import {clone,labels} from './core.js';
import {pathfinding} from './algorithms/pathfinding.js';
import {optimization} from './algorithms/optimization.js';
import {game} from './algorithms/game.js';
import {csp} from './algorithms/csp.js';
import {algorithms,queensPreset} from './models.js';
export function execute(lab,config,trace=true){
  if(!algorithms[lab]?.includes(config.algorithm))throw Error('Choose a supported lab and algorithm.');
  if(lab!=='game'&&(!Number.isInteger(config.limit)||config.limit<1||config.limit>1000000))throw Error('Search/iteration limit must be an integer from 1 to 1,000,000.');
  const fn=lab==='pathfinding'?pathfinding:lab==='optimization'?optimization:lab==='game'?game:(c,t)=>csp(c,lab,t);
  return fn(clone(config),trace);
}
const median=xs=>{const sorted=xs.slice().sort((a,b)=>a-b),m=Math.floor(xs.length/2);return xs.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;};
export function compare(lab,config){
  return algorithms[lab].map(algorithm=>{
    const input={...clone(config),algorithm},runs=[];execute(lab,input,false);
    if(lab==='optimization')for(let trial=0;trial<20;trial++){
      const seed=((Number(config.seed)>>>0)+trial)>>>0;const problem=config.trialStarts==='random'?{queens:queensPreset(config.problem.queens.length,seed)}:clone(config.problem);
      const timings=[];let r;for(let repeat=0;repeat<3;repeat++){r=execute(lab,{...input,seed,problem},false);timings.push(r.metrics.executionMs);}r.metrics.executionMs=median(timings);runs.push({seed,startingQueens:problem.queens,status:r.status,metrics:r.metrics,timings});
    }else for(let repeat=0;repeat<5;repeat++){const r=execute(lab,input,false);runs.push({status:r.status,metrics:r.metrics});}
    const metrics={};for(const key of Object.keys(runs[0].metrics)){const values=runs.map(r=>r.metrics[key]);metrics[key]=values.every(v=>typeof v==='number'&&Number.isFinite(v))?median(values):values[0];}
    const success=runs.filter(r=>r.status==='solved'||r.status==='terminal').length;
    return{algorithm,label:labels[algorithm],status:runs.every(r=>r.status===runs[0].status)?runs[0].status:'mixed',metrics,runs,successRate:success/runs.length,trials:runs.length,timingMin:Math.min(...runs.map(r=>r.metrics.executionMs)),timingMax:Math.max(...runs.map(r=>r.metrics.executionMs))};
  });
}
