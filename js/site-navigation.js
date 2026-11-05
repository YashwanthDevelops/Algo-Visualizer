import {icon} from './icons.js';

const NAV_ITEMS = [
  { label: "Pathfinding", href: "#pathfinding" },
  { label: "N-Queens", href: "#optimization" },
  { label: "Game AI", href: "#game" },
  { label: "Sudoku", href: "#sudoku" },
  { label: "Timetabling", href: "#timetable" },
];

const MENU_ITEMS = {
  Labs: NAV_ITEMS,
  Experiments: [
    { label: "Dashboard", href: "#dashboard" },
    { label: "Comparisons", href: "#dashboard?section=compare" },
    { label: "Experiment history", href: "#dashboard?section=history" },
  ],
};

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function chevron() {
  return '<svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

export function mountSiteNavigation(host, {onSameRoute = () => {}} = {}) {
  if (!host) throw new TypeError("mountSiteNavigation requires a host element");

  const activeRoute = () => location.hash || "#dashboard";
  const isCurrent = href => href === activeRoute() || (href === '#guide' && activeRoute().startsWith('#guide?doc='));
  const routeLink = (link) => isCurrent(link.href) ? 'aria-current="page"' : "";
  host.innerHTML = `<header class="sd-nav" aria-label="Site navigation">
    <a class="sd-brand" href="#dashboard" aria-label="AlgoAI home">
      <span class="sd-brand-name">AlgoAI</span>
    </a>
    <nav class="sd-center" aria-label="Main">
      ${Object.entries(MENU_ITEMS).map(([name, links]) => `<div class="sd-menu-wrap">
        <button class="sd-menu-trigger" type="button" aria-expanded="false" aria-haspopup="true">${name}${chevron()}</button>
        <div class="sd-menu" role="menu" aria-label="${name}">${links.map((link) => `<a role="menuitem" href="${esc(link.href)}" ${routeLink(link)}>${esc(link.label)}</a>`).join("")}</div>
      </div>`).join("")}
      <a class="sd-nav-link" href="#question-visualizer">Visualizer</a>
      <a class="sd-nav-link" href="#reference">Reference</a>
      <a class="sd-nav-link" href="#guide">Guide</a>
    </nav>
    <div class="sd-actions"><a class="sd-home" href="#dashboard">Home</a><a class="sd-cta" href="#question-visualizer">Visualize questions</a></div>
  </header>
  <nav class="sd-mobile-dock" aria-label="Mobile navigation">
    <span class="sd-dock-selection" aria-hidden="true"></span>
    <a class="sd-dock-item" href="#dashboard">${icon('squares-four')}<span>Home</span></a>
    <button class="sd-dock-item sd-dock-labs" type="button" aria-expanded="false" aria-controls="sd-mobile-sheet">${icon('book-open')}<span>Labs</span></button>
    <a class="sd-dock-item" href="#question-visualizer">${icon('tree-structure')}<span>Visualize</span></a>
    <button class="sd-dock-item sd-dock-more" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="sd-mobile-sheet">${icon('sliders-horizontal')}<span>More</span></button>
  </nav>
  <div class="sd-mobile-scrim" hidden></div>
  <nav id="sd-mobile-sheet" class="sd-mobile-panel" aria-label="Explore AlgoAI" aria-hidden="true" inert>
    <div class="sd-mobile-sheet-heading"><span>AlgoAI</span><button class="sd-mobile-close" type="button">Close</button></div>
    <div class="sd-mobile-main">
      <button class="sd-mobile-group" type="button" data-mobile-menu="Labs">Labs${chevron()}</button>
      <button class="sd-mobile-group" type="button" data-mobile-menu="Experiments">Experiments${chevron()}</button>
      <a href="#question-visualizer">Visualizer</a><a href="#reference">Reference</a><a href="#guide">Guide</a><a href="#dashboard">Home</a>
    </div>
    <div class="sd-mobile-sub" hidden><button class="sd-mobile-back" type="button"><span>Back</span></button><h2></h2><div class="sd-mobile-sub-links"></div></div>
    <a class="sd-mobile-cta" href="#question-visualizer">Visualize questions</a>
  </nav>`;

  const nav = host.querySelector(".sd-nav");
  const panel = host.querySelector(".sd-mobile-panel");
  const scrim = host.querySelector(".sd-mobile-scrim");
  const dock = host.querySelector('.sd-mobile-dock');
  const toggle = host.querySelector('.sd-dock-more');
  const labsToggle = host.querySelector('.sd-dock-labs');
  const mobileMain = host.querySelector(".sd-mobile-main");
  const mobileSub = host.querySelector(".sd-mobile-sub");
  let openMenu = null;
  let dropdownOpener = null;
  let outsidePointer;
  let mobileOpener = toggle;
  const updateDock = () => {
    const route = activeRoute().slice(1).split('?')[0];
    const index = panel.classList.contains('is-open') ? (mobileOpener === labsToggle ? 1 : 3)
      : NAV_ITEMS.some(item => item.href === `#${route}`) ? 1
      : route === 'question-visualizer' ? 2
      : route === 'dashboard' && !activeRoute().includes('?') ? 0 : 3;
    dock.style.setProperty('--sd-dock-index', index);
    [...dock.querySelectorAll('.sd-dock-item')].forEach((item,i) => item.classList.toggle('is-current',i === index));
  };

  const closeDropdown = (restore = false) => {
    if (!openMenu) return;
    openMenu.querySelector(".sd-menu-trigger").setAttribute("aria-expanded", "false");
    openMenu.classList.remove("is-open");
    openMenu = null;
    if (restore) dropdownOpener?.focus();
    dropdownOpener = null;
  };
  const closeMobile = (restore = false) => {
    if (!panel.classList.contains("is-open")) return;
    panel.classList.remove("is-open");
    scrim.hidden = true;
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    labsToggle.setAttribute('aria-expanded','false');
    mobileSub.hidden = true;
    mobileMain.hidden = false;
    updateDock();
    if (restore) mobileOpener.focus();
  };
  const showMobileGroup = (name) => {
    mobileSub.querySelector('h2').textContent = name;
    mobileSub.querySelector('.sd-mobile-sub-links').innerHTML = MENU_ITEMS[name].map(link => `<a href="${esc(link.href)}" ${routeLink(link)}>${esc(link.label)}</a>`).join('');
    mobileMain.hidden = true; mobileSub.hidden = false;
  };
  const openMobile = (opener = toggle, group = '') => {
    mobileOpener = opener;
    mobileSub.hidden = true; mobileMain.hidden = false;
    if (group) showMobileGroup(group);
    panel.inert = false;
    panel.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    panel.classList.add("is-open");
    toggle.setAttribute("aria-expanded", String(opener === toggle));
    labsToggle.setAttribute('aria-expanded',String(opener === labsToggle));
    toggle.setAttribute("aria-label", "Close navigation");
    updateDock();
    (group ? mobileSub.querySelector('a') : panel.querySelector('.sd-mobile-group')).focus({preventScroll:true});
  };
  const onTrigger = (event) => {
    const trigger = event.target.closest(".sd-menu-trigger");
    if (!trigger) return;
    const wrap = trigger.closest(".sd-menu-wrap");
    if (openMenu === wrap) closeDropdown();
    else {
      closeDropdown();
      openMenu = wrap;
      dropdownOpener = trigger;
      wrap.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      wrap.querySelector(".sd-menu a")?.focus();
    }
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      if (panel.classList.contains("is-open")) closeMobile(true);
      else if (openMenu) closeDropdown(true);
    }
    if (event.key === "Tab" && panel.classList.contains("is-open")) {
      const focusable = [...dock.querySelectorAll('a[href],button'), ...panel.querySelectorAll('a[href],button:not([disabled])')].filter((el) => !el.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  const center = host.querySelector(".sd-center");
  const onCenterKeydown = (event) => {
    if (event.key === "ArrowDown" && event.target.matches(".sd-menu-trigger")) {
      event.preventDefault();
      const trigger = event.target;
      const wrap = trigger.closest(".sd-menu-wrap");
      if (openMenu !== wrap) {
        closeDropdown();
        openMenu = wrap;
        dropdownOpener = trigger;
        wrap.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
      wrap.querySelector(".sd-menu a")?.focus();
    }
  };
  outsidePointer = (event) => {
    if (openMenu && !openMenu.contains(event.target)) closeDropdown();
  };
  center.addEventListener("click", onTrigger);
  center.addEventListener("keydown", onCenterKeydown);
  document.addEventListener("click", outsidePointer);
  const onToggle = () => panel.classList.contains("is-open") && mobileOpener === toggle ? closeMobile() : openMobile();
  const onLabs = () => panel.classList.contains('is-open') && mobileOpener === labsToggle ? closeMobile() : openMobile(labsToggle, 'Labs');
  const onScrim = () => closeMobile();
  const onMobileClick = (event) => {
    const back = event.target.closest(".sd-mobile-back");
    if (back) {
      mobileSub.hidden = true; mobileMain.hidden = false;
      mobileMain.querySelector("[data-mobile-menu]").focus();
      return;
    }
    const button = event.target.closest("[data-mobile-menu]");
    if (!button) return;
    const name = button.dataset.mobileMenu;
    showMobileGroup(name);
    mobileSub.querySelector(".sd-mobile-back").focus();
  };
  const onHostClick = (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    closeDropdown(); closeMobile();
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && link.getAttribute('href') === activeRoute()) {
      event.preventDefault();
      onSameRoute();
    }
  };
  toggle.addEventListener("click", onToggle);
  labsToggle.addEventListener('click',onLabs);
  const onClose = () => closeMobile(true);
  panel.querySelector('.sd-mobile-close').addEventListener('click',onClose);
  scrim.addEventListener("click", onScrim);
  panel.addEventListener("click", onMobileClick);
  host.addEventListener("click", onHostClick);
  document.addEventListener("keydown", onKeydown);
  const onResize = () => { if (window.matchMedia("(min-width: 992px)").matches) closeMobile(); };
  window.addEventListener("resize", onResize);
  const updateVisibility = () => {
    // Keep the universal navigation available even while scrolling the home page.
    nav.classList.remove('sd-nav-away');
    nav.inert = false;
  };
  window.addEventListener('scroll', updateVisibility, { passive: true });


  return {
    update(route) {
      const value = typeof route === "string" ? route : route?.hash || route?.route || "";
      nav.dataset.route = value.replace(/^#/, "").split(/[?&]/)[0];
      host.querySelectorAll('a[href^="#"]').forEach((link) => {
        if (isCurrent(link.getAttribute("href"))) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      updateVisibility();
      updateDock();
    },
    destroy() {
      closeDropdown(); closeMobile();
      center.removeEventListener("click", onTrigger);
      center.removeEventListener("keydown", onCenterKeydown);
      document.removeEventListener("click", outsidePointer);
      toggle.removeEventListener("click", onToggle);
      labsToggle.removeEventListener('click',onLabs);
      panel.querySelector('.sd-mobile-close').removeEventListener('click',onClose);
      scrim.removeEventListener("click", onScrim);
      panel.removeEventListener("click", onMobileClick);
      host.removeEventListener("click", onHostClick);
      document.removeEventListener("keydown", onKeydown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", updateVisibility);
      host.replaceChildren();
    },
  };
}
