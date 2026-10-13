// Presentation consumes public events. It never advances the rules or delays a turn.
export const motionEnabled = (preferences, systemReducedMotion = false) => !preferences.reducedMotion && !systemReducedMotion;
export const tableAnchor = (game, observer) => observer ? 0 : game?.viewer ?? 0;
export function winningSeats(game) {
  if (game?.phase === 'matchOver') return game.winners ?? [];
  if (game?.phase !== 'roundOver' || !game.result) return [];
  const winner = game.players[game.result.winner];
  return game.options.mode === 'team' ? game.players.filter(player => player.team === winner.team).map(player => player.id) : [winner.id];
}
export function liveTableSounds(previous, next, { reconnecting = false } = {}) {
  if (reconnecting || !previous?.game || !next?.game || previous.code !== next.code || next.status !== 'playing' || next.game.revision <= previous.game.revision) return [];
  const last = previous.game.events.at(-1)?.id ?? 0;
  if ((next.game.events.at(-1)?.id ?? 0) < last) return [];
  return next.game.events.filter(event => event.id > last).flatMap(event => {
    if (event.type === 'challenge' && event.challengeKind === 'one' && event.success) return ['boing'];
    if (['round-end','match-end'].includes(event.type)) return ['winner'];
    return [];
  });
}
// Use only the already-public call flag, including when Spy masks the hand count.
export function liveOneCalls(previous, next, { reconnecting = false } = {}) {
  if (reconnecting || !previous?.game || !next?.game || previous.code !== next.code || next.status !== 'playing') return [];
  if (next.game.revision <= previous.game.revision) return [];
  const last = previous.game.events.at(-1)?.id ?? 0;
  if ((next.game.events.at(-1)?.id ?? 0) < last) return [];
  const announced = new Set();
  return next.game.events.filter(event => {
    if (event.id <= last || event.type !== 'one' || !Number.isInteger(event.actor) || announced.has(event.actor)) return false;
    if (!next.game.players?.[event.actor]?.oneCalled || previous.game.players?.[event.actor]?.oneCalled) return false;
    announced.add(event.actor);
    return true;
  });
}
export function latestLivePlay(previous, next, { reconnecting = false, hidden = false } = {}) {
  if (reconnecting || hidden || !previous?.game || !next?.game || previous.code !== next.code || next.status !== 'playing') return null;
  if (next.game.revision <= previous.game.revision) return null;
  const last = previous.game.events.at(-1)?.id ?? 0;
  if ((next.game.events.at(-1)?.id ?? 0) < last) return null;
  return next.game.events.filter(event => event.id > last && event.type === 'play' && Number.isInteger(event.actor) && event.card).at(-1) ?? null;
}
