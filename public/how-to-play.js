export function howToPlayHTML() {
  return `<nav class="help-nav" aria-label="Guide sections">
    <a href="#help-turn">Your turn</a><a href="#help-cards">The cards</a><a href="#help-four">Draw Four</a><a href="#help-one">Call One</a><a href="#help-modes">Game modes</a>
  </nav>
  <div class="help-content" tabindex="0" aria-label="How to play guide">
    <div class="help-intro"><span class="help-kicker">THE GOAL</span><p>First to empty your hand wins the round.<br><strong>A little luck. A clever card. One good round.</strong></p></div>
    <section id="help-turn" aria-labelledby="help-turn-title">
      <h3 id="help-turn-title">Your turn, in three steps</h3>
      <ol class="help-steps">
        <li><strong>Match the discard.</strong><span>Play a card with the same color, number, or symbol. A Wild lets you choose the next color.</span></li>
        <li><strong>Or draw a card.</strong><span>You may draw even if you have a match. Then play the new card, play another matching card from your hand, or choose <b>Keep &amp; pass</b>.</span></li>
        <li><strong>Down to one? Call ONE!</strong><span>Call before you play your second-to-last card. See Call One for how other players can catch you.</span></li>
      </ol>
    </section>
    <section id="help-cards" aria-labelledby="help-cards-title">
      <h3 id="help-cards-title">Know your cards</h3>
      <div class="help-card-grid">
        <article class="help-card"><span class="help-symbol" aria-hidden="true">0–9</span><div><h4>Numbers</h4><p>Match the color or number on the discard.</p></div></article>
        <article class="help-card"><span class="help-symbol" aria-hidden="true">⊘</span><div><h4>Skip</h4><p>The next player loses a turn.</p></div></article>
        <article class="help-card"><span class="help-symbol" aria-hidden="true">⇄</span><div><h4>Reverse</h4><p>Change the direction of play. With two players, it acts as a Skip.</p></div></article>
        <article class="help-card"><span class="help-symbol" aria-hidden="true">+2</span><div><h4>Draw Two</h4><p>The next player draws two cards and loses a turn.</p></div></article>
        <article class="help-card"><span class="help-symbol help-wild" aria-hidden="true">W</span><div><h4>Wild</h4><p>Play on any color, then choose the next color. You may play it even with another match in hand.</p></div></article>
        <article class="help-card"><span class="help-symbol help-wild" aria-hidden="true">+4</span><div><h4>Wild Draw Four</h4><p>Choose a color. The next player draws four and loses a turn, unless they challenge successfully.</p></div></article>
      </div>
      <p class="help-note"><strong>No stacking.</strong> You cannot answer a draw penalty with another Draw Two or Draw Four. Accept the penalty, or challenge a Wild Draw Four when offered.</p>
    </section>
    <section id="help-four" class="help-feature" aria-labelledby="help-four-title">
      <div class="help-feature-heading"><span class="help-symbol help-wild" aria-hidden="true">+4</span><div><span class="help-kicker">A COLOR CHANGE. A CHOICE.</span><h3 id="help-four-title">Wild Draw Four, explained</h3></div></div>
      <p>It is a bluff if the player still held <strong>a card of the previous active color</strong> when they played Draw Four. A matching number or symbol in a different color does not count.</p>
      <p><strong>Only the player receiving the four-card penalty can challenge.</strong> Wait for the color choice, then decide before accepting the penalty.</p>
      <div class="help-outcomes">
        <article><span class="help-kicker">ACCEPT</span><h4>You draw 4</h4><p>Your turn is skipped.</p></article>
        <article><span class="help-kicker">CHALLENGE SUCCEEDS</span><h4>They draw 4</h4><p>They held the previous color. You draw nothing and keep your turn: play, draw, or pass.</p></article>
        <article><span class="help-kicker">CHALLENGE FAILS</span><h4>You draw 6</h4><p>They had no card of the previous color. You take six in total and lose your turn.</p></article>
      </div>
      <p class="help-example"><strong>Example:</strong> The active color is blue. Someone plays Draw Four while still holding a blue 7. Your challenge succeeds. A red 7 alone would not make it a bluff.</p>
      <p class="help-note">If Draw Four is the last card in a hand, its four-card penalty settles before scoring. There is no color choice or later challenge.</p>
    </section>
    <section id="help-one" aria-labelledby="help-one-title">
      <h3 id="help-one-title">Call One. Catch a missed call.</h3>
      <div class="help-two-col"><article><h4>When you have two cards</h4><p>Call <strong>ONE!</strong> before playing down to one. Calling early with more than two cards, including a newly drawn card, can also be caught.</p></article><article><h4>When someone forgets</h4><p>Use <strong>Catch One</strong> before the next accepted draw, play, or pass. A successful catch gives that player two cards, once.</p></article></div>
      <p class="help-note">No catch before the next accepted move means no penalty. Hard computers watch between human turns too. A Spy keeps your card count hidden.</p>
    </section>
    <section aria-labelledby="help-special-title"><h3 id="help-special-title">Three extra surprises</h3><p>Optional special cards add a twist to the standard deck.</p>
      <dl class="help-definitions"><div><dt>Spy</dt><dd>Hides your card count while you hold it. Playing it has no extra effect.</dd></div><div><dt>Shark</dt><dd>Circles the table until it bites a player for four cards and a lost turn. It can bite you too.</dd></div><div><dt>Mutant</dt><dd>Draws a replacement card and applies its effect. Replacements can chain; a drawn Wild Draw Four returns to the pile and is replaced with another card.</dd></div></dl>
    </section>
    <section id="help-modes" aria-labelledby="help-modes-title"><h3 id="help-modes-title">Choose your kind of match</h3>
      <div class="help-mode-grid"><article><h4>Original</h4><p>Win a round to collect the points left in opponents’ hands. Highest score wins the match.</p></article><article><h4>Challenge</h4><p>Leftover points count against you. Reach the target and you’re out. The last two survivors reset to zero for a final hand.</p></article><article><h4>Team</h4><p>Opposite seats are partners and share a score. Either partner can win the round. Your partner’s leftover cards do not count toward your winnings.</p></article></div>
      <p class="help-note"><strong>Card points:</strong> numbers = face value; Skip, Reverse, Draw Two and Mutant = 20; Wild, Draw Four and Shark = 50; Spy = 75. Final draw penalties count before scoring.</p>
    </section>
    <section aria-labelledby="help-friends-title"><h3 id="help-friends-title">Bring friends to the table</h3><p>Choose two, three, or four human players and share the QR invitation or link. The host can start early; computers fill empty seats when the invitation window ends. A disconnected player has 30 seconds to return before a computer continues their hand. Reconnecting restores the same seat and hand.</p></section>
    <section aria-labelledby="help-keys-title"><h3 id="help-keys-title">Keyboard shortcuts</h3><dl class="help-keys"><div><dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Select a card</dd></div><div><dt><kbd>Space</kbd></dt><dd>Play selected card</dd></div><div><dt><kbd>Enter</kbd></dt><dd>Draw, keep, or accept penalty</dd></div><div><dt><kbd>U</kbd></dt><dd>Call One</dd></div><div><dt><kbd>R</kbd> <kbd>G</kbd> <kbd>B</kbd> <kbd>Y</kbd></dt><dd>Choose a Wild color</dd></div><div><dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd>Catch an opponent’s missed call</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Close a dialog or open settings</dd></div></dl></section>
  </div>
  <div class="help-footer"><span>Ready for your next good hand?</span><button type="button" class="primary" data-action="closeModal">Back to the table</button></div>`;
}
