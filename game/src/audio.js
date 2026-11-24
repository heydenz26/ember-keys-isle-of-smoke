// Ember Keys — Isle of Smoke
// audio.js — procedural WebAudio sound: engine hum tied to speed, a police
// siren wail, pickup and cash blips, a shove thud, and a tiny bass-and-arp
// music loop. No audio files, no network. The context is created lazily on
// the first user gesture (browser autoplay policy), and M toggles mute.
//
// Written from scratch for this build.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.started = false;
  }

  // Call from a key/click handler. Safe to call repeatedly.
  ensureStarted() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    // Engine: a sawtooth through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();

    // Siren: a triangle wave whose frequency is LFO-swept when active.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();

    this.started = true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  // Per-frame update: engine pitch from speed, siren sweep while pursued.
  update(dt, speedNorm, sirenActive, time) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const targetEngine = speedNorm > 0.02 ? 0.05 + speedNorm * 0.05 : 0.0;
    this.engineGain.gain.setTargetAtTime(targetEngine, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speedNorm * 165, t, 0.08);

    if (sirenActive) {
      this.sirenGain.gain.setTargetAtTime(0.028, t, 0.2);
      this.sirenOsc.frequency.setTargetAtTime(640 + Math.sin(time * 4.4) * 190, t, 0.05);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, t, 0.15);
    }

    // Music: an eight-step minor loop, scheduled coarsely from the frame
    // loop — good enough for a chiptune groove and fully deterministic in
    // structure (notes from a fixed table).
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 0.24;
      this.playMusicStep(this.musicStep);
      this.musicStep = (this.musicStep + 1) % 32;
    }
  }

  playMusicStep(step) {
    if (!this.ctx || this.muted) return;
    const bassNotes = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
    const arpNotes = [220, 261.6, 329.6, 261.6, 220, 261.6, 392, 329.6];
    const t = this.ctx.currentTime;
    const bass = bassNotes[step % bassNotes.length];
    if (bass) this.tone(bass, 0.20, 'triangle', 0.10, t);
    if (step % 2 === 0) {
      const arp = arpNotes[(step / 2) % arpNotes.length];
      this.tone(arp, 0.11, 'square', 0.022, t);
    }
    if (step % 8 === 4) this.noiseBurst(0.05, 0.015, t); // hat tick
  }

  tone(freq, dur, type, vol, when) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  noiseBurst(dur, vol, when) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(this.master);
    src.start(when);
  }

  blip(kind) {
    if (!this.started || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (kind === 'pickup') {
      this.tone(660, 0.09, 'square', 0.06, t);
      this.tone(990, 0.12, 'square', 0.06, t + 0.07);
    } else if (kind === 'cash') {
      this.tone(880, 0.08, 'square', 0.055, t);
      this.tone(1174, 0.1, 'square', 0.055, t + 0.06);
      this.tone(1568, 0.16, 'square', 0.05, t + 0.12);
    } else if (kind === 'thud') {
      this.noiseBurst(0.12, 0.16, t);
      this.tone(90, 0.14, 'sine', 0.2, t);
    } else if (kind === 'star') {
      this.tone(520, 0.1, 'sawtooth', 0.05, t);
      this.tone(390, 0.16, 'sawtooth', 0.05, t + 0.09);
    } else if (kind === 'door') {
      this.tone(240, 0.07, 'square', 0.05, t);
      this.tone(180, 0.09, 'square', 0.05, t + 0.06);
    }
  }
}
