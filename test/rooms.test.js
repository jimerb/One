import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { RoomManager } from '../app/rooms.js';
import { assertIntegrity } from '../app/engine.js';

const manager = t => { const value = new RoomManager({timers:false}); t.after(()=>value.close()); return value; };
test('solo has four seats; zero-human host is a spectator with visible computer hands', t => {
  const rooms=manager(t);const solo=rooms.create({name:'Casey',humanCount:1});let view=rooms.view(solo.token);
  assert.equal(view.seats.length,4);assert.equal(view.humanSeats,1);assert.equal(view.game.hand.length,7);assert.ok(!('observerHands' in view.game));assert.ok(!('seed' in view.game));
  const zero=rooms.create({humanCount:0});view=rooms.view(zero.token);assert.equal(zero.seat,null);assert.equal(view.humanSeats,0);assert.equal(view.game.observerHands.length,4);
  assert.throws(()=>rooms.action(zero.token,{type:'draw'},'draw',0),/watching/u);
});
test('invitation accepts unique named guests up to its chosen capacity and protects host controls', t => {
  const rooms=manager(t),host=rooms.create({name:'Casey',humanCount:3});const guest=rooms.join(host.code,{name:'Robin'});
  assert.equal(rooms.view(guest.token).viewer,1);assert.equal(rooms.publicLobby(host.code).joined,2);
  assert.throws(()=>rooms.join(host.code,{name:' casey '}),/already/u);assert.throws(()=>rooms.join(host.code,{name:'\u0000bad'}),/Choose a name/u);
  assert.throws(()=>rooms.hostAction(guest.token,{type:'start'}),/Only the host/u);
  rooms.join(host.code,{name:'Alex'});assert.throws(()=>rooms.join(host.code,{name:'Sam'}),/filled/u);
  rooms.hostAction(host.token,{type:'start'});const view=rooms.view(host.token);assert.equal(view.status,'playing');assert.equal(view.humanSeats,3);assert.equal(view.seats.filter(seat=>!seat.human).length,1);
  assert.throws(()=>rooms.join(host.code,{name:'Sam'}),/already started/u);
  assert.ok(view.seats.every(seat=>!('token' in seat)));assert.ok(!('game' in rooms.publicLobby(host.code)));assert.notEqual(host.token,guest.token);
});
test('unfilled invitations start with computer replacements when the deadline expires', async t => {
  const rooms=new RoomManager();t.after(()=>rooms.close());const host=rooms.create({name:'Host',humanCount:4});const room=rooms.getRoom(host.code);
  room.lobbyEndsAt=Date.now()+30;rooms.setLobbyTimer(room);await delay(65);
  assert.equal(room.status,'playing');assert.equal(room.seats.filter(seat=>seat.human).length,1);assert.equal(room.game.players.length,4);assertIntegrity(room.game);
});
test('generated computer names avoid every joined human name', t => {
  const rooms=manager(t),host=rooms.create({name:'Theo',humanCount:2});rooms.join(host.code,{name:'Theo Bot'});rooms.hostAction(host.token,{type:'start'});
  const names=rooms.view(host.token).seats.map(seat=>seat.name.toLowerCase());assert.equal(new Set(names).size,4);
});
test('private projections give different humans only their own cards and never challenge truth', t => {
  const rooms=manager(t),host=rooms.create({name:'Host',humanCount:2,seed:42});const guest=rooms.join(host.code,{name:'Guest'});rooms.hostAction(host.token,{type:'start'});
  const a=rooms.view(host.token).game,b=rooms.view(guest.token).game;
  assert.deepEqual(a.hand,rooms.getRoom(host.code).game.players[0].hand);assert.deepEqual(b.hand,rooms.getRoom(host.code).game.players[1].hand);
  assert.ok(a.hand.every(card=>!b.hand.some(other=>other.id===card.id)));assert.ok(a.players.every(player=>!('hand'in player)));
  for(const view of [a,b]) {assert.ok(!('seed'in view));assert.ok(!('observerHands'in view));assert.ok(!('rngState'in view));assert.ok(!('draw'in view));assert.ok(!('illegal'in(view.wildChallenge??{})));}
});
test('action identifiers prevent duplicate moves; stale revisions are rejected', t => {
  const rooms=manager(t),host=rooms.create({name:'Host',humanCount:1,seed:42});const room=rooms.getRoom(host.code);
  room.game.turn=0;room.game.phase='turn';room.game.colorChoice=null;room.game.players[0].hand.push(...room.game.pending.splice(0));room.game.mayPass=false;
  const revision=room.game.revision;rooms.action(host.token,{type:'draw'},'same-action',revision);const after=structuredClone(room.game);
  rooms.action(host.token,{type:'draw'},'same-action',revision);assert.deepEqual(room.game,after);
  assert.throws(()=>rooms.action(host.token,{type:'pass'},'new-action',revision),/moved on/u);
  rooms.action(host.token,{type:'pass'},'new-action',room.game.revision);assert.notEqual(room.game.turn,0);assertIntegrity(room.game);
});
test('computer-only pause freezes timers, single-step resolves one action, and stop stays stopped', async t => {
  const rooms=new RoomManager();t.after(()=>rooms.close());const host=rooms.create({humanCount:0,delay:0,seed:1,roundLimit:2});const room=rooms.getRoom(host.code);
  rooms.hostAction(host.token,{type:'pause'});const before=structuredClone(room.game);await delay(85);assert.deepEqual(room.game,before);
  rooms.hostAction(host.token,{type:'step'});assert.equal(room.game.revision,before.revision+1);const stepped=structuredClone(room.game);await delay(85);assert.deepEqual(room.game,stepped);
  rooms.hostAction(host.token,{type:'pause'});await delay(150);assert.ok(room.game.revision>stepped.revision);
  rooms.hostAction(host.token,{type:'stop'});const stopped=structuredClone(room.game);await delay(100);assert.deepEqual(room.game,stopped);assert.equal(room.schedule,null);assert.equal(room.status,'stopped');
  assert.throws(()=>rooms.hostAction(host.token,{type:'pause'}),/running/u);assert.throws(()=>rooms.hostAction(host.token,{type:'step'}),/Pause/u);
});
test('manual next-round control cancels the old automatic round timer', async t => {
  const rooms=manager(t),host=rooms.create({humanCount:0,delay:4,seed:3,roundLimit:3,scoreLimit:0});const room=rooms.getRoom(host.code);
  for(let attempts=0;room.game.phase!=='roundOver'&&attempts<10000;attempts++)rooms.botStep(room,true);
  assert.equal(room.game.phase,'roundOver');rooms.timers=true;rooms.plan(room);assert.ok(room.schedule);
  rooms.timers=false; // Keep the already-queued automatic callback alive unless the host control cancels it.
  rooms.hostAction(host.token,{type:'nextRound'});assert.equal(room.game.round,2);assert.equal(room.schedule,null);
  await delay(1850);assert.equal(room.game.round,2);assertIntegrity(room.game);
});
test('disconnect grace takes over the same hand and reconnect restores the human seat', async t => {
  const rooms=new RoomManager({disconnectGraceMs:35});t.after(()=>rooms.close());const host=rooms.create({name:'Host',humanCount:1,delay:4});const room=rooms.getRoom(host.code);
  rooms.hostAction(host.token,{type:'pause'});const ids=room.game.players[0].hand.map(card=>card.id);
  rooms.connected(host.token,false);await delay(60);assert.equal(room.seats[0].human,false);assert.deepEqual(room.game.players[0].hand.map(card=>card.id),ids);
  rooms.connected(host.token,true);assert.equal(room.seats[0].human,true);assert.equal(room.game.players[0].human,true);assert.deepEqual(room.game.players[0].hand.map(card=>card.id),ids);
});
test('cleanup invalidates abandoned room credentials and clears its timers', t => {
  const rooms=manager(t),host=rooms.create({name:'Host',humanCount:2});const room=rooms.getRoom(host.code);room.lastActivity=Date.now()-121*60000;rooms.cleanup();
  assert.throws(()=>rooms.view(host.token),/expired/u);assert.throws(()=>rooms.publicLobby(host.code),/not found/u);assert.equal(rooms.rooms.size,0);
});
test('a guest who disconnects during invitations receives the same reconnect grace after the deal', async t => {
  const rooms=new RoomManager({disconnectGraceMs:35});t.after(()=>rooms.close());
  const host=rooms.create({name:'Host',humanCount:2,delay:4}),guest=rooms.join(host.code,{name:'Guest'}),room=rooms.getRoom(host.code);
  rooms.connected(host.token,true);rooms.connected(guest.token,false);rooms.hostAction(host.token,{type:'start'});rooms.hostAction(host.token,{type:'pause'});
  const cards=room.game.players[1].hand.map(card=>card.id);await delay(60);
  assert.equal(room.seats[0].human,true);assert.equal(room.seats[1].human,false);assert.deepEqual(room.game.players[1].hand.map(card=>card.id),cards);
  rooms.hostAction(host.token,{type:'stop'});assert.equal(room.disconnects.size,0);
});
test('room removal announces closure while its clients can still be identified', t => {
  const rooms=manager(t),host=rooms.create({name:'Host',humanCount:2});let closing=null;
  rooms.on('remove',code=>{closing={code,session:rooms.sessions.has(host.token)};});rooms.remove(rooms.getRoom(host.code));
  assert.deepEqual(closing,{code:host.code,session:true});assert.equal(rooms.sessions.has(host.token),false);
});
