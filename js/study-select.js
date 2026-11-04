// Keep the native select as the source of truth for existing configuration
// handlers, and present an accessible listbox using the shared navbar styling.
export function mountStudySelects(root) {
  const abort = new AbortController(), signal = abort.signal;
  const controls = new Map();
  let open = null, active = 0, typed = '', typedAt = 0;
  function close(restore = false) {
    if (!open) return;
    const control = open;
    control.wrap.classList.remove('is-open');
    control.button.setAttribute('aria-expanded','false');
    control.button.removeAttribute('aria-activedescendant');
    control.menu.inert = true;
    open = null;
    if (restore) control.button.focus();
  }
  function highlight(index) {
    active = Math.max(0,Math.min(index,open.options.length-1));
    open.options.forEach((option,i)=>option.classList.toggle('is-focused',i===active));
    open.button.setAttribute('aria-activedescendant',open.options[active].id);
    open.options[active].scrollIntoView({block:'nearest'});
  }
  function choose(control,index) {
    control.select.selectedIndex = index;
    close(true);
    sync();
    control.select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function show(control) {
    if (control.select.disabled) return;
    if (open === control) { close(); return; }
    close(); open = control;
    control.wrap.classList.toggle('opens-up', innerHeight-control.button.getBoundingClientRect().bottom < Math.min(260,control.options.length*40+30));
    control.wrap.classList.add('is-open');
    control.button.setAttribute('aria-expanded','true');
    control.menu.inert = false;
    highlight(Math.max(0,control.select.selectedIndex));
  }
  function enhance(select) {
    if (controls.has(select)) return;
    const wrap = document.createElement('div'); wrap.className='pf-dropdown';
    select.before(wrap); wrap.append(select);
    select.classList.add('pf-native-select'); select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    const button = document.createElement('button');button.type='button';button.className='pf-dropdown-trigger';button.id=`${select.id}-trigger`;
    button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
    const label = [...root.querySelectorAll('label')].find(el=>el.htmlFor===select.id) || select.closest('label');
    const name = label?.childNodes[0]?.textContent?.trim() || select.id;
    if (label && label.htmlFor===select.id) label.htmlFor=button.id;
    button.setAttribute('aria-label',name);
    const text=document.createElement('span');button.append(text);
    button.insertAdjacentHTML('beforeend','<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    const menu=document.createElement('div');menu.className='pf-dropdown-menu';menu.id=`${select.id}-options`;menu.setAttribute('role','listbox');menu.setAttribute('aria-label',name);menu.inert=true;
    button.setAttribute('aria-controls',menu.id);
    const options=[...select.options].map((option,index)=>{
      const item=document.createElement('div');item.className='pf-dropdown-option';item.id=`${menu.id}-${index}`;item.setAttribute('role','option');item.textContent=option.textContent;
      item.addEventListener('pointerdown',event=>event.preventDefault(),{signal});
      item.addEventListener('click',()=>choose(control,index),{signal});menu.append(item);return item;
    });
    const control={select,wrap,button,text,menu,options};controls.set(select,control);wrap.append(button,menu);
    button.addEventListener('click',()=>show(control),{signal});
    button.addEventListener('keydown',event=>{
      if (event.key==='Tab') {close();return;}
      if (event.key==='Escape') {close(true);event.preventDefault();return;}
      if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)) {
        event.preventDefault();
        if (open!==control) {show(control);return;}
        if (event.key==='Enter'||event.key===' ') {choose(control,active);return;}
        highlight(event.key==='Home'?0:event.key==='End'?options.length-1:active+(event.key==='ArrowDown'?1:-1));
      } else if (event.key.length===1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();if(open!==control)show(control);
        typed=performance.now()-typedAt>700?event.key:typed+event.key;typedAt=performance.now();
        const index=options.findIndex(option=>option.textContent.toLowerCase().startsWith(typed.toLowerCase()));if(index>=0)highlight(index);
      }
    },{signal});
  }
  function sync() {
    root.querySelectorAll('select').forEach(enhance);
    for (const [select,control] of controls) {
      if (!select.isConnected) {if(open===control)close();controls.delete(select);continue;}
      if (control.button.disabled!==select.disabled) control.button.disabled=select.disabled;
      if (control.text.textContent!==select.selectedOptions[0]?.textContent)control.text.textContent=select.selectedOptions[0]?.textContent||'Choose';
      control.options.forEach((option,index)=>{
        const selected=String(index===select.selectedIndex);
        if(option.getAttribute('aria-selected')!==selected)option.setAttribute('aria-selected',selected);
      });
      if (select.disabled && open===control)close();
    }
  }
  document.addEventListener('pointerdown',event=>{if(open&&!open.wrap.contains(event.target))close();},{signal});
  document.addEventListener('focusin',event=>{if(open&&!open.wrap.contains(event.target))close();},{signal});
  root.addEventListener('change',()=>queueMicrotask(()=>{if(!signal.aborted)sync();}),{signal});
  sync();
  return {sync,destroy(){close();abort.abort();}};
}
