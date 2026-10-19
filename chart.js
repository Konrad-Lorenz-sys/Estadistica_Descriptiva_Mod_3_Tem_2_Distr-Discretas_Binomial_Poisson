(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let nextId = 0;
  function element(name, attrs = {}, content) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (content !== undefined) node.textContent = content;
    return node;
  }
  class DistributionChart {
    constructor(container, { onSelect, compact = false, label = 'Distribución de probabilidad' } = {}) {
      this.onSelect = onSelect;
      this.compact = compact;
      this.width = compact ? 350 : 820;
      this.height = compact ? 245 : 365;
      this.margin = { left: compact ? 40 : 58, right: 24, top: 36, bottom: 48 };
      this.bars = new Map();
      this.dots = new Map();
      this.focusedX = 0;
      const id = 'chart-description-' + nextId++;
      this.svg = element('svg', { class: 'chart', viewBox: `0 0 ${this.width} ${this.height}`, role: onSelect ? 'group' : 'img', 'aria-label': label, 'aria-describedby': id });
      this.description = element('desc', { id });
      this.grid = element('g', { 'aria-hidden': 'true' });
      this.axes = element('g', { 'aria-hidden': 'true' });
      this.barGroup = element('g');
      this.line = element('path', { class: 'poisson-line', 'aria-hidden': 'true' });
      this.dotGroup = element('g', { 'aria-hidden': 'true' });
      this.mean = element('line', { class: 'mean-line', 'aria-hidden': 'true' });
      this.meanLabel = element('text', { class: 'mean-label', 'aria-hidden': 'true' });
      this.svg.append(this.description, this.grid, this.axes, this.barGroup, this.line, this.dotGroup, this.mean, this.meanLabel);
      container.append(this.svg);
    }
    createBar(x) {
      const group = element('g', { class: 'bar-item', 'data-x': x });
      const bar = element('rect', { class: 'bar', rx: 2 });
      const hit = element('rect', { class: 'hit' });
      const title = element('title');
      group.append(bar, hit, title);
      if (this.onSelect) {
        group.setAttribute('role', 'button');
        group.addEventListener('click', () => { this.setFocus(x, false); this.onSelect(x); });
        group.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.onSelect(x); }
          const moves = { ArrowRight: x + 1, ArrowLeft: x - 1, Home: 0, End: this.maxX };
          if (event.key in moves) { event.preventDefault(); this.setFocus(Math.max(0, Math.min(this.maxX, moves[event.key])), true); }
        });
      }
      this.barGroup.append(group);
      return { group, bar, hit, title };
    }
    setFocus(x, move) {
      this.focusedX = x;
      this.bars.forEach((entry, key) => { if (this.onSelect) entry.group.setAttribute('tabindex', key === x ? '0' : '-1'); });
      if (move) this.bars.get(x)?.group.focus();
    }
    update(values, { mean, event, selected = null, overlay = null, xLabel = 'Número de éxitos X', fixedMaxX, fixedMaxY, description = '' } = {}) {
      const { left, right, top, bottom } = this.margin;
      const plotWidth = this.width - left - right;
      const baseline = this.height - bottom;
      const plotHeight = baseline - top;
      const maxX = fixedMaxX ?? Math.max(values.length - 1, overlay ? overlay.length - 1 : 0);
      this.maxX = maxX;
      const maxValue = Math.max(...values, ...(overlay || []));
      const maxY = fixedMaxY ?? Math.min(1, Math.ceil(maxValue * 1.15 * 100) / 100);
      const step = plotWidth / (maxX + 1);
      const px = x => left + (x + .5) * step;
      const py = value => baseline - value / maxY * plotHeight;
      this.description.textContent = `${description} Se muestran X de 0 a ${maxX}. Media ${Statistics.formatNumber(mean)}. ${this.onSelect ? 'Usa las flechas izquierda y derecha para recorrer las barras; Enter o espacio para seleccionar. La tabla ofrece los mismos datos.' : ''}`;
      const axisKey = `${maxX}:${maxY}`;
      if (axisKey !== this.axisKey) {
        this.axisKey = axisKey;
        this.grid.replaceChildren();
        this.axes.replaceChildren();
        for (let i = 0; i <= 4; i++) {
          const y = baseline - i / 4 * plotHeight;
          this.grid.append(element('line', { x1: left, x2: this.width - right, y1: y, y2: y, class: 'grid-line' }));
          this.axes.append(element('text', { x: left - 8, y: y + 4, 'text-anchor': 'end' }, Statistics.formatNumber(maxY * i / 4, 3)));
        }
        const labelStep = maxX <= (this.compact ? 8 : 20) ? 1 : maxX <= 50 ? 5 : maxX <= 100 ? 10 : 25;
        for (let x = 0; x <= maxX; x++) {
          if (x % labelStep !== 0 && x !== maxX) continue;
          if (x !== maxX && x > maxX - labelStep * .55) continue;
          this.axes.append(element('text', { x: px(x), y: baseline + 21, 'text-anchor': 'middle' }, String(x)));
        }
        this.axes.append(element('line', { x1: left, x2: this.width - right, y1: baseline, y2: baseline, class: 'axis-line' }));
        this.axes.append(element('text', { x: left, y: 17 }, 'P(X = x)'));
        this.axes.append(element('text', { x: left + plotWidth / 2, y: this.height - 6, 'text-anchor': 'middle' }, xLabel));
      }
      const count = Math.min(maxX + 1, values.length);
      this.bars.forEach((entry, x) => { if (x >= count) { entry.group.remove(); this.bars.delete(x); } });
      for (let x = 0; x < count; x++) {
        let entry = this.bars.get(x);
        if (!entry) { entry = this.createBar(x); this.bars.set(x, entry); }
        const included = event ? Statistics.isIncluded(x, event) : true;
        const isSelected = selected === x;
        entry.group.setAttribute('class', `bar-item${included ? ' included' : ''}${isSelected ? ' selected' : ''}`);
        const attrs = { x: px(x) - step * .34, y: py(values[x]), width: Math.max(.5, step * .68), height: baseline - py(values[x]) };
        Object.entries(attrs).forEach(([key, value]) => entry.bar.setAttribute(key, value));
        // Full-height hit regions keep even zero-probability bars selectable.
        Object.entries({ x: px(x) - step * .5, y: top, width: step, height: plotHeight }).forEach(([key, value]) => entry.hit.setAttribute(key, value));
        const label = `X = ${x}; P(X = ${x}) = ${Statistics.formatProbability(values[x])}${event && included ? '; incluido en el evento' : ''}${isSelected ? '; seleccionado' : ''}`;
        entry.title.textContent = label;
        if (this.onSelect) { entry.group.setAttribute('aria-label', label); entry.group.setAttribute('aria-pressed', String(isSelected)); }
      }
      this.setFocus(Math.min(this.focusedX, count - 1), false);
      this.line.setAttribute('d', overlay ? overlay.slice(0, maxX + 1).map((p, x) => `${x ? 'L' : 'M'}${px(x)},${py(p)}`).join(' ') : '');
      this.dots.forEach((dot, x) => { if (!overlay || x > maxX || x >= overlay.length) { dot.remove(); this.dots.delete(x); } });
      if (overlay) overlay.slice(0, maxX + 1).forEach((p, x) => {
        let dot = this.dots.get(x);
        if (!dot) { dot = element('circle', { r: 3.7, class: 'poisson-dot' }); this.dotGroup.append(dot); this.dots.set(x, dot); }
        dot.setAttribute('cx', px(x)); dot.setAttribute('cy', py(p));
      });
      this.mean.setAttribute('x1', px(mean)); this.mean.setAttribute('x2', px(mean));
      this.mean.setAttribute('y1', top); this.mean.setAttribute('y2', baseline);
      this.meanLabel.setAttribute('x', Math.max(left + 30, Math.min(this.width - right - 30, px(mean))));
      this.meanLabel.setAttribute('y', 28); this.meanLabel.setAttribute('text-anchor', 'middle');
      this.meanLabel.textContent = `μ = ${Statistics.formatNumber(mean)}`;
    }
  }
  window.DistributionChart = DistributionChart;
})();
