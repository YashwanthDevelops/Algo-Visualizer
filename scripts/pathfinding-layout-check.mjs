import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { fresh, gridPreset } from '../js/models.js';
import { pathfinding } from '../js/algorithms/pathfinding.js';
import { encodeConfiguration } from '../js/storage.js';

const origin = process.env.BASE_URL || 'http://127.0.0.1:8001';
const artifacts = process.env.ARTIFACT_DIR || join(tmpdir(),'algoai-pathfinding-review');
await mkdir(artifacts,{recursive:true});
const browser = await chromium.launch({headless:true});
try {
  for (const speed of [1,5,30]) {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    // Give loading a deterministic observation window; computation is still
    // performed by the real worker and all playback frames are real traces.
    await page.addInitScript(()=>{
      const NativeWorker=window.Worker;
      window.Worker=class extends NativeWorker {
        postMessage(...args){setTimeout(()=>super.postMessage(...args),180);}
      };
    });
    const c=fresh('pathfinding');
    if(speed!==30){
      c.problem=gridPreset('blank',5,5);c.problem.cells.fill(0);
      c.problem.start=11;c.problem.goal=13;
      for(const id of [11,12,13])c.problem.cells[id]=1;
      c.preset='custom';
    }
    const expected=pathfinding(c).steps;
    await page.goto(`${origin}/?lab=pathfinding&config=${encodeConfiguration('pathfinding',c)}#pathfinding`);
    await page.locator('.pf-page').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('[aria-controls=pf-advanced]').click();
    await page.locator('#speed').fill(String(speed));
    await page.locator('#speed').dispatchEvent('input');
    await page.locator('.pf-back').click();
    await page.evaluate(expected=>{
      const root=document.querySelector('.pf-page');
      const targets=['.pf-map-column','.pf-graph-frame','.pf-notebook','.pf-code-lines','.pf-tools'];
      const boxes=()=>targets.map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [r.x+scrollX,r.y+scrollY,r.width,r.height];});
      const base=boxes();const svg=root.querySelector('.grid-svg');const reason=root.querySelector('[data-pf=reason]');
      const lines=[...root.querySelectorAll('.pf-code-lines li')];const lineTops=lines.map(line=>line.offsetTop);
      window.review={violations:[],seen:[],loading:false,samples:0};
      function sample(){
        const t=window.review;t.samples++;
        if(!svg.isConnected||!reason.isConnected||lines.some(line=>!line.isConnected))t.violations.push('Study nodes replaced');
        if(JSON.stringify(base)!==JSON.stringify(boxes()))t.violations.push('Panel geometry changed');
        if(lines.some((line,i)=>line.offsetTop!==lineTops[i]))t.violations.push('Pseudocode spacing changed');
        if(!root.querySelector('.pf-loading-overlay').hidden){t.loading=true;return;}
        const stamp=root.dataset.executionStep;if(stamp==='ready')return;
        const frame=expected.find(item=>String(item.eventIndex)===stamp);
        if(!frame){t.violations.push(`Unknown event ${stamp}`);return;}
        for(const selector of ['.grid-svg','.pf-code','#explanation'])if(root.querySelector(selector).dataset.executionStep!==stamp)t.violations.push('Mixed execution steps');
        if(root.querySelector('.pf-code-lines .is-active')?.dataset.line!==String(frame.line))t.violations.push('Wrong pseudocode line');
        if(reason.textContent!==frame.reason)t.violations.push('Wrong explanation');
        const state=frame.state,frontier=new Set(state.frontier.map(n=>n.id)),path=new Set(state.path);
        [...svg.querySelectorAll('.cell')].forEach((cell,id)=>{
          const p=window.reviewProblem;
          const kind=id===p.start?'start':id===p.goal?'goal':id===state.current?'current':path.has(id)?'path':frontier.has(id)?'frontier':state.closed[id]?'expanded':p.cells[id]===0?'wall':p.cells[id]>1?'weight':'empty';
          if(cell.dataset.cellState!==kind)t.violations.push(`Graph mismatch ${stamp}/${id}`);
        });
        if(t.seen.at(-1)!==Number(stamp))t.seen.push(Number(stamp));
      }
      window.reviewObserver=new MutationObserver(sample);window.reviewObserver.observe(root,{subtree:true,attributes:true,childList:true,characterData:true});
      window.reviewSample=sample;sample();
    },expected);
    await page.evaluate(p=>window.reviewProblem=p,c.problem);
    await page.locator('#run').click();
    await page.waitForFunction(()=>!document.querySelector('.pf-loading-overlay').hidden);
    await page.waitForFunction(()=>Number(document.querySelector('#scrub').max)>0);
    await page.waitForFunction(()=>Number(document.querySelector('#scrub').value)>=1);
    await page.locator('#pause').click();
    const paused=await page.locator('#scrub').inputValue();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#scrub').inputValue(),paused,'Pause advances playback');
    await page.locator('#run').click();
    await page.waitForFunction(()=>{
      const slider=document.querySelector('#scrub');return slider.value===slider.max&&document.querySelector('#pause').hidden;
    },null,{timeout:45000});
    await page.evaluate(()=>{window.reviewSample();window.reviewObserver.disconnect();});
    const review=await page.evaluate(()=>window.review);
    assert.deepEqual(review.violations,[]);
    assert.equal(review.loading,true);
    assert.deepEqual(review.seen,expected.map(frame=>frame.eventIndex),'Recorded frames skipped or repeated');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({speed,frames:review.seen.length,samples:review.samples,layoutShifts:review.violations.length,pausedAndResumed:true,completed:true}));
    if(speed===30) {
      const route=page.locator('.pf-route-line');
      assert.equal((await route.getAttribute('points')).trim().split(' ').length,expected.at(-1).state.path.length);
      assert.equal(await page.locator('.cell text').evaluateAll(nodes=>nodes.some(node=>/[×◎↗○·]/.test(node.textContent))),false);
      assert.equal(await page.locator('[data-terrain=weight]').evaluateAll(nodes=>nodes.every(node=>node.querySelector('text').textContent!==' '&&Number(node.querySelector('text').textContent)>1)),true);
      await page.locator('#scrub').fill('0');await page.locator('#scrub').dispatchEvent('input');
      assert.equal(await route.getAttribute('points'),'');
      await page.locator('#scrub').fill(String(expected.length-1));await page.locator('#scrub').dispatchEvent('input');
      const documentHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
      for(const id of ['pf-editor','pf-advanced','pf-details','pf-shortcuts','pf-comparisons']){
        await page.locator(`[aria-controls="${id}"]`).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight),documentHeight,`${id} changes document height`);
        if(id==='pf-comparisons')await page.locator('[aria-label="Close comparison"]').click();
        else if(id==='pf-shortcuts')await page.keyboard.press('Escape');
        else await page.locator('.pf-back').click();
      }
      console.log('Tool views preserve document height; route scrubbing and terrain labels verified.');
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:join(artifacts,'pathfinding-stable-desktop.png'),fullPage:true});
    }
    await page.locator('#reset').click();
    assert.equal(await page.locator('.pf-code-lines .is-active').count(),0);
    await page.locator('#algorithm-trigger').click();
    await page.keyboard.press('Home');await page.keyboard.press('Enter');
    assert.equal(await page.locator('#algorithm').inputValue(),'bfs');
    await page.locator('#preset-trigger').click();await page.keyboard.press('Escape');
    assert.equal(await page.locator('#preset-trigger').getAttribute('aria-expanded'),'false');
    if(speed===30){
      await page.locator('[aria-controls=pf-editor]').click();
      await page.locator('[data-brush=weight]').click();
      await page.locator('#weight').fill('4');await page.locator('#weight').dispatchEvent('change');
      await page.locator('[data-cell="2"]').click();
      assert.equal(await page.locator('[data-cell="2"] text').textContent(),'4');
      assert.equal(await page.locator('.pf-page').getAttribute('data-tool'),'pf-editor');
      const mapSnapshot = () => page.locator('.grid-svg .cell').evaluateAll(cells=>cells.map(cell=>[cell.dataset.cellState,cell.dataset.terrain,cell.querySelector('text').textContent]));
      for(const brush of ['wall','clear','start','goal','weight','inspect']){
        await page.locator(`[data-brush="${brush}"]`).click();
        const before=await mapSnapshot();
        for(const id of [0,1,3,4])await page.locator(`[data-cell="${id}"]`).hover();
        assert.deepEqual(await mapSnapshot(),before,`${brush} changes the map on hover`);
      }
      await page.locator('[data-brush=wall]').click();
      const beforeClick=await mapSnapshot();
      await page.locator('[data-cell="0"]').click();
      const afterClick=await mapSnapshot();
      assert.deepEqual(afterClick.flatMap((value,index)=>JSON.stringify(value)!==JSON.stringify(beforeClick[index])?[index]:[]),[0]);
      const start=await page.locator('[data-cell="3"]').boundingBox(),end=await page.locator('[data-cell="6"]').boundingBox();
      await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();
      await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:8});await page.mouse.up();
      assert.deepEqual(await mapSnapshot(),afterClick,'Dragging paints cells');
      await page.locator('[data-cell="7"]').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-cell="7"]').getAttribute('data-terrain'),'wall');
      assert.equal(await page.locator('.pf-tool-trigger').first().evaluate(el=>getComputedStyle(el,'::after').content),'none');
      console.log('Hover and drag leave every brush unchanged; click and keyboard edit only the selected cell.');
      await page.locator('.pf-back').click();
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>scrollTo(0,0));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:join(artifacts,'pathfinding-stable-mobile.png'),fullPage:true});
      await page.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await page.locator('.cell rect').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log(`Screenshots: ${artifacts}`);
}finally{await browser.close();}
