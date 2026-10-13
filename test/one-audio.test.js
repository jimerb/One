import test from 'node:test';
import assert from 'node:assert/strict';
import { createOneAudio, ONE_AUDIO_URL } from '../public/one-audio.js';
import { liveOneCalls } from '../public/table-effects.js';
import { createGame, applyAction, projectGame } from '../app/engine.js';

const view = (game, viewer = 0) => ({ code: 'ABC123', status: 'playing', game: projectGame(game, viewer) });
function fixture(human) {
  const game = createGame(Array.from({length:4}, (_,id) => ({name:`Seat ${id}`,human:id===0?human:true})), {}, 42);
  game.phase='turn';game.turn=0;game.pending=[];game.drawn=null;
  game.players[0].hand=game.players[0].hand.slice(0,2);game.players[0].oneCalled=false;
  return game;
}
test('human and computer valid One calls reach every private player view exactly once', () => {
  for (const human of [true,false]) {
    const game=fixture(human),called=applyAction(game,0,{type:'one'});
    for(let seat=0;seat<4;seat++) {
      const before=view(game,seat),after=view(called,seat);
      assert.equal(liveOneCalls(before,after).length,1);
      assert.equal(liveOneCalls(after,after).length,0);
      assert.equal(liveOneCalls(null,after).length,0);
      assert.equal(liveOneCalls(before,after,{reconnecting:true}).length,0);
      assert.equal(liveOneCalls(before,{...after,code:'OTHER1'}).length,0);
      assert.equal(liveOneCalls(before,{...after,status:'stopped'}).length,0);
      assert.equal(liveOneCalls(after,view(applyAction(called,0,{type:'one'}),seat)).length,0);
    }
  }
});
test('early calls and rejected out-of-turn calls do not trigger the clip', () => {
  const game=fixture(true);game.players[0].hand.push(game.draw[0]);
  const early=applyAction(game,0,{type:'one'});
  assert.equal(liveOneCalls(view(game),view(early)).length,0);
  assert.throws(()=>applyAction(game,1,{type:'one'}),/not your turn/u);
});
test('a valid call can sound with a Spy-hidden public count without exposing the hand', () => {
  const game=fixture(true),spy=game.draw.find(card=>card.kind==='spy');
  game.players[0].hand[0]=spy;
  const before=view(game,1),after=view(applyAction(game,0,{type:'one'}),1);
  assert.equal(after.game.players[0].count,null);
  assert.equal(liveOneCalls(before,after).length,1);
  assert.ok(!('hand' in after.game.players[0]));
});
function audioFixture() {
  const prefs={effects:true,volume:35},sources=[],gains=[];
  let fetches=0,decodes=0;
  const context={state:'running',destination:{},async decodeAudioData(){decodes++;return {duration:1};},
    createBufferSource(){const source={connect(){},disconnect(){},start(){this.started=true;}};sources.push(source);return source;},
    createGain(){const gain={gain:{},connect(){},disconnect(){}};gains.push(gain);return gain;}};
  const player=createOneAudio(()=>prefs,async url=>{assert.equal(url,ONE_AUDIO_URL);fetches++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(10)};});
  return {prefs,context,player,sources,gains,counts:()=>[fetches,decodes]};
}
test('clip fetches/decodes once, plays on each device, and respects each volume/mute', async () => {
  for(const volume of [20,70]) {
    const f=audioFixture();f.prefs.volume=volume;
    assert.equal(await f.player.play(f.context),true);
    assert.equal(f.sources[0].started,true);assert.equal(f.gains[0].gain.value,volume/100);
    assert.equal(await f.player.play(f.context),true);assert.deepEqual(f.counts(),[1,1]);
    f.prefs.effects=false;assert.equal(await f.player.play(f.context),false);
    f.prefs.effects=true;f.prefs.volume=0;assert.equal(await f.player.play(f.context),false);
    f.prefs.volume=50;f.context.state='suspended';assert.equal(await f.player.play(f.context),false);
    assert.equal(f.sources.length,2);
  }
});
test('muting during loading and an unavailable file do not play a late announcement', async () => {
  const f=audioFixture();const pending=f.player.play(f.context);f.prefs.effects=false;
  assert.equal(await pending,false);assert.equal(f.sources.length,0);
  const failed=createOneAudio(()=>({effects:true,volume:50}),async()=>({ok:false}));
  assert.equal(await failed.play(f.context),false);
});
