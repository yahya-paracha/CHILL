import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { CAST } from './server/characters.mjs';
import { createGame, publicState, act, GameError } from './server/engine.mjs';
const root = path.resolve('public');
const sessions = new Map();
const maxAge = 6 * 60 * 60 * 1000;
setInterval(() => { for (const [id, s] of sessions) if (Date.now() - s.at > maxAge) sessions.delete(id); }, 60000).unref();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function body(req) { let raw = ''; for await (const c of req) { raw += c; if (raw.length > 8192) throw new GameError('Request is too large.', 413); } try { return JSON.parse(raw || '{}'); } catch { throw new GameError('Invalid JSON.'); } }
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/health') return json(res, 200, { ok: true });
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'POST' && req.headers.origin) { const origin = new URL(req.headers.origin).host; const allowed = [req.headers.host, req.headers['x-forwarded-host']]; if (!allowed.includes(origin)) throw new GameError('Cross-origin request rejected.', 403); }
      let sid = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('mafia_session='))?.split('=')[1];
      let session = sessions.get(sid);
      if (!session) { if (sessions.size >= 1500) throw new GameError('The room is busy. Try again shortly.', 503); sid = crypto.randomBytes(32).toString('hex'); session = { game: null, archive: [], at: Date.now(), locked: false, requests: [] }; sessions.set(sid, session); const secure = req.headers['x-forwarded-proto'] === 'https'; res.setHeader('Set-Cookie', `mafia_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=21600${secure ? '; Secure' : ''}`); }
      session.at = Date.now(); session.requests = session.requests.filter(t => Date.now() - t < 60000); if (session.requests.length > 160) throw new GameError('Slow down. Let the room breathe.', 429); session.requests.push(Date.now());
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, { game: session.game ? publicState(session.game) : null, cast: CAST.map(({ id, name, personality, color, bio }) => ({ id, name, personality, color, bio, alive: true, emotion: 'Composed', suspicionHint: 'Unknown' })), aiAvailable: !!process.env.OPENAI_API_KEY });
      if (req.method === 'GET' && url.pathname === '/api/history') return json(res, 200, { games: session.archive });
      if (req.method !== 'POST') throw new GameError('Endpoint not found.', 404);
      if (session.locked) throw new GameError('A decision is already being processed.', 409);
      session.locked = true;
      try {
        const data = await body(req);
        if (url.pathname === '/api/start') { if (session.game?.phase === 'GAME_OVER') { session.archive.unshift(publicState(session.game)); session.archive = session.archive.slice(0, 8); } session.game = createGame({ remix: !!data.remix, dynamicDialogue: !!data.dynamicDialogue }); return json(res, 200, { game: publicState(session.game) }); }
        if (url.pathname === '/api/action') { if (!session.game) throw new GameError('Start a game first.', 409); const game = await act(session.game, data.action, data); return json(res, 200, { game }); }
        throw new GameError('Endpoint not found.', 404);
      } finally { session.locked = false; }
    }
    if (!['GET', 'HEAD'].includes(req.method)) throw new GameError('Method not allowed.', 405);
    let requestPath; try { requestPath = decodeURIComponent(url.pathname); } catch { throw new GameError('Invalid path.'); }
    const file = path.resolve(root, '.' + (requestPath === '/' ? '/index.html' : requestPath));
    if (!file.startsWith(root + path.sep)) throw new GameError('Not found.', 404);
    const info = await stat(file).catch(() => null); if (!info?.isFile()) throw new GameError('Not found.', 404);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch (err) { if (!res.headersSent) json(res, err.status || 500, { error: err.status ? err.message : 'The room went quiet. Please try again.' }); else res.end(); if (!err.status) console.error(err.message); }
});
server.requestTimeout = 15000;
server.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () => console.log('AI MAFIA is listening on port ' + (process.env.PORT || 3000)));
