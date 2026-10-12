import { createGame, applyAction, assertIntegrity } from '../app/engine.js';
import { chooseBotAction } from '../app/ai.js';

export function simulate({ seed = 1, mode = 'original', specialCards = true, difficulty = 'hard', maxActions = 20000, roundLimit = 3, scoreLimit = 500 } = {}) {
  let game = createGame(['Maya', 'Jules', 'Theo', 'Iris'].map(name => ({ name, human: false })), { mode, specialCards, difficulty, roundLimit, scoreLimit, delay: 0 }, seed);
  let turnKey = '', challengeTried = false, actions = 0, rejectedChallenges = 0;
  while (game.phase !== 'matchOver' && actions++ < maxActions) {
    assertIntegrity(game);
    if (game.phase === 'roundOver') { game = applyAction(game, null, { type: 'nextRound' }); continue; }
    const seat = game.phase === 'color' ? game.colorChoice.actor : game.turn;
    const key = `${game.round}:${game.turns}:${seat}:${game.phase}`;
    if (key !== turnKey) { turnKey = key; challengeTried = false; }
    const command = chooseBotAction(game, seat, { challengeTried });
    if (command?.type.startsWith('challenge')) challengeTried = true;
    try { game = applyAction(game, seat, command); }
    catch (error) { if (command?.type.startsWith('challenge')) rejectedChallenges++; else throw error; }
  }
  assertIntegrity(game);
  if (game.phase !== 'matchOver') throw new Error(`Simulation did not finish: seed ${seed}, ${mode}, ${specialCards}, round ${game.round}, turns ${game.turns}`);
  return { seed, mode, specialCards, difficulty, actions, turns: game.turns, rounds: game.round, winners: game.winners, rejectedChallenges };
}
if (process.argv[1]?.endsWith('simulate-one.js')) {
  const count = Math.min(1000, Math.max(1, Number(process.argv[2]) || 25));
  const reports = [];
  for (const mode of ['original', 'challenge', 'team']) for (const specialCards of [false, true]) for (let seed = 1; seed <= count; seed++) reports.push(simulate({ seed, mode, specialCards }));
  console.log(JSON.stringify({ matches: reports.length, actions: reports.reduce((sum, row) => sum + row.actions, 0), maxActions: Math.max(...reports.map(row => row.actions)), allFinished: true, reports }, null, 2));
}
