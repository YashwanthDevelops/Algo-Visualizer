import { random, recorder, timed } from "../core.js";
export function conflicts(q) {
  let s = 0;
  for (let a = 0; a < q.length; a++)
    for (let b = a + 1; b < q.length; b++)
      if (q[a] === q[b] || Math.abs(q[a] - q[b]) === b - a) s++;
  return s;
}
function exactSolution(n) {
  const placement=Array(n).fill(-1);
  let evaluations=0;
  function place(col,rows,down,up){
    if(col===n)return true;
    for(let row=0;row<n;row++){
      const bit=1<<row, d=1<<(row-col+n-1), u=1<<(row+col);
      evaluations++;
      if((rows&bit)||(down&d)||(up&u))continue;
      placement[col]=row;
      if(place(col+1,rows|bit,down|d,up|u))return true;
    }
    placement[col]=-1;
    return false;
  }
  return {queens:place(0,0,0,0)?placement:null,evaluations};
}
export function optimization(config, trace = true) {
  return timed(() => {
    const rec = recorder(trace),
      rng = random(config.seed);
    let q = config.problem.queens.slice(),
      n = q.length;
    if (
      n < 4 ||
      n > 12 ||
      q.some((v) => !Number.isInteger(v) || v < 0 || v >= n)
    )
      throw Error("Use 4-12 queens and one valid row per column.");
    if (
      config.algorithm === "anneal" &&
      (!(config.temperature > 0) || !(config.cooling > 0 && config.cooling < 1))
    )
      throw Error(
        "Temperature must be positive; cooling must be between 0 and 1.",
      );
    let score = conflicts(q),
      best = score,
      bestQueens = q.slice(),
      temperature = config.temperature || 8,
      candidate = null,
      candidates = [],
      chart = [{ iteration: 0, score, best }],
      status = "iteration-limit",
      sideways = 0,
      restarts = 0;
    const metrics = {
      candidateEvaluations: 1,
      iterations: 0,
      currentScore: score,
      bestScore: best,
      worseAccepted: 0,
      sidewaysMoves: 0,
      restarts: 0,
      recoveryEvaluations: 0,
    };
    const record = (event, line, reason, final = false) => {
      if (score < best) {
        best = score;
        bestQueens = q.slice();
      }
      metrics.currentScore = score;
      metrics.bestScore = best;
      if (trace)
        rec.add(
          event,
          {
            queens: q,
            score,
            best,
            bestQueens,
            temperature,
            candidate,
            candidates,
            chart,
          },
          metrics,
          line,
          reason,
          final,
        );
    };
    record(
      "initialize",
      0,
      `Start with ${score} attacking pairs. Each unordered pair counts once.`,
    );
    if (score === 0) status = "solved";
    for (let i = 1; score > 0 && i <= config.limit; i++) {
      metrics.iterations = i;
      candidates = [];
      if (config.algorithm === "hill") {
        let move = null,
          minScore = Infinity;
        for (let col = 0; col < n; col++)
          for (let row = 0; row < n; row++)
            if (row !== q[col]) {
              const z = q.slice();
              z[col] = row;
              const value = conflicts(z);
              metrics.candidateEvaluations++;
              candidate = { col, row, score: value, delta: value - score };
              candidates.push({ ...candidate });
              if (value < minScore) {
                minScore = value;
                move = { col, row, queens: z, score: value };
              }
              record(
                "candidate",
                1,
                `Try column ${col + 1}, row ${row + 1}: ${value} conflicts (${value - score >= 0 ? "+" : ""}${value - score}).`,
              );
            }
        if (minScore >= score) {
          if (
            minScore === score &&
            sideways < (config.sidewaysLimit || 0) &&
            move
          ) {
            q = move.queens;
            sideways++;
            metrics.sidewaysMoves++;
            candidate = move;
            record(
              "sideways",
              3,
              `Take an equal-score move (${sideways}/${config.sidewaysLimit}) to cross a plateau.`,
            );
          } else if (restarts < (config.restarts || 0)) {
            restarts++;
            metrics.restarts = restarts;
            q = Array.from({ length: n }, () => Math.floor(rng() * n));
            score = conflicts(q);
            sideways = 0;
            candidate = null;
            record(
              "restart",
              3,
              `Restart ${restarts}/${config.restarts} from a seeded random board (score ${score}).`,
            );
          } else {
            status = minScore === score ? "plateau" : "local-minimum";
            chart.push({ iteration: i, score, best });
            record(
              status,
              2,
              minScore === score
                ? "No improving move remains and the sideways-move allowance is exhausted."
                : "All single-queen moves worsen the score and restarts are exhausted.",
            );
            break;
          }
        } else {
          q = move.queens;
          score = move.score;
          sideways = 0;
          candidate = move;
          record(
            "improve",
            3,
            `Take the best strictly improving move: score becomes ${score}.`,
          );
        }
      } else {
        if (temperature < 1e-8) {
          status = "temperature-limit";
          break;
        }
        const k = Math.floor(rng() * n * (n - 1)),
          col = Math.floor(k / (n - 1));
        let row = k % (n - 1);
        if (row >= q[col]) row++;
        const z = q.slice();
        z[col] = row;
        const value = conflicts(z),
          delta = value - score,
          probability = delta <= 0 ? 1 : Math.exp(-delta / temperature),
          draw = delta <= 0 ? null : rng(),
          accepted = delta <= 0 || draw < probability;
        metrics.candidateEvaluations++;
        candidate = {
          col,
          row,
          score: value,
          delta,
          probability,
          draw,
          accepted,
        };
        candidates = [candidate];
        record(
          "candidate",
          1,
          `Propose column ${col + 1} → row ${row + 1}; Δ = ${delta}.`,
        );
        if (accepted) {
          q = z;
          score = value;
          if (delta > 0) metrics.worseAccepted++;
        }
        record(
          accepted ? "accept" : "reject",
          2,
          `${accepted ? "Accept" : "Reject"} ${delta > 0 ? "a worse" : "a non-worse"} move. p = ${probability.toFixed(4)}${draw === null ? "" : `, seeded draw = ${draw.toFixed(4)}`}.`,
        );
        temperature *= config.cooling;
      }
      if (score < best) {
        best = score;
        bestQueens = q.slice();
      }
      metrics.currentScore = score;
      metrics.bestScore = best;
      chart.push({ iteration: i, score, best });
      record(
        "iteration",
        3,
        `Iteration ${i}: current ${score}, best ${best}${config.algorithm === "anneal" ? `, next T = ${temperature.toFixed(4)}` : ""}.`,
      );
      if (score === 0) {
        status = "solved";
        break;
      }
    }
    if(score>0){
      const localStatus=status, recovered=exactSolution(n);
      candidates=[];
      metrics.recoveryEvaluations=recovered.evaluations;
      if(recovered.queens){
        for(let col=0;col<n;col++){
          const before=score;
          q[col]=recovered.queens[col];score=conflicts(q);
          candidate={col,row:q[col],score,delta:score-before,accepted:true,recovery:true};
          record('recovery',4,`Local search stopped at ${localStatus.replaceAll('-',' ')}. Exact completion places the queen in column ${col+1}, row ${q[col]+1}; ${score} conflicts remain.`);
        }
        chart.push({iteration:metrics.iterations,score,best});
        status='solved-after-recovery';
      }else status='no-solution';
    }
    metrics.currentScore = score;
    metrics.bestScore = best;
    record(
      status,
      4,
      status === "solved"
        ? "Zero attacking pairs: a valid N-Queens solution."
        : status === "solved-after-recovery"
          ? "Local search stalled. The exact completion phase found a valid arrangement with zero attacking pairs."
          : status === "no-solution"
            ? `No solution exists for a ${n}-queen board.`
        : `Stopped: ${status.replaceAll("-", " ")}. Best conflict score = ${best}; this is not a proof of impossibility.`,
      true,
    );
    return {
      steps: rec.steps,
      status,
      metrics,
      output: { queens: q, bestQueens },
      traceSkipped: rec.skipped,
    };
  });
}
