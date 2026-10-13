import { motionEnabled, tableAnchor, latestLivePlay } from './table-effects.js';
import { TABLE_THEMES, CARD_DECKS, normalizeAppearance, getTheme, cameraLabel } from './appearance.js';
import { prismCardHTML } from './prism-cards.js';
const app = document.querySelector('#app');
const COLORS = { red: '#df5861', blue: '#3688b1', green: '#368b70', yellow: '#e9b73e' };
const AVATARS = ['#e7bd82', '#bccdae', '#b3cbd1', '#d9b8aa'];
const NAME = { draw2: 'Draw Two', reverse: 'Reverse', skip: 'Skip', wild: 'Wild', wild4: 'Wild Draw Four', spy: 'Spy', mutant: 'Mutant', shark: 'Shark' };
const esc = value => String(value ?? '').replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const titleCase = value => String(value ?? '').replace(/^./u, value => value.toUpperCase());
const labelCard = card => `${card.color ? `${titleCase(card.color)} ` : ''}${card.kind === 'number' ? card.value : NAME[card.kind]}`;
const paths = {
  play: '<path d="m8 5 11 7-11 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  arrow: '<path d="M4 12h16m-5-5 5 5-5 5"/>', sound: '<path d="M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/>', settings: '<path d="m9 3-1 3-3 1-2 4 2 3 3 1 1 4h6l1-4 3-1 2-3-2-4-3-1-1-3z"/><circle cx="12" cy="11" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .4-1 1-1 2m0 3h.01"/>', users: '<circle cx="8" cy="8" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m2 3a6 6 0 0 1 4 6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  shuffle: '<path d="M3 5h3c5 0 7 14 12 14h3m-4-4 4 4-4 3M3 19h3c2 0 3-2 5-6m3-5c1-2 2-3 4-3h3m-4-3 4 3-4 4"/>',
  reverse: '<path d="M4 8h14l-4-4m4 4-4 4M20 16H6l4 4m-4-4 4-4"/>', skip: '<circle cx="12" cy="12" r="8"/><path d="m6 18 12-12"/>',
  spy: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  mutant: '<path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5zM20 2v4m-2-2h4M3 18v4m-2-2h4"/>',
  shark: '<path d="M3 17c5-1 7-5 10-13 2 5 1 9 7 13M2 20c2-3 4 3 7 0s4 3 7 0 4 3 6 0"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>', home: '<path d="m3 10 9-7 9 7v11H3zM9 21v-7h6v7"/>', leaf: '<path d="M20 3c-9 0-16 2-16 9s7 10 11 5 5-14 5-14zM3 21 16 8"/>',
  themes: '<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h3a5 5 0 0 0 0-10z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6" r="1"/><circle cx="15" cy="6" r="1"/>',
  qr: '<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm12 0v3h3v4m3-7v3m-6 4h-2"/>', step: '<path d="m5 5 10 7-10 7zM19 5v14"/>', check: '<path d="m5 12 4 4L20 5"/>', trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v6M7 21h10"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? paths.play}</svg>`;
const readStored = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const savedPreferences = readStored('one.preferences', {});
let prefs = { effects: false, music: false, volume: 35, reducedMotion: false, contrast: false, ...savedPreferences, ...normalizeAppearance(savedPreferences) };
let draft = { name: localStorage.getItem('one.name') || '', humanCount: 1, mode: 'original', specialCards: true, difficulty: 'hard', delay: 1, roundLimit: 1, scoreLimit: 0, lobbySeconds: 60, ...readStored('one.setup', {}) };
let skipPresentation = true, activeFlight = null, lastFlightAt = 0;
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
let room = null, credentials = null, socket = null, connected = false, reconnectTimer = null, retry = 0;
let joinCode = location.pathname.match(/^\/r\/([A-Z0-9]{6})$/iu)?.[1].toUpperCase() ?? null;
let lobby = null, inviteBase = location.origin, selectedCard = null, watchSeat = 'auto', lastEvent = 0, busy = false;
let formError = '', modal = null, autoPaused = false, serverOffset = 0, toastTimer = null, abandoned = false;
let themeFilter = 'all', modalReturnAction = 'settings';
const savePrefs = () => { try { localStorage.setItem('one.preferences', JSON.stringify(prefs)); } catch {} applyPreferences(); };
function applyPreferences() {
  document.body.dataset.theme = prefs.theme;
  document.body.dataset.deck = prefs.deck;
  document.body.classList.toggle('reduced-motion', !motionEnabled(prefs, systemMotion.matches));
  if (!motionEnabled(prefs, systemMotion.matches)) cancelFlight();
  document.body.classList.toggle('high-contrast', prefs.contrast);
}
function toast(message) {
  const node = document.querySelector('#toast'); node.textContent = message; node.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 3800);
}

const audio = {
  context: null, musicTimer: null, melodyIndex: 0, slideURL: null, slideBuffer: null, slideLoad: null, lastSlideAt: -1,
  init() { try { this.context ??= new AudioContext(); this.context.resume().catch(()=>{}); this.loadSlide(); } catch {} },
  loadSlide() {
    if(!this.context || !this.slideURL || this.slideLoad)return;
    this.slideLoad=fetch(this.slideURL).then(response=>{if(!response.ok)throw Error('No local sample');return response.arrayBuffer();}).then(data=>this.context.decodeAudioData(data)).then(buffer=>{this.slideBuffer=buffer;}).catch(()=>{});
  },
  slide() {
    if(!prefs.effects||prefs.volume<=0)return;this.init();const context=this.context;if(!context||context.state!=='running')return;
    const at=context.currentTime;if(at-this.lastSlideAt<.075)return;this.lastSlideAt=at;
    const gain=context.createGain();gain.connect(context.destination);
    if(this.slideBuffer){const source=context.createBufferSource();source.buffer=this.slideBuffer;gain.gain.value=.8*prefs.volume/100;source.connect(gain);source.start(at);source.onended=()=>{source.disconnect();gain.disconnect();};return;}
    const duration=.28,buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    const source=context.createBufferSource(),filter=context.createBiquadFilter();source.buffer=buffer;filter.type='bandpass';filter.Q.value=.65;
    filter.frequency.setValueAtTime(2200,at);filter.frequency.exponentialRampToValueAtTime(900,at+duration);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,.15*prefs.volume/100),at+.035);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    source.connect(filter);filter.connect(gain);source.start(at);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  },
  note(frequency, duration = .09, delay = 0, level = .08, type = 'sine') {
    if (!this.context || this.context.state !== 'running' || prefs.volume<=0) return;
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type; osc.frequency.value = frequency; const at = this.context.currentTime + delay;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level * prefs.volume / 100, at + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(gain); gain.connect(this.context.destination); osc.start(at); osc.stop(at + duration + .03);
  },
  effect(type) { if (!prefs.effects) return; this.init();
    if (type === 'one') { this.note(523,.14); this.note(659,.14,.12); this.note(784,.2,.24); }
    else if (['match-end','round-end'].includes(type)) { [523,659,784,1046].forEach((n,i) => this.note(n,.25,i*.12)); }
    else if (type === 'shark' || type === 'challenge') { this.note(180,.15,0,.11,'triangle'); this.note(240,.15,.1,.07,'triangle'); }
    else if (type === 'play' || type === 'draw') this.slide();
  },
  updateMusic() {
    clearInterval(this.musicTimer); this.musicTimer = null;
    if (!prefs.music || !room || room.paused || room.status !== 'playing') return;
    this.init(); const notes = [220,277,330,277,196,247,294,247];
    const play = () => { this.note(notes[this.melodyIndex++ % notes.length],1.25,0,.023,'sine'); };
    play(); this.musicTimer = setInterval(play,1700);
  }
};
const unlockAudio=()=>{if(prefs.effects||prefs.music)audio.init();};
document.addEventListener('pointerdown',unlockAudio,{passive:true});
document.addEventListener('keydown',unlockAudio);

function cardHTML(card, back = false, deck = prefs.deck) {
  if (deck === 'prism') return prismCardHTML(card, back);
  if (back) return '<div class="card card-back"><div class="card-inner"><div class="card-oval"></div><div class="back-word">one</div><div class="back-small">CARD TABLE</div></div></div>';
  const color = COLORS[card.color] ?? '#25443a';
  const corner = card.kind === 'number' ? card.value : ({ draw2: '+2', wild4: '+4', wild: '✦', reverse: '↔', skip: '⊘', spy: '◉', mutant: 'M', shark: '△' })[card.kind];
  const mark = card.kind === 'number' ? card.value : card.kind === 'draw2' ? '+2' : card.kind === 'wild4' ? '+4' : card.kind === 'wild' ? '<span class="wild-symbol"><i></i><i></i><i></i><i></i></span>' : icon(card.kind);
  const dots = card.kind === 'wild4' ? `<span class="wild4-dots">${Object.values(COLORS).map(color => `<i style="--dot:${color}"></i>`).join('')}</span>` : '';
  return `<div class="card ${esc(card.kind)}" style="--card-color:${color}" aria-hidden="true"><div class="card-inner"><div class="card-oval"></div><span class="card-corner">${corner}</span><span class="card-corner bottom">${corner}</span>${dots}<div class="card-mark">${mark}</div>${card.kind !== 'number' ? `<div class="card-kind">${esc(NAME[card.kind])}</div>` : ''}</div></div>`;
}
const demoHand = [
  { id:'demo1', kind:'number', color:'blue', value:8 }, { id:'demo2', kind:'number', color:'red', value:4 },
  { id:'demo3', kind:'skip', color:'yellow' }, { id:'demo4', kind:'wild', color:null },
  { id:'demo5', kind:'number', color:'green', value:2 }, { id:'demo6', kind:'shark', color:'blue' }, { id:'demo7', kind:'number', color:'yellow', value:9 }
];
const actorSeat = game => game.phase === 'color' ? game.colorActor : game.turn;
function cancelFlight() {
  const flight=activeFlight;activeFlight=null;
  if(flight){flight.animation?.cancel();flight.nodes.forEach(node=>node.remove());}
  document.body.classList.remove('card-in-flight');
}
function playOrigin(play, previous) {
  const self=tableAnchor(previous.game,previous.desiredHumans===0);
  const source=play.actor===self
    ? document.querySelector(`[data-card="${CSS.escape(play.card.id)}"]`)??document.querySelector('.drawn-panel .small-card')??document.querySelector('.hand-area')
    : document.querySelector(`.opponent[data-seat="${play.actor}"] .mini-fan`);
  if(!source)return null;
  const rect=source.getBoundingClientRect();
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,scale:play.actor === self ? .85 : .46};
}
function slideCard(play, origin, previousDiscard) {
  const now=performance.now(),rapid=now-lastFlightAt<180;lastFlightAt=now;
  cancelFlight();audio.slide();
  if(!origin||rapid||!motionEnabled(prefs,systemMotion.matches)||modal)return;
  const pile=document.querySelector('.pile.discard');if(!pile||typeof pile.animate!=='function')return;
  const rect=pile.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2;
  const create=(card,extra)=>{const node=document.createElement('div');node.className=`card-flight ${extra}`;node.setAttribute('aria-hidden','true');node.style.cssText=`left:${x-rect.width/2}px;top:${y-rect.height/2}px;width:${rect.width}px;height:${rect.height}px;`;node.innerHTML=cardHTML(card);document.body.append(node);return node;};
  const old=previousDiscard?create(previousDiscard,'old-discard'):null,flying=create(play.card,'moving-card');
  document.body.classList.add('card-in-flight');
  const dx=origin.x-x,dy=origin.y-y;
  const animation=flying.animate([
    {transform:`translate3d(${dx}px,${dy}px,0) rotate(-9deg) scale(${origin.scale})`,opacity:.96},
    {transform:`translate3d(${dx*.25}px,${dy*.25}px,0) rotate(3deg) scale(.96)`,opacity:1,offset:.72},
    {transform:'translate3d(0,0,0) rotate(7deg) scale(1)',opacity:1}
  ],{duration:420,easing:'cubic-bezier(.2,.65,.3,1)',fill:'forwards'});
  const flight={animation,nodes:[old,flying].filter(Boolean)};activeFlight=flight;
  const finish=()=>{flight.nodes.forEach(node=>node.remove());if(activeFlight===flight){activeFlight=null;document.body.classList.remove('card-in-flight');}};
  animation.onfinish=finish;animation.oncancel=finish;
}
systemMotion.addEventListener('change',applyPreferences);
window.addEventListener('resize',cancelFlight);
window.addEventListener('scroll',cancelFlight,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelFlight();});
function miniFan(player) {
  const count = player.hidden ? 5 : Math.min(7, player.count ?? 5);
  const cards = Array.from({ length: count }, (_, index) => `<div class="mini-card ${prefs.deck === 'prism' ? 'prism-mini' : ''}" style="transform:translateX(${(index - (count-1)/2)*10}px) rotate(${(index-(count-1)/2)*9}deg)">${prefs.deck === 'prism' ? cardHTML(null, true) : '<span>one</span>'}</div>`).join('');
  return `<div class="mini-fan" aria-label="${esc(player.name)}: ${player.hidden ? 'card count hidden by Spy' : player.alive === false ? 'eliminated' : `${count === 7 ? 'at least seven' : count} cards`}">${cards}<span class="count-badge ${player.hidden ? 'hidden' : ''}">${player.alive === false ? 'Out' : player.hidden ? icon('spy') : count === 7 ? '7+' : count}</span></div>`;
}
function tableHTML() {
  const theme = getTheme(prefs.theme);
  const game = room?.game;
  const observer = room?.desiredHumans === 0;
  const viewer = observer ? (watchSeat === 'auto' ? game?.turn ?? 0 : Number(watchSeat)) : game?.viewer ?? 0;
  const demo = !game;
  const players = game?.players ?? (lobby || room)?.seats?.map(seat => ({ ...seat, score:0, count:7, alive:true })) ?? [
    { id:0, name:draft.name || 'You', human:true, count:7, score:0, alive:true }, ...['Maya','Jules','Theo'].map((name,index) => ({ id:index+1, name, human:false, count:7, score:0, alive:true }))
  ];
  const anchor = tableAnchor(game, observer);
  const others = [1,2,3].map(offset => players[(anchor + offset) % 4]);
  const hand = observer ? game?.observerHands?.[viewer] ?? [] : game?.hand ?? demoHand;
  const own = players[viewer];
  const playing = !!game && room.status === 'playing' && ['turn','color'].includes(game.phase);
  const ownTurn = playing && actorSeat(game) === anchor;
  const actor = game ? players[game.phase === 'color' ? game.colorActor : game.turn] : null;
  const top = game?.discard ?? { kind:'number', color:'red', value:8 };
  const myTurn = !!game && game.viewer === game.turn && game.phase === 'turn' && room.status === 'playing' && !room.paused && connected;
  const invitation = room?.status === 'lobby' || !!joinCode && !room;
  const canCatch = !!game && !observer && room.status === 'playing' && !room.paused && game.phase === 'turn';
  const oneNeeded = myTurn && hand.length + (game.drawn ? 1 : 0) <= 2 && !own.oneCalled;
  let message = demo ? 'Match a color, a number, or a symbol.' : room.status === 'stopped' ? 'This table is stopped. Start a fresh game when you’re ready.' : room.paused ? 'Take your time. The table is paused.' : game.phase === 'matchOver' ? `${game.winners.map(id => players[id].name).join(' & ')} won the match.` : game.phase === 'roundOver' ? `${players[game.result.winner].name} won this round.` : game.phase === 'color' ? `${actor.name} is choosing the next color.` : observer ? `${actor.name} is thinking…` : myTurn ? game.pendingCount ? `Pick up ${game.pendingCount}${game.wildChallenge ? ' — or challenge the Wild Draw Four.' : ' and pass.'}` : game.drawn ? 'Play the drawn card, play a matching hand card, or keep it.' : 'Your turn. Click a matching card, or draw.' : `${actor.name}’s turn. Your cards are ready.`;
  if (invitation) message = 'A few friends. A few computers. One good table.';
  return `<section class="table-shell ${game?'live-table':''} ${room?.paused?'paused':''} ${ownTurn?'own-turn':''} ${theme.art?'art-table':''}" data-camera="${theme.camera}" ${theme.art ? `style="--board-image:url('${theme.art}')"` : ''} aria-label="One card table">
    <div class="table-meta"><span>${icon('users')} FOUR SEATS</span><span>${demo ? 'PULL UP A CHAIR' : observer ? 'COMPUTER TABLE' : esc(titleCase(game?.options.mode ?? 'original'))}${game ? ` · ROUND ${game.round}` : ''}</span></div>
    <div class="wood-table"></div><div class="center-brand">one more round</div>
    <div class="opponent-row">${others.map(player => `<div data-seat="${player.id}" class="opponent ${playing && game?.turn === player.id && ['turn','color'].includes(game.phase) ? 'active' : ''} ${!player.alive ? 'eliminated' : ''}">
      <div class="player-pill"><div class="avatar" style="--avatar:${AVATARS[player.id]}">${esc([...player.name][0]?.toUpperCase() ?? '?')}</div><div><div class="player-name">${esc(player.name)}</div><div class="player-caption">${player.human ? icon('users') : ''}${player.human ? 'At the table' : invitation ? 'Computer seat' : 'Computer'}${game?.options.mode === 'team' ? ` · ${player.team === 0 ? 'Red' : 'Blue'}` : ''}</div></div><span class="player-score">${player.score ?? 0}</span>${playing&&game.turn===player.id?'<span class="turn-marker" aria-hidden="true">'+icon('play')+'</span>':''}${player.oneCalled ? '<span class="one-tag">ONE!</span>' : ''}</div>
      ${miniFan(player)}${canCatch ? `<button class="catch-button" data-action="catch" data-target="${player.id}" aria-label="Challenge ${esc(player.name)} for a missed One call">Catch One</button>` : ''}</div>`).join('')}</div>
    <div class="piles"><div class="pile-group"><button class="pile draw" data-action="draw" aria-label="Draw a card" ${!myTurn || !game?.canDraw ? 'disabled' : ''}>${cardHTML(null,true)}</button><div class="pile-label">DRAW ${game ? `<b>${game.drawCount}</b>` : ''}</div></div>
      <div class="pile-group"><div class="pile discard" role="img" aria-label="Discard: ${esc(labelCard(top))}">${cardHTML(top)}</div><div class="pile-label">DISCARD</div></div></div>
    <div class="direction-indicator" aria-label="Current color: ${game?.activeColor??(demo?'red':'choose a color')}"><span class="color-badge ${game?.activeColor??(demo?'red':'choosing')}" style="--suit:${COLORS[game?.activeColor??'red']??'#536859'}"><span class="color-swatch" aria-hidden="true"></span><span>${game?.activeColor?titleCase(game.activeColor):demo?'Red':'Choose color'}</span></span><span class="direction-caption">${icon('reverse')} ${game?.direction===-1?'Counterclockwise':'Clockwise'}</span></div>
    <div class="table-message">${esc(message)}</div>
    <button class="one-button ${oneNeeded ? 'needed' : ''}" data-action="one" aria-label="Call One before playing your second-to-last card" ${!myTurn || !game?.canCallOne ? 'disabled' : ''}>ONE!</button><span class="one-caption">${own?.oneCalled ? 'YOU CALLED IT' : 'CALL BEFORE YOU PLAY'}</span>
    <div class="hand-area ${ownTurn?'active':''}" data-seat="${anchor}"><div class="hand-label"><span>${observer ? `${esc(own?.name)}’s hand` : game ? 'Your hand' : 'Your next good hand'}${game ? ` · ${hand.length} cards` : ''}</span><span class="hand-turn-badge ${ownTurn?'on':''}">${ownTurn?icon('play'):''}${observer ? ownTurn?`${esc(players[anchor].name)}’S TURN`:'WATCHING' : demo ? 'THE TABLE IS READY' : ownTurn ? 'YOUR TURN' : 'PLAN YOUR NEXT MOVE'}</span></div>
      <div class="hand-rail ${hand.length > 9 ? 'many' : ''}" tabindex="-1" aria-label="${observer ? 'Observed computer hand' : 'Your cards'}">${hand.map((card,index) => {
        const mid = (Math.min(hand.length,9)-1)/2;
        const playable = game?.legalCardIds.includes(card.id);
        return `<button class="hand-card ${demo ? 'demo' : ''} ${selectedCard === card.id ? 'selected' : ''} ${myTurn && playable ? 'playable' : 'unplayable'}" data-card="${esc(card.id)}" aria-label="${esc(labelCard(card))}${myTurn ? playable ? ', playable' : ', cannot play now' : ''}" style="--angle:${hand.length > 9 ? 0 : (index-mid)*2}deg;--raise:${hand.length > 9 ? 0 : Math.abs(index-mid)*1.5}px;--z:${index}" ${demo || observer ? 'disabled' : ''}>${cardHTML(card)}</button>`;
      }).join('')}</div></div>
    ${room?.paused || room?.status === 'stopped' ? `<div class="status-overlay"><span>${room.status === 'stopped' ? 'Table stopped' : 'Taking a breather'}</span></div>` : ''}
  </section>`;
}
function setupHTML() {
  const helper = draft.humanCount === 0 ? 'Four computers play. You can watch, pause, step, or stop.' : draft.humanCount === 1 ? 'You and three computer opponents. Ready when you are.' : `${draft.humanCount} human seats. Computers fill the remaining ${4-draft.humanCount}.`;
  return `<aside class="side-panel home-panel"><div class="eyebrow">${icon('leaf')} A GOOD GAME, TOGETHER</div><h1>Welcome to<br>the table.</h1><p>The familiar game of colors and clever cards. Bring friends, or let the computers pull up a chair.</p>
    <form id="create-form"><div class="form-row"><label for="player-name">Your name</label><input id="player-name" name="name" placeholder="What should we call you?" value="${esc(draft.name)}" maxlength="24" autocomplete="nickname" ${draft.humanCount === 0 ? 'disabled' : 'required'}></div>
    <div class="form-row"><span class="field-label">Human players</span><div class="humans-choice">${[0,1,2,3,4].map(n => `<button type="button" class="choice-button ${draft.humanCount === n ? 'selected' : ''}" data-action="humans" data-count="${n}" aria-label="${n === 0 ? 'Zero humans, computer-only test table' : `${n} human players`}" aria-pressed="${draft.humanCount === n}">${n === 0 ? icon('play') : n}</button>`).join('')}</div><p class="form-help">${helper}</p></div>
    <div class="form-grid"><div class="form-row"><label for="mode">Game</label><select id="mode" name="mode">${[['original','Original'],['challenge','Challenge'],['team','Team']].map(([value,label])=>`<option value="${value}" ${draft.mode===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="form-row"><label for="difficulty">Computers</label><select id="difficulty" name="difficulty">${['easy','medium','hard'].map(value=>`<option value="${value}" ${draft.difficulty===value?'selected':''}>${titleCase(value)}</option>`).join('')}</select></div></div>
    <label class="checkbox-row"><span><b>Spy, Shark & Mutant</b><small>A little more surprise at the table.</small></span><input type="checkbox" name="specialCards" ${draft.specialCards?'checked':''}></label>
    <details class="advanced"><summary>Match length & pace</summary><div class="advanced-content"><div class="form-grid"><div class="form-row"><label for="round-limit">Round limit</label><input id="round-limit" type="number" name="roundLimit" min="0" max="50" value="${draft.roundLimit}" ${draft.mode==='challenge'?'disabled':''}></div><div class="form-row"><label for="score-limit">Point target</label><input id="score-limit" type="number" name="scoreLimit" min="0" max="3000" step="100" value="${draft.scoreLimit}"></div></div><div class="form-row"><label for="delay">Computer think time</label><select id="delay" name="delay">${[[0,'Fast · no wait'],[.4,'Brisk · 0.4 seconds'],[1,'Relaxed · 1 second'],[2,'Take your time · 2 seconds'],[4,'Slow · 4 seconds']].map(([value,label])=>`<option value="${value}" ${draft.delay===value?'selected':''}>${label}</option>`).join('')}</select></div>${draft.humanCount>1?`<div class="form-row"><label for="lobby-seconds">Invitation window</label><select id="lobby-seconds" name="lobbySeconds">${[30,60,120].map(value=>`<option value="${value}" ${draft.lobbySeconds===value?'selected':''}>${value} seconds</option>`).join('')}</select></div>`:''}<p class="form-help">Zero rounds means unlimited. Zero points means no point limit with finite rounds; otherwise the target is 500. Challenge uses a point target and unlimited rounds.</p></div></details>
    <div class="error-line form-error" role="alert">${esc(formError)}</div><div class="form-actions"><button class="primary" type="submit" ${busy?'disabled':''}>${busy ? 'Setting the table…' : draft.humanCount===0?'Watch the computers':draft.humanCount>1?'Invite your friends':'Play One'} ${icon(draft.humanCount>1?'qr':'arrow')}</button><div class="side-foot">Four seats. No accounts. Just a good round.</div></div></form></aside>`;
}
const inviteURL = code => `${inviteBase}/r/${code}`;
function lobbyHTML() {
  const info = room ?? lobby;
  const seats = info?.seats ?? [];
  const joined = seats.filter(seat => seat.human);
  if (!room) return `<aside class="side-panel"><div class="eyebrow">${icon('users')} YOU’RE INVITED</div><h1 class="join-title">Pull up a chair.</h1><p>${lobby ? `${esc(lobby.hostName)} has saved a place at the table. Enter your name to join.` : 'Finding your table…'}</p>${lobby?.status && lobby.status!=='lobby' ? `<p>${lobby.status==='missing'?esc(formError):'This table has already started. Ask the host for a new invitation.'}</p><button class="primary" data-action="home">Create your own table ${icon('arrow')}</button>` : `<form id="join-form"><div class="form-row"><label for="join-name">Your name</label><input id="join-name" name="name" value="${esc(draft.name)}" placeholder="Your name" maxlength="24" autocomplete="nickname" required></div><div class="error-line" role="alert">${esc(formError)}</div><button class="primary" ${busy||!lobby?'disabled':''}>${busy?'Joining…':'Join the table'} ${icon('arrow')}</button></form>`}<div class="side-foot">Table ${esc(joinCode)} · Same Wi-Fi or local network</div></aside>`;
  return `<aside class="side-panel lobby-panel"><div class="eyebrow">${icon('users')} ${room.host?'YOUR TABLE, YOUR PEOPLE':'A CHAIR WITH YOUR NAME ON IT'}</div><h2>${room.host?'Gather around.':'You’re at the table.'}</h2><p>${room.host?'Friends scan this code, enter a name, and join. No app to install.':'The host will start the game. Anyone still missing is replaced by a computer when the timer ends.'}</p>
    <div class="qr-wrap"><img src="/api/rooms/${room.code}/qr.svg" alt="QR invitation to join this One table"></div><div class="room-code">TABLE ${room.code}</div><div class="invite-url">${esc(inviteURL(room.code))}</div>
    <div class="countdown"><span>${joined.length} of ${room.desiredHumans} human seats joined</span><b data-countdown>—</b></div>
    <div class="joined-list">${seats.map(seat=>`<div class="joined-person"><span><i style="opacity:${seat.human?1:.3}"></i>${esc(seat.human?seat.name:'Open chair')}</span><small>${seat.human?'Joined':'Computer if unfilled'}</small></div>`).join('')}</div>
    <button class="secondary block" data-action="copy">${icon('copy')} Copy invitation link</button>${room.host?`<div class="button-row"><button class="secondary" data-action="extend">More time</button><button class="primary" data-action="start">Start now ${icon('play')}</button></div>`:''}<div class="side-foot">Phones and tablets must use the same Wi-Fi or local network.</div></aside>`;
}
function resultsHTML(game) {
  const result = game.result;
  const complete = game.phase === 'matchOver';
  const meWon = game.viewer !== null && game.winners.includes(game.viewer);
  const winner = game.players[result.winner];
  let rows = result.rows;
  if (game.options.mode === 'team') rows = [0,1].map(team=>({ ...rows.find(row=>row.team===team), name:rows.filter(row=>row.team===team).map(row=>row.name).join(' & '), id:team }));
  return `<div class="eyebrow">${icon('trophy')} ${complete?'MATCH COMPLETE':`ROUND ${game.round} COMPLETE`}</div><h2>${complete?meWon?'You won. Nicely played.':`${esc(game.winners.map(id=>game.players[id].name).join(' & '))} won.`:`${esc(winner.name)} takes the round.`}</h2><p>${complete?'A good round deserves another.':'The cards left in hand settle the score.'}${result.finalPairReset?' Two players remain. Scores reset for the final hand.':''}</p>
    <div class="round-result">${rows.map(row=>`<div class="result-row ${row.id===result.winner||game.options.mode==='team'&&row.team===winner.team?'winner':''} ${!row.alive?'eliminated':''}"><span>${esc(row.name)}${!row.alive?' · out':''}</span><span class="delta">+${row.delta}</span><span class="score">${row.score}</span></div>`).join('')}</div>
    <div class="result-actions">${room.host?`<button class="primary" data-action="${complete?'restart':'nextRound'}">${complete?'Play another match':'Next round'} ${icon('arrow')}</button>`:`<p>${complete?'The host can deal another match.':'The next round will start shortly.'}</p>`}</div>`;
}
function gameHTML() {
  const game = room.game, observer = room.desiredHumans === 0;
  const myColor=game.phase==='color'&&game.colorActor===game.viewer;
  const myTurn = game.viewer === game.turn && game.phase === 'turn' && connected && !room.paused && room.status==='playing';
  const actor = game.players[game.phase==='color'?game.colorActor:game.turn];
  const current = game.players[game.viewer];
  const ended = ['roundOver','matchOver'].includes(game.phase);
  let content = '';
  if (room.status==='stopped') content=`<div class="eyebrow">${icon('stop')} TABLE STOPPED</div><h2>That was a good<br>place to pause.</h2><p>The computers have stopped. Your last table stays here for a look.</p>${room.host?'<button class="primary" data-action="restart">Deal a fresh game '+icon('shuffle')+'</button>':''}`;
  else if (ended) content = resultsHTML(game);
  else {
    content = `<div class="eyebrow">${icon(observer?'play':'leaf')} ${observer?'FOUR COMPUTERS, ONE TABLE':myTurn?'YOUR MOVE':'A GOOD ROUND IN PROGRESS'}</div><h2>${observer?'Watch the table.':myColor?'Choose a color.':myTurn?'Make your move.':'One more turn.'}</h2><div class="turn-summary ${myTurn?'yours':''}"><div class="turn-name">${room.paused?'The table is paused':game.phase==='color'?`${esc(actor.name)} chooses a color`:myTurn?'You’re up.':`${esc(actor.name)}’s turn`}</div><div class="turn-hint">${myColor?'Choose the next color using the buttons below.':myTurn?game.pendingCount?`Pick up ${game.pendingCount} cards and pass${game.wildChallenge?' — or challenge the Wild Draw Four':''}.`:game.drawn?'The new card is below. Your original hand can still be played.':'Match the color, number, or symbol. Call One before you play down to one card.':observer?'Every computer uses its own cards and public information.':current?.alive===false?'You’re out of this Challenge match, but you can watch the final hands.':'You can plan your next card while the table plays.'}</div></div>`;
    if (game.phase==='color' && game.colorActor===game.viewer) content += `<div class="color-prompt" aria-label="Choose the next color">${Object.entries(COLORS).map(([color,value])=>`<button class="color-button" data-action="color" data-color="${color}" style="--suit:${value}" ${room.paused?'disabled':''}><i></i>${titleCase(color)}</button>`).join('')}</div>`;
    else if (myTurn && game.drawn) content += `<div class="drawn-panel"><p>You drew ${esc(labelCard(game.drawn))}.</p><div class="drawn-card-row"><div class="small-card">${cardHTML(game.drawn)}</div><div class="drawn-options"><button class="primary" data-action="playDrawn" ${game.legalCardIds.includes(game.drawn.id)?'':'disabled'}>Play card</button><button class="secondary" data-action="pass">Keep & pass</button></div></div></div>`;
    else if (myTurn) content += `<div class="game-action-row"><button class="primary" data-action="${game.pendingCount||game.canPass?'pass':'draw'}" ${game.pendingCount||game.canPass||game.canDraw?'':'disabled'}>${game.pendingCount?`Draw ${game.pendingCount} & pass`:game.canPass?'Pass turn':'Draw a card'} ${icon('arrow')}</button></div>`;
    if (myTurn && game.wildChallenge?.recipient===game.viewer) content += `<button class="secondary block" style="margin-top:8px" data-action="challengeWild">Challenge Wild Draw Four</button>`;
  }
  if (room.fault) content += `<p class="error-line">${esc(room.fault)}</p>`;
  const log = [...game.events].reverse().slice(0,8);
  return `<aside class="side-panel game-panel">${content}<div class="event-heading"><span>AT THE TABLE</span>${icon('clock')}</div><div class="event-feed" role="log" aria-label="Public table events">${log.map(item=>`<div class="event-item ${['one','challenge','shark','round-end','match-end'].includes(item.type)?'highlight':''}"><i class="event-dot"></i><span>${esc(item.text)}</span></div>`).join('')}</div>
    ${observer?`<div class="observer-controls"><label for="watch-seat">Look at a computer’s hand</label><select id="watch-seat">${[['auto','Follow the turn'],...game.players.map(player=>[player.id,player.name])].map(([value,label])=>`<option value="${value}" ${String(watchSeat)===String(value)?'selected':''}>${esc(label)}</option>`).join('')}</select><div class="button-row"><button class="secondary" data-action="pause" ${room.status==='playing'&&game.phase!=='matchOver'?'':'disabled'}>${icon(room.paused?'play':'pause')} ${room.paused?'Resume':'Pause'}</button><button class="secondary" data-action="step" ${room.paused&&room.status==='playing'&&game.phase!=='matchOver'?'':'disabled'}>${icon('step')} Step</button><button class="secondary" data-action="stop" ${room.status==='stopped'?'disabled':''}>${icon('stop')} Stop</button></div><label for="watch-speed">Pace</label><select id="watch-speed">${[[0,'Fast · no wait'],[.4,'Brisk'],[1,'Relaxed'],[2,'Slow'],[4,'Very slow']].map(([value,label])=>`<option value="${value}" ${Number(room.options.delay)===value?'selected':''}>${label}</option>`).join('')}</select><div class="seed">Seed ${game.seed} · ${game.turns} turns · ${game.discardCount} discards<br>Pause freezes play. Step resolves one computer action.</div></div>`:`<div class="your-score"><span>${game.options.mode==='team'?`${current?.team===0?'Red':'Blue'} team score`:'Your score'}</span><b>${current?.score??0}</b><span class="mode-badge">${titleCase(game.options.mode)}</span></div>`}</aside>`;
}
function render() {
  const oldRail = document.querySelector('.hand-rail'); const scroll = oldRail?.scrollLeft ?? 0;
  const focused = document.activeElement?.dataset.card;
  const headerControls = room?.host && room.status==='playing' && room.game?.phase!=='matchOver' ? `<button class="small-button" data-action="pause" aria-label="${room.paused?'Resume':'Pause'} table">${icon(room.paused?'play':'pause')}<span>${room.paused?'Resume':'Pause'}</span></button><button class="small-button danger" data-action="stop" aria-label="Stop game">${icon('stop')}<span>Stop</span></button>` : '';
  app.innerHTML=`<header class="topbar"><button class="brand" data-action="home" aria-label="${room?'Leave this table and go home':'One home'}"><div class="brand-stack" aria-hidden="true"></div><div><div class="wordmark">one</div><div class="brand-sub">CARD TABLE</div></div></button><div class="header-center">${room?`<i class="connection-dot ${connected?'':'offline'}"></i>${connected?'At the table':'Reconnecting…'} · ${room.code}`:'A little luck. A clever card. A good table.'}</div><nav class="header-actions" aria-label="Table controls">${headerControls}<button class="small-button" data-action="sound" aria-label="${prefs.effects?'Mute':'Enable'} sound effects">${icon(prefs.effects?'sound':'mute')}<span>Sound ${prefs.effects?'on':'off'}</span></button><button class="small-button" data-action="help" aria-label="How to play">${icon('help')}<span>How to play</span></button><button class="small-button themes-button" data-action="themes" aria-label="Choose themes and card deck">${icon('themes')}<span>Themes</span></button><button class="small-button" data-action="settings" aria-label="Open settings">${icon('settings')}</button></nav></header><main class="page ${!room&&joinCode?'joining':room?.status==='lobby'?'inviting':''}"><div class="workspace">${tableHTML()}${room?room.status==='lobby'?lobbyHTML():gameHTML():joinCode?lobbyHTML():setupHTML()}</div><footer class="footer"><span>${icon('leaf')} FOUR SEATS. ONE GOOD ROUND.</span><span>${room?room.options.specialCards?'Spy, Shark & Mutant are in the deck':'Classic cards at the table':'Made for a few friends and a little friendly rivalry.'}</span></footer></main>`;
  const rail=document.querySelector('.hand-rail'); if(rail)rail.scrollLeft=scroll;
  if(focused) document.querySelector(`[data-card="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  updateCountdown();
}
function themePreview(theme) {
  return `<div class="theme-preview ${theme.art ? '' : `standard-preview ${theme.id}`}" aria-hidden="true">${theme.art ? `<img src="${theme.thumbnail}" loading="lazy" alt="">` : ''}</div>`;
}
function themeTile(theme) {
  const selected = prefs.theme === theme.id;
  return `<button type="button" class="theme-tile ${selected ? 'selected' : ''}" data-action="chooseTheme" data-theme="${theme.id}" aria-pressed="${selected}" aria-label="${theme.number ? `Theme ${theme.number}: ` : ''}${esc(theme.name)}, ${cameraLabel(theme.camera)}">
    ${themePreview(theme)}${theme.number ? `<span class="theme-number">${theme.number}</span>` : ''}${selected ? `<span class="theme-selected" aria-hidden="true">${icon('check')}</span>` : ''}
    <span class="theme-tile-copy"><span class="theme-tile-name">${esc(theme.name)}</span><span class="theme-tile-camera">${cameraLabel(theme.camera)}</span><span class="theme-tile-description">${esc(theme.description)}</span></span>
  </button>`;
}
function themesHTML() {
  const selected = getTheme(prefs.theme);
  const collection = TABLE_THEMES.filter(theme => theme.group === 'collection' && (themeFilter === 'all' || theme.camera === themeFilter));
  return `<div class="theme-content"><p>Choose a place to play, then a deck to make it yours.</p>
    <div class="theme-summary" role="status" aria-live="polite">${themePreview(selected)}<div><small>YOUR TABLE</small><strong>${esc(selected.name)} · ${cameraLabel(selected.camera)}</strong><small>${esc(CARD_DECKS.find(deck => deck.id === prefs.deck).name)} cards</small></div></div>
    <section aria-labelledby="deck-heading"><h3 id="deck-heading">The cards</h3><p>Choose your deck independently of the table.</p><div class="deck-options">${CARD_DECKS.map(deck => `<button type="button" class="deck-option ${prefs.deck === deck.id ? 'selected' : ''}" data-action="chooseDeck" data-deck="${deck.id}" aria-pressed="${prefs.deck === deck.id}" aria-label="${esc(deck.name)} card deck">
      <span class="deck-preview" aria-hidden="true">${cardHTML({kind:'number',color:'blue',value:8},false,deck.id)}${cardHTML({kind:'number',color:'red',value:4},false,deck.id)}${cardHTML(null,true,deck.id)}</span><span class="deck-option-copy"><strong>${deck.name}</strong><small>${deck.description}</small></span>${prefs.deck === deck.id ? `<span class="theme-selected" aria-hidden="true">${icon('check')}</span>` : ''}</button>`).join('')}</div></section>
    <section aria-labelledby="collection-heading"><div class="theme-section-head"><div><h3 id="collection-heading">The new collection <span class="theme-count">10</span></h3><p>Five settings. Two ways to sit at the table.</p></div><div class="theme-filters" role="group" aria-label="Filter table views">${[['all','All views'],['flat','Flat boards'],['seated','Seated views']].map(([value,label]) => `<button type="button" class="theme-filter ${themeFilter === value ? 'selected' : ''}" data-action="themeFilter" data-filter="${value}" aria-pressed="${themeFilter === value}">${label}</button>`).join('')}</div></div><div class="theme-grid">${collection.map(themeTile).join('')}</div></section>
    <section aria-labelledby="standard-heading"><h3 id="standard-heading">Standard tables <span class="theme-count">4</span></h3><p>The original One table settings.</p><div class="theme-grid standard-grid">${TABLE_THEMES.filter(theme => theme.group === 'standard').map(themeTile).join('')}</div></section>
    </div><div class="theme-footer"><small>Your choices stay on this device. Everyone keeps their own view of the same game.</small><button type="button" class="primary" data-action="closeModal">Done ${icon('check')}</button></div>`;
}
function renderModal(preserve = false) {
  const previous = document.querySelector('.modal-backdrop');
  const scroll = preserve ? previous?.querySelector('.theme-content')?.scrollTop ?? 0 : 0;
  const focus = preserve ? document.activeElement : null;
  const choice = focus?.dataset;
  const restore = choice?.theme ? `[data-theme="${CSS.escape(choice.theme)}"][data-action=chooseTheme]` : choice?.deck ? `[data-deck="${CSS.escape(choice.deck)}"][data-action=chooseDeck]` : choice?.filter ? `[data-filter="${CSS.escape(choice.filter)}"]` : null;
  document.querySelector('.modal-backdrop')?.remove();
  if (!modal) return;
  const settings = `<button type="button" class="secondary block" data-action="themes">${icon('themes')} Choose your table & cards</button><label class="setting-label">Card sounds<input id="pref-effects" type="checkbox" ${prefs.effects?'checked':''}></label><label class="setting-label">Quiet background music<input id="pref-music" type="checkbox" ${prefs.music?'checked':''}></label><label class="setting-label">Volume<input id="pref-volume" type="range" min="0" max="100" value="${prefs.volume}"></label><label class="setting-label">Less motion<input id="pref-motion" type="checkbox" ${prefs.reducedMotion?'checked':''}></label><label class="setting-label">Higher contrast<input id="pref-contrast" type="checkbox" ${prefs.contrast?'checked':''}></label><small>These settings stay on this device.</small>`;
  const help = `<p>Play a card matching the top discard’s color, number, or symbol. Wilds choose the next color. Empty your hand to win the round.</p><h3>Don’t forget One</h3><p>Call <b>ONE!</b> before playing your second-to-last card. Another player can catch a missed call until the next legal draw, play, or pass. A catch costs two cards, once. Hard computers watch between human turns too; Spy hides your count. If nobody catches you before the next valid move, there is no penalty. An early call can also be caught.</p><h3>Draws and challenges</h3><p>You may draw even when you can play. Play the drawn card, play another matching hand card, or keep it and pass. Draw Two and Wild Draw Four cost the next player their turn; you can’t stack them. Only the player drawing four may challenge: a bluff makes its player draw four, a failed challenge costs six.</p><h3>The three surprises</h3><ul><li><b>Spy:</b> hides your card count while you hold it.</li><li><b>Shark:</b> circles the table and bites a random player with four cards. It might be you.</li><li><b>Mutant:</b> becomes the next drawn card and applies that card’s effect.</li></ul><h3>Three ways to play</h3><p><b>Original:</b> winners collect the points left in opponents’ hands. <b>Challenge:</b> leftover points count against you; reach the limit and you’re out. <b>Team:</b> opposite seats are partners, with a shared score.</p><h3>Keyboard shortcuts</h3><p>Arrow keys select cards. Space plays the selected card. Enter draws or keeps. U calls One. R / G / B / Y choose a Wild color. Esc opens or closes settings. 1 / 2 / 3 attempt a missed-call challenge on opponents.</p><h3>Friends at the table</h3><p>Choose two, three, or four humans and share the QR invitation. The host can start early. Empty seats become computers at the end of the invitation window. If a player disconnects, their seat waits 30 seconds, then a computer keeps it moving. Reconnecting restores the same hand.</p>`;
  const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
  backdrop.innerHTML=`<section class="modal ${modal === 'themes' ? 'theme-modal' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div>${modal === 'themes' ? '<div class="eyebrow">A PLACE FOR YOUR NEXT GOOD ROUND</div>' : ''}<h2 id="modal-title">${modal==='themes'?'Make the table yours.':modal==='settings'?'Make yourself comfortable.':'A good hand starts here.'}</h2></div><button class="close" data-action="closeModal" aria-label="Close dialog">${icon('close')}</button></div>${modal==='themes'?themesHTML():modal==='settings'?settings:help}</section>`;
  document.body.append(backdrop);
  (restore ? backdrop.querySelector(restore) : null)?.focus({preventScroll:true});
  if (!restore || !backdrop.querySelector(restore)) backdrop.querySelector('.close').focus({preventScroll:true});
  if (preserve) backdrop.querySelector('.theme-content')?.scrollTo(0,scroll);
}
function openModal(which) {
  cancelFlight();
  if (!modal) {
    autoPaused=!!room?.host && room.desiredHumans<=1 && room.status==='playing' && !room.paused && room.game?.phase!=='matchOver';
    if(autoPaused)host('pause');
  }
  modalReturnAction=which; modal=which; app.inert=true; document.body.classList.add('dialog-open'); renderModal();
}
function closeModal() { if(autoPaused&&room?.status==='playing')host('pause');autoPaused=false;modal=null;renderModal();app.inert=false;document.body.classList.remove('dialog-open');document.querySelector(`[data-action="${modalReturnAction}"]`)?.focus({preventScroll:true}); }
function rememberForm() {
  const form=document.querySelector('#create-form'); if(!form)return;
  const data=new FormData(form);
  for(const field of ['name','mode','difficulty'])if(data.has(field))draft[field]=data.get(field);
  for(const field of ['delay','roundLimit','scoreLimit','lobbySeconds'])if(data.has(field))draft[field]=Number(data.get(field));
  draft.specialCards=data.has('specialCards');localStorage.setItem('one.setup',JSON.stringify(draft));
}
async function api(path, data, authorization) {
  const response=await fetch(path,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(authorization?{Authorization:`Bearer ${authorization}`}:{})},...(data?{body:JSON.stringify(data)}:{})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'The table could not be reached.');return result;
}
function saveSession(value) { const sessions=readStored('one.sessions',{});sessions[value.code]=value;localStorage.setItem('one.sessions',JSON.stringify(sessions));localStorage.setItem('one.current',value.code); }
function connect(value) {
  skipPresentation=true;cancelFlight();credentials=value;saveSession(value);abandoned=false;clearTimeout(reconnectTimer);socket?.close();
  const client=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws?token=${encodeURIComponent(value.token)}`);socket=client;
  client.addEventListener('open',()=>{if(socket!==client)return;connected=true;retry=0;render();});
  client.addEventListener('message',event=>{
    if(socket!==client)return;
    const message=JSON.parse(event.data);
    if(message.type==='error'){toast(message.message);return;}
    if(message.type!=='state')return;
    if(message.state.status==='stopped'||message.state.paused&&!room?.paused)cancelFlight();
    const previous=room;const play=latestLivePlay(previous,message.state,{reconnecting:skipPresentation,hidden:document.hidden});
    const origin=play?playOrigin(play,previous):null;room=message.state;serverOffset=room.serverTime-Date.now();
    if(room.game){
      const latestEvent=room.game.events.at(-1)?.id??0;if(latestEvent<lastEvent)lastEvent=0;
      const events=room.game.events.filter(item=>item.id>lastEvent);lastEvent=latestEvent;
      if(previous?.game&&!skipPresentation&&!document.hidden)for(const item of events)if(item.type!=='play')audio.effect(item.type);
      if(events.length)document.querySelector('#announcer').textContent=events.at(-1).text;
      if(room.game.drawn && previous?.game?.drawn?.id !== room.game.drawn.id) selectedCard=room.game.drawn.id;
      if(selectedCard&&!room.game.hand.some(card=>card.id===selectedCard)&&room.game.drawn?.id!==selectedCard)selectedCard=null;
      if(!selectedCard)selectedCard=room.game.legalCardIds[0]??room.game.hand[0]?.id??null;
    }
    render();if(play)slideCard(play,origin,previous.game.discard);skipPresentation=false;if(previous?.paused!==room.paused||previous?.status!==room.status)audio.updateMusic();
  });
  client.addEventListener('close',async()=>{
    if(socket!==client||abandoned)return;connected=false;cancelFlight();render();clearTimeout(reconnectTimer);
    try {
      const response=await fetch('/api/session',{headers:{Authorization:`Bearer ${value.token}`}});
      if(socket!==client||abandoned)return;
      if(response.status===400||response.status===401){
        const sessions=readStored('one.sessions',{});delete sessions[value.code];localStorage.setItem('one.sessions',JSON.stringify(sessions));
        goHome();toast('This table has closed. Start a fresh game.');return;
      }
    } catch {}
    if(socket===client&&!abandoned)reconnectTimer=setTimeout(()=>connect(value),Math.min(5000,600*2**retry++));
  });
  client.addEventListener('error',()=>{});
}
function send(message) { if(socket?.readyState!==WebSocket.OPEN){toast('Reconnecting to the table. Try again in a moment.');return;}socket.send(JSON.stringify(message)); }
function action(type, details={}) { if(!room?.game||room.paused){toast('The table is paused.');return;}send({type:'action',action:{type,...details},revision:room.game.revision,requestId:crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`}); }
function host(type,details={}) { send({type:'host',action:{type,...details}}); }
function goHome() {
  cancelFlight();
  if(room?.host&&room.status!=='stopped')host('stop');
  abandoned=true;clearTimeout(reconnectTimer);socket?.close();socket=null;connected=false;room=null;credentials=null;joinCode=null;lobby=null;lastEvent=0;formError='';localStorage.removeItem('one.current');history.pushState({},'', '/');document.querySelector('#announcer').textContent='';audio.updateMusic();render();
}
function updateCountdown() {
  const node=document.querySelector('[data-countdown]');if(!node||!room?.lobbyEndsAt)return;
  const seconds=Math.max(0,Math.ceil((room.lobbyEndsAt-(Date.now()+serverOffset))/1000));node.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}

document.addEventListener('submit',async event=>{
  if(!['create-form','join-form'].includes(event.target.id))return;event.preventDefault();if(busy)return;
  if(event.target.id==='create-form')rememberForm();else draft.name=new FormData(event.target).get('name');
  busy=true;formError='';audio.init();render();
  try{
    const result=event.target.id==='create-form'?await api('/api/rooms',draft):await api(`/api/rooms/${joinCode}/join`,{name:draft.name});
    localStorage.setItem('one.name',String(draft.name).trim());history.replaceState({},'',`/r/${result.code}`);joinCode=result.code;connect(result);
  }catch(error){formError=error.message;render();}finally{busy=false;if(!room)render();}
});
document.addEventListener('click',async event=>{
  if(event.target.classList.contains('modal-backdrop')){closeModal();return;}
  const card=event.target.closest('[data-card]');
  if(card&&!card.disabled){selectedCard=card.dataset.card;if(room?.game?.viewer===room?.game?.turn&&room.game.phase==='turn'){
    if(room.game.legalCardIds.includes(selectedCard))action('play',{cardId:selectedCard});else toast(room.game.pendingCount?'Pick up the penalty first; cards cannot be stacked.':'That card doesn’t match the color, number, or symbol.');
  }render();return;}
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const type=button.dataset.action;
  if(type==='humans'){rememberForm();draft.humanCount=Number(button.dataset.count);localStorage.setItem('one.setup',JSON.stringify(draft));render();}
  else if(type==='sound'){prefs.effects=!prefs.effects;audio.init();savePrefs();render();if(prefs.effects)audio.effect('one');}
  else if(type==='help'||type==='settings'||type==='themes')openModal(type);
  else if(type==='chooseTheme'){
    if (!TABLE_THEMES.some(theme => theme.id === button.dataset.theme)) return;
    cancelFlight(); prefs.theme=button.dataset.theme; savePrefs(); render(); renderModal(true);
  }
  else if(type==='chooseDeck'){
    if (!CARD_DECKS.some(deck => deck.id === button.dataset.deck)) return;
    cancelFlight(); prefs.deck=button.dataset.deck; savePrefs(); render(); renderModal(true);
  }
  else if(type==='themeFilter'){
    if (!['all','flat','seated'].includes(button.dataset.filter)) return;
    themeFilter=button.dataset.filter; renderModal(true);
  }
  else if(type==='closeModal')closeModal();
  else if(type==='home')goHome();
  else if(['pause','stop','restart','start','extend','nextRound','step'].includes(type))host(type);
  else if(type==='color')action('color',{color:button.dataset.color});
  else if(type==='catch')action('challengeOne',{target:Number(button.dataset.target)});
  else if(type==='playDrawn')action('play',{cardId:room.game.drawn.id});
  else if(['draw','pass','one','challengeWild'].includes(type))action(type);
  else if(type==='copy'){
    try{await navigator.clipboard.writeText(inviteURL(room.code));toast('Invitation copied. Share it with your friends.');}
    catch{toast(`Invitation: ${inviteURL(room.code)}`);}
  }
});
document.addEventListener('input',event=>{if(event.target.closest('#create-form'))rememberForm();});
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.closest('#create-form')){rememberForm();if(target.name==='mode')render();}
  if(target.id==='watch-seat'){watchSeat=target.value;render();}
  if(target.id==='watch-speed')host('speed',{delay:Number(target.value)});
  const prefMap={'pref-effects':'effects','pref-music':'music','pref-volume':'volume','pref-motion':'reducedMotion','pref-contrast':'contrast'};
  if(prefMap[target.id]){prefs[prefMap[target.id]]=target.type==='checkbox'?target.checked:target.type==='range'?Number(target.value):target.value;savePrefs();audio.updateMusic();render();}
});
document.addEventListener('keydown',event=>{
  if(modal){
    if(event.key==='Escape'){event.preventDefault();closeModal();}
    else if(event.key==='Tab'){
      const items=[...document.querySelector('.modal').querySelectorAll('button,input,select,a')].filter(node=>!node.disabled);const first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }return;
  }
  if(event.key==='Escape'&&room){event.preventDefault();openModal('settings');return;}
  if(event.target.matches('input,select,textarea')||!room?.game||room.desiredHumans===0)return;
  const game=room.game,key=event.key.toLowerCase();
  if(game.phase==='color'&&game.colorActor===game.viewer&&({r:'red',g:'green',b:'blue',y:'yellow'})[key]){event.preventDefault();action('color',{color:({r:'red',g:'green',b:'blue',y:'yellow'})[key]});return;}
  if(key==='u'){event.preventDefault();action('one');return;}
  if(['1','2','3'].includes(key)){event.preventDefault();action('challengeOne',{target:(game.viewer+Number(key))%4});return;}
  if(event.target.closest('button:not([data-card])'))return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();const index=game.hand.findIndex(card=>card.id===selectedCard);const next=(index+(event.key==='ArrowRight'?1:-1)+game.hand.length)%game.hand.length;selectedCard=game.hand[next]?.id;render();document.querySelector(`[data-card="${CSS.escape(selectedCard??'')}"]`)?.focus();
  }else if(event.code==='Space'){event.preventDefault();if(game.legalCardIds.includes(selectedCard))action('play',{cardId:selectedCard});else toast('Choose a matching card.');}
  else if(event.key==='Enter'){event.preventDefault();if(game.canPass)action('pass');else if(game.canDraw)action('draw');}
});
window.addEventListener('popstate',()=>{if(location.pathname==='/')goHome();});
setInterval(updateCountdown,500);

async function init() {
  applyPreferences();render();
  try{const config=await api('/api/config');inviteBase=config.inviteBase;audio.slideURL=config.cardSlideAudio;audio.loadSlide();}catch{}
  const saved=readStored('one.sessions',{});
  const code=joinCode??localStorage.getItem('one.current');
  if(code&&saved[code]){
    try{room=await api('/api/session',null,saved[code].token);joinCode=code;history.replaceState({},'',`/r/${code}`);connect(saved[code]);render();return;}
    catch{localStorage.removeItem('one.current');}
  }
  if(joinCode){try{lobby=await api(`/api/rooms/${joinCode}`);}catch(error){formError=error.message;lobby={status:'missing',hostName:'Your host',seats:Array.from({length:4},(_,id)=>({id,name:'Open chair',human:false}))};}render();}
}
init();
