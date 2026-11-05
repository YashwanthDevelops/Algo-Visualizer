import {timetableLayout,timetableCellHTML} from './timetable-layout.js?v=calendar-4';
import {escapeHTML as e} from './core.js';
import {timetableHTML,pseudocode,metricsHTML} from './renderers.js?v=calendar-4';

export function timetablePage({c,playback,selectField,icon,guide,comparisons,comparisonControls}) {
 const forward=c.algorithm==='forward';
 return `<section class="pf-page timetable-study" aria-labelledby="pf-title">
 <header class="pf-heading"><div><h1 id="pf-title">Timetabling</h1><p>Give every session a time and room. Follow how constraints shape the schedule.</p></div><div class="pf-save"><button data-action="save-setup">Save setup</button><button data-action="share-setup">Share</button></div></header>
 <div class="pf-setup"><div class="pf-selectors">${selectField('Algorithm','algorithm',['backtracking','forward'],c.algorithm)}${selectField('Dataset','dataset',[['feasible','Five-session example'],['impossible','Availability conflict'],['custom','Uploaded / custom']],c.dataset||'custom')}</div><button id="run" class="pf-primary" data-action="run"><span class="button-text">Generate timetable</span></button></div><div id="error-slot" role="alert"></div>
 <div class="pf-workspace"><section class="timetable-map-column" aria-label="Timetable and playback"><div class="timetable-board-frame"><div class="timetable-topline"><span>Times × days</span><span data-tt="filled">—</span><button type="button" class="tt-fullscreen" aria-label="Open timetable full screen" aria-pressed="false">Full screen</button></div><div id="visualization" class="timetable-board-space">${timetableHTML(c.problem)}</div><div class="timetable-legend"><span>Outlined · current placement</span><span>Breaks remain reserved</span></div><div class="pf-loading-overlay" hidden role="status"><span class="pf-loading-dot"></span>Preparing the search…</div></div>
 <div class="pf-playback"><button id="pf-play" class="pf-play" data-action="run" aria-label="Play search">${icon('play')}</button><button id="pause" class="pf-play" data-action="pause" aria-label="Pause search">${icon('pause')}</button><button id="previous" data-action="previous" aria-label="Previous step">${icon('skip-back')}</button><button id="next" data-action="next" aria-label="Next step">${icon('skip-forward')}</button><input id="scrub" type="range" min="0" max="0" value="0" aria-label="Seek recorded decision"><span id="step-count">0 / 0</span></div>
 <div class="timetable-summary">${[['assigned','Scheduled'],['assignmentsAttempted','Attempts'],['backtracks','Backtracks'],['valuesRemoved','Values removed']].map(([key,name])=>`<div><span>${name}</span><strong data-tt="${key}">—</strong></div>`).join('')}</div><p id="trace-gap-label" class="pf-trace-gap"></p></section>
 <aside class="pf-notebook" aria-labelledby="pf-notebook-title"><h2 id="pf-notebook-title">Decision notebook</h2><p id="pf-step-label">Choose a dataset and begin</p><div id="explanation"><p class="pf-rule">${forward?'Forward checking removes conflicting time and room choices after each placement.':'Backtracking tries a time and room, checks constraints, and undoes placements when needed.'}</p><div class="pf-current"><p class="pf-event" data-tt="event">Ready to explore</p><p class="pf-reason" data-tt="reason">Run the search to follow its first decision.</p></div><dl class="timetable-decision"><dt>Current session</dt><dd data-tt="cell">—</dd><dt>Trying placement</dt><dd data-tt="candidate">—</dd><dt>Available choices</dt><dd data-tt="domain">—</dd>${forward?'<dt>Removed this step</dt><dd data-tt="removed">—</dd>':''}</dl></div><section class="pf-code"><h3>Algorithm steps</h3><ol class="pf-code-lines">${pseudocode.timetable(c.algorithm).map((line,i)=>`<li><span>${i+1}</span><code>${e(line)}</code></li>`).join('')}</ol></section><span id="run-status" class="pf-status">Ready</span></aside></div>
 <div class="pf-tools"><details id="tt-data"><summary>Dataset & JSON</summary><div class="pf-tool-content"><h3>Upload a timetable dataset</h3><p>Choose a JSON file to validate its constraints and generate a schedule. Files stay in your browser.</p><label class="tt-upload" for="timetable-upload">Choose JSON file<input id="timetable-upload" type="file" accept=".json,application/json"></label><p id="tt-upload-message" role="status"></p><button data-action="tt-template">Download example JSON</button><p class="hint">Up to 64 sessions, 84 time slots, and 6 rooms. Each session occupies one slot. Availability uses zero-based slot indexes. Sessions can also specify available periods to stay on a particular day.</p><details class="tt-json-editor"><summary>Edit dataset JSON</summary><label for="timetable-json">Slots, rooms, teachers, and sessions</label><textarea id="timetable-json" rows="12" spellcheck="false">${e(JSON.stringify(c.problem,null,2))}</textarea><button data-action="apply-timetable">Validate & load JSON</button></details></div></details>
 <details id="pf-advanced"><summary>Advanced settings</summary><div class="pf-tool-content">${selectField('Choose next session','variableOrdering',[['fixed','Session order'],['mrv','Fewest choices (MRV)']],c.variableOrdering||'fixed')}${selectField('Try values','valueOrdering',[['natural','Natural order'],['lcv','Least constraining first']],c.valueOrdering||'natural')}<div class="field pf-number-field"><label for="limit">Search limit</label><div class="pf-number-control"><button class="pf-number-step" data-number-step="-1" aria-label="Decrease search limit">−</button><input id="limit" data-param="limit" type="number" min="1" max="1000000" step="100" value="${c.limit}"><button class="pf-number-step" data-number-step="1" aria-label="Increase search limit">+</button></div></div><label for="speed">Playback speed <span id="speed-label">${playback.speed} steps/s</span><input id="speed" type="range" min="1" max="30" value="${playback.speed}"></label><div class="pf-key-events"><button data-action="jump-prev">Previous key event</button><button data-action="jump-next">Next key event</button></div>${guide}</div></details>
 <details id="pf-comparisons"><summary>Compare runs</summary><div class="pf-tool-content"><section class="pf-compare-all"><div><h3>Compare both algorithms</h3><p>Use the same sessions, availability, and ordering.</p></div><button data-action="compare">Compare algorithms</button></section><section class="pf-compare-traces"><h3>Compare two traces</h3>${comparisonControls}</section>${comparisons}</div></details>
 <details id="pf-details"><summary>Run details</summary><div class="pf-tool-content"><h3>Selected replay step</h3><div id="metrics" class="metrics"></div><h3>Complete run</h3><div class="timetable-final-metrics metrics"></div><p class="timetable-final-note"></p>${guide}</div></details>
 <details id="pf-shortcuts"><summary>Keyboard shortcuts</summary><div class="pf-tool-content"><dl><dt>Play / pause</dt><dd>Space</dd><dt>Previous / next step</dt><dd>← / →</dd><dt>Previous / next key event</dt><dd>J / K</dd></dl></div></details></div>
 <div class="pf-reset-row"><button id="reset" data-action="reset">Reset</button><span>A complete schedule respects all configured constraints.</span><button data-action="tt-export" disabled>Download timetable</button></div><span id="event-progress" hidden>0</span><span id="playback-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span></section>`;
}


export function mountTimetableRenderer(root) {
 const cells=[...root.querySelectorAll('.tt-period')].map((el,index)=>({el,index}));
 const abort=new AbortController(),signal=abort.signal;
 const board=root.querySelector('.timetable-board-frame'),expand=root.querySelector('.tt-fullscreen');
 let fallback=false,previousStep=null;
 const syncExpanded=()=>{
  const expanded=document.fullscreenElement===board||fallback;
  expand.textContent=expanded?'Exit full screen':'Full screen';expand.setAttribute('aria-pressed',String(expanded));expand.setAttribute('aria-label',expanded?'Exit timetable full screen':'Open timetable full screen');
 };
 expand.addEventListener('click',async()=>{
  if(fallback){fallback=false;board.classList.remove('tt-expanded');syncExpanded();return;}
  if(document.fullscreenElement===board){await document.exitFullscreen();return;}
  try{await board.requestFullscreen();}catch{fallback=true;board.classList.add('tt-expanded');syncExpanded();}
 },{signal});
 document.addEventListener('fullscreenchange',syncExpanded,{signal});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(document.fullscreenElement===board){document.exitFullscreen().catch(()=>{});expand.focus({preventScroll:true});}else if(fallback){fallback=false;board.classList.remove('tt-expanded');syncExpanded();expand.focus({preventScroll:true});}},{signal});
 const set=(key,value)=>{const el=root.querySelector(`[data-tt="${key}"]`);if(el)el.textContent=value;};
 return {destroy(){abort.abort();if(document.fullscreenElement===board)document.exitFullscreen().catch(()=>{});board.classList.remove('tt-expanded');},update({c,frame,playback,busy,result}){
  const p=c.problem,s=frame?.state,assignments=s?.assignments||p.sessions.map(()=>null),layout=timetableLayout(p);
  const stamp=String(frame?.eventIndex??'ready'),changed=previousStep!==stamp;
  root.dataset.executionStep=stamp;root.querySelector('#explanation').dataset.executionStep=stamp;root.querySelector('.pf-code').dataset.executionStep=stamp;
  for(const {el,index} of cells){
   const {periods}=layout.cells[index],slots=periods.map(v=>v.slot);
   const html=timetableCellHTML(p,assignments,periods);
   if(el.innerHTML!==html)el.innerHTML=html;
   const active=s?.candidate&&slots.includes(s.candidate.slot)&&s.current!=null;
   el.classList.toggle('tt-current',active);el.classList.toggle('tt-rejected',active&&s.rejected);
   if(changed){el.classList.remove('tt-assigned');if(playback.timer&&frame?.event==='assign'&&active)el.classList.add('tt-assigned');}
  }
  previousStep=stamp;
  set('filled',`${assignments.filter(Boolean).length} / ${p.sessions.length} scheduled`);set('event',busy?'Preparing schedule':frame?.event.replaceAll('-',' ')||'Ready to schedule');
  set('reason',busy?'The timetable stays in place while the solver checks possible placements.':frame?.reason||'Generate a timetable, or upload a JSON dataset to use your own sessions.');
  set('cell',s?.current!=null?p.sessions[s.current].name:'—');set('candidate',s?.candidate?`${p.slots[s.candidate.slot]} · ${s.candidate.room}`:'—');set('domain',s?.current!=null?s.domains[s.current].length:'—');set('removed',s?.removed?.length??'—');
  for(const key of ['assigned','assignmentsAttempted','backtracks','valuesRemoved'])set(key,frame?.metrics[key]??(key==='assigned'?0:'—'));
  root.querySelectorAll('.pf-code-lines li').forEach((line,i)=>{line.classList.toggle('is-active',!busy&&frame?.line===i);if(!busy&&frame?.line===i)line.setAttribute('aria-current','step');else line.removeAttribute('aria-current');});
  root.querySelector('.pf-loading-overlay').hidden=!busy;
  root.querySelector('#run-status').textContent=busy?'Generating…':frame&&playback.index===playback.steps.length-1?({'solved':'Complete timetable · all constraints satisfied','no-solution':'No feasible timetable exists for these constraints','search-limit':'Search limit reached · feasibility is still unknown'}[result?.status]||frame.event):'Follow each recorded placement';
  root.querySelector('[data-action="tt-export"]').disabled=busy||result?.status!=='solved';
  if(!root.querySelector('#pf-details').hidden){root.querySelector('#metrics').innerHTML=metricsHTML('timetable',frame?.metrics||{});root.querySelector('.timetable-final-metrics').innerHTML=metricsHTML('timetable',result?.metrics||{});root.querySelector('.timetable-final-note').textContent=result?`Final outcome: ${result.status.replaceAll('-',' ')}. Compute time excludes playback and rendering.`:'Generate a schedule to record its outcome.';}
 }};
}
