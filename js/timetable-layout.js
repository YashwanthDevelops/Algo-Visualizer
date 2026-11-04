import {escapeHTML as e} from './core.js';
const dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function timetableLayout(p){
 const days=[],rows=[],map=new Map();
 p.slots.forEach((label,slot)=>{
  const match=label.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(.+)$/i);
  const day=match?dayNames.find(d=>d.toLowerCase().startsWith(match[1].toLowerCase())):'Schedule';
  const tail=match?match[2]:label,parts=tail.split(/\s*[·|]\s*/),time=parts[0].trim(),note=parts.slice(1).join(' · ');
  if(!days.includes(day))days.push(day);
  if(!map.has(time)){const row={time,byDay:new Map()};rows.push(row);map.set(time,row);}
  const row=map.get(time);if(!row.byDay.has(day))row.byDay.set(day,[]);row.byDay.get(day).push({slot,note,isBreak:/break|lunch/i.test(note)});
 });
 days.sort((a,b)=>(dayNames.indexOf(a)<0?7:dayNames.indexOf(a))-(dayNames.indexOf(b)<0?7:dayNames.indexOf(b)));
 const minute=text=>{const m=text.match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null;};
 rows.sort((a,b)=>minute(a.time)!=null&&minute(b.time)!=null?minute(a.time)-minute(b.time):0);
 return {days,rows,cells:rows.flatMap(row=>days.map(day=>({day,time:row.time,periods:row.byDay.get(day)||[]})))};
}
export function timetableCellHTML(p,assignments,periods){
 if(!periods.length)return '<span class="unavailable">—</span>';
 const slots=periods.map(v=>v.slot),found=assignments.map((v,i)=>v&&slots.includes(v.slot)?i:null).filter(i=>i!==null);
 if(found.length)return found.map(i=>`<div class="session-block" title="${e(p.sessions[i].teacher)}"><strong>${e(p.sessions[i].name)}</strong><small>${e(assignments[i].room)} · ${e(p.sessions[i].group)}</small></div>`).join('');
 if(periods.every(v=>v.isBreak))return `<span class="tt-break-label">${e(periods[0].note||'Break')}</span>`;
 return periods.some(v=>p.rooms.some(room=>room.available.includes(v.slot)))?'<span class="unavailable">Free</span>':'<span class="unavailable">Unavailable</span>';
}
export function calendarHTML(p,state){
 const layout=timetableLayout(p),assignments=state?.assignments||p.sessions.map(()=>null);
 let html='<div class="table-head tt-corner" role="columnheader">TIME</div>'+layout.days.map(day=>`<div class="table-head tt-day" role="columnheader">${e(day)}</div>`).join('');
 for(const row of layout.rows){html+=`<div class="table-head tt-time" role="rowheader">${e(row.time)}</div>`;for(const day of layout.days){const periods=row.byDay.get(day)||[];html+=`<div class="tt-period ${periods.length&&periods.every(v=>v.isBreak)?'tt-break':''}" role="cell" aria-label="${e(day+' '+row.time)}" data-tt-slots="${periods.map(v=>v.slot).join(',')}">${timetableCellHTML(p,assignments,periods)}</div>`;}}
 return `<div class="grid-scroll"><div class="timetable-grid" role="table" aria-label="Weekly timetable: times by day" style="width:100%;min-width:${100+128*layout.days.length}px;grid-template-columns:100px repeat(${layout.days.length},minmax(128px,1fr));grid-template-rows:36px ${layout.rows.map(row=>[...row.byDay.values()].flat().every(v=>v.isBreak)?'36px':'minmax(88px,1fr)').join(' ')}">${html}</div></div>`;
}
