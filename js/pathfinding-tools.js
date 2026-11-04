// Tools reuse the fixed notebook footprint. Only comparisons need a modal;
// no tool inserts an expanding section into the document flow.
export function mountPathfindingTools(root, {pause, onInspect, onLeaveEditor, onShow = () => {}, initialMode = ''}) {
  const abort = new AbortController(), signal = abort.signal;
  const notebook = root.querySelector('.pf-notebook');
  const toolbar = root.querySelector('.pf-tools');
  const study = document.createElement('div');study.className='pf-study-view';
  study.append(...notebook.childNodes);notebook.append(study);
  const tools=document.createElement('div');tools.className='pf-side-tools';tools.hidden=true;
  tools.innerHTML='<div class="pf-side-heading"><button type="button" class="pf-back"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M9.75 3.5 5.25 8l4.5 4.5M5.5 8h8"/></svg><span>Back to explanation</span></button><h2 id="pf-tool-title"></h2></div>';
  notebook.append(tools);
  const title=tools.querySelector('h2'), triggers=new Map(), panels=new Map();
  const dialog=document.createElement('dialog');dialog.className='pf-comparison-dialog';dialog.setAttribute('aria-labelledby','pf-comparison-title');
  dialog.innerHTML='<header class="pf-dialog-heading"><div><h2 id="pf-comparison-title">Compare runs</h2><p>The same map. Different search decisions.</p></div><button type="button" aria-label="Close comparison">Close ×</button></header>';
  root.append(dialog);
  const shortcut=document.createElement('div');shortcut.className='pf-shortcuts-popover';shortcut.hidden=true;shortcut.setAttribute('role','region');shortcut.setAttribute('aria-label','Keyboard shortcuts');
  let mode='', compareOpen=false, opener=null;
  for (const details of [...toolbar.children]) {
    const summary=details.querySelector(':scope > summary');
    const name=summary.childNodes[0].textContent.trim();
    const button=document.createElement('button');button.type='button';button.className='pf-tool-trigger';button.textContent=name;
    button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',details.id);
    const panel=document.createElement('section');panel.id=details.id;panel.className='pf-tool-view';panel.hidden=true;
    panel.append(details.querySelector('.pf-tool-content'));
    details.replaceWith(button);triggers.set(panel.id,button);panels.set(panel.id,panel);
    if(panel.id==='pf-comparisons'){panel.hidden=false;dialog.append(panel);button.setAttribute('aria-haspopup','dialog');}
    else if(panel.id==='pf-shortcuts'){shortcut.id=panel.id;shortcut.append(...panel.childNodes);}
    else tools.append(panel);
    button.addEventListener('click',()=>show(panel.id,true),{signal});
  }
  toolbar.append(shortcut);
  function hideShortcuts(){shortcut.hidden=true;triggers.get('pf-shortcuts').setAttribute('aria-expanded','false');}
  function back(focus=false){
    const previous=mode;mode='';root.dataset.tool='';
    if(previous==='pf-editor')onLeaveEditor();
    study.hidden=false;tools.hidden=true;
    notebook.setAttribute('aria-labelledby','pf-notebook-title');
    for(const [id,panel] of panels)if(!['pf-comparisons','pf-shortcuts'].includes(id))panel.hidden=true;
    for(const [id,button] of triggers)if(id!=='pf-comparisons')button.setAttribute('aria-expanded','false');
    hideShortcuts();
    if(focus)triggers.get(previous)?.focus({preventScroll:true});
  }
  function show(id,focus=false){
    if(id==='pf-comparisons'){
      hideShortcuts();if(dialog.open)return;
      pause();opener=triggers.get(id);compareOpen=true;opener.setAttribute('aria-expanded','true');dialog.showModal();return;
    }
    if(id==='pf-shortcuts'){
      pause();
      const next=shortcut.hidden;hideShortcuts();shortcut.hidden=!next;triggers.get(id).setAttribute('aria-expanded',String(next));return;
    }
    if(mode===id){back(focus);return;}
    back();pause();mode=id;root.dataset.tool=id;
    study.hidden=true;tools.hidden=false;panels.get(id).hidden=false;
    title.textContent=triggers.get(id).textContent;
    notebook.setAttribute('aria-labelledby','pf-tool-title');
    triggers.get(id).setAttribute('aria-expanded','true');
    if(id==='pf-details')onInspect();
    onShow();
    if(focus){
      tools.querySelector('.pf-back').focus({preventScroll:true});
      if(innerWidth<=800)notebook.scrollIntoView({block:'start',behavior:'instant'});
    }
  }
  tools.querySelector('.pf-back').addEventListener('click',()=>back(true),{signal});
  dialog.querySelector('button').addEventListener('click',()=>dialog.close(),{signal});
  dialog.addEventListener('close',()=>{compareOpen=false;triggers.get('pf-comparisons').setAttribute('aria-expanded','false');opener?.focus({preventScroll:true});},{signal});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();},{signal});
  document.addEventListener('pointerdown',event=>{if(!shortcut.hidden&&!shortcut.contains(event.target)&&!triggers.get('pf-shortcuts').contains(event.target))hideShortcuts();},{signal});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||dialog.open||root.querySelector('.pf-dropdown.is-open'))return;
    if(!shortcut.hidden){hideShortcuts();triggers.get('pf-shortcuts').focus({preventScroll:true});}
    else if(mode){event.preventDefault();back(true);}
  },{signal});
  if(initialMode&&panels.has(initialMode))show(initialMode);
  return {show,back,get mode(){return mode;},get compareOpen(){return compareOpen;},destroy(){if(dialog.open)dialog.close();abort.abort();}};
}
