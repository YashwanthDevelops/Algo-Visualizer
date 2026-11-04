import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fresh} from '../js/models.js';
import {optimization} from '../js/algorithms/optimization.js';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const origin=process.env.BASE_URL||'http://127.0.0.1:8001';
const browser=await chromium.launch({headless:true});
const tool=(page,id)=>page.locator(`.pf-tool-trigger[aria-controls="${id}"]`);
const set=async(page,id,value)=>page.locator(`#${id}`).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));},value);
try {
  for(const algorithm of ['hill','anneal'])for(const speed of process.env.NQUEENS_UI_ONLY?[]:[1,5,30]){
    const c={...fresh('optimization'),algorithm,problem:{queens:[1,3,0,0]},arrangement:'custom',limit:2};
    const expected=optimization(c).steps;
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(c=>{
      localStorage.setItem('so-playground-v1',JSON.stringify({version:1,configs:{optimization:c},history:[]}));
      const Native=window.Worker;
      window.Worker=class extends Native{postMessage(...args){setTimeout(()=>super.postMessage(...args),180);}};
    },c);
    await page.goto(`${origin}/#optimization`);await page.locator('.nq-page').waitFor();await page.evaluate(()=>document.fonts.ready);
    await tool(page,'pf-advanced').click();await page.locator('#speed').fill(String(speed));await page.locator('#speed').dispatchEvent('input');await page.locator('.pf-back').click();
    await page.evaluate(expected=>{
      const root=document.querySelector('.nq-page'),board=root.querySelector('.nq-board'),reason=root.querySelector('[data-nq=reason]');
      const targets=['.nq-board-frame','.nq-board','.pf-notebook','.nq-summary','.nq-chart','.pf-tools'];
      const boxes=()=>targets.map(s=>{const b=root.querySelector(s).getBoundingClientRect();return [b.x+scrollX,b.y+scrollY,b.width,b.height].map(n=>Math.round(n*10));});
      const base=JSON.stringify(boxes()),lines=[...root.querySelectorAll('.pf-code-lines li')],tops=lines.map(el=>el.offsetTop);
      window.review={violations:[],seen:[],loading:false};
      const frames=new Map(expected.map(f=>[String(f.eventIndex),f]));
      const check=()=>{
        const out=window.review;
        if(!board.isConnected||!reason.isConnected)out.violations.push('Study DOM replaced');
        if(JSON.stringify(boxes())!==base)out.violations.push('Panel dimensions changed');
        if(lines.some((el,i)=>el.offsetTop!==tops[i]))out.violations.push('Pseudocode line spacing changed');
        const b=board.getBoundingClientRect();if(Math.abs(b.width-b.height)>.1)out.violations.push('Board not square');
        if(!root.querySelector('.pf-loading-overlay').hidden){out.loading=true;return;}
        const stamp=root.dataset.executionStep;if(stamp==='ready')return;
        const f=frames.get(stamp);if(!f){out.violations.push('Unknown frame');return;}
        for(const s of ['.nq-board','.pf-code','#explanation'])if(root.querySelector(s).dataset.executionStep!==stamp)out.violations.push('Mixed execution stamps');
        if(reason.textContent!==f.reason)out.violations.push('Explanation mismatch');
        if(root.querySelector('.pf-code-lines .is-active')?.dataset.line!==String(f.line))out.violations.push('Active line mismatch');
        root.querySelectorAll('[data-queen]').forEach((el,col)=>{if(+el.dataset.row!==f.state.queens[col])out.violations.push('Board state mismatch');});
        for(const key of ['currentScore','bestScore','iterations','candidateEvaluations'])if(root.querySelector(`[data-nq="${key}"]`).textContent!==String(f.metrics[key]))out.violations.push(`${key} mismatch`);
        if(out.seen.at(-1)!==+stamp)out.seen.push(+stamp);
      };
      window.reviewObserver=new MutationObserver(check);window.reviewObserver.observe(root,{subtree:true,attributes:true,characterData:true,childList:true});check();
    },expected);
    await page.locator('#run').click();await page.waitForFunction(()=>!document.querySelector('.pf-loading-overlay').hidden);
    await page.waitForFunction(()=>+document.querySelector('#scrub').value>=1);
    await page.locator('#pause').click();const paused=await page.locator('#scrub').inputValue();await page.waitForTimeout(180);assert.equal(await page.locator('#scrub').inputValue(),paused);
    await page.locator('#run').click();
    await page.waitForFunction(()=>{const s=document.querySelector('#scrub');return s.value===s.max&&document.querySelector('#pause').hidden;},null,{timeout:35000});
    await page.evaluate(()=>window.reviewObserver.disconnect());const review=await page.evaluate(()=>window.review);
    assert.deepEqual(review.violations,[]);assert.equal(review.loading,true);assert.deepEqual(review.seen,expected.map(f=>f.eventIndex));assert.deepEqual(errors,[]);
    await page.locator('#scrub').fill('0');await page.locator('#scrub').dispatchEvent('input');assert.equal(await page.locator('.nq-page').getAttribute('data-execution-step'),String(expected[0].eventIndex));
    await tool(page,'pf-advanced').click();assert.equal(await page.locator('#temperature').count(),algorithm==='anneal'?1:0);assert.equal(await page.locator('#sidewaysLimit').count(),algorithm==='hill'?1:0);await page.locator('.pf-back').click();
    await tool(page,'nq-candidates').click();assert.match(await page.locator('.nq-candidate-list').innerText(),/No candidates/);await page.locator('.pf-back').click();
    console.log(JSON.stringify({algorithm,speed,frames:review.seen.length,stablePanels:true,loading:true,pauseResume:true,complete:true,accurateReplay:true}));await page.close();
  }

  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/#optimization`);await page.locator('.nq-page').waitFor();
  const rows=()=>page.locator('.nq-board [data-queen]').evaluateAll(els=>els.map(el=>+el.dataset.row));
  const initial=await rows();await tool(page,'pf-editor').click();await page.locator('#nq-cell-2-0').click();assert.deepEqual(await rows(),[2,...initial.slice(1)]);
  await page.locator('#nq-cell-3-1').focus();await page.keyboard.press('Enter');assert.equal((await rows())[1],3);
  await page.locator('#queen-rows').fill('2, 4, 6, 8, 3, 1, 7, 5');await page.locator('[data-action=apply-queens]').click();assert.deepEqual(await rows(),[1,3,5,7,2,0,6,4]);await page.locator('.pf-back').click();
  for(const preset of ['random','aligned','stalled','local','solved','custom']){
    await set(page,'arrangement',preset);const q=await rows();assert.equal(q.length,preset==='local'?8:['stalled','solved'].includes(preset)?4:q.length);if(preset==='aligned')assert(q.every(r=>r===0));if(preset==='solved')assert.deepEqual(q,[1,3,0,2]);
  }
  for(const n of [4,12]){await set(page,'size',n);assert.equal((await rows()).length,n);}
  for(const n of [3,13]){await set(page,'size',n);assert.equal((await rows()).length,12);assert.equal(await page.locator('#size').inputValue(),'12');}
  await set(page,'size',8);await set(page,'arrangement','local');
  await tool(page,'pf-comparisons').click();await page.locator('[data-action=compare]').click();await page.locator('.pf-comparison-dialog .history-table').waitFor();assert.equal(await page.locator('.pf-comparison-dialog .history-table tbody tr').count(),2);
  await page.locator('[data-action=compare-visual]').click();await page.locator('.compare-boards .nq-board').first().waitFor();assert.equal(await page.locator('.compare-boards .nq-board').count(),2);
  await page.locator('#visual-progress').fill('1000');await page.locator('#visual-progress').dispatchEvent('input');assert.equal(await page.locator('#visual-progress-label').innerText(),'100%');
  await page.locator('[aria-label="Close comparison"]').click();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(tmpdir(),'algoai-nqueens-final-desktop.png'),fullPage:true});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('so-playground-v1')));assert.equal(saved.configs.optimization.problem.queens.length,8);assert(saved.history.length>0);
  await page.reload();assert.deepEqual(await rows(),saved.configs.optimization.problem.queens);
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:844});
    const layout=await page.evaluate(()=>['.nq-board-frame','.pf-playback','.nq-summary','.nq-chart','.pf-notebook'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {s,left:r.left,right:r.right,viewport:innerWidth};}));
    for(const r of layout)assert(r.left>=-.5&&r.right<=r.viewport+.5,`${r.s} clipped at ${width}px`);
    const board=await page.locator('.nq-board').boundingBox();assert(Math.abs(board.width-board.height)<.1);
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  const geometry=await page.locator('.nq-board').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth}));assert(Math.abs(geometry.width-geometry.height)<.1);assert.equal(geometry.overflow,false);
  await tool(page,'pf-comparisons').click();const modal=await page.locator('.pf-comparison-dialog').boundingBox();assert(modal.x>=0&&modal.x+modal.width<=390.5);await page.locator('[aria-label="Close comparison"]').click();
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.nq-queen').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(tmpdir(),'algoai-nqueens-final-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('Board editing, all presets, 4–12 bounds, comparisons, saved data, mobile square geometry, and reduced motion passed.');
}finally{await browser.close();}
