import { COLORS, cardPoints, projectGame, randomInt } from './engine.js';

const chance = (game, percent) => (randomInt(game) % 100) < percent;
const nextLive = (view, from, direction = view.direction) => {
  for (let n = 1; n <= view.players.length; n++) {
    const id = (from + direction * n + view.players.length * n) % view.players.length;
    if (view.players[id].alive) return id;
  }
  return from;
};
function chooseColor(hand) {
  const counts = COLORS.map(color => hand.filter(card => card.color === color).length);
  return COLORS[counts.indexOf(Math.max(...counts))];
}

// This strategy uses its own hand and the same public information a human can see.
// It never reads another hand, the stock, or Wild Draw Four adjudication flags.
export function chooseBotOneChallenge(game, seat, context = {}) {
  const view = projectGame(game, seat);
  if (view.phase !== 'turn' || context.challengeTried || view.lastPlayer === null || view.lastPlayer === seat) return null;
  const previous = view.players[view.lastPlayer];
  if (!previous.alive || previous.hidden || previous.count !== 1 || view.lastPlayerOneCalled) return null;
  // Hard opponents always notice a publicly visible missed call. Easier opponents
  // can overlook it; no difficulty gets to inspect hidden hands or offense flags.
  if (view.options.difficulty === 'hard' || chance(game, view.options.difficulty === 'medium' ? 70 : 40)) {
    return { type: 'challengeOne', target: previous.id };
  }
  return null;
}
export function chooseBotAction(game, seat = game.turn, context = {}) {
  const view = projectGame(game, seat);
  const me = view.players[seat];
  const difficulty = view.options.difficulty;
  if (view.phase === 'color') return { type: 'color', color: chooseColor(view.hand) };
  if (view.phase !== 'turn') return null;

  const catchOne = chooseBotOneChallenge(game, seat, context);
  if (catchOne) return catchOne;
  if (view.pendingCount) {
    if (!context.challengeTried && view.wildChallenge?.recipient === seat) {
      const opponent = view.players[view.wildChallenge.actor];
      // Large visible hands are more likely to contain the previous color; still a gamble.
      const suspicion = difficulty === 'hard' ? (opponent.count >= 5 ? 22 : 7) : difficulty === 'medium' ? 12 : 30;
      if (chance(game, suspicion)) return { type: 'challengeWild' };
    }
    return { type: 'pass' };
  }

  const available = [...view.hand, ...(view.drawn ? [view.drawn] : [])];
  const legal = available.filter(card => view.legalCardIds.includes(card.id));
  if (legal.length && available.length <= 2 && !me.oneCalled && chance(game, difficulty === 'hard' ? 98 : difficulty === 'medium' ? 80 : 50)) return { type: 'one' };
  if (view.drawn) {
    if (view.legalCardIds.includes(view.drawn.id)) return { type: 'play', cardId: view.drawn.id };
    if (difficulty !== 'hard' || !legal.length) return { type: 'pass' };
  }
  if (!legal.length) return view.canPass ? { type: 'pass' } : { type: 'draw' };
  if (difficulty === 'easy') return { type: 'play', cardId: legal[randomInt(game) % legal.length].id };

  const next = nextLive(view, seat);
  const target = view.players[next];
  const sameTeam = view.options.mode === 'team' && me.team === target.team;
  const blocking = !sameTeam && !target.hidden && target.count <= 2;
  const heldColor = view.hand.some(card => card.color === view.activeColor);
  const scores = legal.map(card => {
    let score = cardPoints(card);
    score += view.hand.filter(held => held.color === card.color && card.color !== null).length * 3;
    if (card.kind === 'wild') score -= available.length > 4 ? 45 : 18;
    if (card.kind === 'wild4') score += blocking ? 28 : -15;
    if (card.kind === 'wild4' && heldColor) score -= 95; // Avoid an easily caught bluff.
    if (card.kind === 'shark') score -= 18;
    if (card.kind === 'mutant') score -= 3;
    if (blocking && ['skip', 'draw2', 'wild4'].includes(card.kind)) score += 45;
    if (sameTeam && ['skip', 'draw2', 'wild4'].includes(card.kind)) score -= 65;
    if (card.kind === 'reverse' && blocking) score += 20;
    return { card, score: score + (randomInt(game) % (difficulty === 'hard' ? 3 : 13)) };
  });
  scores.sort((a, b) => b.score - a.score);
  return { type: 'play', cardId: scores[0].card.id };
}
