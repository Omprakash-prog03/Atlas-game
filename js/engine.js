/**
 * ATLAS — game engine
 *
 * Pure, serializable, host-authoritative match logic. No DOM, no timers,
 * no unseeded randomness: the same action on the same state always produces
 * the same result, which is what lets the host broadcast state and guests
 * replay it safely (and lets the test suite assert exact outcomes).
 *
 * Rules implemented here:
 *  - A word must start with the required letter, exist in the category bank and
 *    never repeat inside a match.
 *  - A round is one full trip around the table (every surviving player played).
 *  - Answer before the deadline or take a strike. Three strikes eliminate you.
 *  - Passing keeps the letter, costs one pass.
 *  - The match ends when one player is left, or when the round cap is reached;
 *    then the highest score wins (ties: best streak, best combo, most words).
 *
 * Economy (v4):
 *  - Every accepted card adds to the table COMBO. The combo sets a score
 *    multiplier that the whole table rides, so keeping the chain alive is a
 *    shared incentive. A timeout freezes the chain; a pass cools it by one.
 *  - Cards also charge a personal ENERGY meter. Energy buys POWER-UPS:
 *    hint, freeze, double, wild, shield. Each has a cost, a per-match charge
 *    limit and a per-turn cap, so nobody can dump a whole battery at once.
 *  - DOUBLE is the risk play: it doubles your next card, but if you time out
 *    while it is armed you lose it, lose energy and the combo goes cold.
 *  - SHIELD is the safety play: it eats your next strike.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./datasets.js"));
  } else {
    root.AtlasEngine = factory(root.AtlasData);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (AtlasData) {
  "use strict";

  var DEFAULTS = {
    category: "PLACES",
    turnSeconds: 20,
    maxPasses: 3,
    strikesToEliminate: 3,
    maxRounds: 12,
    minPlayers: 1,
    maxPlayers: 10,

    // ---- v4 economy -------------------------------------------------------
    powerups: true,        // power-up tray is live in this match
    combo: true,           // table combo multiplies card scores
    startEnergy: 3,        // energy each player begins with
    maxEnergy: 10,         // energy cap (unspent energy is wasted energy)
    freezeSeconds: 8,      // clock added by the FREEZE power
    maxPowersPerTurn: 2,   // anti-dump cap per turn
    doublePenalty: 2,      // energy lost when an armed DOUBLE times out
    difficulty: "sharp"    // relaxed | sharp | ruthless (house players)
  };

  var STATUS = {
    LOBBY: "lobby",
    PLAYING: "playing",
    ROUND_END: "round_end",
    MATCH_END: "match_end"
  };

  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  /**
   * Power-up catalogue. `needsTurn` powers only fire while it is your turn;
   * SHIELD can be armed at any time because it protects a future turn.
   */
  var POWERS = {
    hint: {
      key: "hint",
      label: "Hint",
      glyph: "\uD83D\uDCA1",
      cost: 3,
      limit: 3,
      needsTurn: true,
      blurb: "Reveals a masked answer for the current letter."
    },
    freeze: {
      key: "freeze",
      label: "Freeze",
      glyph: "\u2744\uFE0F",
      cost: 3,
      limit: 2,
      needsTurn: true,
      blurb: "Adds seconds to the clock on your turn."
    },
    double: {
      key: "double",
      label: "Double",
      glyph: "\uD83C\uDFAF",
      cost: 5,
      limit: 2,
      needsTurn: true,
      blurb: "Your next card scores double. Time out while armed and you lose it."
    },
    wild: {
      key: "wild",
      label: "Wild",
      glyph: "\uD83D\uDD00",
      cost: 4,
      limit: 2,
      needsTurn: true,
      blurb: "Swap the required letter for any letter that still has answers."
    },
    shield: {
      key: "shield",
      label: "Shield",
      glyph: "\uD83D\uDEE1\uFE0F",
      cost: 4,
      limit: 2,
      needsTurn: false,
      blurb: "Absorbs your next strike."
    }
  };

  var POWER_ORDER = ["hint", "freeze", "double", "wild", "shield"];

  /**
   * Table combo tiers. The multiplier is deliberately 1 for the first two
   * cards so an opening answer always scores its honest base value — the heat
   * has to be earned before it pays.
   */
  var COMBO_TIERS = [
    { min: 0, mult: 1, label: "\u00D71", name: "Cold" },
    { min: 3, mult: 1.25, label: "\u00D71.25", name: "Warming" },
    { min: 5, mult: 1.5, label: "\u00D71.5", name: "Hot" },
    { min: 8, mult: 2, label: "\u00D72", name: "Blazing" },
    { min: 12, mult: 2.5, label: "\u00D72.5", name: "Seared" },
    { min: 16, mult: 3, label: "\u00D73", name: "White hot" }
  ];

  var DIFFICULTIES = {
    relaxed: { label: "Relaxed", think: [1800, 3600], powerChance: 0.18, greed: 0.35, slip: 0.18 },
    sharp: { label: "Sharp", think: [1100, 2600], powerChance: 0.5, greed: 0.62, slip: 0.06 },
    ruthless: { label: "Ruthless", think: [650, 1500], powerChance: 0.92, greed: 0.9, slip: 0 }
  };

  function nowMs() {
    return Date.now();
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function uid(prefix) {
    return (prefix || "p") + "_" + Math.random().toString(36).slice(2, 9);
  }

  function randomCode(length) {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var out = "";
    for (var i = 0; i < (length || 5); i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }

  // ------------------------------------------------------------- seeded rng

  /** FNV-1a — turns any string (a room code, a date) into a stable seed. */
  function hashSeed(input) {
    var str = String(input == null ? "" : input);
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /**
   * mulberry32, advanced from state so it survives a JSON round-trip. Every
   * random choice inside a match flows through here: host and guest see the
   * same shuffle, and a replayed log reproduces exactly.
   */
  function nextRandom(state) {
    var s = (Number(state.rngState) || 0) + 0x6d2b79f5;
    state.rngState = s >>> 0;
    var t = state.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Pick one item using the match's own seeded stream. */
  function pickFrom(state, list) {
    if (!list || !list.length) return null;
    return list[Math.floor(nextRandom(state) * list.length) % list.length];
  }

  function config(input) {
    var cfg = Object.assign({}, DEFAULTS, input || {});
    cfg.category = AtlasData.categories[cfg.category] ? cfg.category : DEFAULTS.category;
    cfg.turnSeconds = clamp(Number(cfg.turnSeconds) || DEFAULTS.turnSeconds, 5, 120);
    cfg.maxPasses = clamp(Number(cfg.maxPasses), 0, 9);
    cfg.strikesToEliminate = clamp(Number(cfg.strikesToEliminate) || 3, 1, 5);
    cfg.maxRounds = clamp(Number(cfg.maxRounds) || DEFAULTS.maxRounds, 3, 40);

    cfg.powerups = cfg.powerups !== false && cfg.powerups !== "false";
    cfg.combo = cfg.combo !== false && cfg.combo !== "false";
    cfg.startEnergy = clamp(Number(cfg.startEnergy) || 0, 0, cfg.maxEnergy || DEFAULTS.maxEnergy);
    cfg.maxEnergy = clamp(Number(cfg.maxEnergy) || DEFAULTS.maxEnergy, 1, 30);
    cfg.startEnergy = clamp(cfg.startEnergy, 0, cfg.maxEnergy);
    cfg.freezeSeconds = clamp(Number(cfg.freezeSeconds) || DEFAULTS.freezeSeconds, 2, 30);
    cfg.maxPowersPerTurn = clamp(Number(cfg.maxPowersPerTurn) || DEFAULTS.maxPowersPerTurn, 1, 5);
    cfg.doublePenalty = clamp(Number(cfg.doublePenalty) || 0, 0, 10);
    cfg.difficulty = DIFFICULTIES[cfg.difficulty] ? cfg.difficulty : DEFAULTS.difficulty;
    return cfg;
  }

  function freshArmed() {
    return { double: false, shield: false };
  }

  function makePlayer(seat) {
    return {
      id: uid("p"),
      seat: seat,
      name: "Player " + (seat + 1),
      bot: false,
      connected: true,
      ready: false,
      score: 0,
      words: 0,
      passes: 3,
      strikes: 0,
      streak: 0,
      bestStreak: 0,
      eliminated: false,
      lastAction: null,

      // ---- economy ----
      energy: 0,
      energyEarned: 0,
      energySpent: 0,
      combo: 0,           // personal best chain contribution (informational)
      maxCombo: 0,        // highest table combo this player cashed in on
      multiplier: 1,      // multiplier applied to their last card
      armed: freshArmed(),
      powersUsed: {},     // key -> count this match
      powersThisTurn: 0,
      powerCount: 0,
      hint: null,         // {pattern, letter, count, at}
      doublesCashed: 0,
      shieldsUsed: 0,
      shieldsLost: 0
    };
  }

  /** A letter that actually has answers in this category, so the match can start. */
  function pickStartLetter(category, rng) {
    var pool = LETTERS.filter(function (letter) {
      return AtlasData.wordsFor(category, letter).length >= 3;
    });
    if (!pool.length) pool = LETTERS.filter(function (l) { return AtlasData.wordsFor(category, l).length > 0; });
    var r = typeof rng === "function" ? rng() : Math.random();
    return pool[Math.floor(r * pool.length)] || "A";
  }

  /** Unused answers for a letter, in bank order. */
  function unusedFor(state, letter) {
    var pool = AtlasData.wordsFor(state.category, letter);
    var out = [];
    for (var i = 0; i < pool.length; i++) {
      if (!state.used[AtlasData.normalize(pool[i])]) out.push(pool[i]);
    }
    return out;
  }

  /** True when at least one unused answer exists for this letter. */
  function hasUnusedLetter(state, letter) {
    return unusedFor(state, letter).length > 0;
  }

  /** Letters that could legally be required right now (used by WILD and the UI). */
  function playableLetters(state) {
    return LETTERS.filter(function (letter) { return hasUnusedLetter(state, letter); });
  }

  /**
   * A chain can run dry: every answer for the required letter may already be on
   * the table. Punishing players for a dead deck is unfair, so the deck opens a
   * fresh chain instead (and the UI announces it). Seeded, so host and guest
   * agree on which letter appears.
   */
  function ensurePlayableLetter(state) {
    if (hasUnusedLetter(state, state.requiredLetter)) return false;

    var from = state.requiredLetter;
    var candidates = LETTERS.filter(function (letter) {
      var pool = AtlasData.wordsFor(state.category, letter);
      var unused = 0;
      for (var i = 0; i < pool.length && unused < 2; i++) {
        if (!state.used[AtlasData.normalize(pool[i])]) unused += 1;
      }
      return unused >= 2;
    });
    if (!candidates.length) return false;

    var next = pickFrom(state, candidates);
    state.requiredLetter = next;
    state.letterReset = { from: from, to: next, at: nowMs(), wild: false };
    return true;
  }

  function createMatch(options) {
    var cfg = config(options);
    var opts = options || {};
    var seed = opts.seed != null ? hashSeed(opts.seed) : (hashSeed(opts.code || randomCode(5)) ^ (nowMs() & 0xffffff));

    var state = {
      id: uid("m"),
      code: opts.code || randomCode(5),
      mode: opts.mode || "solo", // 'solo' | 'host' | 'guest'
      config: cfg,
      status: STATUS.LOBBY,
      category: cfg.category,
      round: 1,
      turn: 0,
      activeId: null,
      requiredLetter: "",
      startingLetter: "",
      deck: [],          // accepted words, newest last: {word, norm, emoji, note, byId, byName, points, at, round}
      used: {},          // normalized word -> true
      players: [],
      deadline: 0,
      turnStartAt: 0,
      turnBudgetMs: cfg.turnSeconds * 1000, // grows when FREEZE is played
      turnSeconds: cfg.turnSeconds,
      winnerId: null,
      roundSeen: {},     // player ids that already played this round
      roundBanner: null, // {round, at} transient signal for the UI
      letterReset: null, // {from, to, at, wild} set when the letter changes unexpectedly
      lastEvent: null,

      // ---- economy ----
      seed: seed >>> 0,
      rngState: seed >>> 0,
      combo: 0,          // table combo: consecutive accepted cards
      comboBest: 0,
      comboBanner: null, // {combo, tier, at} transient signal when the heat changes
      powerLog: [],      // newest last, capped: {key, playerId, byName, at, note}
      powerBanner: null, // transient signal for the UI

      version: 0,
      createdAt: nowMs(),
      updatedAt: nowMs()
    };

    if (Array.isArray(opts.players)) {
      opts.players.forEach(function (p, i) {
        var player = makePlayer(i);
        Object.assign(player, p, { seat: i, id: p.id || player.id });
        player.passes = cfg.maxPasses;
        player.energy = cfg.startEnergy;
        state.players.push(player);
      });
    }
    return state;
  }

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function touch(state, event) {
    state.version += 1;
    state.updatedAt = nowMs();
    if (event) state.lastEvent = Object.assign({ at: state.updatedAt }, event);
    return state;
  }

  function alivePlayers(state) {
    return state.players.filter(function (p) { return !p.eliminated; });
  }

  function playerById(state, id) {
    for (var i = 0; i < state.players.length; i++) if (state.players[i].id === id) return state.players[i];
    return null;
  }

  function activePlayer(state) {
    return state.activeId ? playerById(state, state.activeId) : null;
  }

  function isActive(state, playerId) {
    return state.status === STATUS.PLAYING && state.activeId === playerId;
  }

  // ---------------------------------------------------------------- players

  function addPlayer(state, player) {
    if (state.status !== STATUS.LOBBY) return { ok: false, error: "Match already started" };
    if (state.players.length >= state.config.maxPlayers) return { ok: false, error: "Room is full" };
    var p = makePlayer(state.players.length);
    Object.assign(p, player || {});
    p.passes = state.config.maxPasses;
    p.energy = state.config.startEnergy;
    p.armed = freshArmed();
    p.powersUsed = {};
    p.ready = state.mode === "solo" ? true : !!(player && player.ready);
    state.players.push(p);
    touch(state, { type: "player_joined", playerId: p.id, name: p.name });
    return { ok: true, playerId: p.id, state: state };
  }

  function removePlayer(state, playerId) {
    var idx = state.players.findIndex(function (p) { return p.id === playerId; });
    if (idx === -1) return { ok: false, error: "Player not found" };
    var wasActive = state.activeId === playerId;
    var removed = state.players.splice(idx, 1)[0];
    state.players.forEach(function (p, i) { p.seat = i; });

    if (state.status === STATUS.PLAYING) {
      delete state.roundSeen[playerId];
      if (alivePlayers(state).length === 0) return endMatch(state, null);
      if (wasActive) {
        state.activeId = null;
        advance(state);
      } else if (alivePlayers(state).length === 1) {
        return endMatch(state, alivePlayers(state)[0].id);
      }
    }
    touch(state, { type: "player_left", playerId: playerId, name: removed.name });
    return { ok: true, state: state };
  }

  function setPlayer(state, playerId, patch) {
    var p = playerById(state, playerId);
    if (!p) return { ok: false, error: "Player not found" };
    Object.assign(p, patch || {});
    touch(state, { type: "player_updated", playerId: playerId });
    return { ok: true, state: state };
  }

  function setReady(state, playerId, ready) {
    return setPlayer(state, playerId, { ready: !!ready });
  }

  // ---------------------------------------------------------------- match flow

  function start(state, options) {
    if (state.status === STATUS.PLAYING) return { ok: false, error: "Match already running" };
    if (state.players.length < state.config.minPlayers) return { ok: false, error: "Not enough players" };

    var opts = options || {};
    state.status = STATUS.PLAYING;
    state.round = 1;
    state.turn = 0;
    state.deck = [];
    state.used = {};
    state.roundSeen = {};
    state.winnerId = null;
    state.roundBanner = null;
    state.letterReset = null;
    state.combo = 0;
    state.comboBest = 0;
    state.comboBanner = null;
    state.powerLog = [];
    state.powerBanner = null;

    // A rematch on the same room keeps the same seed stream moving forward, so
    // two matches in one room never deal identical letter resets.
    if (opts.seed != null) {
      state.seed = hashSeed(opts.seed) >>> 0;
      state.rngState = state.seed;
    }

    state.players.forEach(function (p) {
      p.score = 0;
      p.words = 0;
      p.strikes = 0;
      p.streak = 0;
      p.bestStreak = 0;
      p.eliminated = false;
      p.passes = state.config.maxPasses;
      p.lastAction = null;
      p.energy = state.config.startEnergy;
      p.energyEarned = 0;
      p.energySpent = 0;
      p.combo = 0;
      p.maxCombo = 0;
      p.multiplier = 1;
      p.armed = freshArmed();
      p.powersUsed = {};
      p.powersThisTurn = 0;
      p.powerCount = 0;
      p.hint = null;
      p.doublesCashed = 0;
      p.shieldsUsed = 0;
      p.shieldsLost = 0;
    });

    state.startingLetter = opts.letter || pickStartLetter(state.category, opts.rng);
    state.requiredLetter = state.startingLetter;
    state.activeId = state.players[0] ? state.players[0].id : null;
    state.turn = 1;
    state.turnSeconds = state.config.turnSeconds;
    state.turnStartAt = nowMs();
    state.turnBudgetMs = state.turnSeconds * 1000;
    state.deadline = state.turnStartAt + state.turnBudgetMs;

    state.roundSeen = {};
    touch(state, { type: "match_started", letter: state.requiredLetter });
    return { ok: true, state: state };
  }

  var MILESTONES = { 3: 5, 5: 10, 10: 20 };

  /** The combo tier for a given chain length. */
  function heatFor(combo) {
    var tier = COMBO_TIERS[0];
    for (var i = 0; i < COMBO_TIERS.length; i++) {
      if ((combo || 0) >= COMBO_TIERS[i].min) tier = COMBO_TIERS[i];
    }
    return tier;
  }

  /** Multiplier in force for the next accepted card. */
  function multiplierFor(state) {
    if (!state.config.combo) return 1;
    return heatFor(state.combo).mult;
  }

  /** Energy charged by one accepted card: 1..4 depending on how good it was. */
  function energyFor(scored, tier) {
    var gain = 1;
    if (scored.speed >= 3) gain += 1;
    if (scored.length >= 3) gain += 1;
    if (tier && tier.mult >= 1.5) gain += 1;
    return gain;
  }

  function addEnergy(player, amount, state) {
    var cap = state.config.maxEnergy;
    var before = player.energy;
    player.energy = clamp(before + amount, 0, cap);
    var gained = player.energy - before;
    if (gained > 0) player.energyEarned += gained;
    return gained;
  }

  function spendEnergy(player, amount) {
    player.energy = Math.max(0, player.energy - amount);
    player.energySpent += amount;
  }

  /**
   * Full scoring breakdown. Base points are unchanged from the classic curve;
   * the combo multiplier and an armed DOUBLE scale the total on top of it.
   */
  function scoreFor(state, word, player, remainingMs) {
    var base = 10;
    var ratio = state.turnSeconds > 0 ? remainingMs / (state.turnSeconds * 1000) : 0;
    var speed = ratio >= 0.66 ? 5 : ratio >= 0.33 ? 3 : ratio >= 0.08 ? 1 : 0;

    var nextStreak = player.streak + 1;
    var streak = MILESTONES[nextStreak] || 0;

    var len = AtlasData.normalize(word).replace(/\s/g, "").length;
    var length = len >= 10 ? 4 : len >= 8 ? 3 : len >= 6 ? 2 : 0;

    var tier = heatFor(state.combo + 1); // the card being scored is the next link
    var comboMult = state.config.combo ? tier.mult : 1;
    var doubleMult = player.armed && player.armed.double ? 2 : 1;

    var raw = base + speed + streak + length;
    var multiplier = comboMult * doubleMult;
    var total = multiplier === 1 ? raw : Math.round(raw * multiplier);

    return {
      base: base,
      speed: speed,
      streak: streak,
      length: length,
      raw: raw,
      multiplier: multiplier,
      comboMultiplier: comboMult,
      doubleMultiplier: doubleMult,
      tier: tier,
      total: total,
      nextStreak: nextStreak
    };
  }

  /**
   * Live validation for the UI (does not mutate anything).
   * Returns { status, message, suggestion }.
   */
  function validate(state, playerId, rawWord, atMs) {
    var word = AtlasData.normalize(rawWord);
    if (state.status !== STATUS.PLAYING) return { status: "inactive", message: "Match is not running" };
    if (state.activeId !== playerId) return { status: "not-your-turn", message: "Not your turn" };
    if (!word) return { status: "empty", message: "Type a word" };

    if (AtlasData.firstLetter(word) !== state.requiredLetter) {
      return { status: "wrong-letter", message: "Must start with " + state.requiredLetter };
    }
    if (state.used[word]) return { status: "used", message: "Already played this match" };

    var entry = AtlasData.get(state.category, word);
    if (!entry) {
      return {
        status: "unknown",
        message: "Not in the " + AtlasData.categories[state.category].label.toLowerCase() + " list",
        suggestion: AtlasData.suggest(state.category, word, 1)[0] || null
      };
    }

    var at = atMs || nowMs();
    var remaining = Math.max(0, state.deadline - at);
    if (remaining <= 0) return { status: "late", message: "Too late — time ran out" };
    return { status: "ok", message: entry.word, entry: entry, remaining: remaining };
  }

  function logPower(state, entry) {
    state.powerLog.push(entry);
    if (state.powerLog.length > 24) state.powerLog = state.powerLog.slice(-24);
    state.powerBanner = entry;
  }

  function submit(state, playerId, rawWord, atMs) {
    var check = validate(state, playerId, rawWord, atMs);
    if (check.status !== "ok") {
      return { ok: false, error: check.message, reason: check.status, suggestion: check.suggestion || null, state: state };
    }

    var player = playerById(state, playerId);
    var entry = check.entry;
    var scored = scoreFor(state, entry.word, player, check.remaining);
    var at = atMs || nowMs();

    // --- combo: the table rides this card -----------------------------------
    var previousCombo = state.combo;
    if (state.config.combo) {
      state.combo += 1;
      state.comboBest = Math.max(state.comboBest, state.combo);
      if (heatFor(state.combo).min !== heatFor(previousCombo).min) {
        state.comboBanner = { combo: state.combo, tier: heatFor(state.combo), at: at };
      }
    }
    player.combo = state.combo;
    player.maxCombo = Math.max(player.maxCombo || 0, state.combo);
    player.multiplier = scored.multiplier;

    var cashedDouble = !!(player.armed && player.armed.double);
    if (cashedDouble) {
      player.armed.double = false;
      player.doublesCashed += 1;
    }

    // --- energy: a good card charges you ------------------------------------
    var gained = 0;
    if (state.config.powerups) {
      gained = addEnergy(player, energyFor(scored, scored.tier), state);
    }

    player.score += scored.total;
    player.words += 1;
    player.streak = scored.nextStreak;
    player.bestStreak = Math.max(player.bestStreak, player.streak);
    player.lastAction = "word";
    player.hint = null;

    state.used[entry.norm] = true;
    var card = {
      word: entry.word,
      norm: entry.norm,
      emoji: entry.emoji,
      note: entry.note,
      byId: player.id,
      byName: player.name,
      points: scored.total,
      breakdown: {
        base: scored.base,
        speed: scored.speed,
        streak: scored.streak,
        length: scored.length,
        multiplier: scored.multiplier,
        comboMultiplier: scored.comboMultiplier,
        doubleMultiplier: scored.doubleMultiplier,
        raw: scored.raw
      },
      energy: gained,
      combo: state.combo,
      doubled: cashedDouble,
      at: at,
      round: state.round
    };
    state.deck.push(card);

    var previous = state.requiredLetter;
    state.requiredLetter = AtlasData.lastLetter(entry.word);
    var reset = ensurePlayableLetter(state);

    touch(state, {
      type: "accepted",
      card: card,
      playerId: playerId,
      points: scored.total,
      multiplier: scored.multiplier,
      combo: state.combo,
      energy: player.energy,
      energyGained: gained,
      letter: state.requiredLetter,
      letterReset: reset ? state.letterReset : null
    });
    advance(state, playerId);

    return { ok: true, card: card, points: scored.total, multiplier: scored.multiplier, state: state };
  }

  function pass(state, playerId) {
    if (state.status !== STATUS.PLAYING) return { ok: false, error: "Match is not running" };
    if (state.activeId !== playerId) return { ok: false, error: "Not your turn" };
    var player = playerById(state, playerId);
    if (player.passes <= 0) return { ok: false, error: "No passes left" };

    player.passes -= 1;
    player.streak = 0;
    player.lastAction = "pass";
    player.hint = null;

    // Passing cools the chain by one link — it never lands a card.
    if (state.config.combo && state.combo > 0) {
      state.combo -= 1;
      state.comboBanner = { combo: state.combo, tier: heatFor(state.combo), at: nowMs(), cooled: true };
    }

    touch(state, { type: "passed", playerId: playerId, letter: state.requiredLetter, combo: state.combo });
    advance(state, playerId);
    return { ok: true, state: state };
  }

  /** Called by the host on a timer. Returns { ok, events }. */
  function tick(state, atMs) {
    if (state.status !== STATUS.PLAYING) return { ok: false, state: state };
    var now = atMs || nowMs();
    if (now < state.deadline) return { ok: false, state: state };

    var player = activePlayer(state);
    if (!player) return { ok: false, state: state };

    var events = [];
    player.lastAction = "timeout";
    player.streak = 0;
    player.hint = null;

    // SHIELD eats the strike instead of the player.
    if (player.armed && player.armed.shield) {
      player.armed.shield = false;
      player.shieldsUsed += 1;
      player.lastAction = "shield";
      events.push({ type: "shield_saved", playerId: player.id, name: player.name });
      logPower(state, {
        key: "shield", playerId: player.id, byName: player.name, at: now,
        note: "Shield absorbed the strike", consumed: true
      });
    } else {
      player.strikes += 1;
      events.push({ type: "timeout", playerId: player.id, name: player.name, strikes: player.strikes });
      if (player.strikes >= state.config.strikesToEliminate) {
        player.eliminated = true;
        events.push({ type: "eliminated", playerId: player.id, name: player.name });
      }
    }

    // An armed DOUBLE that times out is wasted — that is the risk you bought.
    if (player.armed && player.armed.double) {
      player.armed.double = false;
      player.shieldsLost += 0;
      spendEnergy(player, state.config.doublePenalty);
      events.push({ type: "double_lost", playerId: player.id, name: player.name });
      logPower(state, {
        key: "double", playerId: player.id, byName: player.name, at: now,
        note: "Double burned — the clock beat you", lost: true
      });
    }

    // A timeout freezes the whole table's chain.
    if (state.config.combo && state.combo > 0) {
      state.combo = 0;
      state.comboBanner = { combo: 0, tier: heatFor(0), at: now, cooled: true };
    }

    touch(state, events[events.length - 1]);
    var result = advance(state, player.id);
    if (result && result.events) events = events.concat(result.events);
    return { ok: true, events: events, state: state };
  }

  // -------------------------------------------------------------- power-ups

  /**
   * Build a masked hint: first letter, one seeded interior letter, the rest as
   * dots. Only the mask is stored in state — the answer itself never crosses
   * the wire, so a guest cannot read it out of a snapshot.
   */
  function maskFor(state, word) {
    var clean = AtlasData.normalize(word).replace(/\s/g, "");
    if (clean.length <= 2) return clean[0] + " \u2022".repeat(Math.max(0, clean.length - 1));
    var revealAt = 1 + Math.floor(nextRandom(state) * (clean.length - 2));
    var out = "";
    for (var i = 0; i < clean.length; i++) {
      out += (i === 0 || i === revealAt) ? clean[i] : "\u2022";
    }
    // Re-insert spacing so multi-word answers stay readable.
    var norm = AtlasData.normalize(word);
    var rebuilt = "";
    var k = 0;
    for (var j = 0; j < norm.length; j++) {
      if (norm[j] === " ") { rebuilt += " "; continue; }
      rebuilt += out[k++];
    }
    return rebuilt;
  }

  /**
   * Read-only power-up status for the UI: what each power costs, whether it is
   * affordable, and why not. Never mutates state.
   */
  function powerStatus(state, playerId) {
    var player = playerById(state, playerId);
    if (!player) return { available: false, energy: 0, powers: [] };
    var isTurn = state.status === STATUS.PLAYING && state.activeId === playerId;
    var cfg = state.config;
    var canSpendThisTurn = player.powersThisTurn < cfg.maxPowersPerTurn;

    var powers = POWER_ORDER.map(function (key) {
      var def = POWERS[key];
      var used = player.powersUsed[key] || 0;
      var armed = !!(player.armed && player.armed[key]);
      var blocked = null;
      if (!cfg.powerups) blocked = "Power-ups are off";
      else if (state.status !== STATUS.PLAYING) blocked = "Match is not running";
      else if (player.eliminated) blocked = "You are out";
      else if (armed) blocked = "Already armed";
      else if (def.needsTurn && !isTurn) blocked = "Your turn only";
      else if (used >= def.limit) blocked = "No charges left";
      else if (!canSpendThisTurn) blocked = "Limit of " + cfg.maxPowersPerTurn + " per turn";
      else if (player.energy < def.cost) blocked = "Needs " + def.cost + " energy";
      else if (key === "freeze" && !isTurn) blocked = "Your turn only";

      return {
        key: key,
        label: def.label,
        glyph: def.glyph,
        blurb: def.blurb,
        cost: def.cost,
        limit: def.limit,
        used: used,
        left: Math.max(0, def.limit - used),
        armed: armed,
        needsTurn: def.needsTurn,
        affordable: !blocked,
        blocked: blocked,
        isTurn: isTurn
      };
    });

    return {
      available: !!cfg.powerups && state.status === STATUS.PLAYING && !player.eliminated,
      energy: player.energy,
      maxEnergy: cfg.maxEnergy,
      isTurn: isTurn,
      powersThisTurn: player.powersThisTurn,
      maxPowersPerTurn: cfg.maxPowersPerTurn,
      combo: state.combo,
      tier: heatFor(state.combo),
      multiplier: multiplierFor(state),
      hint: player.hint || null,
      powers: powers
    };
  }

  /**
   * Spend energy on a power-up. Host-authoritative: guests send an intent and
   * receive the new state back.
   *
   * usePower(state, playerId, "wild", { letter: "K" })
   */
  function usePower(state, playerId, kind, options, atMs) {
    var opts = options || {};
    var at = atMs || nowMs();
    var cfg = state.config;
    var key = String(kind || "").toLowerCase();
    var def = POWERS[key];

    function fail(message, reason) {
      return { ok: false, error: message, reason: reason || "invalid", state: state };
    }

    if (!cfg.powerups) return fail("Power-ups are off for this match", "disabled");
    if (!def) return fail("Unknown power-up", "unknown");
    if (state.status !== STATUS.PLAYING) return fail("Match is not running", "inactive");

    var player = playerById(state, playerId);
    if (!player) return fail("Player not found", "unknown");
    if (player.eliminated) return fail("You are out of this match", "eliminated");

    var isTurn = state.activeId === playerId;
    if (def.needsTurn && !isTurn) return fail("You can only play that on your turn", "not-your-turn");
    if (!def.needsTurn && isTurn && state.deadline - at <= 1200) {
      // Arming a shield with a second left is fine, but never after the buzzer.
      if (at >= state.deadline) return fail("Too late", "late");
    }
    if (at >= state.deadline && isTurn) return fail("Too late — the clock already ran out", "late");

    var used = player.powersUsed[key] || 0;
    if (used >= def.limit) return fail("No " + def.label + " charges left", "exhausted");
    if (player.energy < def.cost) return fail("Not enough energy — " + def.label + " costs " + def.cost, "no-energy");
    if (player.powersThisTurn >= cfg.maxPowersPerTurn) {
      return fail("Only " + cfg.maxPowersPerTurn + " power-ups per turn", "turn-limit");
    }
    if (player.armed && player.armed[key]) return fail(def.label + " is already armed", "armed");

    var effect = { key: key, label: def.label };

    if (key === "hint") {
      var pool = unusedFor(state, state.requiredLetter);
      if (!pool.length) return fail("Nothing left for " + state.requiredLetter, "dead-letter");
      var target = pickFrom(state, pool);
      var pattern = maskFor(state, target);
      effect.pattern = pattern;
      effect.length = AtlasData.normalize(target).replace(/\s/g, "").length;
      effect.candidates = pool.length;
      player.hint = { pattern: pattern, letter: state.requiredLetter, count: pool.length, at: at };

    } else if (key === "freeze") {
      if (at >= state.deadline) return fail("Too late to freeze the clock", "late");
      var added = cfg.freezeSeconds * 1000;
      state.turnBudgetMs += added;
      state.deadline += added;
      effect.addedSeconds = cfg.freezeSeconds;
      effect.deadline = state.deadline;
      effect.budgetMs = state.turnBudgetMs;

    } else if (key === "double") {
      player.armed.double = true;
      effect.armed = "double";

    } else if (key === "wild") {
      var letter = String(opts.letter || "").toUpperCase().replace(/[^A-Z]/g, "")[0] || "";
      if (!letter) return fail("Pick a letter", "no-letter");
      if (letter === state.requiredLetter) return fail("That is already the letter", "same-letter");
      if (!hasUnusedLetter(state, letter)) {
        return fail("No answers left for " + letter, "dead-letter");
      }
      var from = state.requiredLetter;
      state.requiredLetter = letter;
      state.letterReset = { from: from, to: letter, at: at, wild: true, byId: player.id, byName: player.name };
      player.hint = null;
      effect.from = from;
      effect.to = letter;

    } else if (key === "shield") {
      player.armed.shield = true;
      effect.armed = "shield";
    }

    spendEnergy(player, def.cost);
    player.powersUsed[key] = used + 1;
    player.powersThisTurn += 1;
    player.powerCount += 1;

    var entry = {
      key: key,
      label: def.label,
      glyph: def.glyph,
      playerId: player.id,
      byName: player.name,
      cost: def.cost,
      at: at,
      effect: effect,
      note: powerNote(key, effect, player)
    };
    logPower(state, entry);

    touch(state, {
      type: "power",
      power: key,
      playerId: player.id,
      name: player.name,
      cost: def.cost,
      energy: player.energy,
      effect: effect,
      letter: state.requiredLetter
    });

    return { ok: true, power: key, cost: def.cost, energy: player.energy, effect: effect, state: state };
  }

  function powerNote(key, effect, player) {
    switch (key) {
      case "hint": return "Hint · " + effect.pattern;
      case "freeze": return "Clock frozen +" + effect.addedSeconds + "s";
      case "double": return player.name + " armed a double";
      case "wild": return "Letter swapped " + effect.from + " \u2192 " + effect.to;
      case "shield": return player.name + " raised a shield";
      default: return key;
    }
  }

  /**
   * Move to the next surviving player. `finishedId` is the player whose turn just
   * ended; once every surviving player has finished a turn, the round advances.
   */
  function advance(state, finishedId) {
    var finished = finishedId ? playerById(state, finishedId) : null;
    if (finished) state.roundSeen[finished.id] = true;

    var alive = alivePlayers(state);
    if (alive.length === 0) return endMatch(state, null);
    if (alive.length === 1) return endMatch(state, alive[0].id);

    // Round complete when every survivor has taken a turn this round.
    var everyonePlayed = alive.every(function (p) { return state.roundSeen[p.id]; });
    if (everyonePlayed) {
      if (state.round >= state.config.maxRounds) return endMatch(state, bestPlayerId(state));
      state.round += 1;
      state.roundSeen = {};
      state.roundBanner = { round: state.round, at: nowMs() };
    }

    var from = finished ? state.players.indexOf(finished) : -1;
    var start = from === -1 ? 0 : from;
    var next = null;
    for (var step = 1; step <= state.players.length; step++) {
      var candidate = state.players[(start + step) % state.players.length];
      if (!candidate.eliminated) { next = candidate; break; }
    }
    if (!next) return endMatch(state, alive[0].id);

    // Per-turn power budget and hints reset with the turn.
    next.powersThisTurn = 0;
    next.hint = null;

    state.activeId = next.id;
    state.turn += 1;
    state.turnStartAt = nowMs();
    state.turnBudgetMs = state.turnSeconds * 1000;
    state.deadline = state.turnStartAt + state.turnBudgetMs;
    touch(state, { type: "turn", playerId: next.id, name: next.name, letter: state.requiredLetter });
    return { ok: true, events: [{ type: "turn", playerId: next.id }] };
  }

  function bestPlayerId(state) {
    var ranked = rank(state);
    return ranked.length ? ranked[0].id : null;
  }

  function endMatch(state, winnerId) {
    state.status = STATUS.MATCH_END;
    state.winnerId = winnerId || null;
    state.activeId = null;
    state.deadline = 0;
    state.powerBanner = null;
    touch(state, { type: "match_end", winnerId: state.winnerId });
    return { ok: true, events: [{ type: "match_end", winnerId: state.winnerId }], state: state };
  }

  /** Ranked standings: score, then best streak, then best combo, then words, then seat. */
  function rank(state) {
    return state.players
      .map(function (p) { return Object.assign({}, p); })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
        if ((b.maxCombo || 0) !== (a.maxCombo || 0)) return (b.maxCombo || 0) - (a.maxCombo || 0);
        if (b.words !== a.words) return b.words - a.words;
        return a.seat - b.seat;
      });
  }

  function standings(state) {
    return rank(state).map(function (p, i) {
      return Object.assign({}, p, { place: i + 1 });
    });
  }

  function remainingMs(state, atMs) {
    if (state.status !== STATUS.PLAYING) return 0;
    return Math.max(0, state.deadline - (atMs || nowMs()));
  }

  function remainingSeconds(state, atMs) {
    return Math.ceil(remainingMs(state, atMs) / 1000);
  }

  /** Budget for the current turn, including any FREEZE time bought. */
  function turnBudgetMs(state) {
    return state.turnBudgetMs || state.turnSeconds * 1000;
  }

  function summary(state) {
    var ranked = standings(state);
    return {
      code: state.code,
      category: state.category,
      round: state.round,
      status: state.status,
      winner: ranked[0] ? ranked[0].name : null,
      comboBest: state.comboBest || 0,
      standings: ranked.map(function (p) {
        return {
          name: p.name,
          score: p.score,
          words: p.words,
          bestStreak: p.bestStreak,
          maxCombo: p.maxCombo || 0,
          energyEarned: p.energyEarned || 0,
          energySpent: p.energySpent || 0,
          powers: p.powerCount || 0,
          place: p.place
        };
      })
    };
  }

  return {
    STATUS: STATUS,
    DEFAULTS: DEFAULTS,
    LETTERS: LETTERS,
    POWERS: POWERS,
    POWER_ORDER: POWER_ORDER,
    COMBO_TIERS: COMBO_TIERS,
    DIFFICULTIES: DIFFICULTIES,
    createMatch: createMatch,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    setPlayer: setPlayer,
    setReady: setReady,
    start: start,
    submit: submit,
    pass: pass,
    tick: tick,
    validate: validate,
    usePower: usePower,
    powerStatus: powerStatus,
    heatFor: heatFor,
    multiplierFor: multiplierFor,
    energyFor: energyFor,
    scoreFor: scoreFor,
    maskFor: maskFor,
    unusedFor: unusedFor,
    playableLetters: playableLetters,
    rank: rank,
    standings: standings,
    remainingMs: remainingMs,
    remainingSeconds: remainingSeconds,
    turnBudgetMs: turnBudgetMs,
    playerById: playerById,
    activePlayer: activePlayer,
    alivePlayers: alivePlayers,
    isActive: isActive,
    endMatch: endMatch,
    summary: summary,
    clone: clone,
    randomCode: randomCode,
    hashSeed: hashSeed,
    nextRandom: nextRandom,
    pickStartLetter: pickStartLetter,
    hasUnusedLetter: hasUnusedLetter,
    ensurePlayableLetter: ensurePlayableLetter,
    normalize: AtlasData.normalize
  };
});
