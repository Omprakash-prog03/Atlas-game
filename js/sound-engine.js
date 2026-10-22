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
    }
  };

  root.SoundEngine = SoundEngine;
})(typeof window !== "undefined" ? window : globalThis);
