// Presentation consumes public events. It never advances the rules or delays a turn.
export const motionEnabled = (preferences, systemReducedMotion = false) => !preferences.reducedMotion && !systemReducedMotion;
export const tableAnchor = (game, observer) => observer ? 0 : game?.viewer ?? 0;
export function latestLivePlay(previous, next, { reconnecting = false, hidden = false } = {}) {
  if (reconnecting || hidden || !previous?.game || !next?.game || previous.code !== next.code || next.status !== 'playing') return null;
  if (next.game.revision <= previous.game.revision) return null;
  const last = previous.game.events.at(-1)?.id ?? 0;
  if ((next.game.events.at(-1)?.id ?? 0) < last) return null;
  return next.game.events.filter(event => event.id > last && event.type === 'play' && Number.isInteger(event.actor) && event.card).at(-1) ?? null;
}
