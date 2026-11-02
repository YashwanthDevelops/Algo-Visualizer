import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAnalyzeQuestion } from '../api/worker.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const body = { schemaVersion:1, selectedAlgorithm:'bfs', image:{mimeType:'image/png',base64:png} };
const env = { GEMINI_API_KEY:'test-key', ALLOWED_ORIGINS:'https://app.example' };
function request(value=body, headers={}) { return new Request('https://api.example/api/analyze-question',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(value)}); }
function providerResponse(draft) { return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(draft)}]}}]}),{status:200}); }

test('missing Gemini configuration is a clear service error and never calls provider', async () => {
  let called=false;
  const response=await handleAnalyzeQuestion(request(),{}, {fetch:async()=>{called=true;}});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error.code,'configuration_missing');
  assert.equal(called,false);
});

test('valid image calls Gemini and returns a normalized draft without exposing key', async () => {
  let target, init;
  const response=await handleAnalyzeQuestion(request(),env,{fetch:async(url,options)=>{target=url;init=options;return providerResponse({algorithm:'astar',algorithmCandidates:['astar','bogus'],questionText:'Find a path',directed:false,startId:'A',goalId:'Z',nodes:[{id:'A',label:'A',heuristic:2,x:-2},{id:'Z',label:'Z',heuristic:null}],edges:[{id:'e',source:'A',target:'Z',cost:null}]});}});
  const data=await response.json();
  assert.equal(response.status,200);
  assert.match(target,/gemini-3\.6-flash:generateContent$/);
  assert.equal(init.headers['x-goog-api-key'],'test-key');
  assert.deepEqual(data.draft.algorithmCandidates,['astar']);
  assert.equal(data.draft.nodes[0].x,0);
  assert.equal(data.draft.edges[0].cost,null);
  assert.equal(JSON.stringify(data).includes('test-key'),false);
});

test('rejects mismatched image magic before provider call', async () => {
  let called=false;
  const response=await handleAnalyzeQuestion(request({...body,image:{mimeType:'image/png',base64:'aGVsbG8='}}),env,{fetch:async()=>{called=true;}});
  assert.equal(response.status,415);
  assert.equal((await response.json()).error.code,'invalid_image');
  assert.equal(called,false);
});

test('invalid graph references become review issues and invalid edges are dropped', async () => {
  const response=await handleAnalyzeQuestion(request(),env,{fetch:async()=>providerResponse({algorithm:null,algorithmCandidates:[],nodes:[{id:'A',label:'A',heuristic:null}],edges:[{id:'e',source:'A',target:'missing',cost:3}],startId:'missing',goalId:null})});
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.draft.edges.length,0);
  assert.equal(data.draft.startId,null);
  assert.equal(data.uncertainties.some(i=>i.id==='invalid-start'),true);
});

test('rejects unsupported algorithm and oversized image inputs', async () => {
  const unsupported=await handleAnalyzeQuestion(request({...body,selectedAlgorithm:'dijkstra'}),env);
  assert.equal(unsupported.status,400);
  const tooLarge=await handleAnalyzeQuestion(request({...body,image:{...body.image,base64:'A'.repeat(11_200_000)}}),env);
  assert.equal(tooLarge.status,413);
});
