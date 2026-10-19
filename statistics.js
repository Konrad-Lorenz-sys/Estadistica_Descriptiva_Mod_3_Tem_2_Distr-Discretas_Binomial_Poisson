(function (root) {
  'use strict';
  const clampProbability = value => Math.max(0, Math.min(1, value));
  function binomialCoefficient(n, k) {
    if (!Number.isInteger(k) || k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let value = 1;
    for (let i = 1; i <= k; i++) value *= (n - k + i) / i;
    return value;
  }
  function binomialPMF(n, p, x) {
    if (!Number.isInteger(x) || x < 0 || x > n) return 0;
    if (p === 0) return x === 0 ? 1 : 0;
    if (p === 1) return x === n ? 1 : 0;
    return binomialCoefficient(n, x) * p ** x * (1 - p) ** (n - x);
  }
  function binomialDistribution(n, p) {
    return Array.from({ length: n + 1 }, (_, x) => binomialPMF(n, p, x));
  }
  function binomialRangeProbability(n, p, a, b) {
    let sum = 0;
    for (let x = Math.max(0, a); x <= Math.min(n, b); x++) sum += binomialPMF(n, p, x);
    return clampProbability(sum);
  }
  function poissonPMF(mu, x) {
    if (!Number.isSafeInteger(x) || x < 0) return 0;
    if (mu === 0) return x === 0 ? 1 : 0;
    // Recurrence is stable over the supported means (0.001 to 200).
    if (x <= 1000) {
      let value = Math.exp(-mu);
      for (let k = 1; k <= x; k++) value *= mu / k;
      return value;
    }
    // Stirling's expansion avoids a huge loop for distant event bounds.
    const logFactorial = (x + .5) * Math.log(x) - x + .5 * Math.log(2 * Math.PI) + 1 / (12 * x) - 1 / (360 * x ** 3);
    return Math.exp(-mu + x * Math.log(mu) - logFactorial);
  }
  function poissonRangeProbability(mu, a, b = Infinity) {
    a = Math.max(0, a);
    if (a > b) return 0;
    let term = poissonPMF(mu, a), sum = term;
    // Sum the tail itself: 1 - CDF would lose tiny upper-tail probabilities.
    for (let x = a + 1, count = 0; x <= b && count < 10000; x++, count++) {
      term *= mu / x;
      sum += term;
      if (x > mu && (term === 0 || term < sum * 1e-16)) break;
    }
    return clampProbability(sum);
  }
  function poissonDistribution(mu) {
    const values = [Math.exp(-mu)];
    let cumulative = values[0], cutoff = cumulative >= .9999 ? 0 : null;
    for (let x = 1; x < 2000; x++) {
      const term = values[x - 1] * mu / x;
      values.push(term);
      cumulative += term;
      if (cutoff === null && cumulative >= .9999) cutoff = x;
      if (cutoff !== null && x >= Math.max(4, cutoff + 2)) break;
    }
    return values;
  }
  function eventBounds(event) {
    switch (event.type) {
      case 'exact': return [event.a, event.a];
      case 'atleast': return [event.a, Infinity];
      case 'more': return [event.a + 1, Infinity];
      case 'atmost': return [0, event.a];
      case 'less': return [0, event.a - 1];
      case 'between': return [event.a, event.b];
      default: throw new Error('Evento desconocido');
    }
  }
  function calculateEventProbability(kind, params, event) {
    const [a, b] = eventBounds(event);
    return kind === 'binomial' ? binomialRangeProbability(params.n, params.p, a, b) : poissonRangeProbability(params.lambda * params.t, a, b);
  }
  function isIncluded(x, event) {
    const [a, b] = eventBounds(event);
    return x >= a && x <= b;
  }
  function formatNumber(value, digits = 3) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits }).format(value);
  }
  function formatProbability(value) {
    if (value === 0 || value === 1) return String(value);
    if (value < .0001) return value.toExponential(3).replace('.', ',');
    if (value > .99995) return '1 − ' + (1 - value).toExponential(3).replace('.', ',');
    return value.toFixed(4).replace('.', ',');
  }
  const api = { binomialCoefficient, binomialPMF, binomialDistribution, binomialRangeProbability, poissonPMF, poissonDistribution, poissonRangeProbability, eventBounds, calculateEventProbability, isIncluded, formatNumber, formatProbability };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Statistics = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
