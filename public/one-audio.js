export const ONE_AUDIO_URL = '/audio/one-announcement.m4a';

export function createOneAudio(getPreferences, fetchAudio = fetch) {
  // Fetch ahead of the call; decoding starts once a user gesture unlocks audio.
  const bytes = fetchAudio(ONE_AUDIO_URL).then(response => {
    if (!response.ok) throw new Error('One announcement unavailable');
    return response.arrayBuffer();
  }).catch(() => null);
  let decoded;
  const load = context => decoded ??= bytes.then(data => data ? context.decodeAudioData(data) : null).catch(() => null);
  return {
    load,
    async play(context) {
      const allowed = () => getPreferences().effects && getPreferences().volume > 0 && context?.state === 'running';
      if (!allowed()) return false;
      const buffer = await load(context);
      if (!buffer || !allowed()) return false;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = getPreferences().volume / 100;
      source.connect(gain); gain.connect(context.destination);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      return true;
    }
  };
}
