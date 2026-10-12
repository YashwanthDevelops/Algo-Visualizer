import {random,recorder,timed} from '../core.js';
export function conflicts(q){let s=0;for(let a=0;a<q.length;a++)for(let b=a+1;b<q.length;b++)if(q[a]===q[b]||Math.abs(q[a]-q[b])===b-a)s++;return s;}
export function optimization(config,trace=true){return timed(()=>{
  const rec=recorder(trace),rng=random(config.seed);let q=config.problem.queens.slice(),n=q.length;
  if(n<4||n>12||q.some(v=>!Number.isInteger(v)||v<0||v>=n))throw Error('Use 4-12 queens and one valid row per column.');
  if(config.algorithm==='anneal'&&(!(config.temperature>0)||!(config.cooling>0&&config.cooling<1)))throw Error('Temperature must be positive; cooling must be between 0 and 1.');
  let score=conflicts(q),best=score,bestQueens=q.slice(),temperature=config.temperature||8,candidate=null,candidates=[],chart=[{iteration:0,score,best}],status='iteration-limit';
  const metrics={candidateEvaluations:1,iterations:0,currentScore:score,bestScore:best,worseAccepted:0};
  const record=(event,line,reason,final=false)=>{if(score<best){best=score;bestQueens=q.slice();}metrics.currentScore=score;metrics.bestScore=best;rec.add(event,{queens:q,score,best,bestQueens,temperature,candidate,candidates,chart},metrics,line,reason,final);};
  record('initialize',0,`Start with ${score} attacking pairs. Each unordered pair counts once.`);
  if(score===0)status='solved';
  for(let i=1;score>0&&i<=config.limit;i++){
    metrics.iterations=i;candidates=[];
    if(config.algorithm==='hill'){
      let move=null,minScore=Infinity;
      for(let col=0;col<n;col++)for(let row=0;row<n;row++)if(row!==q[col]){
        const z=q.slice();z[col]=row;const value=conflicts(z);metrics.candidateEvaluations++;candidate={col,row,score:value,delta:value-score};candidates.push({...candidate});
        if(value<minScore){minScore=value;move={col,row,queens:z,score:value};}
        record('candidate',1,`Try column ${col+1}, row ${row+1}: ${value} conflicts (${value-score>=0?'+':''}${value-score}).`);
      }
      if(minScore>=score){status=minScore===score?'plateau':'local-minimum';chart.push({iteration:i,score,best});record(status,2,minScore===score?'No strictly improving move. Equal-score alternatives form a plateau; sideways moves are disabled.':'All single-queen moves worsen the score: a strict local minimum.');break;}
      q=move.queens;score=move.score;candidate=move;record('improve',3,`Take the best strictly improving move: score becomes ${score}.`);
    }else{
      if(temperature<1e-8){status='temperature-limit';break;}
      const k=Math.floor(rng()*n*(n-1)),col=Math.floor(k/(n-1));let row=k%(n-1);if(row>=q[col])row++;
      const z=q.slice();z[col]=row;const value=conflicts(z),delta=value-score,probability=delta<=0?1:Math.exp(-delta/temperature),draw=delta<=0?null:rng(),accepted=delta<=0||draw<probability;
      metrics.candidateEvaluations++;candidate={col,row,score:value,delta,probability,draw,accepted};candidates=[candidate];
      record('candidate',1,`Propose column ${col+1} → row ${row+1}; Δ = ${delta}.`);
      if(accepted){q=z;score=value;if(delta>0)metrics.worseAccepted++;}
      record(accepted?'accept':'reject',2,`${accepted?'Accept':'Reject'} ${delta>0?'a worse':'a non-worse'} move. p = ${probability.toFixed(4)}${draw===null?'':`, seeded draw = ${draw.toFixed(4)}`}.`);
      temperature*=config.cooling;
    }
    if(score<best){best=score;bestQueens=q.slice();}metrics.currentScore=score;metrics.bestScore=best;chart.push({iteration:i,score,best});record('iteration',3,`Iteration ${i}: current ${score}, best ${best}${config.algorithm==='anneal'?`, next T = ${temperature.toFixed(4)}`:''}.`);
    if(score===0){status='solved';break;}
  }
  metrics.currentScore=score;metrics.bestScore=best;record(status,4,status==='solved'?'Zero attacking pairs: a valid N-Queens solution.':`Stopped: ${status.replaceAll('-',' ')}. Best conflict score = ${best}; this is not a proof of impossibility.`,true);
  return{steps:rec.steps,status,metrics,output:{queens:q,bestQueens},traceSkipped:rec.skipped};
});}
