// One synchronous commit paints graph, explanation, pseudocode and metrics from
// the same recorded frame. Playback never replaces the mounted study panels.
const printable = n => Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '—';
const setText = (node, value) => { if (node && node.textContent !== String(value)) node.textContent = value; };

export function mountPathfindingRenderer(root) {
  const nodes = Object.fromEntries([...root.querySelectorAll('[data-pf]')].map(el => [el.dataset.pf, el]));
  const svg = root.querySelector('.grid-svg');
  const route = document.createElementNS('http://www.w3.org/2000/svg','polyline');
  route.classList.add('pf-route-line');route.setAttribute('aria-hidden','true');
  route.setAttribute('vector-effect','non-scaling-stroke');svg.append(route);
  const cells = [...svg.querySelectorAll('.cell')].map(group => ({group, text:group.querySelector('text')}));
  const lines = [...root.querySelectorAll('.pf-code-lines li')];
  const code = root.querySelector('.pf-code');
  const explanation = root.querySelector('#explanation');
  const overlay = root.querySelector('.pf-loading-overlay');
  const overlayText = overlay.querySelector('span:last-child');
  return {
    update({c, frame, selected, busy, zoom, playback, result}) {
      const p = c.problem, state = frame?.state || {}, metrics = frame?.metrics || {};
      const frontier = new Set((state.frontier || []).map(entry => entry.id));
      const path = new Set(state.path || []);
      const stamp = frame ? String(frame.eventIndex) : 'ready';
      const motion = playback.timer && !busy ? Math.min(110, Math.floor(400 / playback.speed)) : 0;
      root.style.setProperty('--pf-step-duration', `${motion}ms`);
      for (let id = 0; id < cells.length; id++) {
        let cell = cells[id];
        // Pointer painting may replace a single cell; refresh only that handle.
        if (!cell.group.isConnected) {
          const group = svg.querySelector(`[data-cell="${id}"]`);
          cell = cells[id] = {group, text:group.querySelector('text')};
        }
        const kind = id === p.start ? 'start' : id === p.goal ? 'goal' : id === state.current ? 'current' : path.has(id) ? 'path' : frontier.has(id) ? 'frontier' : state.closed?.[id] ? 'expanded' : p.cells[id] === 0 ? 'wall' : p.cells[id] > 1 ? 'weight' : 'empty';
        if (cell.group.dataset.cellState !== kind) cell.group.dataset.cellState = kind;
        const terrain = p.cells[id] === 0 ? 'wall' : p.cells[id] > 1 ? 'weight' : 'plain';
        if(cell.group.dataset.terrain!==terrain)cell.group.dataset.terrain=terrain;
        const endpoint = kind==='start'||kind==='goal';
        const symbol = kind === 'start' ? 'S' : kind === 'goal' ? 'G' : terrain==='weight' ? p.cells[id] : '';
        setText(cell.text, symbol);
        const x=String(id%p.cols*32+(endpoint?16:6));
        const y=String(Math.floor(id/p.cols)*32+(endpoint?21:11));
        if(cell.text.getAttribute('x')!==x)cell.text.setAttribute('x',x);
        if(cell.text.getAttribute('y')!==y)cell.text.setAttribute('y',y);
        const anchor=endpoint?'middle':'start';
        if(cell.text.getAttribute('text-anchor')!==anchor)cell.text.setAttribute('text-anchor',anchor);
        const tab = id === (selected ?? p.start) ? '0' : '-1';
        if (cell.group.getAttribute('tabindex') !== tab) cell.group.setAttribute('tabindex', tab);
        const aria = `Row ${Math.floor(id/p.cols)+1}, column ${id%p.cols+1}; ${id === p.start ? 'start' : id === p.goal ? 'goal' : p.cells[id] === 0 ? 'wall' : `movement cost ${p.cells[id]}`}`;
        if (cell.group.getAttribute('aria-label') !== aria) cell.group.setAttribute('aria-label',aria);
      }
      // The line is derived only from this frame's recorded path. Scrubbing
      // restores or removes it immediately, without a separate animation clock.
      const points=(state.path||[]).map(id=>[id%p.cols*32+16,Math.floor(id/p.cols)*32+16]);
      if(points.length>1){
        const first=points[0],second=points[1],last=points.at(-1),before=points.at(-2);
        points[0]=[first[0]+Math.sign(second[0]-first[0])*11,first[1]+Math.sign(second[1]-first[1])*11];
        points[points.length-1]=[last[0]+Math.sign(before[0]-last[0])*11,last[1]+Math.sign(before[1]-last[1])*11];
      }
      const coordinates=points.length>1?points.map(point=>point.join(',')).join(' '):'';
      if(route.getAttribute('points')!==coordinates)route.setAttribute('points',coordinates);
      const size = `${zoom * 100}%`;
      if (svg.style.width !== size) { svg.style.width = size; svg.style.height = size; }
      setText(nodes.event, busy ? 'Preparing search' : frame?.event?.replaceAll('-', ' ') || 'Ready to explore');
      setText(nodes.reason, busy ? 'Your map stays in place while the search is computed.' : frame?.reason || 'Run the search, or step forward to inspect its first decision.');
      // Current-decision values always follow the trace. A separately selected
      // cell is inspected under Run details, never substituted for the live step.
      const id = state.current;
      const dr = id == null ? 0 : Math.abs(Math.floor(id/p.cols)-Math.floor(p.goal/p.cols));
      const dc = id == null ? 0 : Math.abs(id%p.cols-p.goal%p.cols);
      const h = id == null ? null : (c.heuristic === 'zero' ? 0 : c.heuristic === 'euclidean' ? Math.hypot(dr,dc) : dr+dc)*Math.min(...p.cells.filter(n=>n>0));
      const g = state.g?.[id];
      setText(nodes.cell, id == null ? 'Current cell · —' : `Current cell · row ${Math.floor(id/p.cols)+1}, column ${id%p.cols+1}`);
      setText(nodes.g, printable(g));
      setText(nodes.h, printable(['astar','greedy'].includes(c.algorithm) ? h : id == null ? null : p.cells[id]));
      setText(nodes.f, c.algorithm === 'astar' ? printable(id == null ? null : g+h) : frame ? frontier.size : '—');
      setText(nodes.expanded, printable(metrics.expanded));
      setText(nodes.frontier, frame ? frontier.size : '—');
      setText(nodes.length, printable(metrics.pathLength));
      setText(nodes.cost, printable(metrics.pathCost));
      lines.forEach((line,index) => {
        const active = !busy && index === frame?.line;
        line.classList.toggle('is-active',active);
        if (active) line.setAttribute('aria-current','step'); else line.removeAttribute('aria-current');
      });
      root.dataset.executionStep = stamp;
      svg.dataset.executionStep = stamp;
      code.dataset.executionStep = stamp;
      explanation.dataset.executionStep = stamp;
      root.dataset.running = String(!!playback.timer);
      overlay.hidden = !busy;
      overlay.setAttribute('aria-hidden', String(!busy));
      setText(overlayText, busy ? 'Preparing the search…' : '');
      root.querySelector('.pf-graph-frame').setAttribute('aria-busy',String(busy));
      setText(root.querySelector('#run-status'), busy ? 'Computing…' : !frame ? 'Four-direction movement' : frame === playback.steps.at(-1) ? `Search ${frame.event.replaceAll('-',' ')}` : 'Recorded decision · four-direction movement');
    }
  };
}
