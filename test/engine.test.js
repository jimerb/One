import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck, cardPoints, createGame, applyAction, isPlayable, projectGame, drawCards, assertIntegrity, normalizeOptions, nextSeat } from '../app/engine.js';
import { chooseBotAction } from '../app/ai.js';
import { simulate } from '../tools/simulate-one.js';

const n = (color, value) => ({ kind: 'number', color, value });
const special = (kind, color = null) => ({ kind, color });
function fixture({ hands = [[n('red', 3), n('blue', 8)], [n('blue', 4)], [n('green', 6)], [n('yellow', 7)]], top = n('red', 5), stock = [], mode = 'original', roundLimit = 1, scoreLimit = 0, alive = [] } = {}) {
  const game = createGame(hands.map((_, id) => ({ name: `Player ${id}`, human: true })), { mode, roundLimit, scoreLimit, specialCards: true }, 42);
  const pool = buildDeck(true);
  const take = face => {
    const index = pool.findIndex(card => card.kind === face.kind && card.color === face.color && (face.kind !== 'number' || card.value === face.value));
    assert.notEqual(index, -1, `Fixture card exists: ${JSON.stringify(face)}`);
    return pool.splice(index, 1)[0];
  };
  game.players.forEach((player, id) => { player.hand = hands[id].map(take); player.score = 0; player.alive = alive[id] ?? true; player.oneCalled = player.unoEligible = player.unoOffense = player.unoSafe = false; });
  game.discard = [take(top)]; game.draw = [...stock.map(take), ...pool]; game.drawn = null; game.pending = [];
  game.turn = 0; game.lastPlayer = null; game.dealer = hands.length - 1; game.direction = 1; game.activeColor = top.color;
  game.phase = 'turn'; game.colorChoice = null; game.wildChallenge = null; game.drawAttempted = false; game.mayPass = false;
  game.penaltyKind = null; game.penaltyActor = null; game.events = []; game.eventSeq = 0; game.turns = 0; game.revision = 0;
  assertIntegrity(game); return game;
}
const play = (game, seat = game.turn, card = game.players[seat].hand[0]) => applyAction(game, seat, { type: 'play', cardId: card.id });
function rejectUnchanged(game, seat, action, message) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, seat, action), message); assert.deepEqual(game, before);
}

test('108/120-card decks have the exact recovered composition and point values', () => {
  for (const extended of [false, true]) {
    const deck = buildDeck(extended); assert.equal(deck.length, extended ? 120 : 108);
    assert.equal(new Set(deck.map(card => card.id)).size, deck.length);
    for (const color of ['red', 'blue', 'green', 'yellow']) {
      assert.equal(deck.filter(card => card.color === color && card.kind === 'number' && card.value === 0).length, 1);
      for (let value = 1; value <= 9; value++) assert.equal(deck.filter(card => card.color === color && card.kind === 'number' && card.value === value).length, 2);
      for (const kind of ['draw2', 'skip', 'reverse']) assert.equal(deck.filter(card => card.color === color && card.kind === kind).length, 2);
      for (const kind of ['spy', 'mutant', 'shark']) assert.equal(deck.filter(card => card.color === color && card.kind === kind).length, extended ? 1 : 0);
    }
    for (const kind of ['wild', 'wild4']) assert.equal(deck.filter(card => card.kind === kind).length, 4);
  }
  assert.equal(cardPoints(n('red', 9)), 9);
  for (const [kind, points] of Object.entries({draw2:20, skip:20, reverse:20, wild:50, wild4:50, spy:75, mutant:20, shark:50})) assert.equal(cardPoints(special(kind)), points);
});

test('native zero-limit conversion and Challenge settings are preserved', () => {
  assert.deepEqual(normalizeOptions({ roundLimit: 0, scoreLimit: 0 }).scoreLimit, 500);
  assert.equal(normalizeOptions({ roundLimit: 3, scoreLimit: 0 }).scoreLimit, 0);
  assert.equal(normalizeOptions({ mode: 'challenge', roundLimit: 3, scoreLimit: 0 }).roundLimit, 0);
  assert.equal(normalizeOptions({ mode: 'challenge', roundLimit: 3, scoreLimit: 0 }).scoreLimit, 500);
  assert.equal(normalizeOptions({ roundLimit: 100, scoreLimit: 9999 }).roundLimit, 50);
  assert.throws(() => createGame([{name:'A'}]), /two to four/u);
  assert.throws(() => createGame([{name:'A'},{name:'B'}], {mode:'team'}), /four/u);
});

test('seeded dealing preserves inventory and opening special-card sequencing', () => {
  const found = new Set();
  for (let seed = 1; seed <= 220; seed++) {
    const game = createGame(['A','B','C','D'].map(name=>({name})), {}, seed);
    assertIntegrity(game); assert.deepEqual(game.players.map(player=>player.hand.length), [7,7,7,7]);
    const opening = game.discard[0]; found.add(opening.kind);
    assert.ok(!['mutant','wild4'].includes(opening.kind));
    if (opening.kind === 'wild') { assert.equal(game.phase, 'color'); assert.equal(game.turn, (game.dealer+1)%4); const next = applyAction(game,game.turn,{type:'color',color:'green'}); assert.equal(next.turn,game.turn); assert.equal(next.turns,0); }
    if (opening.kind === 'reverse') { assert.equal(game.direction,-1); assert.equal(game.turn,game.dealer); }
    if (opening.kind === 'skip') assert.equal(game.turn,(game.dealer+2)%4);
    if (opening.kind === 'draw2') { assert.equal(game.pending.length,2); assert.equal(game.turn,(game.dealer+1)%4); }
  }
  assert.ok(['wild','reverse','skip','draw2','spy','shark'].every(kind=>found.has(kind)));
  assert.deepEqual(createGame(['A','B','C','D'].map(name=>({name})),{},12), createGame(['A','B','C','D'].map(name=>({name})),{},12));
});

test('matching uses color, number or face; rejects out-of-turn and foreign cards without mutation', () => {
  const game = fixture(); assert.ok(isPlayable(game,n('blue',5))); assert.ok(isPlayable(game,n('red',9)));
  assert.ok(isPlayable(game,special('wild4'))); assert.ok(!isPlayable(game,n('blue',8)));
  rejectUnchanged(game,1,{type:'draw'},/not your turn/u);
  rejectUnchanged(game,0,{type:'play',cardId:game.players[1].hand[0].id},/not in your hand/u);
  rejectUnchanged(game,0,{type:'play',cardId:game.players[0].hand[1].id},/Match/u);
  const spies=fixture({top:special('spy','red')}); assert.ok(isPlayable(spies,special('spy','blue')));
  const mutants=fixture({top:special('mutant','red')}); assert.ok(isPlayable(mutants,special('mutant','blue')));
});

test('voluntary drawing uses transit; existing-hand play merges unused transit at move end', () => {
  const game=fixture({stock:[n('green',4)]}); const drawn=applyAction(game,0,{type:'draw'});
  assert.equal(drawn.players[0].hand.length,2); assert.equal(drawn.drawn.kind,'number'); assert.equal(drawn.turn,0);
  rejectUnchanged(drawn,0,{type:'draw'},/drawing again/u);
  const next=play(drawn); assert.equal(next.turn,1); assert.equal(next.players[0].hand.length,2); assert.equal(next.drawn,null);
  assert.ok(next.players[0].hand.some(card=>card.color==='green'&&card.value===4)); assertIntegrity(next);
});

test('drawn card can be played; keep passes; pass without drawing is rejected', () => {
  const game=fixture({stock:[n('red',9)]}); rejectUnchanged(game,0,{type:'pass'},/Draw a card/u);
  const drawn=applyAction(game,0,{type:'draw'}), next=play(drawn,0,drawn.drawn);
  assert.equal(next.players[0].hand.length,2); assert.equal(next.discard.at(-1).value,9); assert.equal(next.turn,1); assertIntegrity(next);
  const kept=applyAction(drawn,0,{type:'pass'}); assert.equal(kept.players[0].hand.length,3); assert.equal(kept.turn,1); assertIntegrity(kept);
});

test('Skip advances twice; Reverse changes direction with four and skips with two live players', () => {
  let game=fixture({hands:[[special('skip','red'),n('blue',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  game=play(game); assert.equal(game.turn,2);
  const reverse=()=>fixture({hands:[[special('reverse','red'),n('blue',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  game=play(reverse()); assert.equal(game.direction,-1); assert.equal(game.turn,3);
  game=reverse(); game.players[1].alive=false;game.players[3].alive=false; game=play(game); assert.equal(game.turn,0);assert.equal(game.direction,1);assertIntegrity(game);
});

test('Draw Two reserves cards, cannot be stacked, and consumes the recipient turn', () => {
  let game=fixture({hands:[[special('draw2','red'),n('blue',8)],[special('draw2','blue')],[n('green',6)],[n('yellow',7)]]});
  game=play(game); assert.equal(game.turn,1);assert.equal(game.pending.length,2);assert.equal(game.players[1].hand.length,1);
  rejectUnchanged(game,1,{type:'play',cardId:game.players[1].hand[0].id},/cannot be stacked/u);
  rejectUnchanged(game,1,{type:'draw'},/drawing again/u);
  game=applyAction(game,1,{type:'pass'});assert.equal(game.players[1].hand.length,3);assert.equal(game.turn,2);assert.equal(game.pending.length,0);assertIntegrity(game);
});

test('Wild color choice blocks every other action and returns play to the next seat', () => {
  let game=fixture({hands:[[special('wild'),n('blue',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  game=play(game);assert.equal(game.phase,'color');assert.equal(game.turn,0);
  rejectUnchanged(game,1,{type:'color',color:'red'},/Wait/u);rejectUnchanged(game,0,{type:'one'},/Wait/u);
  rejectUnchanged(game,0,{type:'color',color:'purple'},/Choose red/u);
  game=applyAction(game,0,{type:'color',color:'yellow'});assert.equal(game.activeColor,'yellow');assert.equal(game.turn,1);assert.equal(game.phase,'turn');
});

test('missed One can be caught out of turn once, while correct calls are ineligible', () => {
  let game=play(fixture()); assert.equal(game.players[0].hand.length,1); const turn=game.turn;
  const caught=applyAction(game,3,{type:'challengeOne',target:0});assert.equal(caught.players[0].hand.length,3);assert.equal(caught.turn,turn);assertIntegrity(caught);
  rejectUnchanged(caught,2,{type:'challengeOne',target:0},/already been resolved/u);
  game=applyAction(fixture(),0,{type:'one'});game=play(game);rejectUnchanged(game,2,{type:'challengeOne',target:0},/cannot be challenged/u);
});

test('early calls can be caught; only accepted legal draw/play/pass expires a missed-call window', () => {
  let early=fixture(); early.players[0].hand.push(early.draw.shift());early=applyAction(early,0,{type:'one'});
  assert.equal(early.players[0].oneCalled,false);early=applyAction(early,2,{type:'challengeOne',target:0});assert.equal(early.players[0].hand.length,5);
  let game=play(fixture());rejectUnchanged(game,1,{type:'pass'},/Draw a card/u);
  assert.ok(game.players[0].unoEligible);
  game=applyAction(game,1,{type:'draw'});rejectUnchanged(game,2,{type:'challengeOne',target:0},/cannot be challenged/u);
  // The original wrong-call branch needs synthetic permission, as in the preserved backend probe.
  game=fixture();game.players[1].unoEligible=true;game.players[1].unoOffense=false;
  const wrong=applyAction(game,0,{type:'challengeOne',target:1});assert.equal(wrong.players[0].hand.length,4);assert.equal(wrong.turn,0);
});

test('illegal Wild Draw Four is challengeable only by its recipient after color choice', () => {
  let game=fixture({hands:[[special('wild4'),n('red',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  game=play(game);assert.equal(game.pending.length,4);rejectUnchanged(game,1,{type:'challengeWild'},/Wait/u);
  game=applyAction(game,0,{type:'color',color:'blue'});rejectUnchanged(game,2,{type:'challengeWild'},/Only the player/u);
  game=applyAction(game,1,{type:'challengeWild'});assert.equal(game.players[0].hand.length,5);assert.equal(game.players[1].hand.length,1);assert.equal(game.turn,1);assert.equal(game.pending.length,0);
  assert.ok(projectGame(game,1).legalCardIds.length);assert.equal(game.mayPass,true);
  game=applyAction(game,1,{type:'pass'});assert.equal(game.turn,2);assertIntegrity(game);
});

test('failed Wild Draw Four challenge costs six cards and ends the challenger turn', () => {
  let game=fixture({hands:[[special('wild4'),n('green',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  game=play(game);game=applyAction(game,0,{type:'color',color:'blue'});game=applyAction(game,1,{type:'challengeWild'});
  assert.equal(game.players[1].hand.length,7);assert.equal(game.turn,2);assert.equal(game.pending.length,0);assertIntegrity(game);
});

test('terminal Wilds skip color choice and settle Draw Four before scoring', () => {
  for(const kind of ['wild','wild4']) {
    const game=play(fixture({hands:[[special(kind)],[n('blue',4)],[n('green',6)],[n('yellow',7)]],stock:[n('red',1),n('red',2),n('red',3),n('red',4)]}));
    assert.equal(game.phase,'matchOver');assert.equal(game.colorChoice,null);assert.equal(game.wildChallenge,null);
    assert.equal(game.players[1].hand.length,kind==='wild4'?5:1);
    assert.equal(game.players[0].score,kind==='wild4'?27:17);assertIntegrity(game);
  }
});

test('Spy hides the public count and projections do not expose seed, RNG, stock, other hands or challenge flags', () => {
  let game=fixture({hands:[[n('red',3),n('blue',8)],[special('spy','blue'),n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  const view=projectGame(game,0);assert.equal(view.players[1].count,null);assert.equal(view.players[1].hidden,true);assert.equal(view.hand.length,2);
  for(const key of ['seed','rngState','randomValues','draw','pending','initialCardIds','observerHands'])assert.ok(!(key in view));
  assert.ok(view.players.every(player=>!('hand'in player)&&!('unoEligible'in player)&&!('unoOffense'in player)&&!('unoSafe'in player)));
  game.turn=1;game.activeColor='blue';game=play(game,1);assert.equal(projectGame(game,0).players[1].hidden,false);assert.equal(projectGame(game,0).players[1].count,1);
  assert.equal(projectGame(game,null,true).observerHands.length,4);
});

test('Shark follows the geometric scan, can bite its actor, and ignores empty terminal actor', () => {
  let game=fixture({hands:[[special('shark','red'),n('blue',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  game.randomValues=[1,1,1,0];game=play(game);assert.equal(game.turn,0);assert.equal(game.pending.length,4);
  assert.deepEqual(game.events.find(item=>item.type==='shark').missed,[1,2,3]);game=applyAction(game,0,{type:'pass'});assert.equal(game.turn,1);assert.equal(game.players[0].hand.length,5);assertIntegrity(game);
  game=fixture({hands:[[special('shark','red')],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});game.randomValues=[1,1,1,0];game=play(game);
  assert.equal(game.phase,'matchOver');assert.equal(game.events.find(item=>item.type==='shark').target,1);assert.equal(game.players[1].hand.length,5);assertIntegrity(game);
});

test('Shark uses original seat count after eliminations and skips dead seats', () => {
  let game=fixture({hands:[[special('shark','red'),n('blue',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]],alive:[true,false,true,false]});
  game.randomValues=[2,0];game=play(game);assert.equal(game.turn,0);assert.deepEqual(game.events.find(item=>item.type==='shark').missed,[2]);assertIntegrity(game);
});

test('Mutant uses a physical replacement and recursively applies Skip / Draw Two / Wild', () => {
  for(const kind of ['skip','draw2','wild']) {
    let game=fixture({hands:[[special('mutant','red'),n('blue',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]],stock:[special('mutant','blue'),special(kind,kind==='wild'?null:'green')]});
    const physical=game.draw[1].id;game=play(game);assert.equal(game.discard.at(-1).id,physical);assert.equal(game.discard.length,4);assert.equal(game.events.filter(item=>item.type==='mutate').length,2);
    if(kind==='skip')assert.equal(game.turn,2);if(kind==='draw2'){assert.equal(game.turn,1);assert.equal(game.pending.length,2);}if(kind==='wild'){assert.equal(game.phase,'color');game=applyAction(game,0,{type:'color',color:'green'});assert.equal(game.turn,1);}
    assertIntegrity(game);
  }
});

test('Mutant returns Wild Draw Four, creates a non-four decoy, and recycling removes decoys', () => {
  let game=fixture({hands:[[special('mutant','red'),n('blue',8)],[n('blue',4)],[n('green',6)],[n('yellow',7)]],stock:[special('wild4')]});
  const four=game.draw[0].id;game.randomValues=[14,3,0];game=play(game);assert.equal(game.discard.at(-1).decoy,true);assert.notEqual(game.discard.at(-1).kind,'wild4');assert.ok(game.draw.some(card=>card.id===four));assertIntegrity(game);
  const decoy=game.discard.at(-1);const top=game.draw.shift();game.discard.push(top);game.players[3].hand.push(...game.draw.splice(0));
  drawCards(game,1).forEach(card=>game.players[3].hand.push(card));assert.ok(!game.discard.some(card=>card.id===decoy.id));assert.ok(!game.draw.some(card=>card.id===decoy.id));assertIntegrity(game);
});

test('stock replenishment preserves the final discard; exhausted draws are partial and can pass', () => {
  const game=fixture();game.players[3].hand.push(...game.draw.splice(0));const old=game.players[3].hand.pop();game.discard.unshift(old);
  const top=game.discard.at(-1).id;const drawn=drawCards(game,8);assert.equal(drawn.length,1);assert.equal(game.discard.at(-1).id,top);game.players[3].hand.push(...drawn);assertIntegrity(game);
  const empty=applyAction(game,0,{type:'draw'});assert.equal(empty.drawn,null);assert.equal(empty.mayPass,true);assert.equal(applyAction(empty,0,{type:'pass'}).turn,1);
});

test('Original and Team scores exclude partner cards; score or round limit ends the match', () => {
  for(const mode of ['original','team']) {
    const game=play(fixture({mode,hands:[[n('red',3)],[special('spy','blue')],[special('wild')],[special('shark','yellow')]]}));
    assert.equal(game.players[0].score,mode==='team'?125:175);assert.deepEqual(game.winners,mode==='team'?[0,2]:[0]);assert.equal(game.phase,'matchOver');assertIntegrity(game);
  }
  const score=play(fixture({roundLimit:0,scoreLimit:10,hands:[[n('red',3)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]}));assert.equal(score.phase,'matchOver');
  const next=play(fixture({roundLimit:2,scoreLimit:0,hands:[[n('red',3)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]}));assert.equal(next.phase,'roundOver');
  const dealt=applyAction(next,null,{type:'nextRound'});assert.equal(dealt.dealer,0);assert.equal(dealt.round,2);assert.deepEqual(dealt.players.map(player=>player.hand.length),[7,7,7,7]);assertIntegrity(dealt);
});

test('Challenge eliminates at threshold, resets final-pair scores, and ends after their next hand', () => {
  let game=fixture({mode:'challenge',scoreLimit:100,hands:[[n('red',3)],[n('blue',4)],[special('spy','green')],[special('shark','yellow')]]});game.players[2].score=25;game.players[3].score=50;
  game=play(game);assert.equal(game.phase,'roundOver');assert.deepEqual(game.result.eliminated,[2,3]);assert.equal(game.result.finalPairReset,true);assert.deepEqual(game.players.map(player=>player.score),[0,0,0,0]);assert.equal(nextSeat(game,0),1);
  game=applyAction(game,null,{type:'nextRound'});assert.deepEqual(game.players.map(player=>player.hand.length),[7,7,0,0]);assertIntegrity(game);
  game.turn=0;game.phase='turn';game.colorChoice=null;game.pending.splice(0).forEach(card=>game.draw.push(card));game.players[0].hand.splice(1).forEach(card=>game.draw.push(card));game.activeColor=game.players[0].hand[0].color;
  if(['wild','wild4'].includes(game.players[0].hand[0].kind))game.activeColor='red';
  game=play(game);assert.equal(game.phase,'matchOver');assert.deepEqual(game.winners,[0]);assertIntegrity(game);
});

test('tied scores retain every eligible winner; a two-seat Challenge continues until its threshold', () => {
  let game=fixture({hands:[[n('red',3)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  game.players[0].score=39;game.players[1].score=56;game=play(game);assert.deepEqual(game.winners,[0,1]);
  game=fixture({mode:'challenge',scoreLimit:100,alive:[true,true,false,false],hands:[[n('red',3)],[n('blue',4)],[n('green',6)],[n('yellow',7)]]});
  game.players[0].score=10;game.players[1].score=6;game=play(game);assert.deepEqual(game.winners,[0,1]);assert.equal(game.phase,'matchOver');
  game=fixture({mode:'challenge',scoreLimit:100,hands:[[n('red',3)],[n('blue',4)]]});game=play(game);assert.equal(game.phase,'roundOver');assert.deepEqual(game.players.map(player=>player.score),[0,4]);
});

test('fair AI decisions are identical when only hidden opponent cards and stock change', () => {
  const game=fixture();const other=structuredClone(game);[other.players[1].hand[0],other.draw[0]]=[other.draw[0],other.players[1].hand[0]];
  // Keep the public count, Spy visibility and all information available to this seat identical.
  assert.deepEqual(projectGame(game,0),projectGame(other,0));assert.deepEqual(chooseBotAction(game,0),chooseBotAction(other,0));
});

test('computer games finish deterministically across all three modes and both decks', () => {
  for(const mode of ['original','challenge','team'])for(const specialCards of [false,true])for(let seed=1;seed<=5;seed++) {
    const result=simulate({seed,mode,specialCards});assert.ok(result.winners.length);assert.ok(result.actions<20000);
  }
  assert.deepEqual(simulate({seed:123}),simulate({seed:123}));
});
