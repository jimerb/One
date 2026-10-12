import test from 'node:test';
import assert from 'node:assert/strict';
import { motionEnabled, tableAnchor, latestLivePlay } from '../public/table-effects.js';
const card={id:'c1',kind:'number',color:'red',value:5};
const state=(revision,events,extra={})=>({code:'ABC123',status:'playing',game:{revision,events,viewer:2,turn:1},...extra});
const play={id:5,type:'play',actor:1,card};
test('flight uses the public actor/card and is not replayed by same-revision connection updates',()=>{
  const before=state(3,[{id:4,type:'draw'}]),after=state(4,[{id:4,type:'draw'},play]);
  assert.deepEqual(latestLivePlay(before,after),play);assert.equal(latestLivePlay(after,after),null);
  assert.equal(latestLivePlay(before,after,{reconnecting:true}),null);assert.equal(latestLivePlay(before,after,{hidden:true}),null);
});
test('initial snapshots, restarted matches, other rooms and stopped tables do not replay historical cards',()=>{
  const before=state(10,[{id:40,type:'draw'}]),after=state(0,[play]);
  assert.equal(latestLivePlay(null,after),null);assert.equal(latestLivePlay(before,after),null);
  assert.equal(latestLivePlay(state(3,[]),state(4,[play],{code:'OTHER1'})),null);
  assert.equal(latestLivePlay(state(3,[]),state(4,[play],{status:'stopped'})),null);
});
test('a paused single-step can present its one accepted play, while color selection does not replay it',()=>{
  const before=state(3,[{id:4,type:'one'}],{paused:true}),after=state(4,[play],{paused:true});
  assert.deepEqual(latestLivePlay(before,after),play);assert.equal(latestLivePlay(after,state(5,[play,{id:6,type:'color',actor:1,color:'blue'}])),null);
});
test('backlogs coalesce to the latest public play; Mutant transformations are not extra player slides',()=>{
  const after=state(5,[play,{id:6,type:'mutate',actor:1,card},{id:7,type:'play',actor:3,card}]);
  assert.equal(latestLivePlay(state(3,[]),after).actor,3);
  assert.equal(latestLivePlay(state(3,[]),state(4,[{id:5,type:'mutate',actor:1,card}])),null);
});
test('Less motion and system preference suppress motion; observer seats remain fixed as turns change',()=>{
  assert.equal(motionEnabled({reducedMotion:false}),true);assert.equal(motionEnabled({reducedMotion:true}),false);assert.equal(motionEnabled({reducedMotion:false},true),false);
  assert.equal(tableAnchor({viewer:2,turn:1},false),2);assert.equal(tableAnchor({viewer:null,turn:1},true),0);assert.equal(tableAnchor({viewer:null,turn:3},true),0);
});
