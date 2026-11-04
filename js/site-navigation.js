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
    <button class="sd-mobile-toggle" type="button" aria-label="Open navigation" aria-expanded="false"><span></span><span></span></button>
  </header>
  <div class="sd-mobile-scrim" hidden></div>
  <nav class="sd-mobile-panel" aria-label="Mobile navigation" aria-hidden="true" inert>
    <div class="sd-mobile-main">
      <button class="sd-mobile-group" type="button" data-mobile-menu="Labs">Labs${chevron()}</button>
      <button class="sd-mobile-group" type="button" data-mobile-menu="Experiments">Experiments${chevron()}</button>
      <a href="#question-visualizer">Visualizer</a><a href="#reference">Reference</a><a href="#guide">Guide</a><a href="#dashboard">Home</a>
    </div>
    <div class="sd-mobile-sub" hidden><button class="sd-mobile-back" type="button">← <span>Back</span></button><h2></h2><div class="sd-mobile-sub-links"></div></div>
    <a class="sd-mobile-cta" href="#question-visualizer">Visualize questions</a>
  </nav>`;

  const nav = host.querySelector(".sd-nav");
  const panel = host.querySelector(".sd-mobile-panel");
  const scrim = host.querySelector(".sd-mobile-scrim");
  const toggle = host.querySelector(".sd-mobile-toggle");
  const mobileMain = host.querySelector(".sd-mobile-main");
  const mobileSub = host.querySelector(".sd-mobile-sub");
  let openMenu = null;
  let dropdownOpener = null;
  let outsidePointer;

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
    mobileSub.hidden = true;
    mobileMain.hidden = false;
    if (restore) toggle.focus();
  };
  const openMobile = () => {
    panel.inert = false;
    panel.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    panel.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation");
    panel.querySelector(".sd-mobile-group").focus();
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
      const focusable = [toggle, ...panel.querySelectorAll('a[href],button:not([disabled])')].filter((el) => !el.closest('[hidden]'));
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
  const onToggle = () => panel.classList.contains("is-open") ? closeMobile() : openMobile();
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
    mobileSub.querySelector("h2").textContent = name;
    mobileSub.querySelector(".sd-mobile-sub-links").innerHTML = MENU_ITEMS[name].map((link) => `<a href="${esc(link.href)}" ${routeLink(link)}>${esc(link.label)}</a>`).join("");
    mobileMain.hidden = true; mobileSub.hidden = false;
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
    },
    destroy() {
      closeDropdown(); closeMobile();
      center.removeEventListener("click", onTrigger);
      center.removeEventListener("keydown", onCenterKeydown);
      document.removeEventListener("click", outsidePointer);
      toggle.removeEventListener("click", onToggle);
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
