// Generative "neon noir" soundtrack for the 3D journey, synthesised live with the Web Audio API (no audio files).
// A slow A-minor synthwave loop: warm detuned pads, a sub bass, a soft heartbeat kick, a delayed arpeggio and air noise.
export function createSoundtrack({ volume = 0.42 } = {}) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  const BPM = 84;
  const beat = 60 / BPM;
  const eighth = beat / 2;
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // Master chain: gain -> tone filter -> gentle compressor -> speakers
  const master = ctx.createGain();
  master.gain.value = 0;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 1600;
  tone.Q.value = 0.5;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.ratio.value = 3;
  master.connect(tone).connect(comp).connect(ctx.destination);

  function impulse(seconds, decay) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(3.8, 2.6);
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.6;
  reverb.connect(reverbOut).connect(master);

  const delay = ctx.createDelay(2);
  delay.delayTime.value = beat * 0.75;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const delayTone = ctx.createBiquadFilter();
  delayTone.type = "lowpass";
  delayTone.frequency.value = 2000;
  delay.connect(delayTone).connect(feedback).connect(delay);
  const delayOut = ctx.createGain();
  delayOut.gain.value = 0.4;
  delayTone.connect(delayOut);
  delayOut.connect(master);
  delayOut.connect(reverb);

  // Shared noise buffer for air, whooshes
  const noiseBuffer = (() => {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
    return buffer;
  })();
  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer;
  air.loop = true;
  const airHigh = ctx.createBiquadFilter();
  airHigh.type = "highpass";
  airHigh.frequency.value = 250;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.05;
  air.connect(airHigh).connect(airGain).connect(master);
  air.start();

  // Am9 - Fmaj7 - Cmaj7 - G6, two bars each
  const chords = [
    { root: 45, notes: [57, 60, 64, 71] },
    { root: 41, notes: [53, 57, 60, 64] },
    { root: 48, notes: [55, 60, 64, 71] },
    { root: 43, notes: [55, 59, 62, 64] }
  ];
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 800;
  padFilter.Q.value = 2;
  const padLfo = ctx.createOscillator();
  const padLfoDepth = ctx.createGain();
  padLfo.frequency.value = 0.07;
  padLfoDepth.gain.value = 380;
  padLfo.connect(padLfoDepth).connect(padFilter.frequency);
  padLfo.start();
  const padOut = ctx.createGain();
  padOut.gain.value = 0.5;
  padFilter.connect(padOut);
  padOut.connect(master);
  padOut.connect(reverb);

  const voices = new Set();
  function track(node, stopAt) { voices.add(node); node.onended = () => voices.delete(node); node.stop(stopAt); }

  function pad(chord, t, length) {
    chord.notes.forEach(n => {
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.045, t + 1.8);
      env.gain.setValueAtTime(0.045, t + length - 0.4);
      env.gain.linearRampToValueAtTime(0, t + length + 2.2);
      env.connect(padFilter);
      [-7, 7].forEach(cents => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = midi(n);
        osc.detune.value = cents;
        osc.connect(env);
        osc.start(t);
        track(osc, t + length + 2.4);
      });
    });
  }
  function bass(note, t, length) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midi(note - 12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16, t + 0.08);
    env.gain.setTargetAtTime(0.09, t + 0.2, 0.6);
    env.gain.setTargetAtTime(0, t + length - 0.1, 0.15);
    osc.connect(env).connect(master);
    osc.start(t);
    track(osc, t + length + 0.6);
  }
  function kick(t, level) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const env = ctx.createGain();
    env.gain.setValueAtTime(level, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(env).connect(master);
    osc.start(t);
    track(osc, t + 0.45);
  }
  function pluck(note, t, level) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midi(note);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0008, t + 0.32);
    osc.connect(env);
    env.connect(delay);
    env.connect(master);
    osc.start(t);
    track(osc, t + 0.35);
  }

  let energy = 0;
  let step = 0;
  let nextTime = 0;
  let timer = 0;
  function schedule(s, t) {
    const bar = Math.floor(s / 8);
    const chord = chords[Math.floor(bar / 2) % chords.length];
    if (s % 16 === 0) { pad(chord, t, beat * 8); bass(chord.root, t, beat * 8); }
    if (s % 8 === 0 || s % 8 === 4) kick(t, 0.16 + energy * 0.08);
    // Arpeggio: climbs through the chord, skips a few steps so it breathes, busier while travelling
    if (Math.random() < 0.55 + energy * 0.4) {
      const n = chord.notes[(s * 3) % chord.notes.length] + (s % 4 === 3 ? 24 : 12);
      pluck(n, t, 0.035 + energy * 0.02);
    }
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.3) {
      schedule(step, nextTime);
      nextTime += eighth;
      step++;
    }
  }

  let enabled = false;
  let started = false;
  function start() {
    if (started) return;
    started = true;
    nextTime = ctx.currentTime + 0.15;
    timer = window.setInterval(tick, 60);
    tick();
  }
  return {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      if (on) { if (ctx.state === "suspended") ctx.resume(); start(); }
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(on ? volume : 0, ctx.currentTime, on ? 1.2 : 0.25);
    },
    resume() { if (enabled && ctx.state === "suspended") ctx.resume(); },
    // 0 = resting at a stop, 1 = travelling fast: opens the filter and thickens the arpeggio
    setEnergy(value) {
      energy = Math.max(0, Math.min(1, value));
      tone.frequency.setTargetAtTime(1600 + energy * 3400, ctx.currentTime, 0.35);
    },
    whoosh() {
      if (!enabled) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 1.4;
      band.frequency.setValueAtTime(220, t);
      band.frequency.exponentialRampToValueAtTime(1900, t + 0.55);
      band.frequency.exponentialRampToValueAtTime(380, t + 1.3);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.32, t + 0.45);
      env.gain.linearRampToValueAtTime(0, t + 1.35);
      src.connect(band).connect(env);
      env.connect(master);
      env.connect(reverb);
      src.start(t, Math.random() * 2);
      track(src, t + 1.4);
    },
    chime() {
      if (!enabled) return;
      const t = ctx.currentTime;
      [76, 83].forEach((n, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = midi(n);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t + i * 0.09);
        env.gain.linearRampToValueAtTime(0.05, t + i * 0.09 + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0008, t + i * 0.09 + 1.6);
        osc.connect(env);
        env.connect(reverb);
        env.connect(master);
        osc.start(t + i * 0.09);
        track(osc, t + i * 0.09 + 1.7);
      });
    },
    dispose() {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      window.clearInterval(timer);
      window.setTimeout(() => { voices.forEach(v => { try { v.stop(); } catch (e) { /* already stopped */ } }); ctx.close(); }, 600);
    }
  };
}
