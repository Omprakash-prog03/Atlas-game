/**
 * ATLAS — local profile, stats and ranking
 *
 * Everything lives in localStorage: no account, no server, no tracking.
 * The ranking screen reads these numbers; a match writes to them once.
 */
(function (root) {
  "use strict";

  var KEY = "atlas.profile.v1";
  var MAX_HISTORY = 30;

  var AVATARS = ["🧭", "🦅", "🐅", "🌵", "🪐", "🏺", "🦁", "🌊", "🐫", "🗿", "🦚", "🎬"];

  function defaults() {
    return {
      name: "Player",
      avatar: AVATARS[0],
      sound: true,
      haptics: true,
      liveValidation: true,
      onboarded: false,
      stats: { matches: 0, wins: 0, points: 0, bestScore: 0, bestStreak: 0, words: 0 },
      categories: {},
      history: []
    };
  }

  var cache = null;

  function read() {
    if (cache) return cache;
    var data = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          data = Object.assign(data, parsed);
          data.stats = Object.assign(defaults().stats, parsed.stats || {});
          data.categories = parsed.categories && typeof parsed.categories === "object" ? parsed.categories : {};
          data.history = Array.isArray(parsed.history) ? parsed.history.slice(0, MAX_HISTORY) : [];
        }
      }
    } catch (e) {
      // Storage can be blocked (private mode, quota). Fall back to memory.
    }
    cache = data;
    return cache;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(read()));
    } catch (e) {}
    return read();
  }

  function update(patch) {
    var data = Object.assign(read(), patch || {});
    cache = data;
    return save();
  }

  function setStat(patch) {
    var stats = Object.assign(read().stats, patch);
    return update({ stats: stats });
  }

  function level() {
    var points = read().stats.points;
    return Math.max(1, Math.floor(Math.sqrt(points / 60)) + 1);
  }

  function levelProgress() {
    var points = read().stats.points;
    var lvl = level();
    var floorPts = Math.pow(lvl - 1, 2) * 60;
    var nextPts = Math.pow(lvl, 2) * 60;
    var span = Math.max(1, nextPts - floorPts);
    return {
      level: lvl,
      points: points,
      current: Math.max(0, points - floorPts),
      needed: span,
      pct: Math.min(100, Math.round(((points - floorPts) / span) * 100))
    };
  }

  function bestFor(category) {
    var entry = read().categories[category];
    return entry ? entry.best || 0 : 0;
  }

  /**
   * Result shape:
   * { category, score, place, players, words, bestStreak, won, mode }
   */
  function recordMatch(result) {
    var data = read();
    var r = result || {};
    var category = r.category || "PLACES";

    data.stats.matches += 1;
    if (r.won) data.stats.wins += 1;
    data.stats.points += Math.max(0, r.score || 0);
    data.stats.bestScore = Math.max(data.stats.bestScore, r.score || 0);
    data.stats.bestStreak = Math.max(data.stats.bestStreak, r.bestStreak || 0);
    data.stats.words += Math.max(0, r.words || 0);

    var cat = data.categories[category] || { matches: 0, wins: 0, best: 0, points: 0 };
    cat.matches += 1;
    if (r.won) cat.wins += 1;
    cat.points += Math.max(0, r.score || 0);
    cat.best = Math.max(cat.best || 0, r.score || 0);
    data.categories[category] = cat;

    data.history.unshift({
      at: Date.now(),
      category: category,
      score: r.score || 0,
      place: r.place || 0,
      players: r.players || 1,
      words: r.words || 0,
      won: !!r.won,
      mode: r.mode || "solo"
    });
    data.history = data.history.slice(0, MAX_HISTORY);

    cache = data;
    save();
    return data;
  }

  function rankings() {
    var data = read();
    var cats = Object.keys(data.categories).map(function (key) {
      return {
        category: key,
        best: data.categories[key].best || 0,
        matches: data.categories[key].matches || 0,
        wins: data.categories[key].wins || 0
      };
    }).sort(function (a, b) { return b.best - a.best; });
    return { stats: data.stats, categories: cats, history: data.history.slice(0, 10) };
  }

  function reset() {
    cache = defaults();
    cache.onboarded = true;
    save();
    return read();
  }

  function completeOnboarding() {
    return update({ onboarded: true });
  }

  root.AtlasProfile = {
    AVATARS: AVATARS,
    KEY: KEY,
    read: read,
    save: save,
    update: update,
    setStat: setStat,
    level: level,
    levelProgress: levelProgress,
    bestFor: bestFor,
    recordMatch: recordMatch,
    rankings: rankings,
    reset: reset,
    completeOnboarding: completeOnboarding
  };
})(typeof window !== "undefined" ? window : globalThis);
