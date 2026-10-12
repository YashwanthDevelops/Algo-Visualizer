import {recorder,timed} from '../core.js';
export const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function winner(board){for(const line of lines)if(board[line[0]]&&line.every(i=>board[i]===board[line[0]]))return board[line[0]];return board.every(Boolean)?'draw':null;}
export function validBoard(b){if(!Array.isArray(b)||b.length!==9||b.some(v=>!['','X','O'].includes(v)))return false;const x=b.filter(v=>v==='X').length,o=b.filter(v=>v==='O').length,win=mark=>lines.some(line=>line.every(i=>b[i]===mark));return (x===o||x===o+1)&&!(win('X')&&win('O'))&&(!win('X')||x===o+1)&&(!win('O')||x===o);}
export function game(config,trace=true){return timed(()=>{
  const {board,ai}=config.problem;if(!validBoard(board))throw Error('This Tic-Tac-Toe position is not legal.');
  const turn=board.filter(v=>v==='X').length===board.filter(v=>v==='O').length?'X':'O';if(config.problem.turn!==turn&&!winner(board))throw Error('The selected turn does not match this board.');
  const rec=recorder(trace,12000),tree=[],metrics={nodesEvaluated:0,terminalEvaluations:0,cutoffs:0,searchDepth:0},pruning=config.algorithm==='alphabeta';let nextId=0,retained=0;
  const visit=(b,player,depth,alpha,beta,parent=null,move=null)=>{
    const id=nextId++,storeNode=trace&&(id<30000||depth<=2),node={id,parent,move,player,depth,board:storeNode?b.slice():null,alpha,beta,value:null,children:[],pruned:[],bound:'exact',updates:[]};if(storeNode){tree[id]=node;retained++;}metrics.nodesEvaluated++;metrics.searchDepth=Math.max(metrics.searchDepth,depth);
    const emit=(event,line,reason)=>{rec.add(event,{board:b,nodeId:id,depth,player,alpha:node.alpha,beta:node.beta,value:node.value},metrics,line,reason);if(storeNode&&event!=='visit')node.updates.push({event:rec.events,value:node.value,alpha:node.alpha,beta:node.beta,bound:node.bound});if(event==='cutoff')node.cutoffEvent=rec.events;};
    emit('visit',0,`${player===ai?'MAX':'MIN'} at depth ${depth}; α = ${alpha}, β = ${beta}.`);
    const win=winner(b);if(win){node.value=win==='draw'?0:win===ai?1:-1;metrics.terminalEvaluations++;emit('terminal',1,`${win==='draw'?'Draw':`${win} wins`}: utility ${node.value} from ${ai}'s perspective.`);return{value:node.value,move:null,id};}
    let moves=b.map((v,i)=>v?null:i).filter(v=>v!==null);if(config.ordering==='center')moves.sort((a,b)=>[4,0,2,6,8,1,3,5,7].indexOf(a)-[4,0,2,6,8,1,3,5,7].indexOf(b));
    const max=player===ai;let value=max?-Infinity:Infinity,bestMove=null;
    for(let j=0;j<moves.length;j++){
      const m=moves[j],z=b.slice();z[m]=player;const child=visit(z,player==='X'?'O':'X',depth+1,alpha,beta,id,m);if(storeNode)node.children.push(child.id);
      if(bestMove===null||(max?child.value>value:child.value<value)){value=child.value;bestMove=m;}node.value=value;
      if(pruning){if(max)alpha=Math.max(alpha,value);else beta=Math.min(beta,value);}node.alpha=alpha;node.beta=beta;
      emit('backup',2,`${max?'MAX takes the largest':'MIN takes the smallest'} child value: ${value}.`);
      if(pruning&&alpha>=beta&&j<moves.length-1){metrics.cutoffs++;node.pruned=moves.slice(j+1);node.bound=max?'lower bound':'upper bound';emit('cutoff',3,`α ≥ β (${alpha} ≥ ${beta}): skip ${moves.length-j-1} remaining children. The cutoff value is a ${node.bound}.`);break;}
    }
    return{value,move:bestMove,id};
  };
  const result=visit(board.slice(),turn,0,-Infinity,Infinity);rec.add('decision',{board,nodeId:0,move:result.move,value:result.value,player:turn,depth:0},metrics,4,result.move===null?'The position is terminal.':`Choose square ${result.move+1}; backed-up utility = ${result.value}.`,true);
  return{steps:rec.steps,status:result.move===null?'terminal':'solved',metrics,output:{move:result.move,value:result.value,tree,root:0,treeRetained:retained,treeTruncated:trace&&retained<nextId},traceSkipped:rec.skipped};
});}
