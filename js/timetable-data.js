import {timetableModel} from './algorithms/csp.js?v=calendar-4';

// Validate the public upload format before passing it to the existing CSP engine.
export function parseTimetableJSON(text) {
 let p;try{p=JSON.parse(text);}catch{throw Error('This file is not valid JSON. Check commas, quotes, and brackets.');}
 const object=(x,label)=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error(`${label} must be an object.`);};
 const string=(x,label)=>{if(typeof x!=='string'||!x.trim()||x.length>160)throw Error(`${label} must be a non-empty string of up to 160 characters.`);};
 const fields=(x,allowed,label)=>{object(x,label);for(const key of Object.keys(x))if(!allowed.includes(key))throw Error(`${label}: unsupported field “${key}”. Use the example format.`);};
 fields(p,['slots','rooms','teachers','sessions'],'Timetable');
 for(const [key,max] of [['slots',84],['rooms',6],['teachers',Infinity],['sessions',64]])if(!Array.isArray(p[key])||!p[key].length||p[key].length>max)throw Error(Number.isFinite(max)?`${key} must contain 1–${max} entries.`:`${key} must contain at least one entry.`);
 p.slots.forEach((v,i)=>string(v,`slots[${i}]`));if(new Set(p.slots).size!==p.slots.length)throw Error('Time slot labels must be unique.');
 for(const key of ['rooms','teachers']){
  p[key].forEach((v,i)=>{fields(v,['id','available'],`${key}[${i}]`);string(v.id,`${key}[${i}].id`);if(!Array.isArray(v.available)||v.available.some(n=>!Number.isInteger(n)||n<0||n>=p.slots.length)||new Set(v.available).size!==v.available.length)throw Error(`${key}[${i}].available must contain unique slot indexes from 0 to ${p.slots.length-1}.`);});
  if(new Set(p[key].map(v=>v.id)).size!==p[key].length)throw Error(`${key} IDs must be unique.`);
 }
 p.sessions.forEach((v,i)=>{fields(v,['id','name','teacher','group','rooms','available'],`sessions[${i}]`);for(const key of ['id','name','teacher','group'])string(v[key],`sessions[${i}].${key}`);if(!Array.isArray(v.rooms)||!v.rooms.length||v.rooms.some(id=>typeof id!=='string'||!p.rooms.some(r=>r.id===id))||new Set(v.rooms).size!==v.rooms.length)throw Error(`${v.id}: rooms must list unique existing room IDs.`);if(v.available!==undefined&&(!Array.isArray(v.available)||v.available.some(n=>!Number.isInteger(n)||n<0||n>=p.slots.length)||new Set(v.available).size!==v.available.length))throw Error(`${v.id}: available must list unique slot indexes from 0 to ${p.slots.length-1}.`);if(!p.teachers.some(t=>t.id===v.teacher))throw Error(`${v.id}: teacher “${v.teacher}” does not exist.`);});
 if(new Set(p.sessions.map(v=>v.id)).size!==p.sessions.length)throw Error('Session IDs must be unique.');
 timetableModel(p);
 return p;
}
