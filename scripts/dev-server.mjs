import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAnalyzeQuestion } from '../api/worker.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const env = { ...process.env };
for (const file of ['.env', '.dev.vars']) {
  try {
    const contents = await readFile(resolve(root, file), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && env[match[1]] === undefined) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const port = Number(process.env.PORT || 8001);
const localOrigins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
const configuredOrigins = String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
env.ALLOWED_ORIGINS = [...new Set([...configuredOrigins, ...localOrigins])].join(",");
const blocked = new Set(['.git','.env','.dev.vars','node_modules','api']);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};

const server = createServer(async (req, res) => {
  const origin = `http://${req.headers.host || `127.0.0.1:${port}`}`;
  const url = new URL(req.url, origin);
  if (url.pathname === '/api/analyze-question') {
    if (req.method === 'OPTIONS') {
      const response = await handleAnalyzeQuestion(new Request(url, {method:'OPTIONS',headers:{origin:req.headers.origin || ''}}), env);
      res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(); return;
    }
    const chunks=[]; let size=0; let oversized=false;
    req.on('data', chunk => { size+=chunk.length; if (size>11_250_000) oversized=true; else if (!oversized) chunks.push(chunk); });
    req.on('end', async () => {
      if (oversized) { res.writeHead(413,{'content-type':'application/json; charset=utf-8'}); res.end('{"error":{"code":"image_too_large","message":"Image must be 8 MB or smaller."}}'); return; }
      try {
        const headers = new Headers();
        if (req.headers.origin) headers.set('origin',req.headers.origin);
        if (req.headers['content-type']) headers.set('content-type',req.headers['content-type']);
        headers.set('content-length',String(size));
        const requestInit={method:req.method,headers};
        if (req.method !== 'GET' && req.method !== 'HEAD') requestInit.body=Buffer.concat(chunks);
        const response=await handleAnalyzeQuestion(new Request(url,requestInit),env);
        res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(await response.text());
      } catch { res.writeHead(400,{'content-type':'application/json'}); res.end('{"error":{"code":"invalid_request","message":"Request could not be read."}}'); }
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let decoded;
  try { decoded=decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end('Bad path'); return; }
  const segments=decoded.split('/').filter(Boolean);
  if (segments.some(s => s.startsWith('.') || blocked.has(s.toLowerCase())) || decoded.includes('\\')) { res.writeHead(404); res.end('Not found'); return; }
  const target=resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
  if (!target.startsWith(root + sep) && target !== resolve(root,'index.html')) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const info=await stat(target);
    if (!info.isFile()) throw new Error('not file');
    res.writeHead(200,{'content-type':types[extname(target).toLowerCase()] || 'application/octet-stream','content-length':info.size,'x-content-type-options':'nosniff'});
    if (req.method==='HEAD') res.end(); else res.end(await readFile(target));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port,'127.0.0.1',()=>console.log(`Question Visualizer dev server at http://127.0.0.1:${port}`));
