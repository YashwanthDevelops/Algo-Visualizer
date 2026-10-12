const KEY='so-playground-v1';
export function load(){try{const v=JSON.parse(localStorage.getItem(KEY));return v?.version===1&&Array.isArray(v.history)&&v.configs&&typeof v.configs==='object'?v:{version:1,configs:{},history:[]};}catch{return{version:1,configs:{},history:[]};}}
export function save(data){try{localStorage.setItem(KEY,JSON.stringify(data));return true;}catch{return false;}}
export function summary(lab,config,result){return{id:crypto.randomUUID(),date:new Date().toISOString(),lab,config:structuredClone(config),algorithm:config.algorithm,status:result.status,metrics:result.metrics,traceSkipped:result.traceSkipped||0};}
