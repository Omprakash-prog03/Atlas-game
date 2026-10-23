/**
 * ATLAS — house players
 *
 * Bots only exist in offline / solo matches. They read the same engine state the
 * human does and answer through the same validation path, so a bot can never
 * cheat its way past a letter, a repeat or the clock.
 *
 * Difficulty is a behaviour profile, not a stat boost:
 *  - relaxed   slow to answer, happy with a short word, rarely spends energy,
 *              and occasionally lets the clock beat it.
 *  - sharp     the reference opponent: answers in good time, values the length
 *              bonus, spends energy on doubles when the chain is hot.
 *  - ruthless  fast, greedy for long words, arms doubles and shields on sight,
 *              and steers the letter with WILD when it has a run planned.
 *
 * Every bot decision goes through the engine's public actions, so a bot's power
 * use costs real energy and is visible in the same power log as a human's.
 */
(function (root) {
  "use strict";

  var NAMES = ["Elena", "Kenji", "Amina", "Rafael", "Sofia", "Idris", "Mei", "Tomas", "Nadia", "Omar"];

  var PROFILES = {
    relaxed: { label: "Relaxed", think: [1800, 3600], powerChance: 0.18, greed: 0.35, slip: 0.18, wildIQ: 0.1 },
    sharp: { label: "Sharp", think: [1100, 2600], powerChance: 0.5, greed: 0.62, slip: 0.06, wildIQ: 0.45 },
    ruthless: { label: "Ruthless", think: [650, 1500], powerChance: 0.92, greed: 0.9, slip: 0, wildIQ: 0.85 }
  };

  function profileFor(difficulty) {
    return PROFILES[difficulty] || PROFILES.sharp;
  }

  function createBots(count, takenNames, difficulty) {
    var taken = {};
    (takenNames || []).forEach(function (n) { taken[String(n).toLowerCase()] = true; });
    var pool = NAMES.filter(function (n) { return !taken[n.toLowerCase()]; });
    var bots = [];
    for (var i = 0; i < count; i++) {
      bots.push({
        name: pool[i % pool.length] || "Bot " + (i + 1),
        avatar: "\uD83E\uDD16",
        difficulty: difficulty || "sharp"
      });
    }
    return bots;
  }

  /** How good is this word as a *next* link? Long words pay a length bonus. */
  function valueOf(word) {
    var len = word.replace(/[^A-Z]/gi, "").length;
    return len >= 10 ? 4 : len >= 8 ? 3 : len >= 6 ? 2 : 0;
  }

  /**
   * Choose an answer for a bot.
   * Returns { word } | { pass:true } | { skip:true }
   */
  function chooseAnswer(state, botId, data, engine, difficulty) {
    var profile = profileFor(difficulty || (state.config && state.config.difficulty));
    var pool = engine.unusedFor
      ? engine.unusedFor(state, state.requiredLetter).map(function (w) { return data.get(state.category, w).word; })
      : data.wordsFor(state.category, state.requiredLetter).filter(function (word) {
        return !state.used[data.normalize(word)];
      });

    if (!pool.length) {
      var stuck = engine.playerById(state, botId);
      return stuck && stuck.passes > 0 ? { pass: true } : { skip: true };
    }

    // Relaxed bots grab something short and keep the chain moving. Greedier
    // bots weigh the length bonus, but never deterministically — otherwise the
    // same bot would win every match the same way.
    var ranked = pool.slice().sort(function (a, b) {
      return (valueOf(b) - valueOf(a)) || (a.length - b.length);
    });
    var greedy = Math.random() < profile.greed;
    var window = greedy
      ? ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.35)))
      : ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.6))).sort(function (a, b) { return a.length - b.length; });

    var word = window[Math.floor(Math.random() * window.length)];
    return { word: word };
  }

  /**
   * Decide whether this bot should fire a power-up right now.
   * Returns null, or { key, letter? } for the caller to apply via the engine.
   *
   * The bot never peeks: it only spends energy the engine has actually given it
   * and only on powers the engine says are affordable.
   */
  function choosePower(state, botId, data, engine, difficulty) {
    var cfg = state.config || {};
    if (!cfg.powerups) return null;
    var profile = profileFor(difficulty || cfg.difficulty);
    if (Math.random() > profile.powerChance) return null;

    var status = engine.powerStatus(state, botId);
    if (!status.available || !status.isTurn) return null;

    var usable = {};
    status.powers.forEach(function (p) { if (p.affordable) usable[p.key] = p; });

    var bot = engine.playerById(state, botId);
    if (!bot) return null;

    // 1. A shield is worth arming when one more strike is fatal, or when the
    //    bot is carrying an armed double it does not want to burn.
    if (usable.shield && (bot.strikes >= cfg.strikesToEliminate - 1 || bot.armed.double)) {
      return { key: "shield" };
    }

    var pool = engine.unusedFor(state, state.requiredLetter);

    // 2. Out of answers and out of passes? Buy a letter instead of a strike.
    if (!pool.length) {
      if (usable.wild) {
        var letters = engine.playableLetters(state).filter(function (l) { return l !== state.requiredLetter; });
        if (letters.length) {
          var best = letters.slice().sort(function (a, b) {
            return engine.unusedFor(state, b).length - engine.unusedFor(state, a).length;
          });
          var pick = Math.random() < profile.wildIQ ? best[0] : best[Math.floor(Math.random() * best.length)];
          return { key: "wild", letter: pick };
        }
      }
      if (usable.hint) return { key: "hint" };
      return null;
    }

    // 3. A long answer on a hot chain is exactly when a double pays for itself.
    var heat = engine.heatFor(state.combo).mult;
    var bestValue = Math.max.apply(null, pool.map(valueOf));
    if (usable.double && heat >= 1.25 && bestValue >= 2 && bot.energy >= usable.double.cost + 2) {
      return { key: "double" };
    }

    // 4. Plenty of clock left and a thin pool: freeze is wasted, hint is not.
    var remaining = engine.remainingMs(state);
    if (usable.hint && pool.length <= 2 && remaining < cfg.turnSeconds * 500) {
      return { key: "hint" };
    }

    // 5. Ruthless bots steer the letter toward a fat pool so the next link is easy.
    if (usable.wild && pool.length <= 1 && Math.random() < profile.wildIQ) {
      var options = engine.playableLetters(state).filter(function (l) { return l !== state.requiredLetter; });
      if (options.length) {
        var richest = options.slice().sort(function (a, b) {
          return engine.unusedFor(state, b).length - engine.unusedFor(state, a).length;
        })[0];
        return { key: "wild", letter: richest };
      }
    }

    return null;
  }

  /**
   * Plan a bot move without touching the engine. The caller applies the action
   * so solo and online hosts share exactly one code path.
   */
  function plan(state, botId, delayRange, difficulty) {
    var profile = profileFor(difficulty || (state && state.config && state.config.difficulty));
    var range = delayRange || profile.think;
    var delay = range[0] + Math.random() * (range[1] - range[0]);

    // A relaxed bot sometimes simply runs out of clock.
    var stalls = Math.random() < profile.slip;
    return { botId: botId, delay: Math.round(delay), stalls: stalls, difficulty: profile.label };
  }

  root.AtlasBots = {
    NAMES: NAMES,
    PROFILES: PROFILES,
    createBots: createBots,
    chooseAnswer: chooseAnswer,
    choosePower: choosePower,
    plan: plan,
    profileFor: profileFor,
    valueOf: valueOf
  };
})(typeof window !== "undefined" ? window : globalThis);
