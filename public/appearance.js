// Initial appearance for devices without saved choices. Saved choices win.
export const DEFAULT_APPEARANCE = Object.freeze({ theme: 'coastal-terrace-seated', deck: 'prism' });

const standard = (id, name, description) => ({ id, name, description, group: 'standard', camera: 'standard' });
const illustrated = (number, id, name, camera, description) => ({
  number, id, name, camera, description, group: 'collection',
  art: `/art/tables/${id}.webp`, thumbnail: `/art/thumbnails/${id}.webp`,
});
export const TABLE_THEMES = Object.freeze([
  standard('tabletop', 'The wooden table', 'Warm wood and a familiar green room.'),
  standard('broadway', 'Broadway', 'Burgundy curtains and a golden stage.'),
  standard('circus', 'Circus', 'Playful stripes and a warm wooden table.'),
  standard('space', 'Space', 'A silver table beneath a quiet starfield.'),
  illustrated(1, 'velvet-lounge-flat', 'Velvet Lounge', 'flat', 'Emerald velvet, walnut and warm brass.'),
  illustrated(2, 'moonlit-conservatory-flat', 'Moonlit Conservatory', 'flat', 'Moonlit botanicals and midnight teal.'),
  illustrated(3, 'orbital-observatory-flat', 'Orbital Observatory', 'flat', 'Navy, titanium and delicate orbital lines.'),
  illustrated(4, 'coastal-terrace-flat', 'Coastal Terrace', 'flat', 'Blue linen, teak and coastal twilight.'),
  illustrated(5, 'art-deco-theatre-flat', 'Art Deco Theatre', 'flat', 'Plum velvet and champagne geometry.'),
  illustrated(6, 'velvet-lounge-seated', 'Velvet Lounge', 'seated', 'A fireside seat in the library lounge.'),
  illustrated(7, 'moonlit-conservatory-seated', 'Moonlit Conservatory', 'seated', 'Lanterns beneath an arched glasshouse.'),
  illustrated(8, 'orbital-observatory-seated', 'Orbital Observatory', 'seated', 'A panoramic planet beyond your table.'),
  illustrated(9, 'coastal-terrace-seated', 'Coastal Terrace', 'seated', 'An ocean horizon at the terrace table.'),
  illustrated(10, 'art-deco-theatre-seated', 'Art Deco Theatre', 'seated', 'An intimate seat in the theatre lounge.'),
]);
export const CARD_DECKS = Object.freeze([
  { id: 'classic', name: 'Classic', description: 'The familiar, clean One deck.' },
  { id: 'prism', name: 'Prism Atelier', description: 'Illustrated faces, fine gold detail and a shared prism back.' },
]);
export const cameraLabel = camera => camera === 'flat' ? 'Flat board' : camera === 'seated' ? 'Seated view' : 'Standard';
export const getTheme = id => TABLE_THEMES.find(theme => theme.id === id) ?? TABLE_THEMES.find(theme => theme.id === DEFAULT_APPEARANCE.theme);
export function normalizeAppearance(value) {
  return {
    theme: getTheme(value?.theme).id,
    deck: CARD_DECKS.some(deck => deck.id === value?.deck) ? value.deck : DEFAULT_APPEARANCE.deck,
  };
}
