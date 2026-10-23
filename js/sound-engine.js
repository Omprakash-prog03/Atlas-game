/**
 * ATLAS — procedural sound
 *
 * Everything is synthesised with Web Audio: no audio files to download, no
 * licensing, and it works offline. The context is created lazily on the first
 * real gesture so mobile browsers never block it.
 */
(function (root) {
  "use strict";

  var SoundEngine = {
    ctx: null,
    enabled: true,
    haptics: true,

    init: function () {
      if (typeof window === "undefined") return;
      if (!this.ctx) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        try {
          this.ctx = new Ctx();
        } catch (e) {
          return;
        }
      }
      if (this.ctx.state === "suspended") {
        try { this.ctx.resume(); } catch (e) {}
      }
    },

    setEnabled: function (on) {
      this.enabled = !!on;
    },

    setHaptics: function (on) {
      this.haptics = !!on;
    },

    buzz: function (pattern) {
      if (!this.haptics) return;
      try {
        if (navigator && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
      } catch (e) {}
    },

    tone: function (freq, opts) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      var o = opts || {};
      var t0 = this.ctx.currentTime + (o.delay || 0);
      var dur = o.duration || 0.12;
      try {
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = o.type || "sine";
        osc.frequency.setValueAtTime(freq, t0);
        if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t0 + dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(o.volume || 0.18, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) {}
    },

    noise: function (opts) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      var o = opts || {};
      var dur = o.duration || 0.24;
      try {
        var frames = Math.floor(this.ctx.sampleRate * dur);
        var buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < frames; i++) {
          var decay = Math.pow(1 - i / frames, o.decay || 2.2);
          data[i] = (Math.random() * 2 - 1) * decay;
        }
        var src = this.ctx.createBufferSource();
        src.buffer = buffer;
        var filter = this.ctx.createBiquadFilter();
        filter.type = o.filter || "bandpass";
        filter.frequency.setValueAtTime(o.freq || 900, this.ctx.currentTime);
        if (o.sweepTo) filter.frequency.exponentialRampToValueAtTime(o.sweepTo, this.ctx.currentTime + dur);
        filter.Q.value = o.q || 0.9;
        var gain = this.ctx.createGain();
        gain.gain.value = o.volume || 0.22;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        src.start();
      } catch (e) {}
    },

    // ------------------------------------------------------------ public API

    playClick: function () {
      this.tone(620, { type: "sine", duration: 0.06, glideTo: 260, volume: 0.1 });
      this.buzz(8);
    },

    playDeal: function () {
      this.noise({ duration: 0.18, freq: 2400, sweepTo: 700, volume: 0.1, filter: "highpass", decay: 2.6 });
      this.tone(320, { type: "sine", duration: 0.1, volume: 0.06 });
    },

    playSwipe: function () {
      this.noise({ duration: 0.26, freq: 700, sweepTo: 2600, volume: 0.16, filter: "bandpass", decay: 1.8 });
    },

    playValidChime: function () {
      var notes = [523.25, 659.25, 783.99];
      var self = this;
      notes.forEach(function (freq, i) {
        self.tone(freq, { delay: i * 0.06, duration: 0.3, volume: 0.13 });
      });
      this.buzz([12, 30, 16]);
    },

    playInvalidBuzz: function () {
      this.tone(150, { type: "sawtooth", duration: 0.16, volume: 0.14 });
      this.tone(110, { type: "sawtooth", duration: 0.2, delay: 0.08, volume: 0.12 });
      this.buzz([50, 40, 50]);
    },

    playTimerTick: function (urgent) {
      this.tone(urgent ? 900 : 460, { type: urgent ? "triangle" : "sine", duration: 0.05, volume: urgent ? 0.1 : 0.05 });
      if (urgent) this.buzz(10);
    },

    playFanfare: function () {
      var notes = [392, 523.25, 659.25, 783.99, 1046.5];
      var self = this;
      notes.forEach(function (freq, i) {
        self.tone(freq, { delay: i * 0.075, duration: 0.34, type: "triangle", volume: 0.12 });
      });
      this.buzz([20, 40, 20, 40, 30]);
    },

    playRound: function () {
      this.tone(523.25, { duration: 0.16, volume: 0.1 });
      this.tone(783.99, { delay: 0.1, duration: 0.22, volume: 0.1 });
    },

    // ---------------------------------------------------- v4 economy sounds

    /** Energy landing on the meter: a short rising blip. */
    playCharge: function (amount) {
      var steps = Math.max(1, Math.min(4, amount || 1));
      for (var i = 0; i < steps; i++) {
        this.tone(660 + i * 130, { delay: i * 0.045, duration: 0.09, type: "triangle", volume: 0.07 });
      }
    },

    /** A power-up fired: bright, mechanical, unmistakably "you spent something". */
    playPower: function (key) {
      switch (key) {
        case "freeze": this.playFreeze(); break;
        case "shield": this.playShield(); break;
        case "double": this.playDoubleArm(); break;
        case "wild": this.playWild(); break;
        default: this.playHint();
      }
    },

    playHint: function () {
      this.tone(880, { duration: 0.1, type: "sine", volume: 0.1 });
      this.tone(1320, { delay: 0.07, duration: 0.14, type: "sine", volume: 0.08 });
      this.buzz(10);
    },

    playFreeze: function () {
      this.noise({ duration: 0.3, freq: 3200, sweepTo: 900, volume: 0.1, filter: "highpass", decay: 2.2 });
      this.tone(1180, { duration: 0.22, type: "sine", glideTo: 620, volume: 0.09 });
      this.buzz([8, 24, 8]);
    },

    playDoubleArm: function () {
      this.tone(392, { duration: 0.12, type: "triangle", volume: 0.11 });
      this.tone(587.33, { delay: 0.09, duration: 0.2, type: "triangle", volume: 0.11 });
      this.buzz([14, 20, 14]);
    },

    playWild: function () {
      var self = this;
      [523.25, 698.46, 880, 698.46].forEach(function (freq, i) {
        self.tone(freq, { delay: i * 0.05, duration: 0.12, type: "square", volume: 0.06 });
      });
      this.buzz([10, 16, 10]);
    },

    playShield: function () {
      this.tone(220, { duration: 0.18, type: "sine", volume: 0.13 });
      this.noise({ duration: 0.22, freq: 1400, sweepTo: 400, volume: 0.09, filter: "lowpass", decay: 2.4 });
      this.buzz([18, 26, 18]);
    },

    /** A shield actually absorbing a strike. */
    playShieldBreak: function () {
      this.noise({ duration: 0.34, freq: 900, sweepTo: 260, volume: 0.17, filter: "bandpass", decay: 1.6 });
      this.tone(330, { duration: 0.24, type: "triangle", glideTo: 140, volume: 0.12 });
      this.buzz([40, 30, 40]);
    },

    /** The table combo climbing into a new tier. */
    playComboUp: function (tierIndex) {
      var base = 523.25 * Math.pow(1.122, Math.min(9, tierIndex || 0));
      this.tone(base, { duration: 0.14, type: "triangle", volume: 0.1 });
      this.tone(base * 1.5, { delay: 0.08, duration: 0.2, type: "triangle", volume: 0.09 });
      this.buzz(12);
    },

    /** The chain going cold: a descending, deflating pair. */
    playComboBreak: function () {
      this.tone(392, { duration: 0.16, type: "sine", glideTo: 196, volume: 0.11 });
      this.tone(294, { delay: 0.1, duration: 0.24, type: "sine", glideTo: 130, volume: 0.09 });
    },

    /** An armed double burning on a timeout. */
    playDoubleLost: function () {
      this.tone(440, { duration: 0.14, type: "sawtooth", glideTo: 160, volume: 0.1 });
      this.noise({ duration: 0.2, freq: 1800, sweepTo: 500, volume: 0.08, filter: "bandpass", decay: 2 });
      this.buzz([30, 30, 30]);
    },

    /** Denied: not enough energy, no charges left, wrong moment. */
    playDenied: function () {
      this.tone(200, { duration: 0.1, type: "square", volume: 0.08 });
      this.tone(160, { delay: 0.07, duration: 0.12, type: "square", volume: 0.07 });
      this.buzz(24);
    }
  };

  root.SoundEngine = SoundEngine;
})(typeof window !== "undefined" ? window : globalThis);
