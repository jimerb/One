// Fresh implementation of the recovered edition rules. Research sources stay separate.
export const COLORS = ['red', 'blue', 'green', 'yellow'];
export const KINDS = ['number', 'draw2', 'reverse', 'skip', 'wild', 'wild4', 'spy', 'mutant', 'shark'];
const VALUES = { draw2: 20, reverse: 20, skip: 20, wild: 50, wild4: 50, spy: 75, mutant: 20, shark: 50 };

export class RuleError extends Error {}
const requireRule = (condition, message) => { if (!condition) throw new RuleError(message); };
export const cardPoints = card => card.kind === 'number' ? card.value : VALUES[card.kind];
export const isHidden = player => player.hand.some(card => card.kind === 'spy');
export const cardName = card => card ? `${card.color ? `${card.color} ` : ''}${card.kind === 'number' ? card.value : ({ draw2: 'Draw Two', reverse: 'Reverse', skip: 'Skip', wild: 'Wild', wild4: 'Wild Draw Four', spy: 'Spy', mutant: 'Mutant', shark: 'Shark' })[card.kind]}` : '';

export function normalizeOptions(input = {}) {
  const integer = (value, fallback, min, max) => Number.isInteger(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const mode = ['original', 'challenge', 'team'].includes(input.mode) ? input.mode : 'original';
  const roundLimit = mode === 'challenge' ? 0 : integer(input.roundLimit ?? 0, 0, 0, 50);
  let scoreLimit = integer(input.scoreLimit ?? 500, 500, 0, 3000);
  if (!scoreLimit && (!roundLimit || mode === 'challenge')) scoreLimit = 500;
  return { mode, roundLimit, scoreLimit, specialCards: input.specialCards !== false,
    difficulty: ['easy', 'medium', 'hard'].includes(input.difficulty) ? input.difficulty : 'hard',
    delay: Math.min(4, Math.max(0, Number(input.delay ?? 1) || 0)) };
}

export function randomInt(game) {
  if (game.randomValues?.length) return game.randomValues.shift() >>> 0;
  let x = game.rngState | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  game.rngState = x >>> 0;
  return game.rngState;
}
export function shuffle(game, cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(game) % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function buildDeck(specialCards = true) {
  const deck = [];
  const add = (kind, color = null, value = null) => deck.push({ id: `c${deck.length}`, kind, color, value, decoy: false });
  for (const color of COLORS) {
    add('number', color, 0);
    for (let value = 1; value <= 9; value++) { add('number', color, value); add('number', color, value); }
    for (const kind of ['draw2', 'reverse', 'skip']) { add(kind, color); add(kind, color); }
    if (specialCards) for (const kind of ['spy', 'mutant', 'shark']) add(kind, color);
  }
  for (const kind of ['wild', 'wild4']) for (let i = 0; i < 4; i++) add(kind);
  return deck;
}
function event(game, type, text, details = {}) {
  const item = { id: ++game.eventSeq, type, text, ...details };
  game.events.push(item);
  game.events = game.events.slice(-70);
  return item;
}
export function nextSeat(game, from = game.turn) {
  for (let n = 1; n <= game.players.length; n++) {
    const index = (from + game.direction * n + game.players.length * n) % game.players.length;
    if (game.players[index].alive) return index;
  }
  throw new RuleError('No active players remain.');
}
const liveCount = game => game.players.filter(player => player.alive).length;
function advance(game) { game.lastPlayer = game.turn; game.turn = nextSeat(game); }
function clearChallenges(player) {
  player.unoEligible = false; player.unoOffense = false; player.unoSafe = false;
}
function clearPrevious(game) {
  if (game.lastPlayer !== null) clearChallenges(game.players[game.lastPlayer]);
  if (game.wildChallenge?.actor === game.lastPlayer) game.wildChallenge = null;
}
function beginTurn(game) {
  const player = game.players[game.turn];
  player.oneCalled = false;
  clearChallenges(player);
  game.drawn = null; game.drawAttempted = false; game.mayPass = game.pending.length > 0;
  game.phase = 'turn';
}
function reshuffle(game) {
  if (game.discard.length <= 1) return;
  const top = game.discard.pop();
  game.draw.push(...game.discard.filter(card => !card.decoy));
  game.discard = [top];
  shuffle(game, game.draw);
  event(game, 'shuffle', 'The discard pile was reshuffled.');
}
export function drawCards(game, count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    if (!game.draw.length) reshuffle(game);
    if (!game.draw.length) break;
    result.push(game.draw.shift());
  }
  return result;
}
function sortHand(player) {
  const order = card => (card.color === null ? -1 : COLORS.indexOf(card.color)) * 30 + (card.kind === 'number' ? card.value : 10 + KINDS.indexOf(card.kind));
  player.hand.sort((a, b) => order(a) - order(b));
}
export function isPlayable(game, card) {
  if (!card || game.phase !== 'turn' || game.pending.length) return false;
  if (card.kind === 'wild' || card.kind === 'wild4') return true;
  const top = game.discard.at(-1);
  if (!top) return true;
  if (card.color === game.activeColor) return true;
  if (top.kind === 'wild' || top.kind === 'wild4') return false;
  return card.kind === top.kind && (card.kind !== 'number' || card.value === top.value);
}
function reservePenalty(game, count, kind, actor) {
  game.pending.push(...drawCards(game, count));
  game.penaltyKind = kind;
  game.penaltyActor = actor;
}
function pickDecoy(game) {
  const faces = [...Array.from({ length: 10 }, (_, value) => ({ kind: 'number', value })),
    ...['draw2', 'reverse', 'skip', 'wild', 'wild4', ...(game.options.specialCards ? ['spy', 'mutant', 'shark'] : [])].map(kind => ({ kind, value: null }))];
  let face;
  for (let attempts = 0; attempts < 4096; attempts++) {
    face = faces[(randomInt(game) & 0xffffff) % faces.length];
    if (face.kind !== 'wild4') break;
  }
  requireRule(face?.kind !== 'wild4', 'Random mutation could not resolve.');
  return { id: `d${++game.decoySeq}`, ...face, color: COLORS[(randomInt(game) & 0xffffff) % 4], decoy: true };
}
function resolveEffect(game, played, actor, { opening = false, depth = 0 } = {}) {
  requireRule(depth < 256, 'Mutation chain is too long to resolve.');
  let card = played;
  if (card.kind === 'mutant') {
    let replacement = drawCards(game, 1)[0];
    if (replacement?.kind === 'wild4') { game.draw.push(replacement); replacement = null; }
    if (!replacement) replacement = pickDecoy(game);
    game.discard.push(replacement);
    event(game, 'mutate', `${game.players[actor].name}'s Mutant became ${cardName(replacement)}.`, { actor, card: replacement });
    card = resolveEffect(game, replacement, actor, { opening, depth: depth + 1 });
  } else if (card.kind === 'reverse') {
    if (liveCount(game) > 2) game.direction *= -1;
    else advance(game);
    event(game, 'reverse', 'The direction of play reversed.', { actor });
  } else if (card.kind === 'skip') {
    const skipped = nextSeat(game);
    advance(game);
    event(game, 'skip', `${game.players[skipped].name} was skipped.`, { target: skipped });
  } else if (card.kind === 'draw2') {
    reservePenalty(game, 2, 'draw2', actor);
  } else if (card.kind === 'shark') {
    let victim = nextSeat(game);
    const missed = [];
    let attempts = 0;
    while (!game.players[victim].hand.length || (randomInt(game) & 0xffff) % game.players.length !== 0) {
      requireRule(++attempts < 4096, 'Shark scan could not resolve.');
      missed.push(victim);
      advance(game);
      victim = nextSeat(game);
    }
    reservePenalty(game, 4, 'shark', actor);
    event(game, 'shark', `Shark bit ${game.players[victim].name}! Four cards are coming their way.`, { actor, target: victim, missed });
  } else if (card.kind === 'wild4') {
    const previousColor = game.activeColor;
    game.wildChallenge = { actor, recipient: nextSeat(game, actor), illegal: game.players[actor].hand.some(held => held.color === previousColor), resolved: false };
    reservePenalty(game, 4, 'wild4', actor);
  }
  game.activeColor = card.color;
  if (card.kind === 'wild' || card.kind === 'wild4') {
    // Terminal Wilds do not ask for a color. An opening Wild does not spend a move.
    if (opening || game.players[actor].hand.length) {
      game.phase = 'color';
      game.colorChoice = { actor, opening };
    }
  }
  return card;
}
function selectDealer(game) {
  for (let attempt = 0; attempt < 4096; attempt++) {
    const selection = drawCards(game, game.players.length);
    const values = selection.map(card => card.kind === 'number' ? card.value : -1);
    const highest = Math.max(...values);
    game.draw.push(...selection);
    shuffle(game, game.draw);
    if (highest >= 0 && values.filter(value => value === highest).length === 1) {
      game.dealer = values.indexOf(highest);
      event(game, 'dealer', `${game.players[game.dealer].name} deals first.`, { actor: game.dealer });
      return;
    }
  }
  throw new RuleError('A dealer could not be selected.');
}
function startRound(game) {
  game.round++;
  game.direction = 1; game.lastPlayer = null; game.turn = game.dealer;
  game.drawn = null; game.pending = []; game.wildChallenge = null; game.colorChoice = null;
  game.penaltyKind = null; game.penaltyActor = null;
  game.drawAttempted = false; game.mayPass = false; game.phase = 'turn'; game.result = null;
  for (const player of game.players) { player.oneCalled = false; clearChallenges(player); }
  shuffle(game, game.draw);
  for (let round = 0; round < 7; round++) for (const player of game.players) if (player.alive) {
    const card = game.draw.shift();
    requireRule(card, 'There are not enough cards to deal.');
    player.hand.push(card);
  }
  for (const player of game.players) sortHand(player);
  let opening;
  for (let tries = 0; tries < game.draw.length + 1; tries++) {
    const candidate = game.draw.shift();
    requireRule(candidate, 'There is no opening card.');
    if (candidate.kind === 'wild4' || candidate.kind === 'mutant') game.draw.push(candidate);
    else { opening = candidate; break; }
  }
  requireRule(opening, 'There is no valid opening card.');
  game.discard = [opening]; game.activeColor = opening.color;
  event(game, 'round', `Round ${game.round} begins with ${cardName(opening)}.`, { card: opening });
  if (opening.kind === 'wild') {
    advance(game); game.phase = 'color'; game.colorChoice = { actor: game.turn, opening: true };
  } else if (opening.kind === 'reverse') {
    game.direction = -1; beginTurn(game);
  } else {
    resolveEffect(game, opening, game.dealer, { opening: true });
    advance(game); beginTurn(game);
  }
}
export function createGame(seats, options = {}, seed = Date.now() >>> 0) {
  requireRule(seats.length >= 2 && seats.length <= 4, 'One supports two to four seats.');
  const rules = normalizeOptions(options);
  requireRule(rules.mode !== 'team' || seats.length === 4, 'Team games need four seats.');
  const game = { version: 1, revision: 0, options: rules, players: seats.map((seat, index) => ({
    id: index, name: seat.name, human: !!seat.human, alive: true, team: rules.mode === 'team' ? index % 2 : index,
    score: 0, hand: [], oneCalled: false, unoEligible: false, unoOffense: false, unoSafe: false })),
    rngState: (seed >>> 0) || 0x9e3779b9, seed: seed >>> 0, events: [], eventSeq: 0, decoySeq: 0,
    round: 0, turns: 0, dealer: 0, turn: 0, lastPlayer: null, direction: 1, activeColor: null,
    draw: buildDeck(rules.specialCards), discard: [], pending: [], drawn: null, phase: 'turn', winners: [], result: null };
  game.initialCardIds = game.draw.map(card => card.id);
  shuffle(game, game.draw); selectDealer(game); startRound(game);
  return game;
}
function settlePenalty(game, target) {
  const cards = game.pending.splice(0);
  game.players[target].hand.push(...cards);
  sortHand(game.players[target]);
  if (cards.length) event(game, 'penalty', `${game.players[target].name} picked up ${cards.length} penalty cards.`, { target, count: cards.length });
  game.penaltyKind = null; game.penaltyActor = null;
}
function scoreRound(game, winner) {
  if (game.pending.length) settlePenalty(game, game.turn);
  const winnerTeam = game.players[winner].team;
  const before = game.players.map(player => player.score);
  const handPoints = game.players.map(player => player.hand.reduce((total, card) => total + cardPoints(card), 0));
  if (game.options.mode === 'challenge') {
    for (const player of game.players) if (player.team !== winnerTeam) player.score += handPoints[player.id];
  } else {
    const gain = game.players.reduce((sum, player) => sum + (player.team === winnerTeam ? 0 : handPoints[player.id]), 0);
    for (const player of game.players) if (player.team === winnerTeam) player.score += gain;
  }
  const scoreAfterRound = game.players.map(player => player.score);
  let complete = false, finalPairReset = false;
  const eliminated = [];
  if (game.options.mode === 'challenge') {
    if (liveCount(game) === 2 && game.players.length > 2) complete = true;
    else {
      for (const player of game.players) if (player.alive && game.options.scoreLimit && player.score >= game.options.scoreLimit) {
        player.alive = false; eliminated.push(player.id);
        event(game, 'eliminate', `${player.name} was eliminated.`, { target: player.id });
      }
      if (liveCount(game) <= 1) complete = true;
      else if (liveCount(game) === 2 && game.players.length > 2) {
        finalPairReset = true;
        for (const player of game.players) player.score = 0;
        event(game, 'final-pair', 'Two players remain. Scores reset for the final hand.');
      }
    }
  } else complete = !!game.options.scoreLimit && game.players.some(player => player.score >= game.options.scoreLimit);
  if (game.options.roundLimit && game.round >= game.options.roundLimit) complete = true;
  game.result = { winner, round: game.round, rows: game.players.map((player, index) => ({ id: index, name: player.name, team: player.team,
    handPoints: handPoints[index], delta: scoreAfterRound[index] - before[index], score: scoreAfterRound[index], alive: player.alive })), eliminated, finalPairReset };
  game.colorChoice = null; game.wildChallenge = null;
  game.phase = complete ? 'matchOver' : 'roundOver';
  game.dealer = winner;
  if (complete) {
    const alive = game.players.filter(player => player.alive);
    const best = game.options.mode === 'challenge' ? Math.min(...alive.map(player => player.score)) : Math.max(...alive.map(player => player.score));
    game.winners = alive.filter(player => player.score === best).map(player => player.id);
    event(game, 'match-end', `${game.winners.map(id => game.players[id].name).join(' & ')} won the match!`);
  } else event(game, 'round-end', `${game.players[winner].name} won round ${game.round}.`);
}
function finishMove(game, actor) {
  if (game.drawn) { game.players[actor].hand.push(game.drawn); game.drawn = null; sortHand(game.players[actor]); }
  const player = game.players[actor];
  if (player.hand.length === 1 && !player.oneCalled) { player.unoEligible = true; player.unoOffense = true; player.unoSafe = false; }
  advance(game); game.turns++;
  if (!player.hand.length) scoreRound(game, actor);
  else beginTurn(game);
}
function collectForNextRound(game) {
  const cards = [...game.draw, ...game.discard, ...game.pending, ...(game.drawn ? [game.drawn] : []), ...game.players.flatMap(player => player.hand)];
  game.draw = cards.filter(card => !card.decoy);
  game.discard = []; game.pending = []; game.drawn = null;
  for (const player of game.players) player.hand = [];
}

export function applyAction(previous, actor, command) {
  const game = structuredClone(previous);
  requireRule(command && typeof command.type === 'string', 'Choose a game action.');
  if (command.type === 'nextRound') {
    requireRule(game.phase === 'roundOver', 'The next round is not ready.');
    collectForNextRound(game); startRound(game); game.revision++; return game;
  }
  requireRule(['turn', 'color'].includes(game.phase), 'This round has ended.');
  const player = game.players[actor];
  requireRule(player?.alive, 'This seat is not active.');
  if (game.phase === 'color') {
    requireRule(command.type === 'color' && actor === game.colorChoice.actor, 'Wait for the color choice.');
    requireRule(COLORS.includes(command.color), 'Choose red, blue, green, or yellow.');
    const opening = game.colorChoice.opening;
    game.activeColor = command.color; game.colorChoice = null; game.phase = 'turn';
    event(game, 'color', `${player.name} chose ${command.color}.`, { actor, color: command.color });
    if (opening) beginTurn(game); else finishMove(game, actor);
  } else if (command.type === 'challengeOne') {
    const target = game.players[command.target];
    requireRule(target?.alive && target !== player && target.unoEligible, 'That One call cannot be challenged now.');
    requireRule(!target.unoSafe, 'That call has already been resolved.');
    const offender = target.unoOffense;
    const recipient = offender ? target : player;
    const cards = drawCards(game, 2); recipient.hand.push(...cards); sortHand(recipient);
    target.unoSafe = true; target.unoOffense = false;
    event(game, 'challenge', offender ? `${player.name} caught ${target.name} without One. ${target.name} draws two.` : `${player.name}'s challenge failed. ${player.name} draws two.`, { actor, target: recipient.id, count: cards.length, success: offender });
  } else if (command.type === 'challengeWild') {
    const challenge = game.wildChallenge;
    requireRule(challenge && !challenge.resolved && actor === challenge.recipient && actor === game.turn, 'Only the player drawing four can challenge.');
    challenge.resolved = true;
    if (challenge.illegal) {
      settlePenalty(game, challenge.actor);
      game.mayPass = true;
      event(game, 'challenge', `${player.name}'s challenge succeeded. ${game.players[challenge.actor].name} draws four.`, { actor, target: challenge.actor, success: true });
    } else {
      game.pending.push(...drawCards(game, 2)); settlePenalty(game, actor);
      event(game, 'challenge', `${player.name}'s challenge failed. Six cards, and a lost turn.`, { actor, target: actor, success: false });
      clearPrevious(game); finishMove(game, actor);
    }
  } else {
    requireRule(actor === game.turn, 'It is not your turn yet.');
    if (command.type === 'one') {
      if (player.hand.length + (game.drawn ? 1 : 0) <= 2) {
        player.oneCalled = true; event(game, 'one', `${player.name} called ONE!`, { actor });
      } else {
        player.unoEligible = true; player.unoOffense = true; player.unoSafe = false;
        // The other players see the call, not the private hand size or adjudication flag.
        event(game, 'one', `${player.name} called ONE!`, { actor });
      }
    } else if (command.type === 'draw') {
      requireRule(!game.drawn && !game.pending.length, 'Keep or play the drawn card before drawing again.');
      game.drawn = drawCards(game, 1)[0] ?? null; game.drawAttempted = true; game.mayPass = true;
      clearPrevious(game);
      event(game, 'draw', game.drawn ? `${player.name} drew a card.` : 'No cards are available to draw.', { actor, count: game.drawn ? 1 : 0 });
    } else if (command.type === 'pass') {
      requireRule(game.mayPass, 'Draw a card before passing.');
      if (game.pending.length) settlePenalty(game, actor);
      else event(game, 'keep', `${player.name} kept the drawn card and passed.`, { actor });
      clearPrevious(game); finishMove(game, actor);
    } else if (command.type === 'play') {
      const index = player.hand.findIndex(card => card.id === command.cardId);
      const fromDraw = game.drawn?.id === command.cardId;
      const card = fromDraw ? game.drawn : player.hand[index];
      requireRule(card, 'That card is not in your hand.');
      requireRule(isPlayable(game, card), game.pending.length ? 'Penalty cards cannot be stacked. Accept the draw.' : 'Match the color, number, or symbol.');
      if (fromDraw) game.drawn = null; else player.hand.splice(index, 1);
      game.discard.push(card);
      event(game, 'play', `${player.name} played ${cardName(card)}.`, { actor, card });
      resolveEffect(game, card, actor);
      clearPrevious(game);
      if (game.phase !== 'color') finishMove(game, actor);
    } else throw new RuleError('That action is not available.');
  }
  game.revision++;
  return game;
}

export function projectGame(game, viewer = null, revealBots = false) {
  const current = game.players[viewer];
  const myTurn = viewer === game.turn && game.phase === 'turn';
  return { revision: game.revision, options: game.options, phase: game.phase, round: game.round,
    turns: game.turns, turn: game.turn, direction: game.direction, dealer: game.dealer, lastPlayer: game.lastPlayer,
    activeColor: game.activeColor, discard: game.discard.at(-1), drawCount: game.draw.length, discardCount: game.discard.length,
    pendingCount: game.pending.length, penaltyKind: game.penaltyKind, viewer,
    players: game.players.map(player => ({ id: player.id, name: player.name, human: player.human, team: player.team,
      score: player.score, alive: player.alive, hidden: isHidden(player), count: isHidden(player) ? null : Math.min(7, player.hand.length), oneCalled: player.oneCalled })),
    hand: current?.hand ?? [], drawn: myTurn ? game.drawn : null,
    legalCardIds: myTurn ? [...(current?.hand ?? []), ...(game.drawn ? [game.drawn] : [])].filter(card => isPlayable(game, card)).map(card => card.id) : [],
    canDraw: myTurn && !game.pending.length && !game.drawn,
    canPass: myTurn && game.mayPass,
    canCallOne: myTurn,
    colorActor: game.colorChoice?.actor ?? null,
    wildChallenge: game.wildChallenge && !game.wildChallenge.resolved ? { actor: game.wildChallenge.actor, recipient: game.wildChallenge.recipient } : null,
    // Catch controls never expose private missed-call adjudication flags.
    catchTargets: game.phase === 'turn' && current?.alive ? game.players.filter(player => player.id !== viewer && player.alive).map(player => player.id) : [],
    events: game.events, result: game.result, winners: game.winners,
    ...(revealBots ? { seed: game.seed, observerHands: game.players.map(player => player.hand), observerDrawn: game.drawn } : {}) };
}

export function assertIntegrity(game) {
  const cards = [...game.draw, ...game.discard, ...game.pending, ...(game.drawn ? [game.drawn] : []), ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id);
  requireRule(new Set(ids).size === ids.length, 'A card exists in more than one location.');
  const physical = cards.filter(card => !card.decoy).map(card => card.id).sort();
  requireRule(JSON.stringify(physical) === JSON.stringify([...game.initialCardIds].sort()), 'Physical card inventory changed.');
  requireRule(game.players[game.turn]?.alive || ['roundOver', 'matchOver'].includes(game.phase), 'The active seat is eliminated.');
  requireRule(game.phase !== 'color' || game.colorChoice?.actor === game.turn, 'Color choice belongs to a different seat.');
  return true;
}
