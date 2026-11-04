const portraits = Array.from({ length: 16 }, (_, index) => {
  const n = index + 1;
  const src = `assets/skydive/hero/rq${n}.webp`;
  return `<div class="sd-orbit-card sd-orbit-${n}" data-orbit-card="${n}"><img src="${src}" alt="" loading="${n < 7 ? "eager" : "lazy"}" /></div>`;
}).join("");

const templates = [
  { title: "Pathfinding", type: "Search lab", text: "Trace how an algorithm finds its way across a map.", href: "#pathfinding", mark: "01" },
  { title: "N-Queens", type: "Optimization", text: "Find a conflict-free board, one decision at a time.", href: "#optimization", mark: "02" },
  { title: "Game search", type: "Adversarial AI", text: "Explore the search behind a game of Tic-Tac-Toe.", href: "#game", mark: "03" },
  { title: "Constraint solving", type: "Sudoku", text: "Watch domains shrink as the puzzle takes shape.", href: "#sudoku", mark: "04" },
  { title: "Timetable", type: "Scheduling", text: "Build a schedule around real constraints.", href: "#timetable", mark: "05" },
  { title: "Question visualizer", type: "Learn from a question", text: "Turn a question into a clear, visual explanation.", href: "#question-visualizer", mark: "06", featured: true },
  { title: "Compare runs", type: "Your experiments", text: "See how algorithms behave on the same input.", href: "#dashboard?section=compare", mark: "07" },
  { title: "Experiment history", type: "Your experiments", text: "Return to a saved run and pick up where you left off.", href: "#dashboard?section=history", mark: "08" },
];

function templateCard(card, index) {
  return `<a class="sd-template-card${card.featured ? " sd-template-featured" : ""}" href="${card.href}"${card.jump ? ` data-dashboard-jump="${card.jump}"` : ""} style="--sd-card-index:${index}">
    <span class="sd-template-art"><img src="assets/skydive/hero/rq${index + 1}.webp" alt="" loading="lazy" /><span aria-hidden="true">+</span></span>
    <span class="sd-template-title">${card.title}</span>
    <span class="sd-template-copy">${card.text}</span>
    <span class="sd-template-chips"><i>${card.type}</i><i>${index < 5 ? "Interactive" : "Your workspace"}</i></span>
  </a>`;
}

/** Build the homepage around the live comparison and history fragments from main.js. */
export function dashboardHTML({ comparisonHTML = "", historyHTML = "" } = {}) {
  return `<div class="sd-dashboard">
    <section class="sd-hero" aria-labelledby="sd-hero-title"><div class="sd-hero-stage">
      <div class="sd-hero-glyph" aria-hidden="true"></div>
      <div class="sd-hero-orbit" aria-hidden="true">${portraits}</div>
      <div class="sd-hero-copy">
        <p class="sd-eyebrow">Foundations of Artificial Intelligence</p>
        <h1 id="sd-hero-title">A place to study.<span>AI, brought to life.</span></h1>
        <p class="sd-hero-description">Explore the foundations, one decision at a time.</p>
        <a class="sd-button sd-button-light sd-hero-cta" href="#question-visualizer">Visualize questions</a>
      </div>
    <div class="sd-intro" id="sd-intro" aria-labelledby="sd-intro-title">
      <div class="sd-intro-copy"><p id="sd-intro-title">Artificial intelligence is full of ideas worth exploring. Follow a question, experiment with an algorithm, and watch the concepts take shape as you go.</p></div>
    </div></div></section>

    <section class="sd-workbench" aria-labelledby="sd-workbench-title">
      <div class="sd-workbench-stage" id="sd-compare" data-dashboard-section="compare"><div class="sd-workbench-inner">
        <div class="sd-stage-copy"><h2 id="sd-workbench-title">Compare<br />what you find.</h2><p>Same problem, different approaches. See how each algorithm performs, and discover what the results can tell you.</p><a class="sd-text-link" href="#sd-templates">Explore the labs <span aria-hidden="true">↗</span></a></div>
        <div class="sd-workbench-window sd-comparison-window">
          <div class="sd-window-bar"><span class="sd-window-lights"><i></i><i></i><i></i></span><span>COMPARE / EXPERIMENTS</span><span class="sd-window-count">01</span></div>
          <div class="sd-embedded-content">${comparisonHTML}</div>
        </div>
      </div></div>
      <div class="sd-workbench-stage sd-history-stage" id="sd-history" data-dashboard-section="history"><div class="sd-workbench-inner">
        <div class="sd-stage-copy"><h2>Keep the<br />whole story.</h2><p>Each run is a chance to learn. Revisit an experiment, load its input, and keep building on what you discovered.</p><a class="sd-text-link" href="#sd-templates">Find a new question <span aria-hidden="true">↗</span></a></div>
        <div class="sd-workbench-window sd-history-window">
          <div class="sd-window-bar"><span class="sd-window-lights"><i></i><i></i><i></i></span><span>HISTORY / YOUR WORK</span><span class="sd-window-count">02</span></div>
          <div class="sd-embedded-content">${historyHTML}</div>
        </div>
      </div></div>
      <div class="sd-workbench-caption"><span>Keep experimenting</span><span>Every run tells you something new. ↗</span></div>
    </section>

    <section class="sd-templates" id="sd-templates" aria-labelledby="sd-templates-title">
      <div class="sd-section-heading sd-template-heading"><div><h2 id="sd-templates-title">Explore the possibilities.</h2></div></div>
      <div class="sd-template-grid">${templates.map(templateCard).join("")}</div>
    </section>

    <section class="sd-mountain-cta" aria-labelledby="sd-mountain-title">
      <img class="sd-mountain-image" src="assets/skydive/mountains.webp" alt="" loading="lazy" />
      <div class="sd-mountain-shade"></div>
      <div class="sd-mountain-content"><h2 id="sd-mountain-title">Let’s explore</h2><a class="sd-button sd-button-light" href="#question-visualizer">Start learning <span aria-hidden="true">↗</span></a></div>
      <div class="sd-mountain-caption"><span>Foundations of Artificial Intelligence</span><span>Start anywhere. See where it takes you.</span></div>
    </section>

    <footer class="sd-footer"><div class="sd-footer-columns"><div><a class="sd-footer-home" href="#dashboard">AlgoAI</a><p>Foundations of Artificial Intelligence.<br>Learn through exploration.</p></div><div><h3>LABORATORIES</h3><a href="#pathfinding">Pathfinding</a><a href="#optimization">N-Queens</a><a href="#game">Game AI</a><a href="#sudoku">Sudoku</a><a href="#timetable">Timetabling</a></div><div><h3>EXPLORE</h3><a href="#question-visualizer">Question Visualizer</a><a href="#dashboard?section=compare">Comparisons</a><a href="#dashboard?section=history">Experiment history</a></div><div><h3>REFERENCE</h3><a href="#reference">Algorithms</a><a href="#guide">Project guide</a><a href="#guide?doc=architecture">Architecture</a></div></div><a class="sd-footer-brand" href="#dashboard">AlgoAI</a><div class="sd-footer-bottom"><span>AlgoAI</span><span>Experiments saved in this browser</span><a href="#sd-hero-title">Back to top ↑</a></div></footer>
  </div>`;
}

/** Native motion follows the reference's orbit and scroll-revealed introduction. */
export function mountDashboardMotion(root) {
  if (!root) return () => {};
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hero = root.querySelector('.sd-hero');
  const stage = root.querySelector('.sd-hero-stage');
  const copy = root.querySelector('.sd-hero-copy');
  const intro = root.querySelector('.sd-intro');
  const cards = [...root.querySelectorAll('[data-orbit-card]')];
  const paragraph = root.querySelector('.sd-intro-copy p');
  const words = paragraph.textContent.split(/\s+/);
  paragraph.replaceChildren(...words.map(word => { const span = document.createElement('span'); span.textContent = word + ' '; return span; }));
  let frame = 0, stopped = false, start = null, pointer = null;
  let cleanupGlyph = () => {};
  const glyphHost = root.querySelector('.sd-hero-glyph');
  if (glyphHost) {
    import('../assets/glyph/hero-glyph.js').then(({mountHeroGlyph}) => {
      if (!stopped && glyphHost.isConnected) cleanupGlyph = mountHeroGlyph(glyphHost);
    }).catch(() => { glyphHost.dataset.renderer = 'unavailable'; });
  }
  const clamp = x => Math.max(0,Math.min(1,x));
  function tick(now) {
    if (stopped) return;
    const reduced = media.matches;
    const rect = hero.getBoundingClientRect();
    const width = stage.clientWidth, height = reduced ? innerHeight : stage.clientHeight;
    const inViewport = rect.bottom > 0 && rect.top < innerHeight;
    if (inViewport && start === null) start = now;
    const progress = clamp(-rect.top / Math.max(1,rect.height-height));
    const spread = clamp((progress-.15)/.65);
    if (inViewport) {
      const mobile = width < 600;
      const radius = Math.min(width*(mobile?.43:.31),height*.365);
      const size = mobile ? Math.min(44,width*.105) : Math.min(88,height*.098);
      cards.forEach((card,i) => {
        const angle = i/cards.length*Math.PI*2-Math.PI/2+(reduced?0:(now-start)*.000045);
        const expansion = radius*(1+spread*1.8);
        const x=width/2+Math.cos(angle)*expansion;
        const y=height/2+Math.sin(angle)*expansion;
        const distance = pointer ? Math.hypot(pointer.x-x,pointer.y-y) : 9999;
        const scale=1+Math.max(0,1-distance/160)*.2;
        card.style.width=`${size*.83}px`; card.style.height=`${size}px`;
        card.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale})`;
        card.style.opacity=reduced?'1':String(clamp((now-start-i*45)/650)*(1-clamp((progress-.88)/.12)));
      });
      copy.style.opacity = reduced ? "1" : String(1-clamp((progress-.02)/.2));
      copy.style.transform = reduced ? "none" : `translateY(${-progress*36}px)`;
      copy.style.pointerEvents = !reduced && progress>.2?'none':'auto';
      intro.style.opacity=reduced ? "1" : String(clamp((progress-.17)/.15));
      [...paragraph.children].forEach((word,i)=>word.style.opacity=reduced || progress>.25+i/words.length*.48?'1':'.13');
    }
    frame=requestAnimationFrame(tick);
  }
  const onPointer=e=>{ const r=stage.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top}; };
  const onLeave=()=>{pointer=null;};
  stage.addEventListener('pointermove',onPointer);stage.addEventListener('pointerleave',onLeave);
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('sd-in-view');observer.unobserve(entry.target);}}),{threshold:.08});
  root.querySelectorAll('.sd-template-card').forEach(card=>{ if(!media.matches)card.classList.add('sd-reveal');observer.observe(card); });
  frame=requestAnimationFrame(tick);
  return ()=>{stopped=true;cleanupGlyph();cancelAnimationFrame(frame);observer.disconnect();stage.removeEventListener('pointermove',onPointer);stage.removeEventListener('pointerleave',onLeave);};
}
