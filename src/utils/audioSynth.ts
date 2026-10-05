// Web Audio API severe weather alert synthesizer and atmospheric wind sound
let audioCtx: AudioContext | null = null;
let rumbleOsc: OscillatorNode | null = null;
let rumbleGain: GainNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Play EAS dual-tone attention signal (853 Hz + 960 Hz)
export function playEASAlertTone(durationMs = 900) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(853, now); // Standard EAS tone 1

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(960, now); // Standard EAS tone 2

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
    gain.gain.setValueAtTime(0.12, now + (durationMs - 60) / 1000);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationMs / 1000);
    osc2.stop(now + durationMs / 1000);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

// Low frequency atmospheric tornado rumble
export function startTornadoRumble(volume = 0.08) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (rumbleOsc) return;

    const now = ctx.currentTime;
    rumbleOsc = ctx.createOscillator();
    rumbleGain = ctx.createGain();

    rumbleOsc.type = 'triangle';
    rumbleOsc.frequency.setValueAtTime(54, now); // Deep bass roar

    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.linearRampToValueAtTime(volume, now + 0.5);

    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    rumbleOsc.start(now);
  } catch {
    // Ignore
  }
}

export function stopTornadoRumble() {
  try {
    if (rumbleOsc && rumbleGain && audioCtx) {
      const now = audioCtx.currentTime;
      rumbleGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
      rumbleOsc.stop(now + 0.3);
      setTimeout(() => {
        rumbleOsc?.disconnect();
        rumbleGain?.disconnect();
        rumbleOsc = null;
        rumbleGain = null;
      }, 350);
    }
  } catch {
    rumbleOsc = null;
    rumbleGain = null;
  }
}
