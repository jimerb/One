import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createGame, applyAction, projectGame, assertIntegrity, normalizeOptions, RuleError } from './engine.js';
import { chooseBotAction, chooseBotOneChallenge } from './ai.js';

const BOT_NAMES = ['Maya', 'Jules', 'Theo', 'Iris'];
const safeName = value => {
  const name = String(value ?? '').trim().replace(/\s+/gu, ' ');
  if (!name || [...name].length > 24 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new RuleError('Choose a name between 1 and 24 characters.');
  return name;
};
const token = () => randomBytes(24).toString('base64url');

export class RoomManager extends EventEmitter {
  constructor({ timers = true, idleMinutes = 120, disconnectGraceMs = 30_000 } = {}) {
    super(); this.rooms = new Map(); this.sessions = new Map(); this.timers = timers; this.idleMinutes = idleMinutes; this.disconnectGraceMs = disconnectGraceMs;
    if (timers) { this.cleanupTimer = setInterval(() => this.cleanup(), 60_000); this.cleanupTimer.unref(); }
  }
  create(input) {
    const humanCount = Number(input.humanCount ?? 1);
    if (!Number.isInteger(humanCount) || humanCount < 0 || humanCount > 4) throw new RuleError('Choose zero to four human players.');
    const name = humanCount ? safeName(input.name) : 'Table host';
    let code; do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase(); } while (this.rooms.has(code));
    const hostToken = token();
    const seats = Array.from({ length: 4 }, (_, index) => ({ id: index, name: BOT_NAMES[index], human: false, connected: false, token: null }));
    if (humanCount) seats[0] = { id: 0, name, human: true, connected: false, token: hostToken };
    const room = { code, hostToken, desiredHumans: humanCount, seats, options: normalizeOptions(input),
      status: humanCount > 1 ? 'lobby' : 'playing', paused: false, game: null, revision: 0, requested: new Map(),
      lobbySeconds: Math.min(300, Math.max(15, Number(input.lobbySeconds) || 60)), lobbyEndsAt: null,
      seed: input.seed === undefined ? randomBytes(4).readUInt32LE() : Number(input.seed) >>> 0,
      createdAt: Date.now(), lastActivity: Date.now(), schedule: null, lobbyTimer: null, disconnects: new Map(),
      botTurnKey: null, botChallengeTried: false, fault: null };
    this.rooms.set(code, room); this.sessions.set(hostToken, { room, seat: humanCount ? 0 : null, host: true });
    if (room.status === 'lobby') { room.lobbyEndsAt = Date.now() + room.lobbySeconds * 1000; this.setLobbyTimer(room); }
    else this.start(room);
    return { code, token: hostToken, seat: humanCount ? 0 : null };
  }
  publicLobby(code) {
    const room = this.getRoom(code);
    return { code: room.code, status: room.status, desiredHumans: room.desiredHumans, hostName: room.seats.find(seat => seat.token === room.hostToken)?.name ?? 'Table host',
      joined: room.seats.filter(seat => seat.human).length, seats: room.seats.map(({ name, human, id }) => ({ name, human, id })), options: room.options, lobbyEndsAt: room.lobbyEndsAt };
  }
  join(code, input) {
    const room = this.getRoom(code);
    if (room.status !== 'lobby') throw new RuleError('This table has already started. Ask the host to open a new table.');
    const name = safeName(input.name);
    if (room.seats.some(seat => seat.human && seat.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new RuleError('That name is already at the table. Choose another.');
    if (room.seats.filter(seat => seat.human).length >= room.desiredHumans) throw new RuleError('All human seats are filled.');
    const seat = room.seats.find(seat => !seat.human);
    const guestToken = token(); Object.assign(seat, { name, human: true, token: guestToken, connected: false });
    this.sessions.set(guestToken, { room, seat: seat.id, host: false });
    this.changed(room); return { code: room.code, token: guestToken, seat: seat.id };
  }
  getRoom(code) { const room = this.rooms.get(String(code).toUpperCase()); if (!room) throw new RuleError('That table was not found. Check the invitation.'); return room; }
  session(key) { const session = this.sessions.get(key); if (!session) throw new RuleError('Your seat has expired. Open the invitation again.'); return session; }
  view(key) {
    const session = this.session(key), room = session.room;
    const humanSeats = room.seats.filter(seat => seat.human).length;
    return { code: room.code, roomRevision: room.revision, status: room.status, paused: room.paused, host: room.hostToken === key,
      desiredHumans: room.desiredHumans, humanSeats, lobbyEndsAt: room.lobbyEndsAt, serverTime: Date.now(),
      viewer: session.seat, fault: room.fault, options: room.options,
      seats: room.seats.map(({ id, name, human, connected }) => ({ id, name, human, connected })),
      game: room.game ? projectGame(room.game, session.seat, room.desiredHumans === 0 && room.hostToken === key) : null };
  }
  changed(room) { room.revision++; room.lastActivity = Date.now(); this.emit('change', room.code); }
  start(room) {
    clearTimeout(room.lobbyTimer); room.lobbyTimer = null;
    clearTimeout(room.schedule); room.schedule = null;
    for (const timer of room.disconnects.values()) clearTimeout(timer);
    room.disconnects.clear();
    room.status = 'playing'; room.paused = false; room.lobbyEndsAt = null; room.fault = null;
    const names = new Set(room.seats.filter(seat => seat.human).map(seat => seat.name.toLowerCase()));
    for (const seat of room.seats) if (!seat.human) {
      const base = BOT_NAMES[seat.id]; let name = base, suffix = 0;
      while (names.has(name.toLowerCase())) name = `${base} Bot${++suffix > 1 ? ` ${suffix}` : ''}`;
      seat.name = name; names.add(name.toLowerCase());
    }
    room.game = createGame(room.seats, room.options, room.seed);
    if (this.timers) for (const seat of room.seats) if (seat.human && !seat.connected) this.connected(seat.token, false);
    room.botTurnKey = null; room.botCatchKey = null; this.changed(room); this.plan(room);
  }
  setLobbyTimer(room) {
    clearTimeout(room.lobbyTimer);
    if (this.timers) room.lobbyTimer = setTimeout(() => this.start(room), Math.max(0, room.lobbyEndsAt - Date.now()));
  }
  hostAction(key, action) {
    const { room } = this.session(key);
    if (room.hostToken !== key) throw new RuleError('Only the host can change table controls.');
    if (action.type === 'start') { if (room.status !== 'lobby') throw new RuleError('This table has already started.'); this.start(room); return; }
    if (action.type === 'extend') {
      if (room.status !== 'lobby') throw new RuleError('The invitation period has ended.');
      room.lobbyEndsAt = Date.now() + room.lobbySeconds * 1000; this.setLobbyTimer(room);
    } else if (action.type === 'pause') {
      if (room.status !== 'playing') throw new RuleError('Only a running table can be paused.');
      room.paused = !room.paused; clearTimeout(room.schedule); room.schedule = null;
    } else if (action.type === 'stop') {
      clearTimeout(room.schedule); clearTimeout(room.lobbyTimer); room.schedule = null; room.lobbyTimer = null;
      for (const timer of room.disconnects.values()) clearTimeout(timer);
      room.disconnects.clear();
      room.status = 'stopped'; room.paused = false;
    } else if (action.type === 'restart') {
      room.seed = randomBytes(4).readUInt32LE(); this.start(room); return;
    } else if (action.type === 'nextRound') {
      if (room.status !== 'playing' || !room.game || room.game.phase !== 'roundOver') throw new RuleError('The next round is not ready.');
      clearTimeout(room.schedule); room.schedule = null;
      room.game = applyAction(room.game, null, { type: 'nextRound' }); room.botTurnKey = null;
    } else if (action.type === 'step') {
      if (room.desiredHumans !== 0 || !room.paused || room.status !== 'playing') throw new RuleError('Pause a computer-only table to step through it.');
      this.botStep(room, true); return;
    } else if (action.type === 'speed') {
      const delay = Number(action.delay);
      if (!Number.isFinite(delay) || delay < 0 || delay > 4) throw new RuleError('Choose a speed between zero and four seconds.');
      room.options.delay = delay; if (room.game) room.game.options.delay = delay;
      clearTimeout(room.schedule); room.schedule = null;
    } else throw new RuleError('That table control is not available.');
    this.changed(room); this.plan(room);
  }
  action(key, command, requestId, revision) {
    const { room, seat } = this.session(key);
    if (room.status !== 'playing' || room.paused) throw new RuleError(room.paused ? 'The table is paused.' : 'This table is stopped.');
    if (seat === null) throw new RuleError('You are watching the computer players.');
    if (!room.seats[seat].human) throw new RuleError('This seat is now controlled by the computer.');
    if (typeof requestId !== 'string' || requestId.length > 100) throw new RuleError('This move needs a valid identifier.');
    const id = `${key}:${requestId}`;
    if (room.requested.has(id)) return;
    if (revision !== room.game.revision) throw new RuleError('The table moved on. Try again with the current cards.');
    if (command.type === 'nextRound') throw new RuleError('Only the host can start the next round.');
    const game = applyAction(room.game, seat, command);
    assertIntegrity(game); room.game = game; room.requested.set(id, true);
    if (room.requested.size > 2000) room.requested.delete(room.requested.keys().next().value);
    this.changed(room); this.plan(room);
  }
  plan(room) {
    if (!this.timers || room.schedule || room.status !== 'playing' || room.paused || !room.game || room.game.phase === 'matchOver') return;
    if (room.game.phase === 'roundOver') {
      room.schedule = setTimeout(() => { room.schedule = null; if (room.status === 'playing' && !room.paused) {
        room.game = applyAction(room.game, null, { type: 'nextRound' }); room.botTurnKey = null; this.changed(room); this.plan(room);
      } }, room.desiredHumans === 0 ? 1800 : 7000);
      return;
    }
    const actor = room.game.phase === 'color' ? room.game.colorChoice.actor : room.game.turn;
    // A hard computer can catch out of turn, including between two human moves
    // or when an effect returns the move to its player. Use only public evidence.
    if (room.game.options.difficulty === 'hard' && (room.seats[actor].human || actor === room.game.lastPlayer)) {
      const catchKey = `${room.game.round}:${room.game.turns}:${room.game.lastPlayer}`;
      const watcher = room.seats.find(seat => !seat.human && room.game.players[seat.id].alive && chooseBotOneChallenge(room.game, seat.id));
      if (watcher && room.botCatchKey !== catchKey) {
        room.schedule = setTimeout(() => {
          room.schedule = null;
          if (room.status !== 'playing' || room.paused) return;
          if (catchKey !== `${room.game.round}:${room.game.turns}:${room.game.lastPlayer}`) { this.plan(room); return; }
          room.botCatchKey = catchKey;
          const command = chooseBotOneChallenge(room.game, watcher.id);
          if (command && !room.seats[watcher.id].human) {
            try { room.game = applyAction(room.game, watcher.id, command); assertIntegrity(room.game); }
            catch (error) {
              if (!(error instanceof RuleError)) {
                room.paused = true; room.fault = 'The table paused because a move could not be resolved.';
                this.emit('fault', { code: room.code, error, command });
              }
            }
            this.changed(room);
          }
          this.plan(room);
        }, Math.max(25, room.options.delay * 1000));
        return;
      }
    }
    if (room.seats[actor].human) return;
    const key = `${room.game.round}:${room.game.turns}:${actor}:${room.game.phase}`;
    const freshTurn = key !== room.botTurnKey;
    if (freshTurn) { room.botTurnKey = key; room.botChallengeTried = false; }
    const delay = freshTurn && room.game.phase === 'turn' ? Math.max(25, room.options.delay * 1000) : Math.max(35, Math.min(280, room.options.delay * 300));
    room.schedule = setTimeout(() => { room.schedule = null; this.botStep(room); }, delay);
  }
  botStep(room, force = false) {
    if (room.status !== 'playing' || (!force && room.paused) || !room.game) return;
    if (room.game.phase === 'roundOver') {
      room.game = applyAction(room.game, null, { type: 'nextRound' }); room.botTurnKey = null;
    } else if (room.game.phase !== 'matchOver') {
      const actor = room.game.phase === 'color' ? room.game.colorChoice.actor : room.game.turn;
      if (room.seats[actor].human) return;
      const key = `${room.game.round}:${room.game.turns}:${actor}:${room.game.phase}`;
      if (key !== room.botTurnKey) { room.botTurnKey = key; room.botChallengeTried = false; }
      const command = chooseBotAction(room.game, actor, { challengeTried: room.botChallengeTried });
      if (command?.type.startsWith('challenge')) room.botChallengeTried = true;
      try { if (command) { room.game = applyAction(room.game, actor, command); assertIntegrity(room.game); } }
      catch (error) {
        if (!command?.type.startsWith('challenge')) {
          room.paused = true; room.fault = 'The table paused because a move could not be resolved.';
          this.emit('fault', { code: room.code, error, command });
        }
      }
    }
    this.changed(room); if (!force) this.plan(room);
  }
  connected(key, connected) {
    const { room, seat } = this.session(key);
    if (seat === null) return;
    const record = room.seats[seat]; record.connected = connected;
    clearTimeout(room.disconnects.get(seat)); room.disconnects.delete(seat);
    if (connected) {
      if (!record.human && record.token === key) { record.human = true; if (room.game) room.game.players[seat].human = true; }
      this.changed(room); return;
    }
    if (this.timers && room.status === 'playing') {
      const timer = setTimeout(() => {
        if (record.connected || room.status !== 'playing') return;
        record.human = false; if (room.game) room.game.players[seat].human = false;
        this.changed(room); this.plan(room);
      }, this.disconnectGraceMs);
      room.disconnects.set(seat, timer);
    }
    this.changed(room);
  }
  cleanup() { for (const room of this.rooms.values()) if (Date.now() - room.lastActivity > this.idleMinutes * 60_000) this.remove(room); }
  remove(room) {
    this.emit('remove', room.code);
    clearTimeout(room.schedule); clearTimeout(room.lobbyTimer);
    for (const timer of room.disconnects.values()) clearTimeout(timer);
    for (const [key, session] of this.sessions) if (session.room === room) this.sessions.delete(key);
    this.rooms.delete(room.code);
  }
  close() { clearInterval(this.cleanupTimer); for (const room of [...this.rooms.values()]) this.remove(room); }
}
