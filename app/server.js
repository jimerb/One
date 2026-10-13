import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import QRCode from 'qrcode';
import { RoomManager } from './rooms.js';
import { RuleError } from './engine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const HAS_LEGACY_SLIDE = await fs.access(path.join(PUBLIC, 'audio/legacy-card-slide.wav')).then(() => true, () => false);
const PORT = Number(process.env.PORT || 4444);
const rooms = new RoomManager();
const peers = new Map();
const privateIPv4 = ip => /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./u.test(ip);
const addresses = Object.values(os.networkInterfaces()).flat().filter(entry => entry && entry.family === 'IPv4' && !entry.internal).map(entry => entry.address);
const lanAddress = addresses.find(privateIPv4) ?? addresses[0] ?? 'localhost';
const inviteBase = process.env.ONE_PUBLIC_URL?.replace(/\/$/u, '') || `http://${lanAddress}:${PORT}`;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.webmanifest': 'application/manifest+json' };

const json = (response, status, value) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
};
async function body(request) {
  let bytes = 0, data = '';
  for await (const chunk of request) { bytes += chunk.length; if (bytes > 16_384) throw new RuleError('That request is too large.'); data += chunk; }
  try { return JSON.parse(data || '{}'); } catch { throw new RuleError('That request could not be read.'); }
}
function broadcast(code) {
  for (const [key, sockets] of peers) {
    const session = rooms.sessions.get(key);
    if (session?.room.code !== code) continue;
    const payload = JSON.stringify({ type: 'state', state: rooms.view(key) });
    for (const socket of sockets) if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}
rooms.on('change', broadcast);
rooms.on('remove', code => {
  for (const [key, sockets] of peers) if (rooms.sessions.get(key)?.room.code === code) {
    for (const socket of sockets) socket.close(1000, 'Table closed');
  }
});
rooms.on('fault', ({ code, error, command }) => console.error('A table paused:', code, command, error));

const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { ok: true, game: 'One', port: PORT });
    if (request.method === 'GET' && url.pathname === '/api/config') return json(response, 200, { inviteBase, port: PORT, cardSlideAudio: HAS_LEGACY_SLIDE ? '/audio/legacy-card-slide.wav' : null });
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const input = await body(request); delete input.seed;
      return json(response, 201, rooms.create(input));
    }
    const route = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(?:\/(join|qr\.svg))?$/iu);
    if (route) {
      if (request.method === 'GET' && !route[2]) return json(response, 200, rooms.publicLobby(route[1]));
      if (request.method === 'POST' && route[2] === 'join') return json(response, 201, rooms.join(route[1], await body(request)));
      if (request.method === 'GET' && route[2] === 'qr.svg') {
        rooms.getRoom(route[1]);
        const svg = await QRCode.toString(`${inviteBase}/r/${route[1].toUpperCase()}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#1b2925', light: '#ffffff' } });
        response.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }); return response.end(svg);
      }
    }
    if (request.method === 'GET' && url.pathname === '/api/session') {
      const key = request.headers.authorization?.replace(/^Bearer /u, '');
      return json(response, 200, rooms.view(key));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'That action is not available.' });
    const file = url.pathname === '/' || /^\/r\/[A-Z0-9]{6}$/iu.test(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const destination = path.resolve(PUBLIC, file);
    if (!destination.startsWith(`${PUBLIC}${path.sep}`)) return json(response, 404, { error: 'Not found.' });
    let content;
    try { content = await fs.readFile(destination); } catch { return json(response, 404, { error: 'Not found.' }); }
    response.writeHead(200, { 'Content-Type': types[path.extname(destination)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) { json(response, error instanceof RuleError ? 400 : 500, { error: error instanceof RuleError ? error.message : 'Something went wrong. Try again.' }); }
});

const ws = new WebSocketServer({ noServer: true, maxPayload: 16_384 });
server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== '/ws') throw new Error('Unknown socket');
    const key = url.searchParams.get('token'); rooms.session(key);
    if (request.headers.origin) {
      const origin = new URL(request.headers.origin);
      if (origin.host !== request.headers.host) throw new Error('Different origin');
    }
    ws.handleUpgrade(request, socket, head, client => ws.emit('connection', client, key));
  } catch { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); }
});
ws.on('connection', (socket, key) => {
  socket.isAlive = true;
  if (!peers.has(key)) peers.set(key, new Set()); peers.get(key).add(socket);
  rooms.connected(key, true);
  socket.send(JSON.stringify({ type: 'state', state: rooms.view(key) }));
  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'action') rooms.action(key, message.action, message.requestId, message.revision);
      else if (message.type === 'host') rooms.hostAction(key, message.action);
      else if (message.type === 'sync') socket.send(JSON.stringify({ type: 'state', state: rooms.view(key) }));
      else throw new RuleError('That message is not supported.');
    } catch (error) {
      socket.send(JSON.stringify({ type: 'error', message: error instanceof RuleError ? error.message : 'The move could not be read.' }));
      if (rooms.sessions.has(key)) socket.send(JSON.stringify({ type: 'state', state: rooms.view(key) }));
    }
  });
  socket.on('close', () => { peers.get(key)?.delete(socket); if (!peers.get(key)?.size) { peers.delete(key); if (rooms.sessions.has(key)) rooms.connected(key, false); } });
  socket.on('error', () => {});
});
const heartbeat = setInterval(() => {
  for (const socket of ws.clients) { if (!socket.isAlive) socket.terminate(); else { socket.isAlive = false; socket.ping(); } }
}, 15_000);
heartbeat.unref();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`One is ready: http://localhost:${PORT}`);
  console.log(`Phones and tablets: ${inviteBase}`);
});
function shutdown() {
  rooms.close(); clearInterval(heartbeat);
  for (const socket of ws.clients) socket.close();
  ws.close(); server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
