export const clone = value => structuredClone(value);
export class Queue { constructor(){this.items=[];this.head=0;} push(v){this.items.push(v);} pop(){return this.items[this.head++];} get size(){return this.items.length-this.head;} values(){return this.items.slice(this.head);} }
export class Stack { constructor(){this.items=[];} push(v){this.items.push(v);} pop(){return this.items.pop();} get size(){return this.items.length;} values(){return this.items.slice().reverse();} }
export class PriorityQueue {
  constructor(compare=(a,b)=>a.priority-b.priority||a.order-b.order){this.heap=[];this.compare=compare;}
  push(v){const h=this.heap;h.push(v);let i=h.length-1;while(i){const p=(i-1)>>1;if(this.compare(h[p],h[i])<=0)break;[h[p],h[i]]=[h[i],h[p]];i=p;}}
  pop(){const h=this.heap;if(!h.length)return;const top=h[0],last=h.pop();if(h.length){h[0]=last;let i=0;while(true){let a=i*2+1,b=a+1,k=i;if(a<h.length&&this.compare(h[a],h[k])<0)k=a;if(b<h.length&&this.compare(h[b],h[k])<0)k=b;if(k===i)break;[h[k],h[i]]=[h[i],h[k]];i=k;}}return top;}
  get size(){return this.heap.length;} values(){return this.heap.slice().sort(this.compare);}
}
export function random(seed=1){let x=Number(seed)>>>0;if(!x)x=0x9e3779b9;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
export function recorder(enabled=true,limit=1800){
  const steps=[];let events=0,skipped=0;
  return {steps, get events(){return events;}, get skipped(){return skipped;}, add(event,state,metrics,line,reason,final=false){events++;if(!enabled)return;if(steps.length>=limit&&!final){skipped++;return;}steps.push({event,state:clone(state),metrics:clone(metrics),line,reason,eventIndex:events});}};
}
export function timed(fn){const t=performance.now();const result=fn();result.metrics.executionMs=performance.now()-t;return result;}
export const labels={bfs:'Breadth-first search',dfs:'Depth-first search',ucs:'Uniform-cost search',greedy:'Greedy best-first',astar:'A* search',hill:'Hill climbing',anneal:'Simulated annealing',minimax:'Minimax',alphabeta:'Alpha-beta pruning',backtracking:'Backtracking',forward:'Forward checking'};
export const escapeHTML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
