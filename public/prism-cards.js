const COLORS = { red: '#b83338', blue: '#236793', green: '#256344', yellow: '#b88820' };
const NAMES = { draw2: 'Draw Two', reverse: 'Reverse', skip: 'Skip', wild: 'Wild', wild4: 'Wild Draw Four', spy: 'Spy', shark: 'Shark', mutant: 'Mutant' };
const CORNERS = { draw2: '+2', reverse: '↔', skip: '⊘', wild: '✦', wild4: '+4', spy: '◉', shark: '△', mutant: 'M' };
const COLUMNS = { red: 0, blue: 1, green: 2, yellow: 3 };
const ILLUSTRATIONS = { spy: 0, shark: 1, mutant: 2, wild: 3 };
const reverse = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 18h29l-8-8m8 8-8 8M39 31H10l8 8m-8-8 8-8"/></svg>';

// Art supplies the texture; real values and color labels are always rendered by code.
export function prismCardHTML(card, back = false) {
  if (back) return '<div class="card prism-card prism-back" aria-hidden="true"><span class="prism-art" style="--art-x:100%;--art-y:94.2%;--art-height:213.2%"></span></div>';
  const kind = card.kind;
  const isNumber = kind === 'number';
  const color = Object.hasOwn(COLORS, card.color) ? card.color : null;
  const value = isNumber && Number.isInteger(card.value) && card.value >= 0 && card.value <= 9 ? String(card.value) : '';
  const corner = isNumber ? value : CORNERS[kind] ?? '?';
  const illustrated = Object.hasOwn(ILLUSTRATIONS, kind);
  const column = illustrated ? ILLUSTRATIONS[kind] : COLUMNS[color] ?? 4;
  const title = isNumber ? '' : NAMES[kind] ?? 'Card';
  const mark = isNumber ? value : kind === 'reverse' ? reverse : kind === 'draw2' ? '+2' : kind === 'wild4' ? '+4' : kind === 'skip' ? '⊘' : '';
  return `<div class="card prism-card ${isNumber ? 'prism-number' : 'prism-action'} ${color ?? 'unsuited'}" style="--card-color:${COLORS[color] ?? '#172923'}" aria-hidden="true">
    <span class="prism-art" style="--art-x:${column * 25}%;--art-y:${illustrated ? 94.2 : 0}%;--art-height:${illustrated ? 213.2 : 204.2}%"></span>
    <span class="prism-corner">${corner}</span><span class="prism-corner bottom">${corner}</span>
    ${color ? `<span class="prism-color">${color}</span>` : ''}
    ${mark ? `<span class="prism-mark">${mark}</span>` : ''}
    ${kind === 'wild4' ? '<span class="prism-four-colors"><i></i><i></i><i></i><i></i></span>' : ''}
    ${title ? `<span class="prism-name">${title}</span>` : ''}
  </div>`;
}
