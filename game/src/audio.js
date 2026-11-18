// All sound is synthesised with WebAudio: engine hum, police sirens, gunshots, punches,
// pickups and a light music loop. No audio files, no network. Every call is a no-op until the
// player unlocks audio with a key or a click, and while the tab is hidden.
const MUSIC_STEPS = [
  // A sunny two-bar loop: bass notes (Hz) with a bright pluck on top, one step each 0.22 s.
  [110, 220], [0, 0], [130.8, 261.6], [0, 0], [98, 196], [0, 0], [146.8, 293.7], [0, 0],
  [110, 220], [0, 0], [130.8, 261.6], [0, 0], [164.8, 329.6], [146.8, 293.7], [130.8, 261.6], [0, 0],
];
const STEP_SECONDS = 0.22;

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let musicTimer = null;
  let musicStep = 0;
  let musicOn = false;

  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      context = null;
    }
  }

  function tone(frequency, duration, type, volume, slideTo) {
    if (!context) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noiseBurst(duration, volume) {
    if (!context) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  function playMusicStep() {
    if (!context || !musicOn) return;
    const [bass, pluck] = MUSIC_STEPS[musicStep % MUSIC_STEPS.length];
    if (bass) tone(bass, 0.2, 'triangle', 0.11);
    if (pluck) tone(pluck, 0.16, 'sine', 0.05);
    musicStep += 1;
  }

  return {
    unlock,
    /** Start the music loop after the player unlocks audio. */
    startMusic() {
      unlock();
      if (!context || musicOn) return;
      musicOn = true;
      musicTimer = window.setInterval(playMusicStep, STEP_SECONDS * 1000);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer !== null) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
    },
    /** Continuous engine hum: speed in px/s, 0 while on foot. */
    engine(speed) {
      if (!context) return;
      const target = speed > 20 ? 0.045 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed * 0.14, context.currentTime, 0.08);
    },
    /** Two-tone police siren while any police car is near the player. */
    siren(active, dt) {
      if (!context) return;
      sirenGain.gain.setTargetAtTime(active ? 0.028 : 0, context.currentTime, 0.15);
      if (!active) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.38;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, context.currentTime, 0.02);
      }
    },
    shot() {
      noiseBurst(0.12, 0.22);
      tone(220, 0.08, 'square', 0.1, 90);
    },
    punch() {
      tone(150, 0.12, 'sine', 0.25, 60);
    },
    hit() {
      tone(90, 0.15, 'sine', 0.2, 45);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.16);
      window.setTimeout(() => tone(1318, 0.12, 'sine', 0.16), 80);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((frequency, index) => {
        window.setTimeout(() => tone(frequency, 0.18, 'triangle', 0.18), index * 110);
      });
    },
    busted() {
      [392, 330, 262, 196].forEach((frequency, index) => {
        window.setTimeout(() => tone(frequency, 0.22, 'sawtooth', 0.12), index * 140);
      });
    },
    click() {
      tone(660, 0.06, 'sine', 0.12);
    },
    crash() {
      noiseBurst(0.2, 0.25);
    },
  };
}
