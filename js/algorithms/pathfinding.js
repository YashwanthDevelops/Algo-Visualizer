import {Queue,Stack,PriorityQueue,recorder,timed} from '../core.js';
export function pathfinding(config,trace=true){return timed(()=>{
  const {problem:p,algorithm:a}=config,n=p.rows*p.cols,rec=recorder(trace);
  if(!Number.isInteger(p.rows)||!Number.isInteger(p.cols)||p.rows<1||p.cols<1||p.cells.length!==n||!p.cells[p.start]||!p.cells[p.goal]||p.cells.some(v=>!Number.isFinite(v)||v<0))throw Error('Choose valid start/goal cells and non-negative terrain costs (0 = wall).');
  const min=Math.min(...p.cells.filter(x=>x>0)),h=id=>(Math.abs(Math.floor(id/p.cols)-Math.floor(p.goal/p.cols))+Math.abs(id%p.cols-p.goal%p.cols))*min;
  const frontier=a==='bfs'?new Queue():a==='dfs'?new Stack():new PriorityQueue();
  const g=Array(n).fill(Infinity),parents=Array(n).fill(null),closed=Array(n).fill(false),seen=Array(n).fill(false);
  let order=0,current=null,path=[],status='no-solution';
  const metrics={expanded:0,discovered:1,maxFrontier:1,pathLength:null,pathCost:null};
  const priority=(id,cost)=>a==='ucs'?cost:a==='greedy'?h(id):a==='astar'?cost+h(id):0;
  const active=()=>frontier.values().filter(v=>!closed[v.id]&&v.g===g[v.id]);
  const record=(event,line,reason,final=false)=>rec.add(event,{current,frontier:active().map(v=>({...v,h:h(v.id),f:v.g+h(v.id)})),g,parents,closed,path},metrics,line,reason,final);
  g[p.start]=0;seen[p.start]=true;frontier.push({id:p.start,g:0,priority:priority(p.start,0),order:order++});record('initialize',0,'Place the start in the frontier with g = 0.');
  while(frontier.size){
    const entry=frontier.pop();if(closed[entry.id]||entry.g!==g[entry.id])continue;
    current=entry.id;record('select',1,a==='bfs'?'Dequeue the oldest discovered cell.':a==='dfs'?'Pop the most recently discovered cell.':`Select the smallest ${a==='ucs'?'g':a==='greedy'?'h':'g + h'}; ties use insertion order.`);
    if(current===p.goal){status='solved';let id=current;while(id!==null){path.unshift(id);id=parents[id];}metrics.pathLength=path.length-1;metrics.pathCost=g[current];break;}
    if(metrics.expanded>=(config.limit||20000)){status='search-limit';break;}
    closed[current]=true;metrics.expanded++;const r=Math.floor(current/p.cols),c=current%p.cols;
    let neighbors=[[-1,0],[0,1],[1,0],[0,-1]].map(([dr,dc])=>[r+dr,c+dc]).filter(([rr,cc])=>rr>=0&&rr<p.rows&&cc>=0&&cc<p.cols).map(([rr,cc])=>rr*p.cols+cc);
    if(a==='dfs')neighbors.reverse();
    record('expand',2,'Expand this cell: examine its four-direction neighbors. Expanded counts exclude the goal, whose neighbors are never examined.');
    for(const id of neighbors){if(p.cells[id]===0)continue;const next=g[current]+p.cells[id];const relax=a==='ucs'||a==='astar';if(relax?next>=g[id]:seen[id])continue;
      const discovered=!seen[id];if(discovered){seen[id]=true;metrics.discovered++;}g[id]=next;parents[id]=current;closed[id]=false;
      frontier.push({id,g:next,priority:priority(id,next),order:order++});metrics.maxFrontier=Math.max(metrics.maxFrontier,new Set(active().map(v=>v.id)).size);
      record(discovered?'discover':'relax',3,`${discovered?'Discover':'Improve'} (${Math.floor(id/p.cols)+1}, ${id%p.cols+1}): g = ${g[current]} + ${p.cells[id]} = ${next}; record its parent.`);
    }
  }
  record(status,4,status==='solved'?`Goal selected. Path: ${metrics.pathLength} moves, cost ${metrics.pathCost}.`:status==='search-limit'?'Expansion limit reached; this does not prove the goal unreachable.':'Frontier exhausted: no path exists on this map.',true);
  return{steps:rec.steps,status,metrics,output:{path},traceSkipped:rec.skipped};
});}
