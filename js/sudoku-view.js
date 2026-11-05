import {escapeHTML as e} from './core.js';
import {sudokuHTML,pseudocode,metricsHTML} from './renderers.js';

export function sudokuPage({c,playback,selectField,icon,guide,comparisons,comparisonControls}) {
 const forward=c.algorithm==='forward';
 return `<section class="pf-page sudoku-study" aria-labelledby="pf-title">
 <header class="pf-heading"><div><h1 id="pf-title">Sudoku</h1><p>Follow each choice, constraint, and backtrack as the puzzle takes shape.</p></div><div class="pf-save"><button data-action="save-setup">Save setup</button><button data-action="share-setup">Share</button></div></header>
 <div class="pf-setup"><div class="pf-selectors">${selectField('Algorithm','algorithm',['backtracking','forward'],c.algorithm)}${selectField('Puzzle','puzzle',[['easy','Teaching puzzle'],['classic','Classic puzzle'],['invalid','Duplicate clue'],['impossible','No solution'],['custom','Custom puzzle']],c.puzzle||'custom')}</div><button id="run" class="pf-primary" data-action="run"><span class="button-text">Run search</span></button></div><div id="error-slot" role="alert"></div>
 <div class="pf-workspace"><section class="sudoku-map-column" aria-label="Sudoku board and playback"><div class="sudoku-board-frame"><div class="sudoku-topline"><span>Every row, column, and box: 1–9</span><span data-sd="filled">—</span></div><div id="visualization" class="sudoku-board-space">${sudokuHTML(c)}</div><div class="sudoku-legend"><span>Bold · clue</span><span>Small digits · candidates</span><span>Outline · active cell</span></div><div class="pf-loading-overlay" hidden role="status"><span class="pf-loading-dot"></span>Preparing the search…</div></div>
 <div class="pf-playback"><button id="pf-play" class="pf-play" data-action="run" aria-label="Play search">${icon('play')}</button><button id="pause" class="pf-play" data-action="pause" aria-label="Pause search">${icon('pause')}</button><button id="previous" data-action="previous" aria-label="Previous step">${icon('skip-back')}</button><button id="next" data-action="next" aria-label="Next step">${icon('skip-forward')}</button><input id="scrub" type="range" min="0" max="0" value="0" aria-label="Seek recorded decision"><span id="step-count">0 / 0</span></div>
 <div class="sudoku-summary">${[['assigned','Filled cells'],['assignmentsAttempted','Attempts'],['backtracks','Backtracks'],['valuesRemoved','Values removed']].map(([key,name])=>`<div><span>${name}</span><strong data-sd="${key}">—</strong></div>`).join('')}</div><p id="trace-gap-label" class="pf-trace-gap"></p></section>
 <aside class="pf-notebook" aria-labelledby="pf-notebook-title"><h2 id="pf-notebook-title">Decision notebook</h2><p id="pf-step-label">Choose a puzzle and begin</p><div id="explanation"><p class="pf-rule">${forward?'Forward checking removes impossible candidates from related empty cells after each assignment.':'Backtracking tries a value, checks its row, column, and box, then undoes choices when needed.'}</p><div class="pf-current"><p class="pf-event" data-sd="event">Ready to explore</p><p class="pf-reason" data-sd="reason">Run the search to follow its first decision.</p></div><dl class="sudoku-decision"><dt>Active cell</dt><dd data-sd="cell">—</dd><dt>Trying value</dt><dd data-sd="candidate">—</dd><dt>Cell candidates</dt><dd data-sd="domain">—</dd>${forward?'<dt>Removed this step</dt><dd data-sd="removed">—</dd>':''}</dl></div><section class="pf-code"><h3>Algorithm steps</h3><ol class="pf-code-lines">${pseudocode.sudoku(c.algorithm).map((line,i)=>`<li><span>${i+1}</span><code>${e(line)}</code></li>`).join('')}</ol></section><span id="run-status" class="pf-status">Ready</span></aside></div>
 <div class="pf-tools"><details id="pf-editor"><summary>Edit puzzle</summary><div class="pf-tool-content"><p>Enter 1–9 in a square. Delete a digit to clear a clue. Editing starts a fresh search.</p><button data-action="clear-sudoku">Clear all clues</button><p class="hint">Duplicate clues are checked before the search begins.</p></div></details>
 <details id="pf-advanced"><summary>Advanced settings</summary><div class="pf-tool-content">${selectField('Choose next cell','variableOrdering',[['fixed','Fixed row order'],['mrv','Smallest domain (MRV)']],c.variableOrdering||'fixed')}${selectField('Try values','valueOrdering',[['natural','Natural order'],['lcv','Least constraining first']],c.valueOrdering||'natural')}<div class="field pf-number-field"><label for="limit">Search limit</label><div class="pf-number-control"><button class="pf-number-step" data-number-step="-1" aria-label="Decrease search limit">−</button><input id="limit" data-param="limit" type="number" min="1" max="1000000" step="100" value="${c.limit}"><button class="pf-number-step" data-number-step="1" aria-label="Increase search limit">+</button></div></div><label for="speed">Playback speed <span id="speed-label">${playback.speed} steps/s</span><input id="speed" type="range" min="1" max="30" value="${playback.speed}"></label><div class="pf-key-events"><button data-action="jump-prev">Previous key event</button><button data-action="jump-next">Next key event</button></div>${guide}</div></details>
 <details id="pf-comparisons"><summary>Compare runs</summary><div class="pf-tool-content"><section class="pf-compare-all"><div><h3>Compare both algorithms</h3><p>Use the same clues and ordering for both searches.</p></div><button data-action="compare">Compare algorithms</button></section><section class="pf-compare-traces"><h3>Compare two traces</h3>${comparisonControls}</section>${comparisons}</div></details>
 <details id="pf-details"><summary>Run details</summary><div class="pf-tool-content"><h3>Selected replay step</h3><div id="metrics" class="metrics"></div><h3>Complete run</h3><div class="sudoku-final-metrics metrics"></div><p class="sudoku-final-note"></p>${guide}</div></details>
 <details id="pf-shortcuts"><summary>Keyboard shortcuts</summary><div class="pf-tool-content"><dl><dt>Play / pause</dt><dd>Space</dd><dt>Previous / next step</dt><dd>← / →</dd><dt>Previous / next key event</dt><dd>J / K</dd><dt>Move between squares</dt><dd>Arrow keys while editing</dd></dl></div></details></div>
 <div class="pf-reset-row"><button id="reset" data-action="reset">Reset</button><span>Replay decisions in either direction. Edit the starting clues whenever you want.</span></div><span id="event-progress" hidden>0</span><span id="playback-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span></section>`;
}

export function mountSudokuRenderer(root) {
 const inputs=[...root.querySelectorAll('[data-sudoku]')],cells=inputs.map(x=>x.parentElement);
 const abort=new AbortController();
 let previousStamp=null,previousIndex=-1;
 const domains=cells.map(cell=>{const box=document.createElement('div');box.className='domains';box.setAttribute('aria-hidden','true');box.innerHTML=Array.from({length:9},()=>'<span></span>').join('');cell.prepend(box);return box;});
 root.querySelector('.sudoku-board').addEventListener('keydown',event=>{
  const input=event.target.closest('[data-sudoku]');if(!input||input.readOnly)return;
  const id=Number(input.dataset.sudoku),r=Math.floor(id/9),c=id%9,delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[event.key];
  if(delta){event.preventDefault();inputs[Math.max(0,Math.min(8,r+delta[0]))*9+Math.max(0,Math.min(8,c+delta[1]))].focus();}
 },{signal:abort.signal});
 const set=(key,value)=>{const el=root.querySelector(`[data-sd="${key}"]`);if(el)el.textContent=value;};
 return {destroy(){abort.abort();},update({c,frame,playback,busy,result,editing}){
  const s=frame?.state,values=s?.assignments||c.problem.board,locked=false;
  root.dataset.executionStep=String(frame?.eventIndex??'ready');root.querySelector('#explanation').dataset.executionStep=root.dataset.executionStep;root.querySelector('.pf-code').dataset.executionStep=root.dataset.executionStep;
  root.dataset.editing=String(editing&&!locked);
  const stamp=String(frame?.eventIndex??'ready');
  if(stamp!==previousStamp){
    cells.forEach(cell=>cell.classList.remove('is-assigned'));
    if(playback.timer&&playback.index===previousIndex+1&&frame?.event==='assign'&&s.current!=null)cells[s.current].classList.add('is-assigned');
    previousStamp=stamp;previousIndex=playback.index;
  }
  cells.forEach((cell,i)=>{
   const value=values[i]||'',input=inputs[i];if(input.value!==String(value))input.value=value;
   cell.classList.toggle('given',!!c.problem.board[i]);cell.classList.toggle('current',s?.current===i);cell.classList.toggle('rejected',s?.current===i&&s?.rejected);
   input.disabled=false;input.readOnly=locked||!editing;input.setAttribute('aria-readonly',String(input.readOnly));input.setAttribute('aria-label',`Row ${Math.floor(i/9)+1}, column ${i%9+1}${s?.domains?', candidates '+s.domains[i].join(', '):''}`);
   domains[i].hidden=!!value||!s?.domains;
   [...domains[i].children].forEach((digit,j)=>{digit.textContent=s?.domains?.[i]?.includes(j+1)?j+1:'';digit.classList.toggle('is-removed',!!s?.removed?.some(v=>v.variable===i&&v.value===j+1));});
  });
  set('filled',`${values.filter(Boolean).length} / 81 filled`);set('event',busy?'Preparing search':frame?.event.replaceAll('-',' ')||'Ready to explore');set('reason',busy?'Your board stays in place while the search is prepared.':frame?.reason||'Run the search, or open Edit puzzle to change the starting clues.');
  set('cell',s?.current!=null?`Row ${Math.floor(s.current/9)+1}, col ${s.current%9+1}`:'—');set('candidate',s?.candidate??'—');set('domain',s?.current!=null?(s.domains[s.current].join(', ')||'Empty'):'—');set('removed',s?.removed?.length??'—');
  for(const key of ['assigned','assignmentsAttempted','backtracks','valuesRemoved'])set(key,frame?.metrics[key]??(key==='assigned'?values.filter(Boolean).length:'—'));
  root.querySelectorAll('.pf-code-lines li').forEach((line,i)=>{line.classList.toggle('is-active',!busy&&frame?.line===i);if(!busy&&frame?.line===i)line.setAttribute('aria-current','step');else line.removeAttribute('aria-current');});
  root.querySelector('.pf-loading-overlay').hidden=!busy;
  root.querySelector('#run-status').textContent=busy?'Computing…':frame&&playback.index===playback.steps.length-1?({'solved':'Solution found','no-solution':'No solution exists','search-limit':'Search limit reached · solution not ruled out'}[result?.status]||frame.event):'Replay follows the selected execution step';
  if(!root.querySelector('#pf-details').hidden){root.querySelector('#metrics').innerHTML=metricsHTML('sudoku',frame?.metrics||{});root.querySelector('.sudoku-final-metrics').innerHTML=metricsHTML('sudoku',result?.metrics||{});root.querySelector('.sudoku-final-note').textContent=result?`Final outcome: ${result.status.replaceAll('-',' ')}. Compute time excludes playback and rendering.`:'Run the search to record its outcome.';}
 }};
}
