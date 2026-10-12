import {clone,recorder,timed} from '../core.js';
export function sudokuModel(board){
  if(!Array.isArray(board)||board.length!==81||board.some(v=>!Number.isInteger(v)||v<0||v>9))throw Error('Sudoku requires 81 cells containing digits 0-9.');
  const peers=Array.from({length:81},(_,i)=>{const r=Math.floor(i/9),c=i%9;return Array.from({length:81},(_,j)=>j).filter(j=>j!==i&&(Math.floor(j/9)===r||j%9===c||(Math.floor(j/27)===Math.floor(r/3)&&Math.floor(j%9/3)===Math.floor(c/3))));});
  for(let i=0;i<81;i++)if(board[i]&&peers[i].some(j=>board[j]===board[i]))throw Error(`Invalid Sudoku: duplicate ${board[i]} related to row ${Math.floor(i/9)+1}, column ${i%9+1}.`);
  const assignments=board.map(v=>v||null),domains=board.map((v,i)=>v?[v]:Array.from({length:9},(_,j)=>j+1).filter(x=>!peers[i].some(k=>board[k]===x)));
  return {assignments,domains,neighbors:peers,name:i=>`r${Math.floor(i/9)+1}c${i%9+1}`,valueName:String,conflict:(i,v,j,w)=>peers[i].includes(j)&&v===w};
}
export function timetableModel(p){
  if(!Array.isArray(p.slots)||!p.slots.length||!Array.isArray(p.rooms)||!p.rooms.length||!Array.isArray(p.teachers)||!Array.isArray(p.sessions)||!p.sessions.length||p.sessions.length>16||p.slots.length>12||p.rooms.length>6)throw Error('Use 1-16 sessions, 1-12 slots, and 1-6 rooms.');
  const unique=xs=>new Set(xs.map(x=>x.id)).size===xs.length;
  if(!unique(p.rooms)||!unique(p.teachers)||!unique(p.sessions))throw Error('Teacher, room, and session IDs must be unique.');
  const availability=x=>Array.isArray(x.available)&&x.available.every(v=>Number.isInteger(v)&&v>=0&&v<p.slots.length);
  if(!p.rooms.every(availability)||!p.teachers.every(availability))throw Error('Availability must contain valid zero-based slot indexes.');
  for(const s of p.sessions)if(!p.teachers.some(t=>t.id===s.teacher)||!s.group||!Array.isArray(s.rooms)||!s.rooms.length||s.rooms.some(id=>!p.rooms.some(r=>r.id===id)))throw Error(`Session ${s.id}: specify a known teacher, group, and allowed rooms.`);
  const domains=p.sessions.map(s=>p.slots.flatMap((_,slot)=>p.rooms.filter(r=>s.rooms.includes(r.id)&&r.available.includes(slot)&&p.teachers.find(t=>t.id===s.teacher).available.includes(slot)).map(r=>({slot,room:r.id}))));
  return {assignments:p.sessions.map(()=>null),domains,neighbors:p.sessions.map((_,i)=>p.sessions.map((_,j)=>j).filter(j=>j!==i)),name:i=>p.sessions[i].id,valueName:v=>`${p.slots[v.slot]} / ${v.room}`,conflict:(i,v,j,w)=>v.slot===w.slot&&(v.room===w.room||p.sessions[i].teacher===p.sessions[j].teacher||p.sessions[i].group===p.sessions[j].group)};
}
export function csp(config,lab,trace=true){return timed(()=>{
  const model=lab==='sudoku'?sudokuModel(config.problem.board):timetableModel(config.problem),rec=recorder(trace,1800);
  let assignments=clone(model.assignments),domains=clone(model.domains),current=null,candidate=null,removed=[],rejected=false,limited=false;
  const metrics={assignmentsAttempted:0,backtracks:0,valuesRemoved:0,assigned:assignments.filter(v=>v!==null).length,total:assignments.length};
  const record=(event,line,reason,final=false)=>{metrics.assigned=assignments.filter(v=>v!==null).length;rec.add(event,{assignments,domains,current,candidate,removed,rejected},metrics,line,reason,final);};
  record('initialize',0,'Initial domains respect the fixed clues or teacher/room availability.');
  const search=()=>{
    const i=assignments.findIndex(v=>v===null);if(i<0)return true;current=i;removed=[];rejected=false;record('select',1,`Select ${model.name(i)} in fixed variable order; ${domains[i].length} candidate values remain.`);
    for(const v of domains[i].slice()){
      if(metrics.assignmentsAttempted>=config.limit){limited=true;return false;}
      current=i;candidate=v;removed=[];rejected=false;metrics.assignmentsAttempted++;record('try',2,`Try ${model.name(i)} = ${model.valueName(v)}.`);
      const conflict=assignments.findIndex((w,j)=>w!==null&&j!==i&&model.conflict(i,v,j,w));
      if(conflict>=0){rejected=true;record('reject',3,`Reject: conflicts with ${model.name(conflict)} = ${model.valueName(assignments[conflict])}.`);continue;}
      const before=clone(domains);assignments[i]=clone(v);domains[i]=[clone(v)];record('assign',3,`Assign ${model.name(i)} = ${model.valueName(v)}; constraints satisfied so far.`);
      let empty=false;
      if(config.algorithm==='forward'){
        for(const j of model.neighbors[i])if(assignments[j]===null){const keep=[];for(const w of domains[j])if(model.conflict(i,v,j,w)){removed.push({variable:j,value:clone(w)});metrics.valuesRemoved++;}else keep.push(w);domains[j]=keep;if(!keep.length)empty=true;}
        record('prune',3,`Forward checking removes ${removed.length} values from unassigned related variables.${empty?' A domain is empty; backtrack immediately.':''}`);
      }
      if(!empty&&search())return true;
      assignments[i]=null;domains=before;current=i;candidate=v;removed=[];rejected=false;
      if(limited)return false;
      metrics.backtracks++;record('backtrack',4,`Undo ${model.name(i)} and restore every domain removed in this branch.`);
    }
    return false;
  };
  const solved=domains.some((d,i)=>assignments[i]===null&&!d.length)?false:search();const status=solved?'solved':limited?'search-limit':'no-solution';
  current=null;candidate=null;removed=[];record(status,5,solved?'Every variable is assigned and all constraints are satisfied.':limited?'Search limit reached. A valid solution may still exist.':'All possibilities exhausted: no valid solution exists for this input.',true);
  return{steps:rec.steps,status,metrics,output:{assignments},traceSkipped:rec.skipped};
});}
