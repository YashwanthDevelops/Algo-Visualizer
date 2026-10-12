import {execute,compare} from './engine.js';
self.onmessage=({data})=>{try{const result=data.type==='compare'?compare(data.lab,data.config):execute(data.lab,data.config);self.postMessage({id:data.id,result});}catch(error){self.postMessage({id:data.id,error:error.message});}};
