// Phosphor Regular SVGs, retrieved with better-icons. License: assets/icons/LICENSE.txt.
export const iconSprite = new URL('../assets/icons/phosphor.svg', import.meta.url).href;

// Icons accompany visible labels; the SVG itself stays out of the accessibility tree.
export function icon(name, className = '') {
  return `<svg class="icon ${className}" width="18" height="18" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><use href="${iconSprite}#${name}"></use></svg>`;
}
