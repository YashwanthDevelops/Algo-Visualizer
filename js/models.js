import {clone,random} from './core.js';
export function gridPreset(name='weighted'){
  const rows=10,cols=16,cells=Array(rows*cols).fill(1);let start=4*cols+1,goal=4*cols+14;
  if(name==='weighted'){for(let c=3;c<13;c++)cells[4*cols+c]=9;for(let r=1;r<9;r++)if(r!==4&&r!==7)cells[r*cols+8]=0;}
  if(name==='maze'){for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if(c===5&&r!==1||c===10&&r!==8)cells[r*cols+c]=0;}for(let c=1;c<5;c++)cells[6*cols+c]=0;}
  if(name==='unreachable'){for(const d of [-cols,cols,-1,1])cells[goal+d]=0;}
  cells[start]=cells[goal]=1;return{rows,cols,cells,start,goal};
}
export function queensPreset(n=8,seed=42){const rng=random(seed);return Array.from({length:n},()=>Math.floor(rng()*n));}
const solved=['534678912','672195348','198342567','859761423','426853791','713924856','961537284','287419635','345286179'];
export function sudokuPreset(name='easy'){
  let rows=solved.map(x=>x.split('').map(Number));
  if(name==='easy')for(const i of [34,58,42,24,40,48,20,13,61,50,5,11,10,63,38,62,1,74,37,31,54,56,72,77,76,19,23,28,43,22,3,47,36,60,2,69])rows[Math.floor(i/9)][i%9]=0;
  else rows=['530070000','600195000','098000060','800060003','400803001','700020006','060000280','000419005','000080079'].map(x=>x.split('').map(Number));
  if(name==='invalid')rows[0][1]=5;
  if(name==='impossible')rows[0][2]=1;
  return rows.flat();
}
export function timetablePreset(name='feasible'){
  return {slots:['Mon 09:00','Mon 10:00','Tue 09:00'],rooms:[{id:'R1',available:[0,1,2]},{id:'R2',available:[1,2]}],teachers:[{id:'Ada',available:name==='impossible'?[0,1]:[0,1,2]},{id:'Ben',available:[1,2]}],sessions:[
    {id:'MA1',name:'Math A · 1',teacher:'Ada',group:'A',rooms:['R1','R2']},
    {id:'MA2',name:'Math A · 2',teacher:'Ada',group:'A',rooms:['R1','R2']},
    {id:'PA',name:'Physics A',teacher:'Ben',group:'A',rooms:['R1']},
    {id:'MB',name:'Math B',teacher:'Ada',group:'B',rooms:['R1','R2']},
    {id:'PB',name:'Physics B',teacher:'Ben',group:'B',rooms:['R1']} ]};
}
export const defaults={pathfinding:{algorithm:'astar',problem:gridPreset(),preset:'weighted',limit:20000},optimization:{algorithm:'hill',problem:{queens:queensPreset()},arrangement:'random',trialStarts:'current',seed:42,temperature:8,cooling:0.98,limit:300},game:{algorithm:'alphabeta',problem:{board:Array(9).fill(''),turn:'X',ai:'O'},position:'empty',ordering:'natural',limit:1000000},sudoku:{algorithm:'forward',problem:{board:sudokuPreset()},puzzle:'easy',limit:50000},timetable:{algorithm:'forward',problem:timetablePreset(),dataset:'feasible',limit:10000}};
export const algorithms={pathfinding:['bfs','dfs','ucs','greedy','astar'],optimization:['hill','anneal'],game:['minimax','alphabeta'],sudoku:['backtracking','forward'],timetable:['backtracking','forward']};
export function fresh(lab){return clone(defaults[lab]);}
