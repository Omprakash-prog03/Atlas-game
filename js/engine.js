/**
 * ATLAS — game engine
 *
 * Pure, serializable, host-authoritative match logic. No DOM, no timers,
 * no randomness that can't be seeded: the same action produces the same state,
 * which is what lets the host broadcast state and guests replay it safely.
 *
 * Rules implemented here:
 *  - A word must start with the required letter, exist in the category bank and
 *    never repeat inside a match.
 *  - A round is one full trip around the table (every surviving player played).
 *  - Answer before the deadline or take a strike. Three strikes eliminate you.
 *  - Passing keeps the letter, costs one pass.
 *  - The match ends when one player is left, or when the round cap is reached;
 *    then the highest score wins (ties: best streak, then most words).
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
    maxPlayers: 10
  };

  var STATUS = {
    LOBBY: "lobby",
    PLAYING: "playing",
    ROUND_END: "round_end",
    MATCH_END: "match_end"
  };

  var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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

  function config(input) {
    var cfg = Object.assign({}, DEFAULTS, input || {});
    cfg.category = AtlasData.categories[cfg.category] ? cfg.category : DEFAULTS.category;
    cfg.turnSeconds = clamp(Number(cfg.turnSeconds) || DEFAULTS.turnSeconds, 5, 120);
    cfg.maxPasses = clamp(Number(cfg.maxPasses), 0, 9);
    cfg.strikesToEliminate = clamp(Number(cfg.strikesToEliminate) || 3, 1, 5);
    cfg.maxRounds = clamp(Number(cfg.maxRounds) || DEFAULTS.maxRounds, 3, 40);
    return cfg;
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
      lastAction: null
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

  /** True when at least one unused answer exists for this letter. */
  function hasUnusedLetter(state, letter) {
    var pool = AtlasData.wordsFor(state.category, letter);
    for (var i = 0; i < pool.length; i++) {
      if (!state.used[AtlasData.normalize(pool[i])]) return true;
    }
    return false;
  }

  /**
   * A chain can run dry: every answer for the required letter may already be on
   * the table. Punishing players for a dead deck is unfair, so the deck opens a
   * fresh chain instead (and the UI announces it).
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

    var next = candidates[Math.floor(Math.random() * candidates.length)];
    state.requiredLetter = next;
    state.letterReset = { from: from, to: next, at: nowMs() };
    return true;
  }

  function createMatch(options) {
    var cfg = config(options);
    var state = {
      id: uid("m"),
      code: (options && options.code) || randomCode(5),
      mode: (options && options.mode) || "solo", // 'solo' | 'host' | 'guest'
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
      turnSeconds: cfg.turnSeconds,
      winnerId: null,
      roundSeen: {},     // player ids that already played this round
      roundBanner: null, // {round, at} transient signal for the UI
      letterReset: null, // {from, to, at} set when the deck opens a fresh chain
      lastEvent: null,
      version: 0,
      createdAt: nowMs(),
      updatedAt: nowMs()
    };

    if (options && Array.isArray(options.players)) {
      options.players.forEach(function (p, i) {
        var player = makePlayer(i);
        Object.assign(player, p, { seat: i, id: p.id || player.id });
        player.passes = cfg.maxPasses;
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

    state.players.forEach(function (p) {
      p.score = 0;
      p.words = 0;
      p.strikes = 0;
      p.streak = 0;
      p.bestStreak = 0;
      p.eliminated = false;
      p.passes = state.config.maxPasses;
      p.lastAction = null;
    });

    state.startingLetter = opts.letter || pickStartLetter(state.category, opts.rng);
    state.requiredLetter = state.startingLetter;
    state.activeId = state.players[0] ? state.players[0].id : null;
    state.turn = 1;
    state.turnSeconds = state.config.turnSeconds;
    state.deadline = nowMs() + state.turnSeconds * 1000;

    // Pre-mark players whose turn hasn't come yet; the active player is added
    // to roundSeen only once their turn completes.
    state.roundSeen = {};
    touch(state, { type: "match_started", letter: state.requiredLetter });
    return { ok: true, state: state };
  }

  var MILESTONES = { 3: 5, 5: 10, 10: 20 };

  function scoreFor(state, word, player, remainingMs) {
    var base = 10;
    var ratio = state.turnSeconds > 0 ? remainingMs / (state.turnSeconds * 1000) : 0;
    var speed = ratio >= 0.66 ? 5 : ratio >= 0.33 ? 3 : ratio >= 0.08 ? 1 : 0;

    var nextStreak = player.streak + 1;
    var streak = MILESTONES[nextStreak] || 0;

    var len = AtlasData.normalize(word).replace(/\s/g, "").length;
    var length = len >= 10 ? 4 : len >= 8 ? 3 : len >= 6 ? 2 : 0;

    return { base: base, speed: speed, streak: streak, length: length, total: base + speed + streak + length, nextStreak: nextStreak };
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

  function submit(state, playerId, rawWord, atMs) {
    var check = validate(state, playerId, rawWord, atMs);
    if (check.status !== "ok") {
      return { ok: false, error: check.message, reason: check.status, suggestion: check.suggestion || null, state: state };
    }

    var player = playerById(state, playerId);
    var entry = check.entry;
    var scored = scoreFor(state, entry.word, player, check.remaining);

    player.score += scored.total;
    player.words += 1;
    player.streak = scored.nextStreak;
    player.bestStreak = Math.max(player.bestStreak, player.streak);
    player.lastAction = "word";

    state.used[entry.norm] = true;
    var card = {
      word: entry.word,
      norm: entry.norm,
      emoji: entry.emoji,
      note: entry.note,
      byId: player.id,
      byName: player.name,
      points: scored.total,
      breakdown: { base: scored.base, speed: scored.speed, streak: scored.streak, length: scored.length },
      at: atMs || nowMs(),
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
      letter: state.requiredLetter,
      letterReset: reset ? state.letterReset : null
    });
    advance(state, playerId);

    return { ok: true, card: card, points: scored.total, state: state };
  }

  function pass(state, playerId) {
    if (state.status !== STATUS.PLAYING) return { ok: false, error: "Match is not running" };
    if (state.activeId !== playerId) return { ok: false, error: "Not your turn" };
    var player = playerById(state, playerId);
    if (player.passes <= 0) return { ok: false, error: "No passes left" };

    player.passes -= 1;
    player.streak = 0;
    player.lastAction = "pass";
    touch(state, { type: "passed", playerId: playerId, letter: state.requiredLetter });
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

    player.strikes += 1;
    player.streak = 0;
    player.lastAction = "timeout";

    var events = [{ type: "timeout", playerId: player.id, name: player.name, strikes: player.strikes }];
    if (player.strikes >= state.config.strikesToEliminate) {
      player.eliminated = true;
      events.push({ type: "eliminated", playerId: player.id, name: player.name });
    }

    touch(state, events[events.length - 1]);
    var result = advance(state, player.id);
    if (result && result.events) events = events.concat(result.events);
    return { ok: true, events: events, state: state };
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

    state.activeId = next.id;
    state.turn += 1;
    state.deadline = nowMs() + state.turnSeconds * 1000;
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
    touch(state, { type: "match_end", winnerId: state.winnerId });
    return { ok: true, events: [{ type: "match_end", winnerId: state.winnerId }], state: state };
  }

  /** Ranked standings: score, then best streak, then words, then seat. */
  function rank(state) {
    return state.players
      .map(function (p) { return Object.assign({}, p); })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
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

  function summary(state) {
    var ranked = standings(state);
    return {
      code: state.code,
      category: state.category,
      round: state.round,
      status: state.status,
      winner: ranked[0] ? ranked[0].name : null,
      standings: ranked.map(function (p) {
        return { name: p.name, score: p.score, words: p.words, bestStreak: p.bestStreak, place: p.place };
      })
    };
  }

  return {
    STATUS: STATUS,
    DEFAULTS: DEFAULTS,
    LETTERS: LETTERS,
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
    rank: rank,
    standings: standings,
    remainingMs: remainingMs,
    remainingSeconds: remainingSeconds,
    playerById: playerById,
    activePlayer: activePlayer,
    alivePlayers: alivePlayers,
    isActive: isActive,
    endMatch: endMatch,
    summary: summary,
    clone: clone,
    randomCode: randomCode,
    pickStartLetter: pickStartLetter,
    hasUnusedLetter: hasUnusedLetter,
    ensurePlayableLetter: ensurePlayableLetter,
    normalize: AtlasData.normalize
  };
});
