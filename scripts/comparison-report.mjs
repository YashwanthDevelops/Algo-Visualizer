import fs from 'node:fs';
import {compare} from '../js/engine.js';
import {fresh} from '../js/models.js';
import {labels} from '../js/core.js';
import {metricKeys,metricLabels,format} from '../js/renderers.js';
const results=Object.fromEntries(['pathfinding','optimization','game','sudoku','timetable'].map(lab=>[lab,{config:fresh(lab),results:compare(lab,fresh(lab))}]));
const metadata={generated:new Date().toISOString(),runtime:process.version,platform:process.platform,architecture:process.arch};
fs.mkdirSync('reports',{recursive:true});fs.writeFileSync('reports/comparisons.json',JSON.stringify({metadata,experiments:results},null,2));
let md=`# Actual comparison report\n\nGenerated: ${metadata.generated}. Runtime: Node ${metadata.runtime}, ${metadata.platform}/${metadata.architecture}. Browser timings will differ. Inputs are the unchanged default presets; raw configurations, per-run measurements, seeds, starting boards, and timing repetitions are in [comparisons.json](comparisons.json). No animation or rendering was included.\n\nDeterministic algorithms: one warm-up and five timing runs. Optimization: the same configured arrangement for both algorithms, 20 consecutive seeds starting at 42, three timing repetitions per trial; trial timing medians and operation counts are summarized using medians. Success rates apply to this finite trial set, not all N-Queens inputs.\n`;
for(const [lab,experiment] of Object.entries(results)){
  const keys=metricKeys[lab];md+=`\n## ${lab}\n\n| Algorithm | Outcome | ${keys.map(k=>metricLabels[k]).join(' | ')}${lab==='optimization'?' | Success':''} |\n| --- | --- | ${keys.map(()=>'---:').join(' | ')}${lab==='optimization'?' | ---:':''} |\n`;
  for(const r of experiment.results)md+=`| ${labels[r.algorithm]} | ${r.status} | ${keys.map(k=>format(r.metrics[k],k)).join(' | ')}${lab==='optimization'?` | ${Math.round(r.successRate*100)}% (${r.trials} trials)`:''} |\n`;
}
md+='\n## Interpretation\n\nThe weighted grid distinguishes minimum moves from minimum cost. Compare UCS and A* cost before comparing their expansion counts. N-Queens success is sensitive to seed, arrangement, temperature, cooling, and iteration budget. Game pruning preserves the root utility; savings depend on move ordering. Forward checking spends work filtering domains to reduce candidate attempts and backtracks; short timing differences are noisy. A failed/limited algorithm is not a performance winner merely because it stopped quickly.\n\nTiming values include shared algorithm bookkeeping, but exclude trace copying. Tiny durations are sensitive to JIT warm-up, garbage collection, and timer resolution. Counts and correctness are stronger evidence for a university report than small timing differences.\n';
fs.writeFileSync('reports/COMPARISON_REPORT.md',md);console.log(JSON.stringify({report:'reports/COMPARISON_REPORT.md',raw:'reports/comparisons.json',experiments:Object.keys(results),runtime:metadata.runtime}));
