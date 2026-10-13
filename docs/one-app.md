# One: playing and maintaining the web app

One is a four-seat, dark-mode web game built from the recovered CD rules. It runs at http://localhost:4444 and listens on the local network so phones and tablets can join. No account or app installation is needed.

## Start and join

Run `npm install` once, then `npm start` from this project. Node 22 or newer is required. `PORT` overrides the default 4444. The start message prints the local network address; for example, http://YOUR-COMPUTER-IP:4444. That address can change when the computer changes networks.

The setup asks for a name and number of humans. One human means you plus three computers. Two, three or four humans opens a timed invitation with a QR code and copyable link. Guests open the link, enter a unique name, and join. The host can start early or reset the invitation window. Missing players become computers at the deadline. Joining closes after the game starts.

Use the same Wi-Fi/local network. QR links use the first private IPv4 address detected on the host. With several network interfaces, set `ONE_PUBLIC_URL` to the address guests should use, including the port. Public Internet hosting has not been deployed.

Zero humans starts four computers. Follow the active hand or select a specific computer. Pause freezes automatic actions, Step applies one action while paused, Resume restarts play, and Stop cancels play timers. Adjust Pace to watch slowly or test quickly. Only this observer mode shows the game seed and all computer hands.

## Playing

Click a matching card to play it. You may draw even if you can play. A drawn card stays separate until played or kept; an existing matching hand card can still be played after drawing. Keep & pass adds the new card and ends your move. Draw Two, Wild Draw Four and Shark penalties cannot be stacked.

Call ONE before playing down to one card. A catch makes the offender draw two, once. A missed call can be caught before the next accepted draw, play or pass; the penalty is not automatic when nobody catches it. Early calls can also be challenged. Catch One controls do not reveal private adjudication flags; an unavailable challenge returns an explanation.

Wilds ask their player for a color. Only the recipient can challenge a Wild Draw Four, after the color choice. If its player still held the preceding color, the offender takes four and the challenger keeps the turn. Failure costs six and a lost turn. A terminal Wild skips the color prompt; terminal penalties settle before scoring.

Spy hides the owner's public card count while held. Shark scans live seats using the recovered repeated random bite test, can bite its own player, and assigns four cards and a lost turn. Mutant draws a physical replacement and applies its effect, including another Mutant. A Wild Draw Four replacement returns to stock and creates a non-four artificial replacement; artificial cards disappear when recycled.

Original awards opponents' leftover points to the round winner. Opposite seats are Team partners, share their score, and exclude partner leftovers. Challenge adds leftover points against their owners and eliminates at the target. Two survivors reset scores for a final hand. Dealer selection, opening actions, tied winners and score-or-round completion are retained.

Arrow keys select a card, Space plays it, Enter draws or keeps, U calls One, and R/G/B/Y choose a Wild color. Keys 1/2/3 attempt catches on opponents. Esc opens/closes settings. In-game Help explains the rules. Themes, beside the gear, opens the visual table and card-deck chooser. The gear holds optional sounds/music, volume, less motion and higher contrast. Dark mode is the default in every theme.

## Table and deck choices

The chooser retains the four existing Table Setting choices under **Standard tables**: The wooden table, Broadway, Circus and Space. The new collection contains all ten numbered board concepts: 1–5 are flat views and 6–10 are seated views of Velvet Lounge, Moonlit Conservatory, Orbital Observatory, Coastal Terrace and Art Deco Theatre. View filters narrow the collection without changing the selected table. Choices apply immediately; Done or Escape closes the screen.

Classic and Prism Atelier are independent card-art choices. Prism uses newly generated floral, wave, botanical and sun textures, illustrated Spy/Shark/Mutant/Wild faces and a universal prism back. Numbers 0–9, action symbols, suit names and card-type labels come from the renderer. Every suited special card has the actual suit's border, indices and name banner; the illustration never determines its rules or color. Opponent backs remain identical and a held Spy retains the fixed symbolic fan and hidden-count badge.

These are modern presentation additions. The clean backgrounds contain no baked-in interface or cards; the live HTML controls, private projections and authoritative engine remain responsible for the game. Changing appearance retains the current hand, actor, score and pending decisions. A solo/computer-only host's open menu pauses and resumes its scheduler as before; a shared room's local chooser does not pause the other players.

The modal has a fixed close/Done area and a scrollable gallery, touch targets of at least 44 pixels, keyboard focus containment and return, and small WebP previews. The hand scrolls independently when many cards are held. Desktop, tablet portrait/landscape and phone layouts were checked in Chrome with touch emulation, including real draw/keep actions and a 17+ card hand; physical tablet hardware has not been tested.

`public/appearance.js` is the catalog and contains the single `DEFAULT_APPEARANCE` setting. It currently retains `tabletop` and `classic`; change those IDs when the preferred defaults are chosen. Existing valid saved choices take precedence. Older preferences migrate without losing their Standard theme, and unknown theme/deck IDs fall back to these defaults. Appearance is saved per device, rather than in match rules or server room settings.

## Intentional modern choices

The fresh engine follows recovered backend behavior. Cross-color Mutant-on-Mutant matching is allowed, consistent with the original probes. The manual's color-only description and unobserved native UI restrictions remain documented separately.

The default match is one round, no score target, hard computers and one-second thinking time. The CD factory defaults were unlimited rounds, 500 points and two-second delay. Advanced settings preserve the recovered zero-limit conversion: unlimited rounds plus zero points becomes 500; finite rounds permit no point target; Challenge always uses unlimited rounds and a positive target.

Computers use their own hand and public information. They do not read opponents' cards, stock order or hidden Wild Draw Four truth. Hard play considers card value, remaining colors, opponents nearing the finish and team partners. Wild color favors the largest remaining color group. Medium and easy make less consistent choices and calls. This replaces the original AI's access to private challenge flags. Hard computers always attempt a visible missed-call catch, including out of turn between two humans; Medium and Easy retain probabilistic turn-start catches. Spy hides the count, so computers do not catch by inspecting that concealed hand. All-human tables rely on human Catch One actions.

The engine uses seeded, injectable randomness for repeatable fixtures and Fisher–Yates shuffling. Whole-match seed sequences do not reproduce the original separate Java generators and repeated-swap shuffle. Human rooms receive a server-chosen seed which stays private. Public card fans cap counts at seven and show 7+ above that; Spy shows an eye. Human projections never include another hand, stock contents, seed, RNG state, challenge truth or other credentials.

The last mover is recorded separately from seats traversed by Skip, Reverse and Shark. A self-returning turn preserves its missed-call window until the next accepted move, and remembers whether One was called before the preceding play. These are explicit modern corrections to the original cursor-based last-player tracking and move-start flag clearing, following the documented action-based deadline. Catch timers obey Pause and Stop and do not delay another player’s valid move.

The server owns state and accepts moves serially. Repeated action identifiers are ignored; old revisions are rejected with a current view. Each seat has a random private credential stored on that device. Reload restores the same seat. Disconnected humans have 30 seconds to reconnect, then a computer continues the same hand. Returning with the credential restores human control. Host Pause/Stop/Restart affect the shared table; appearance/audio preferences stay per device.

Rooms are held in memory and expire after two hours without activity. Restart closes existing tables and the client returns to setup. Rejoining without saved credentials, cross-server persistence, exact native Windows animation/input equivalence and public hosting are not implemented. Only `public/` is served: proprietary disc art, executables and recovered code remain local research.

## Verification

`npm test` runs engine fixtures, fair-AI checks, private projections, timed controls, disconnect/reconnect, HTTP endpoints, WebSocket authority and independent decoding of the actual QR SVG. `npm run simulate -- 50` completes 300 computer matches across all modes and both decks, checking card inventory and turn legality throughout. The retained run completed 214,435 actions, all matches finished.

Browser checks used separate localhost/LAN origins for host and guest credentials, a 390×844 phone viewport, named joining, separate hands, a guest card play, host drawing/keeping, reload restoration, synchronized pause/stop and computer-only Pause/Step/Stop. Physical phone cameras and tablets have not been tested. Retained views: [desktop](screenshots/desktop.jpg), [phone](screenshots/mobile.jpg), [computer observer](screenshots/computers.jpg). Run the commands above to reproduce the automated checks and match simulations.

The engine is `app/engine.js`, strategy `app/ai.js`, room controller `app/rooms.js`, server `app/server.js`, and browser interface `public/`. Tests are in `test/`. Original comparison probes and private research are excluded from this repository; no CD is required to run the game.

## Table feedback

The active opponent has a gold pane, halo and arrow. Your turn outlines your hand and displays a gold turn badge directly on the table. A larger, labeled color badge sits below the piles and immediately reflects Wild color choices. Observer seats stay fixed, even when following different hands.

Accepted public play events move a card from its player to the discard pile over 420 milliseconds. The previous discard remains visible underneath until arrival. Animation never delays or changes a rule action. Rapid plays are coalesced, reconnect history is not replayed, and scrolling, resizing or hiding the page cancels an in-progress flight. Less motion and system reduced-motion settings suppress flights and pulsing, while retaining static highlights and sound preferences.

The local card-arrival sample is optional and deliberately ignored by Git. If present, the server advertises it and the browser decodes it once; otherwise Web Audio generates a brief filtered-paper slide. Sound effects and volume controls apply to both. No CD mount is needed.
