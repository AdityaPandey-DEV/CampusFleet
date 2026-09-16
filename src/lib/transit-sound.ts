/**
 * CampusFleet Transit Sound & Haptic Notification Engine
 * Pure Web Audio API synthesized sounds — zero external mp3 dependencies,
 * immediate playback across iOS Safari and Android Chrome, zero latency.
 */

let audioCtx: AudioContext | null = null;
let alarmIntervalId: any = null;
let activeAlarmOscillators: OscillatorNode[] = [];

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Prime audio context on user tap / interaction so subsequent automated alerts can ring.
 */
export function primeAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

/**
 * Play a high-urgency recurring transit bell / chime alert when bus is full or departing.
 * Rings continuously every 1.8 seconds until explicitly stopped.
 */
export function playBusFullAlarm() {
  if (typeof window === "undefined") return;

  // Trigger haptic vibration if supported
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate([400, 200, 400, 200, 600]);
    } catch {
      // ignore
    }
  }

  // Clear any existing alarm
  stopAlarm();

  const playSingleCycle = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: High warning chime (880 Hz - A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: Secondary urgent pulse (660 Hz - E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.18);
      gain2.gain.setValueAtTime(0.45, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);

      // Note 3: Low anchor bell (440 Hz - A4)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(440, now + 0.4);
      gain3.gain.setValueAtTime(0.35, now + 0.4);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.4);
      osc3.stop(now + 1.1);

      activeAlarmOscillators = [osc1, osc2, osc3];
    } catch (e) {
      console.warn("Audio synthesis error:", e);
    }
  };

  playSingleCycle();
  alarmIntervalId = setInterval(playSingleCycle, 1600);
}

/**
 * Play pleasant 3-note ascending chime when student confirms onboard or attendance is verified.
 */
export function playBoardingConfirmedChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteTime = now + idx * 0.12;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + 0.4);
    });

    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(120);
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.warn("Chime error:", e);
  }
}

/**
 * Immediately silence alarm and stop audio pulses.
 */
export function stopAlarm() {
  if (alarmIntervalId) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
  activeAlarmOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch {
      // ignore
    }
  });
  activeAlarmOscillators = [];
}

/**
 * Check if alarm loop is actively running.
 */
export function isAlarmRunning(): boolean {
  return alarmIntervalId !== null;
}
