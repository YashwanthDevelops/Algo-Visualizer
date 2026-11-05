import {escapeHTML as e, labels} from './core.js';
import {pseudocode, scoreChart} from './renderers.js';
import {conflicts} from './algorithms/optimization.js';

// Vector artwork uses a classical queen silhouette, with consistent cell insets.
const queen = '<svg x="5" y="4" width="38" height="40" viewBox="0 0 100 100" aria-hidden="true"><g fill="currentColor" stroke="#18201c" stroke-width="2" stroke-linejoin="round"><circle cx="16" cy="23" r="6"/><circle cx="35" cy="16" r="6"/><circle cx="50" cy="10" r="6"/><circle cx="65" cy="16" r="6"/><circle cx="84" cy="23" r="6"/><path d="M17 28 28 55H72L83 28 66 42 64 22 51 39 36 22 34 42Z"/><path d="M29 57H71L66 65H34Z M35 67H65L70 80H30Z M27 82H73L79 91H21Z"/></g></svg>';
export function queensStudySVG(q, interactive = true, candidate = null) {
  const n=q.length, size=n*48;
  let cells='';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)cells+=`<g class="nq-cell" ${interactive?`id="nq-cell-${r}-${c}" data-nq-cell="${r*n+c}" role="button" tabindex="${r===0&&c===0?0:-1}" aria-label="Row ${r+1}, column ${c+1}"`:''}><rect x="${c*48}" y="${r*48}" width="48" height="48" class="${(r+c)%2?'light':'dark'}"/></g>`;
  const coordinates=Array.from({length:n},(_,i)=>`<text class="nq-coordinate" x="${i*48+24}" y="-6" text-anchor="middle">${i+1}</text><text class="nq-coordinate" x="-9" y="${i*48+28}" text-anchor="middle">${i+1}</text>`).join('');
  return `<svg class="nq-board" viewBox="-18 -18 ${size+36} ${size+36}" preserveAspectRatio="xMidYMid meet" role="${interactive?'group':'img'}" aria-label="${n} by ${n} N-Queens board">${coordinates}<g>${cells}</g><rect class="nq-proposal" x="${(candidate?.col||0)*48+2}" y="${(candidate?.row||0)*48+2}" width="44" height="44" rx="3" ${!candidate||candidate.row===q[candidate.col]?'hidden':''}/>${q.map((r,c)=>`<g class="nq-queen" data-queen="${c}" style="transform:translate(${c*48}px,${r*48}px)">${queen}</g>`).join('')}</svg>`;
}
const number=(name,key,value,min,max,step=1)=>`<div class="field pf-number-field"><label for="${key}">${name}</label><div class="pf-number-control"><button type="button" class="pf-number-step" data-number-step="-1" aria-label="Decrease ${name.toLowerCase()}" ${value<=min?'disabled':''}>−</button><input id="${key}" data-param="${key}" type="number" inputmode="${step<1?'decimal':'numeric'}" value="${value}" min="${min}" max="${max}" step="${step}"><button type="button" class="pf-number-step" data-number-step="1" aria-label="Increase ${name.toLowerCase()}" ${value>=max?'disabled':''}>+</button></div></div>`;

export function nqueensPage({c, playback, selectField, icon, comparisonControls, comparisons, guide}) {
  const anneal=c.algorithm==='anneal';
  const code=pseudocode.optimization(c.algorithm).slice();
  if(!anneal)code[2]='if stuck: sideways, restart, or stop';
  code[4]='stop at solution; recover exactly if stalled';
  return `<section class="pf-page nq-page" aria-labelledby="pf-title">
    <header class="pf-heading"><div><h1 id="pf-title">N-Queens</h1><p>Place one queen in each column. Explore how local search reduces conflicts.</p></div><div class="pf-save"><button data-action="save-setup">Save setup</button><button data-action="share-setup" aria-label="Share setup">Share</button></div></header>
    <div class="pf-setup nq-setup"><div class="pf-selectors">${selectField('Algorithm','algorithm',['hill','anneal'],c.algorithm)}${selectField('Arrangement','arrangement',[['random','Seeded random'],['aligned','All in row 1'],['stalled','Plateau · N = 4'],['local','Local minimum · N = 8'],['solved','Solved · N = 4'],['custom','Custom board']],c.arrangement||'custom')}${number('Board size','size',c.problem.queens.length,4,12)}</div><button id="run" class="pf-primary" data-action="run"><span class="button-text">Run search</span></button></div>
    <div id="error-slot" role="alert"></div>
    <div class="pf-workspace"><section class="nq-map-column" aria-label="Chessboard and playback">
      <div class="nq-board-frame"><div class="nq-board-topline"><span>One queen per column</span><span data-nq="board-size"></span></div><div id="visualization" class="nq-board-space">${queensStudySVG(c.problem.queens)}</div><div class="pf-loading-overlay" hidden role="status"><span class="pf-loading-dot" aria-hidden="true"></span>Preparing the search…</div></div>
      <div class="pf-playback"><button class="pf-play" id="pf-play" data-action="run" aria-label="Play search">${icon('play')}</button><button id="pause" class="pf-play" data-action="pause" aria-label="Pause search">${icon('pause')}</button><button id="previous" data-action="previous" aria-label="Previous step">${icon('skip-back')}</button><button id="next" data-action="next" aria-label="Next step">${icon('skip-forward')}</button><input id="scrub" type="range" min="0" max="0" value="0" aria-label="Seek recorded decision"><span id="step-count">0 / 0</span></div>
      <div class="nq-summary">${[['currentScore','Current conflicts'],['bestScore','Best conflicts'],['iterations','Iteration'],['candidateEvaluations','Evaluations']].map(([key,name])=>`<div><span>${name}</span><strong data-nq="${key}">—</strong></div>`).join('')}</div>
      <div class="nq-chart" aria-label="Current and best conflicts by iteration"></div><p id="trace-gap-label" class="pf-trace-gap"></p>
    </section><aside class="pf-notebook" aria-labelledby="pf-notebook-title"><h2 id="pf-notebook-title">Decision notebook</h2><p id="pf-step-label">Choose a board and begin</p><div id="explanation"><p class="pf-rule">${anneal?'Annealing samples a move and may accept more conflicts to escape a local minimum.':'Hill climbing evaluates the alternatives and takes the best improving move.'}</p><div class="pf-current"><p class="pf-event" data-nq="event">Ready to explore</p><p class="pf-reason" data-nq="reason">Run the search to follow its first decision.</p></div><dl class="nq-decision-values"><dt>Proposed move</dt><dd data-nq="candidate">—</dd><dt>Conflict change</dt><dd data-nq="delta">—</dd>${anneal?'<dt>Temperature</dt><dd data-nq="temperature">—</dd><dt>Acceptance probability</dt><dd data-nq="probability">—</dd><dt>Seeded random draw</dt><dd data-nq="draw">—</dd>':'<dt>Candidate conflicts</dt><dd data-nq="candidateScore">—</dd>'}</dl></div><section class="pf-code"><h3>Algorithm steps</h3><ol class="pf-code-lines">${code.map((line,i)=>`<li data-line="${i}"><span>${i+1}</span><code>${e(line)}</code></li>`).join('')}</ol></section><span id="run-status" class="pf-status">One queen per column · zero conflicts solves the board</span></aside></div>
    <div class="pf-tools">
      <details id="pf-editor"><summary>Edit board</summary><div class="pf-tool-content"><p>Click a square to move the queen in that column. Editing a square starts a fresh search.</p>${number('Random seed','seed',c.seed,0,4294967295)}<div class="field"><label for="queen-rows">Rows by column</label><input id="queen-rows" value="${c.problem.queens.map(r=>r+1).join(', ')}" aria-describedby="queen-help"><small id="queen-help">One row from 1 to ${c.problem.queens.length} for each column.</small><button data-action="apply-queens">Apply rows</button></div><p class="nq-editor-state" aria-live="polite">Board editing is active.</p></div></details>
      <details id="pf-advanced"><summary>Advanced settings</summary><div class="pf-tool-content">${anneal?number('Initial temperature','temperature',c.temperature,.001,1000,.1)+number('Cooling multiplier','cooling',c.cooling,.001,.9999,.001):number('Sideways moves','sidewaysLimit',c.sidewaysLimit||0,0,100)+number('Restarts','restarts',c.restarts||0,0,20)}${number('Iteration limit','limit',c.limit,1,1000000)}<label for="speed">Playback speed <span id="speed-label">${playback.speed} steps/s</span><input id="speed" type="range" min="1" max="30" value="${playback.speed}"></label><div class="pf-key-events"><button data-action="jump-prev">Previous key event</button><button data-action="jump-next">Next key event</button></div>${guide}</div></details>
      <details id="nq-candidates"><summary>Candidates</summary><div class="pf-tool-content"><p>${anneal?'The proposed move for this recorded step.':'Moves evaluated in this iteration, in their recorded order.'}</p><div class="nq-candidate-list"></div></div></details>
      <details id="pf-comparisons"><summary>Compare runs</summary><div class="pf-tool-content"><section class="pf-compare-all"><div><h3>Compare both algorithms</h3><p>Use the same starting boards and seeds for paired trials.</p></div><button data-action="compare">Compare algorithms</button></section>${selectField('Starting boards','trialStarts',[['current','Current board'],['random','Paired random boards']],c.trialStarts)}<section class="pf-compare-traces"><h3>Compare two traces</h3>${comparisonControls}</section>${comparisons}</div></details>
      <details id="pf-details"><summary>Run details</summary><div class="pf-tool-content"><h3>Selected replay step</h3><div id="metrics" class="metrics"></div><h3>Complete run</h3><div class="nq-final-metrics metrics"></div><p class="nq-final-note"></p>${guide}</div></details>
      <details id="pf-shortcuts"><summary>Keyboard shortcuts</summary><div class="pf-tool-content"><dl><dt>Play / pause</dt><dd>Space</dd><dt>Previous / next</dt><dd>← / →</dd><dt>Previous / next key event</dt><dd>J / K</dd><dt>Navigate board</dt><dd>Arrow keys</dd><dt>Move queen while editing</dt><dd>Enter / Space</dd></dl></div></details>
    </div><div class="pf-reset-row"><button id="reset" data-action="reset">Reset</button><span>Zero attacking pairs is a solution. If local search stalls, exact completion finds a valid board.</span></div><span id="event-progress" hidden>0</span><span id="playback-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>
  </section>`;
}

const print=n=>Number.isFinite(n)?Number(n.toFixed(4)).toString():'—';
export function mountNQueensRenderer(root, {edit}) {
  const abort=new AbortController(), signal=abort.signal;
  const svg=root.querySelector('.nq-board'), pieces=[...svg.querySelectorAll('.nq-queen')], proposal=svg.querySelector('.nq-proposal');
  const cells=[...svg.querySelectorAll('.nq-cell')], n=pieces.length;
  let previousIndex=-1, previousSteps=null, lastChart='';
  const set=(key,value)=>{const el=root.querySelector(`[data-nq="${key}"]`);if(el&&el.textContent!==String(value))el.textContent=value;};
  function apply(cell){if(root.dataset.tool==='pf-editor'&&root.dataset.locked==='false')edit(Math.floor(+cell.dataset.nqCell/n),+cell.dataset.nqCell%n);}
  svg.addEventListener('click',event=>{const cell=event.target.closest('[data-nq-cell]');if(cell)apply(cell);},{signal});
  svg.addEventListener('keydown',event=>{
    const cell=event.target.closest('[data-nq-cell]');if(!cell)return;
    const id=+cell.dataset.nqCell,r=Math.floor(id/n),c=id%n;
    const shifts={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
    if(shifts[event.key]){event.preventDefault();const [dr,dc]=shifts[event.key];const next=cells[Math.max(0,Math.min(n-1,r+dr))*n+Math.max(0,Math.min(n-1,c+dc))];cells.forEach(el=>el.tabIndex=-1);next.tabIndex=0;next.focus({preventScroll:true});}
    else if(['Enter',' '].includes(event.key)){event.preventDefault();apply(cell);}
  },{signal});
  return {destroy(){abort.abort();},update({c,frame,playback,busy,result}) {
    const s=frame?.state, q=s?.queens||c.problem.queens, m=frame?.metrics||{}, candidate=s?.candidate;
    const stamp=frame?String(frame.eventIndex):'ready';
    root.dataset.executionStep=stamp;svg.dataset.executionStep=stamp;
    root.querySelector('#explanation').dataset.executionStep=stamp;root.querySelector('.pf-code').dataset.executionStep=stamp;
    root.dataset.locked='false';
    const animate=playback.timer&&playback.steps===previousSteps&&playback.index===previousIndex+1&&['improve','accept','sideways','recovery'].includes(frame?.event);
    root.style.setProperty('--nq-motion',`${animate?Math.min(100,Math.floor(450/playback.speed)):0}ms`);
    pieces.forEach((piece,col)=>{piece.style.transform=`translate(${col*48}px,${q[col]*48}px)`;piece.dataset.row=q[col];});
    cells.forEach((cell,id)=>{cell.setAttribute('aria-label',`Row ${Math.floor(id/n)+1}, column ${id%n+1}${q[id%n]===Math.floor(id/n)?', queen':''}`);});
    proposal.toggleAttribute('hidden',!candidate||candidate.row===q[candidate.col]);
    if(!proposal.hasAttribute('hidden')){proposal.setAttribute('x',candidate.col*48+2);proposal.setAttribute('y',candidate.row*48+2);proposal.dataset.rejected=String(frame.event==='reject');}
    svg.setAttribute('aria-label',`${n} by ${n} board. Queen rows by column: ${q.map(r=>r+1).join(', ')}. ${s?.score??conflicts(q)} attacking pairs.`);
    set('board-size',`${n} × ${n}`);set('event',busy?'Preparing search':frame?.event.replaceAll('-',' ')||'Ready to explore');
    set('reason',busy?'The board stays in place while your search is computed.':frame?.reason||'Run the search, or step forward to inspect its first decision.');
    set('candidate',candidate?`Column ${candidate.col+1} → row ${candidate.row+1}`:'—');
    set('delta',Number.isFinite(candidate?.delta)?`${candidate.delta>0?'+':''}${candidate.delta}`:'—');set('candidateScore',print(candidate?.score));
    set('temperature',print(s?.temperature));set('probability',print(candidate?.probability));set('draw',candidate?.draw===null?'Not needed':print(candidate?.draw));
    for(const key of ['currentScore','bestScore','iterations','candidateEvaluations'])set(key,frame?print(m[key]):key==='currentScore'||key==='bestScore'?conflicts(q):'—');
    root.querySelectorAll('.pf-code-lines li').forEach((line,i)=>{const active=!busy&&frame?.line===i;line.classList.toggle('is-active',active);if(active)line.setAttribute('aria-current','step');else line.removeAttribute('aria-current');});
    root.querySelector('.pf-loading-overlay').hidden=!busy;
    root.querySelector('.nq-board-frame').setAttribute('aria-busy',String(busy));
    root.querySelector('#run-status').textContent=busy?'Computing…':frame===playback.steps.at(-1)&&frame?(result?.status==='solved-after-recovery'?'Solution found · exact completion':`Search ${frame.event.replaceAll('-',' ')}`):'Zero conflicts solves the board';
    const chart=JSON.stringify(s?.chart||[{iteration:0,score:conflicts(q),best:conflicts(q)}]);
    if(chart!==lastChart){root.querySelector('.nq-chart').innerHTML=scoreChart(JSON.parse(chart));lastChart=chart;}
    const keys=c.algorithm==='hill'?['candidateEvaluations','iterations','currentScore','bestScore','sidewaysMoves','restarts','recoveryEvaluations']:['candidateEvaluations','iterations','currentScore','bestScore','worseAccepted','recoveryEvaluations'];
    const names={candidateEvaluations:'Evaluations',iterations:'Iterations',currentScore:'Current conflicts',bestScore:'Best conflicts',sidewaysMoves:'Sideways moves',restarts:'Restarts',worseAccepted:'Worse moves accepted',recoveryEvaluations:'Exact recovery checks'};
    const metrics=values=>keys.map(key=>`<div class="metric"><span>${names[key]}</span><strong>${print(values?.[key])}</strong></div>`).join('');
    if(!root.querySelector('#pf-details').hidden){root.querySelector('#metrics').innerHTML=metrics(frame?.metrics);root.querySelector('.nq-final-metrics').innerHTML=metrics(result?.metrics);root.querySelector('.nq-final-note').textContent=result?`Final outcome: ${result.status.replaceAll('-',' ')}. Exact recovery checks are counted separately. Compute time: ${print(result.metrics.executionMs)} ms.`:'Run the search to record a complete outcome.';}
    if(!root.querySelector('#nq-candidates').hidden)root.querySelector('.nq-candidate-list').innerHTML=(s?.candidates||[]).length?`<table class="compact-table"><thead><tr><th>Move</th><th>Conflicts</th><th>Change</th></tr></thead><tbody>${s.candidates.map(v=>`<tr><td>C${v.col+1} → R${v.row+1}</td><td>${v.score}</td><td>${Number.isFinite(v.delta)?(v.delta>0?'+':'')+v.delta:'—'}</td></tr>`).join('')}</tbody></table>`:'<p>No candidates evaluated at this step.</p>';
    previousIndex=playback.index;previousSteps=playback.steps;
  }};
}
