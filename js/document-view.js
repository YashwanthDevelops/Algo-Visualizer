import {escapeHTML as e} from './core.js';

const documents = {
  reference: 'docs/ALGORITHMS.md', guide: 'README.md',
  architecture: 'docs/ARCHITECTURE.md', design: 'docs/DESIGN.md',
  questions: 'docs/QUESTION_VISUALIZER.md', timetable: 'docs/TIMETABLE_JSON.md',
  tests: 'docs/TEST_RESULTS.md', viva: 'docs/VIVA.md',
  glyph: 'docs/GLYPH_BACKGROUND.md',
};

function documentHref(value, source) {
  const url = new URL(value, new URL(source, location.href));
  if (!['http:', 'https:'].includes(url.protocol)) return '#guide';
  if (url.origin === location.origin) {
    for (const [key, file] of Object.entries(documents)) {
      if (url.pathname === new URL(file, location.href).pathname) {
        return key === 'reference' ? '#reference' : key === 'guide' ? '#guide' : `#guide?doc=${key}`;
      }
    }
  }
  return url.href;
}

// Render the local documentation without allowing raw HTML from Markdown.
function markdown(text, source) {
  const inline = value => {
    const tokens = [];
    const token = html => { tokens.push(html); return `\u0000${tokens.length - 1}\u0000`; };
    let result = value.replace(/`([^`]+)`/g, (_, code) => token(`<code>${e(code)}</code>`));
    result = result.replace(/!?\[([^\]]+)\]\(([^\s)]+)\)/g, (_, label, url) => token(`<a href="${e(documentHref(url, source))}">${e(label)}</a>`));
    result = e(result).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return result.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
  };
  const lines = text.replace(/\r/g, '').split('\n');
  const html = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; html.push(`<pre><code>${e(code.join('\n'))}</code></pre>`); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); i++; continue; }
    if (/^\|/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(value => inline(value.trim()));
      const headers = cells(line); i += 2; const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      html.push(`<div class="doc-table"><table><thead><tr>${headers.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (/^(?:[-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\d+\./.test(line), items = [];
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (i < lines.length && pattern.test(lines[i])) items.push(inline(lines[i++].replace(pattern, '')));
      const tag = ordered ? 'ol' : 'ul'; html.push(`<${tag}>${items.map(item => `<li>${item}</li>`).join('')}</${tag}>`); continue;
    }
    if (/^---+$/.test(line)) { html.push('<hr>'); i++; continue; }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(?:#|```|\||[-*] |\d+\. )/.test(lines[i])) paragraph.push(lines[i++]);
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return html.join('');
}

export function mountDocumentPage(container, route) {
  const key = route === 'reference' ? 'reference' : new URLSearchParams(location.hash.split('?')[1] || '').get('doc') || 'guide';
  const source = documents[key] || documents.guide;
  const controller = new AbortController();
  container.innerHTML = '<article class="document-page" aria-busy="true"><p role="status">Loading documentation…</p></article>';
  const article = container.querySelector('.document-page');
  fetch(source, {signal: controller.signal}).then(response => {
    if (!response.ok) throw Error('Documentation could not be loaded.');
    return response.text();
  }).then(text => {
    if (!controller.signal.aborted) { article.innerHTML = markdown(text, source); article.setAttribute('aria-busy', 'false'); }
  }).catch(error => {
    if (!controller.signal.aborted) { article.innerHTML = `<h1>Documentation unavailable</h1><p>${e(error.message)}</p><a href="#dashboard">Return home</a>`; article.setAttribute('aria-busy', 'false'); }
  });
  return () => controller.abort();
}
