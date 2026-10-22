/**
 * ATLAS — house players
 *
 * Bots only exist in offline / solo matches. They read the same engine state the
 * human does and answer through the same validation path, so a bot can never
 * cheat its way past a letter, a repeat or the clock.
 */
(function (root) {
  "use strict";

  var NAMES = ["Elena", "Kenji", "Amina", "Rafael", "Sofia", "Idris", "Mei", "Tomas", "Nadia", "Omar"];

  function createBots(count, takenNames) {
    var taken = {};
    (takenNames || []).forEach(function (n) { taken[String(n).toLowerCase()] = true; });
    var pool = NAMES.filter(function (n) { return !taken[n.toLowerCase()]; });
    var bots = [];
    for (var i = 0; i < count; i++) {
      bots.push({ name: pool[i % pool.length] || "Bot " + (i + 1), avatar: "🤖" });
    }
    return bots;
  }

  /**
   * Choose an answer for a bot.
   * Returns { word } | { pass:true } | { skip:true }
   */
  function chooseAnswer(state, botId, data, engine) {
    var pool = data.wordsFor(state.category, state.requiredLetter).filter(function (word) {
      return !state.used[data.normalize(word)];
    });
    if (!pool.length) {
      var bot = engine.playerById(state, botId);
      return bot && bot.passes > 0 ? { pass: true } : { skip: true };
    }

    // Prefer short-ish answers so the chain keeps moving, but vary the pick so
    // two bots don't always answer the same word.
    var ranked = pool.slice().sort(function (a, b) { return a.length - b.length; });
    var window = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.6)));
    var word = window[Math.floor(Math.random() * window.length)];
    return { word: word };
  }

  /**
   * Plan a bot move without touching the engine. The caller applies the action
   * so solo and online hosts share exactly one code path.
   */
  function plan(state, botId, delayRange) {
    var range = delayRange || [1100, 2600];
    var delay = range[0] + Math.random() * (range[1] - range[0]);
    return { botId: botId, delay: Math.round(delay) };
  }

  root.AtlasBots = {
    NAMES: NAMES,
    createBots: createBots,
    chooseAnswer: chooseAnswer,
    plan: plan
  };
})(typeof window !== "undefined" ? window : globalThis);
