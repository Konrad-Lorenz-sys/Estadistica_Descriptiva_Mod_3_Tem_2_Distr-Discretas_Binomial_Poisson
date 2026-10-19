(function () {
  'use strict';
  const S = window.Statistics;
  const defaults = {
    binomial: { n: 15, p: .4, event: { type: 'exact', a: 5, b: 8 }, selected: 5 },
    poisson: { lambda: 4, t: 1, event: { type: 'exact', a: 6, b: 8 }, selected: 6 }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const state = { view: 'binomial', binomial: clone(defaults.binomial), poisson: clone(defaults.poisson), compare: 0 };
  const configs = {
    binomial: { title: 'Distribución Binomial', subtitle: 'Éxitos en un número fijo de ensayos', controls: [{ key: 'n', label: 'Número de ensayos (n)', min: 1, max: 100, step: 1 }, { key: 'p', label: 'Probabilidad de éxito (p)', min: 0, max: 1, step: .01 }], presets: [{ n: 15, p: .4 }, { n: 10, p: .3 }, { n: 20, p: .4 }, { n: 20, p: .5 }] },
    poisson: { title: 'Distribución de Poisson', subtitle: 'Eventos durante un intervalo o en una región', controls: [{ key: 'lambda', label: 'Tasa promedio de eventos (λ)', min: .01, max: 20, step: .01 }, { key: 't', label: 'Tamaño del intervalo (t)', min: .1, max: 10, step: .1 }], presets: [.1, 2, 5, 10].map(lambda => ({ lambda, t: 1 })) }
  };
  const comparisons = [{ n: 10, p: .2 }, { n: 20, p: .1 }, { n: 100, p: .02 }];
  const workspace = document.getElementById('workspace');
  let chart, currentValues = [], currentMu = 0;
  const $ = id => document.getElementById(id);
  const f = S.formatNumber, fp = S.formatProbability;
  function parameterControl(control, value) {
    return `<div class="control"><div class="control-top"><label id="label-${control.key}" for="number-${control.key}">${control.label}</label><input id="number-${control.key}" type="number" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}" aria-describedby="parameter-error" inputmode="decimal"></div><input id="range-${control.key}" type="range" aria-labelledby="label-${control.key}" min="${control.min}" max="${control.max}" step="${control.step}" value="${value}"><div class="range-labels"><span>${f(control.min)}</span><span>${f(control.max)}</span></div></div>`;
  }
  function presetsMarkup(kind) {
    return configs[kind].presets.map((preset, i) => `<button class="preset" data-preset="${i}" aria-pressed="false"><strong>${kind === 'binomial' ? 'Estado ' + 'ABCD'[i] : 'λ = ' + f(preset.lambda)}</strong>${kind === 'binomial' ? `n = ${preset.n} · p = ${f(preset.p, 2)}` : 't = 1'}</button>`).join('');
  }
  function eventMarkup(params) {
    return `<div class="event-controls"><h3>Calcular probabilidad</h3><label for="event-type">Tipo de evento</label><select id="event-type"><option value="exact">Exactamente · X = x</option><option value="atleast">Al menos · X ≥ x</option><option value="more">Más de · X > x</option><option value="atmost">Como máximo · X ≤ x</option><option value="less">Menos de · X < x</option><option value="between">Entre · a ≤ X ≤ b</option></select><div class="bounds"><div><label id="a-label" for="event-a">Valor de x</label><input id="event-a" type="number" min="0" step="1" value="${params.event.a}" inputmode="numeric" aria-describedby="event-error"></div><div id="b-control" hidden><label for="event-b">Máximo (b)</label><input id="event-b" type="number" min="0" step="1" value="${params.event.b}" inputmode="numeric" aria-describedby="event-error"></div></div><p class="error" id="event-error" role="status"></p></div>`;
  }
  function theoryMarkup(kind) {
    const binomial = kind === 'binomial';
    return `<details class="theory"><summary>El modelo y sus fórmulas</summary><p>${binomial ? 'X cuenta los éxitos en n ensayos independientes, cada uno con dos resultados posibles y la misma probabilidad de éxito p. Su soporte es X = 0, 1, …, n.' : 'X cuenta eventos en un intervalo o región. Se supone una tasa constante, ocurrencias independientes y una probabilidad despreciable de dos o más eventos en un intervalo suficientemente pequeño. Su soporte es X = 0, 1, 2, …, sin límite superior.'}</p><div class="formula">${binomial ? 'P(X = x) = C(n, x) p<sup>x</sup> (1 − p)<sup>n − x</sup>' : 'P(X = x) = e<sup>−λt</sup> (λt)<sup>x</sup> / x!'}</div><p>${binomial ? 'C(n, x) = n! / [x! (n − x)!] · q = 1 − p<br>μ = np · σ² = npq · σ = √(npq)' : 'λ es una tasa por unidad; t es el tamaño del intervalo en esa misma unidad. Por ejemplo, 4 solicitudes por minuto durante 2 minutos dan μ = 8 solicitudes.<br>μ = λt · σ² = λt · σ = √(λt)'}</p></details>`;
  }
  function mountSimulator() {
    const kind = state.view, params = state[kind], config = configs[kind];
    workspace.innerHTML = `<div class="workspace-grid"><aside class="controls" aria-label="Controles del modelo"><div class="section-title"><h2>Parámetros</h2><button class="reset" id="reset">Restablecer</button></div>${config.controls.map(c => parameterControl(c, params[c.key])).join('')}<div class="derived" id="derived"></div><p class="error" id="parameter-error" role="status"></p><div class="divider"></div><h3>Exploración rápida</h3><div class="presets">${presetsMarkup(kind)}</div><div class="divider"></div>${eventMarkup(params)}</aside><div class="right-column"><div class="metrics" id="metrics" aria-live="polite" aria-atomic="true"></div><section class="chart-card" aria-labelledby="chart-title"><div class="chart-heading"><div><h2 id="chart-title">${config.title}</h2><p id="chart-subtitle">${config.subtitle}</p></div><span class="badge">En tiempo real</span></div><div class="chart-scroll" id="main-chart"></div><div class="legend"><span><i class="swatch active" aria-hidden="true"></i>Incluido en el evento</span><span><i class="swatch" aria-hidden="true"></i>Fuera del evento</span><span><i class="swatch selected" aria-hidden="true"></i>Seleccionado</span><span><i class="swatch mean" aria-hidden="true"></i>Media μ</span></div><p class="chart-instruction">Selecciona una barra para explorarla. Con teclado: flechas ← → y Enter. En pantallas estrechas, desliza la gráfica horizontalmente.</p><p id="tail-note" class="tail-note" ${kind === 'binomial' ? 'hidden' : ''}></p><div class="selection" id="selection" aria-live="polite" aria-atomic="true"></div></section><section class="result" aria-label="Resultado del evento" aria-live="polite" aria-atomic="true"><div><span class="result-label">PROBABILIDAD DEL EVENTO</span><h3 id="event-expression"></h3></div><div class="percentage" id="event-percentage"></div><p class="complement" id="complement"></p><p id="interpretation"></p></section><div class="observation"><strong>Observa</strong><p>${kind === 'binomial' ? 'Modifica n y p y observa qué ocurre con la posición y forma de la distribución.' : 'Modifica λ o t y observa cómo cambia λt y cómo responde la distribución.'}</p></div>${theoryMarkup(kind)}<details class="theory" id="table-details"><summary>Ver tabla de probabilidades</summary><p>Las filas marcadas con ✓ pertenecen al evento activo.${kind === 'poisson' ? ' Se muestra el mismo rango de la gráfica; existen valores posteriores.' : ''}</p><div class="table-wrap"><table><caption class="sr-only">Probabilidades de cada valor de X</caption><thead><tr><th scope="col">X</th><th scope="col">P(X = x)</th><th scope="col">Evento</th></tr></thead><tbody id="probability-table"></tbody></table></div></details>${kind === 'poisson' ? '<details class="mini-section" id="lambda-comparison"><summary>Comparar λ · misma escala, t = 1</summary><p class="help">Compara cómo cambia la distribución para tres tasas. Los ejes tienen la misma escala.</p><div class="mini-grid" id="mini-grid"></div></details>' : ''}</div></div>`;
    chart = new DistributionChart($('main-chart'), { onSelect: selectBar, label: config.title });
    config.controls.forEach(control => ['number', 'range'].forEach(prefix => $(`${prefix}-${control.key}`).addEventListener('input', e => parameterInput(control, e.target))));
    $('event-type').value = params.event.type;
    $('event-type').addEventListener('input', eventInput);
    $('event-a').addEventListener('input', eventInput);
    $('event-b').addEventListener('input', eventInput);
    $('reset').addEventListener('click', () => { state[kind] = clone(defaults[kind]); synchronizeInputs(); update(); });
    document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => { Object.assign(state[kind], config.presets[Number(button.dataset.preset)]); constrainEvent(); synchronizeInputs(); update(); }));
    $('table-details').addEventListener('toggle', () => { if ($('table-details').open) updateTable(); });
    if (kind === 'poisson') mountMiniCharts();
    update();
  }
  function validateNumber(input, min, max, integer = false, step) {
    const value = input.valueAsNumber;
    const valid = input.value.trim() !== '' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isSafeInteger(value)) && (!step || Math.abs(value / step - Math.round(value / step)) < 1e-7);
    input.setAttribute('aria-invalid', String(!valid));
    return valid ? value : null;
  }
  function parameterInput(control, input) {
    const value = validateNumber(input, control.min, control.max, control.key === 'n', control.step);
    if (value === null) {
      $('parameter-error').textContent = `${control.label}: usa ${control.key === 'n' ? 'un entero' : 'un valor'} entre ${f(control.min)} y ${f(control.max)}, en pasos de ${f(control.step)}. Se conserva el último estado válido.`;
      return;
    }
    state[state.view][control.key] = value;
    $(`range-${control.key}`).value = value;
    if (input.type === 'range') { $(`number-${control.key}`).value = value; $(`number-${control.key}`).setAttribute('aria-invalid', 'false'); }
    if (!document.querySelector('.control [aria-invalid="true"]')) $('parameter-error').textContent = '';
    constrainEvent();
    update();
  }
  function constrainEvent() {
    const params = state[state.view];
    if (state.view === 'binomial') {
      const before = clone(params.event);
      params.event.a = Math.min(params.event.a, params.n);
      params.event.b = Math.max(params.event.a, Math.min(params.event.b, params.n));
      if (params.selected !== null) params.selected = Math.min(params.selected, params.n);
      if (before.a !== params.event.a || before.b !== params.event.b) {
        $('event-a').value = params.event.a; $('event-b').value = params.event.b;
        $('event-a').setAttribute('aria-invalid', 'false'); $('event-b').setAttribute('aria-invalid', 'false');
        $('event-error').textContent = 'El evento se ajustó al nuevo número de ensayos.';
      }
    }
  }
  function synchronizeInputs() {
    const params = state[state.view];
    configs[state.view].controls.forEach(c => ['range', 'number'].forEach(prefix => { const input = $(`${prefix}-${c.key}`); input.value = params[c.key]; input.setAttribute('aria-invalid', 'false'); }));
    $('event-type').value = params.event.type;
    $('event-a').value = params.event.a; $('event-b').value = params.event.b;
    $('event-a').setAttribute('aria-invalid', 'false'); $('event-b').setAttribute('aria-invalid', 'false');
    $('event-error').textContent = ''; $('parameter-error').textContent = '';
  }
  function eventInput() {
    const params = state[state.view], type = $('event-type').value;
    const max = state.view === 'binomial' ? params.n : Number.MAX_SAFE_INTEGER - 1;
    const a = validateNumber($('event-a'), 0, max, true);
    const b = type === 'between' ? validateNumber($('event-b'), 0, max, true) : params.event.b;
    $('b-control').hidden = type !== 'between';
    $('a-label').textContent = type === 'between' ? 'Mínimo (a)' : 'Valor de x';
    if (a === null || b === null || (type === 'between' && a > b)) {
      if (a !== null && b !== null && a > b) $('event-b').setAttribute('aria-invalid', 'true');
      $('event-error').textContent = `Usa valores enteros ${state.view === 'binomial' ? 'entre 0 y ' + params.n : 'mayores o iguales a 0'}${type === 'between' ? ', con a ≤ b' : ''}. Se conserva el último evento válido.`;
      return;
    }
    params.event = { type, a, b };
    $('event-error').textContent = '';
    update(false);
  }
  function selectBar(x) {
    state[state.view].selected = x;
    update(false);
  }
  function expression(event) {
    const operators = { exact: '=', atleast: '≥', more: '>', atmost: '≤', less: '<' };
    return event.type === 'between' ? `P(${event.a} ≤ X ≤ ${event.b})` : `P(X ${operators[event.type]} ${event.a})`;
  }
  function describeEvent(event) {
    return event.type === 'between' ? `entre ${event.a} y ${event.b} (ambos incluidos)` : `${{ exact: 'exactamente', atleast: 'al menos', more: 'más de', atmost: 'como máximo', less: 'menos de' }[event.type]} ${event.a}`;
  }
  function metric(label, value, formula) { return `<div class="metric"><span>${label}</span><strong>${f(value)}</strong><small>${formula}</small></div>`; }
  function update(recalculate = true) {
    const kind = state.view, params = state[kind], binomial = kind === 'binomial';
    currentMu = binomial ? params.n * params.p : params.lambda * params.t;
    if (recalculate) currentValues = binomial ? S.binomialDistribution(params.n, params.p) : S.poissonDistribution(currentMu);
    const variance = binomial ? currentMu * (1 - params.p) : currentMu;
    $('metrics').innerHTML = metric('Media · μ', currentMu, binomial ? 'μ = np' : 'μ = λt') + metric('Varianza · σ²', variance, binomial ? 'σ² = npq' : 'σ² = λt') + metric('Desviación · σ', Math.sqrt(variance), binomial ? 'σ = √(npq)' : 'σ = √(λt)');
    $('derived').innerHTML = binomial ? `<span>Probabilidad de fracaso</span><strong>q = ${f(1 - params.p, 2)}</strong>` : `<span>Media del intervalo</span><strong>λt = ${f(currentMu)}</strong>`;
    $('chart-subtitle').textContent = binomial ? `n = ${params.n} · p = ${f(params.p, 2)} · q = ${f(1 - params.p, 2)}` : `λ = ${f(params.lambda)} por unidad · t = ${f(params.t)} · λt = ${f(currentMu)}`;
    document.querySelectorAll('[data-preset]').forEach(button => { const preset = configs[kind].presets[Number(button.dataset.preset)]; button.setAttribute('aria-pressed', String(Object.keys(preset).every(k => params[k] === preset[k]))); });
    if (binomial) { $('event-a').max = params.n; $('event-b').max = params.n; }
    if ($('event-type').value === params.event.type) { $('b-control').hidden = params.event.type !== 'between'; $('a-label').textContent = params.event.type === 'between' ? 'Mínimo (a)' : 'Valor de x'; }
    const result = S.calculateEventProbability(kind, params, params.event);
    const description = `${expression(params.event)} = ${fp(result)}.`;
    chart.update(currentValues, { mean: currentMu, event: params.event, selected: params.selected, xLabel: binomial ? 'Número de éxitos X' : 'Número de eventos X', description });
    const selectedP = binomial ? S.binomialPMF(params.n, params.p, params.selected) : S.poissonPMF(currentMu, params.selected);
    $('selection').innerHTML = `<span>Barra seleccionada <strong>X = ${params.selected}</strong>${params.selected >= currentValues.length ? ' · fuera del rango visual' : ''}</span><strong>P(X = ${params.selected}) = ${fp(selectedP)}</strong>`;
    $('event-expression').textContent = `${expression(params.event)} = ${fp(result)}`;
    $('event-percentage').textContent = result > 0 && result < .000001 ? `${(result * 100).toExponential(2).replace('.', ',')} %` : `≈ ${f(result * 100, 2)} %`;
    $('interpretation').textContent = `La probabilidad de ${binomial ? 'obtener' : 'registrar'} ${describeEvent(params.event)} ${binomial ? 'éxitos en ' + params.n + ' ensayos' : 'eventos durante el intervalo analizado (t = ' + f(params.t) + ')'} es ${fp(result)}.`;
    const complement = params.event.type === 'atleast' ? `P(X ≥ ${params.event.a}) = 1 − P(X ≤ ${params.event.a - 1})` : params.event.type === 'more' ? `P(X > ${params.event.a}) = 1 − P(X ≤ ${params.event.a})` : '';
    $('complement').textContent = complement; $('complement').hidden = !complement;
    if (!binomial) $('tail-note').textContent = `La distribución continúa para valores mayores de X; la gráfica muestra el rango relevante para la visualización (0–${currentValues.length - 1}). El cálculo del evento incluye la cola completa, hasta la precisión numérica.`;
    if ($('table-details').open) updateTable();
  }
  function updateTable() {
    const event = state[state.view].event;
    $('probability-table').innerHTML = currentValues.map((p, x) => `<tr class="${S.isIncluded(x, event) ? 'event-row' : ''}"><td>${x}</td><td>${fp(p)}</td><td>${S.isIncluded(x, event) ? '✓ Incluido' : '—'}</td></tr>`).join('');
  }
  function mountMiniCharts() {
    const rates = [.1, 2, 5], values = rates.map(S.poissonDistribution);
    const maxX = Math.max(...values.map(v => v.length - 1));
    rates.forEach((rate, i) => {
      const article = document.createElement('article');
      article.innerHTML = `<h3>λ = ${f(rate)}</h3><p>μ = σ² = ${f(rate)} · t = 1</p><div></div>`;
      $('mini-grid').append(article);
      new DistributionChart(article.querySelector('div'), { compact: true, label: `Comparación Poisson, lambda ${f(rate)}` }).update(values[i], { mean: rate, fixedMaxX: maxX, fixedMaxY: 1, xLabel: 'Número de eventos X', description: 'Poisson con t = 1. Escalas idénticas en las tres gráficas.' });
    });
  }
  function mountComparison() {
    workspace.innerHTML = `<div class="workspace-grid"><aside class="controls"><div class="section-title"><h2>Aproximación</h2><span class="section-number">np constante</span></div><p class="help">Aumenta n y reduce p manteniendo la misma media. Compara las barras con los puntos.</p><div class="divider"></div><div class="comparison-presets">${comparisons.map((c, i) => `<button class="preset" data-comparison="${i}" aria-pressed="false"><strong>${i + 1}. ${['Punto de partida', 'Más ensayos', 'Eventos poco frecuentes'][i]}</strong>n = ${c.n} · p = ${f(c.p, 2)}</button>`).join('')}</div><div class="divider"></div><h3>Media compartida</h3><p class="constant">np = 2</p><p class="help">μ Poisson = 2 · t = 1 · λ = 2</p><p class="help">Compartir la media no implica que las distribuciones sean iguales.</p></aside><div class="right-column"><div class="metrics" id="comparison-metrics" aria-live="polite"></div><section class="chart-card"><div class="chart-heading"><div><h2>Binomial y Poisson, en el mismo eje</h2><p id="comparison-subtitle"></p></div><span class="badge">μ = 2</span></div><div class="chart-scroll" id="comparison-chart"></div><div class="legend"><span><i class="swatch active" aria-hidden="true"></i>Binomial · barras</span><span><i class="swatch poisson" aria-hidden="true"></i>Poisson · puntos y línea</span><span><i class="swatch mean" aria-hidden="true"></i>Media μ</span></div><p class="tail-note">Vista ampliada del rango 0–12 para distinguir las formas. Binomial tiene soporte 0–n; Poisson continúa sin límite superior. La línea solo conecta probabilidades en valores enteros.</p></section><section class="comparison-note" aria-live="polite"><h3>Una aproximación, no una igualdad</h3><p id="comparison-explanation"></p></section><div class="observation"><strong>Observa</strong><p>Recorre las tres configuraciones. ¿Qué ocurre con la distancia entre las barras y los puntos cuando aumenta n?</p></div></div></div>`;
    chart = new DistributionChart($('comparison-chart'), { label: 'Comparación de Binomial y Poisson con media 2' });
    document.querySelectorAll('[data-comparison]').forEach(button => button.addEventListener('click', () => { state.compare = Number(button.dataset.comparison); updateComparison(); }));
    updateComparison();
  }
  function updateComparison() {
    const params = comparisons[state.compare];
    document.querySelectorAll('[data-comparison]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.comparison) === state.compare)));
    $('comparison-metrics').innerHTML = metric('Media compartida', 2, 'np = μ Poisson = 2') + metric('Varianza Binomial', 2 * (1 - params.p), 'σ² = np(1 − p)') + metric('Varianza Poisson', 2, 'σ² = μ');
    $('comparison-subtitle').textContent = `Binomial: n = ${params.n}, p = ${f(params.p, 2)} · Poisson: μ = 2`;
    chart.update(S.binomialDistribution(params.n, params.p), { mean: 2, overlay: S.poissonDistribution(2), fixedMaxX: 12, fixedMaxY: .35, xLabel: 'Número de éxitos o eventos X', description: `Binomial con n = ${params.n} y p = ${f(params.p)} frente a Poisson con media 2. Varianzas ${f(2 * (1 - params.p))} y 2 respectivamente.` });
    $('comparison-explanation').textContent = `Con n = ${params.n} y p = ${f(params.p, 2)}, ambas medias son 2, pero las varianzas son ${f(2 * (1 - params.p))} y 2. Al aumentar n y disminuir p manteniendo np constante, la distribución Binomial se aproxima a Poisson. En esta configuración las probabilidades siguen siendo distintas.`;
  }
  function changeView(view) {
    state.view = view;
    document.querySelectorAll('[data-view]').forEach(button => { button.setAttribute('aria-selected', String(button.dataset.view === view)); button.tabIndex = button.dataset.view === view ? 0 : -1; });
    workspace.setAttribute('aria-labelledby', `tab-${view}`);
    if (view === 'compare') mountComparison(); else mountSimulator();
  }
  const tabs = [...document.querySelectorAll('[data-view]')];
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => changeView(button.dataset.view));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); tabs[next].focus(); changeView(tabs[next].dataset.view); }
    });
  });
  mountSimulator();
})();
