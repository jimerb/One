export const ONE_AUDIO_URL = '/audio/one-announcement.m4a';

export function createOneAudio(getPreferences, fetchAudio = fetch, url = ONE_AUDIO_URL) {
  // Fetch ahead of the call; decoding starts once a user gesture unlocks audio.
  const bytes = fetchAudio(url).then(response => {
    if (!response.ok) throw new Error('One announcement unavailable');
    return response.arrayBuffer();
  }).catch(() => null);
  let decoded;
  const active = new Set();
  const load = context => decoded ??= bytes.then(data => data ? context.decodeAudioData(data) : null).catch(() => null);
  return {
    load,
    update() {
      const prefs = getPreferences();
      for (const gain of active) gain.gain.value = prefs.effects && !prefs.muted ? prefs.volume / 100 : 0;
    },
    async play(context) {
      const allowed = () => getPreferences().effects && !getPreferences().muted && getPreferences().volume > 0 && context?.state === 'running';
      if (!allowed()) return false;
      const buffer = await load(context);
      if (!buffer || !allowed()) return false;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = getPreferences().volume / 100;
      source.connect(gain); gain.connect(context.destination);
      active.add(gain);
      source.onended = () => { active.delete(gain); source.disconnect(); gain.disconnect(); };
      source.start();
      return true;
    }
  };
}
