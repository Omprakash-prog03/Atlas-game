#!/usr/bin/env node
/**
 * ATLAS — engine unit tests (node --test scripts/test-engine.mjs)
 *
 * These cover the rules that were previously wrong: turn order across
 * eliminations, round counting, no-repeat enforcement, live validation,
 * deadline handling, scoring and match end.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Engine = require("../js/engine.js");
const Data = require("../js/datasets.js");

function players(n) {
  return Array.from({ length: n }, (_, i) => ({ name: "P" + (i + 1) }));
}

function newMatch(n = 3, cfg = {}) {
  const state = Engine.createMatch({
    category: "PLACES",
    turnSeconds: 20,
    maxPasses: 3,
    players: players(n),
    ...cfg
  });
  return state;
}

function startMatch(n = 3, cfg = {}) {
  const state = newMatch(n, cfg);
  Engine.start(state, { letter: "A" });
  return state;
}

function answer(state, word, atMs) {
  const active = Engine.activePlayer(state);
  return Engine.submit(state, active.id, word, atMs);
}

const answersFor = (letter, category = "PLACES") => Data.wordsFor(category, letter);

test("datasets have answers for every letter that can be required", () => {
  for (const cat of Data.list()) {
    for (const word of Data.categories[cat.key].words) {
      const end = Data.lastLetter(word);
      assert.ok(
        Data.wordsFor(cat.key, end).length > 0,
        `${cat.key}: "${word}" ends with ${end} but has no continuation`
      );
    }
  }
});

test("match starts in the lobby and refuses answers before start", () => {
  const state = newMatch(3);
  assert.equal(state.status, "lobby");
  const res = Engine.submit(state, state.players[0].id, "AFRICA");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "inactive");
});

test("starting letter always has answers", () => {
  for (const cat of Object.keys(Data.categories)) {
    for (let i = 0; i < 40; i++) {
      const letter = Engine.pickStartLetter(cat, () => i / 40);
      assert.ok(Data.wordsFor(cat, letter).length >= 3, `${cat}: start letter ${letter} too thin`);
    }
  }
});

test("only the active player can answer", () => {
  const state = startMatch(3);
  const notActive = state.players[1].id;
  const res = Engine.submit(state, notActive, answersFor("A")[0]);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "not-your-turn");
});

test("wrong starting letter is rejected and consumes no turn", () => {
  const state = createMatchWithLetter("A");
  const res = Engine.submit(state, state.activeId, "JAPAN");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "wrong-letter");
  assert.equal(state.turn, 1);
  assert.equal(state.deck.length, 0);
});

function createMatchWithLetter(letter) {
  const state = newMatch(3);
  Engine.start(state, { letter });
  return state;
}

test("unknown words are rejected with a suggestion when close", () => {
  const state = createMatchWithLetter("T");
  const real = Data.wordsFor("PLACES", "T").find((w) => w === "TAJ MAHAL");
  assert.ok(real, "TAJ MAHAL missing from PLACES");
  const res = Engine.submit(state, state.activeId, "TAJ MAHALL");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "unknown");
  assert.equal(res.suggestion, "TAJ MAHAL");
});

test("accepted word advances the letter, the turn and the score", () => {
  const state = createMatchWithLetter("A");
  const first = state.activeId;
  const res = Engine.submit(state, first, "AFRICA");
  assert.equal(res.ok, true);
  assert.equal(state.requiredLetter, "A");
  assert.equal(state.deck.length, 1);
  assert.equal(state.deck[0].word, "AFRICA");
  assert.notEqual(state.activeId, first);
  assert.ok(state.players[0].score >= 10);
  assert.equal(state.players[0].words, 1);
});

test("no repetition inside a match", () => {
  const state = createMatchWithLetter("A");
  assert.equal(Engine.submit(state, state.activeId, "AFRICA").ok, true);
  assert.equal(Engine.submit(state, state.activeId, "ASIA").ok, true);
  assert.equal(Engine.submit(state, state.activeId, "AMERICA").ok, true);
  assert.equal(state.round, 2, "three players -> round 2");
  const again = Engine.submit(state, state.activeId, "AFRICA");
  assert.equal(again.ok, false);
  assert.equal(again.reason, "used");
  assert.equal(state.used.AFRICA, true);
});

test("used-word rejection happens before bank lookup", () => {
  const state = createMatchWithLetter("A");
  Engine.submit(state, state.activeId, "AFRICA");  // ends A
  Engine.submit(state, state.activeId, "ASIA");    // ends A
  Engine.submit(state, state.activeId, "AMERICA"); // round 2: p1 again, letter A
  const res = Engine.submit(state, state.activeId, "AFRICA");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "used");
});

test("a round is one full trip around the table", () => {
  const state = createMatchWithLetter("A");
  assert.equal(state.round, 1);
  Engine.submit(state, state.activeId, "AFRICA");
  assert.equal(state.round, 1);
  Engine.submit(state, state.activeId, "AMERICA");
  assert.equal(state.round, 1);
  Engine.submit(state, state.activeId, "ASIA");
  assert.equal(state.round, 2, "round increments only after every player played");
  assert.equal(state.players[0].id, state.activeId);
});

test("eliminated players are skipped and do not count for rounds", () => {
  const state = startMatch(3);
  const victim = state.players[1];
  victim.eliminated = true;
  // p1 plays, should skip p2 and go to p3
  const pick = () => Data.wordsFor("PLACES", state.requiredLetter).find((w) => !state.used[w]);
  const res = answer(state, pick());
  assert.equal(res.ok, true);
  assert.equal(state.activeId, state.players[2].id);
  // p3 plays, everybody alive (p1, p3) has played -> round 2
  const res2 = answer(state, pick());
  assert.equal(res2.ok, true);
  assert.equal(state.round, 2);
  assert.equal(state.activeId, state.players[0].id);
});

test("timeout gives a strike and passes the turn", () => {
  const state = startMatch(3);
  const first = state.activeId;
  const late = state.deadline + 5;
  const res = Engine.tick(state, late);
  assert.equal(res.ok, true);
  const p1 = Engine.playerById(state, first);
  assert.equal(p1.strikes, 1);
  assert.notEqual(state.activeId, first);
  assert.equal(state.round, 1);
});

test("three strikes eliminate a player and reduce the field", () => {
  const state = startMatch(2);
  const victim = state.players[0];
  const other = state.players[1];
  // Force the victim to be active and time out three times.
  for (let i = 1; i <= 3; i++) {
    state.activeId = victim.id;
    state.deadline = Date.now() - 1;
    Engine.tick(state, Date.now());
  }
  assert.equal(victim.eliminated, true);
  assert.equal(state.status, "match_end");
  assert.equal(state.winnerId, other.id);
});

test("passes keep the letter and are limited", () => {
  const state = createMatchWithLetter("J");
  const letter = state.requiredLetter;
  const first = state.activeId;
  const res = Engine.pass(state, first);
  assert.equal(res.ok, true);
  assert.equal(state.requiredLetter, letter);
  assert.equal(Engine.playerById(state, first).passes, 2);

  // exhaust passes by forcing turns back to p1
  const p1 = Engine.playerById(state, first);
  p1.passes = 0;
  state.activeId = p1.id;
  const denied = Engine.pass(state, p1.id);
  assert.equal(denied.ok, false);
  assert.match(denied.error, /No passes/i);
});

test("answer after the deadline is rejected", () => {
  const state = createMatchWithLetter("A");
  const res = Engine.submit(state, state.activeId, "AFRICA", state.deadline + 1);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "late");
});

test("speed bonus favours fast answers", () => {
  const fast = createMatchWithLetter("A");
  const fastRes = Engine.submit(fast, fast.activeId, "AFRICA");
  const slow = createMatchWithLetter("A");
  const slowRes = Engine.submit(slow, slow.activeId, "AFRICA", slow.deadline - 1);
  assert.ok(fastRes.points > slowRes.points, `${fastRes.points} should beat ${slowRes.points}`);
  assert.equal(fastRes.card.breakdown.speed, 5);
});

test("longer words score a length bonus", () => {
  const state = createMatchWithLetter("A");
  const short = Engine.submit(state, state.activeId, "ALPS");
  const state2 = createMatchWithLetter("A");
  const long = Engine.submit(state2, state2.activeId, "ATLANTIC OCEAN");
  assert.ok(long.points > short.points);
});

test("streak milestones award bonus points", () => {
  const state = createMatchWithLetter("A");
  const p1 = state.players[0];
  p1.streak = 2; // next word is the third in a row
  const res = Engine.submit(state, state.activeId, "AFRICA");
  assert.equal(res.ok, true);
  assert.equal(res.card.breakdown.streak, 5);
});

test("match ends when only one player survives", () => {
  const state = startMatch(3);
  state.players[1].eliminated = true;
  state.players[2].eliminated = true;
  state.activeId = state.players[0].id;
  state.deadline = Date.now() - 1;
  Engine.tick(state, Date.now());
  assert.equal(state.status, "match_end");
  assert.equal(state.winnerId, state.players[0].id);
});

test("round cap ends the match on the highest score", () => {
  const state = startMatch(2, { maxRounds: 3, category: "FOOD" });
  let guard = 0;
  while (state.status === "playing" && guard++ < 40) {
    const pool = Data.wordsFor("FOOD", state.requiredLetter).filter((w) => !state.used[w]);
    if (!pool.length) {
      Engine.tick(state, state.deadline + 1);
      continue;
    }
    const res = Engine.submit(state, state.activeId, pool[0]);
    if (!res.ok) Engine.tick(state, state.deadline + 1);
  }
  assert.ok(guard < 40, "match did not end");
  assert.equal(state.status, "match_end");
  const ranked = Engine.standings(state);
  assert.equal(ranked[0].id, state.winnerId);
  assert.equal(state.round, 3);
});

test("standings rank by score, then streak, then words", () => {
  const state = startMatch(3);
  state.players[0].score = 10;
  state.players[1].score = 30;
  state.players[2].score = 30;
  state.players[2].bestStreak = 4;
  const ranked = Engine.standings(state);
  assert.equal(ranked[0].id, state.players[2].id);
  assert.equal(ranked[1].id, state.players[1].id);
  assert.equal(ranked[2].id, state.players[0].id);
  assert.deepEqual(ranked.map((p) => p.place), [1, 2, 3]);
});

test("a removed player does not stall the match", () => {
  const state = startMatch(3);
  const active = state.activeId;
  Engine.removePlayer(state, active);
  assert.equal(state.status, "playing");
  assert.ok(state.activeId);
  assert.notEqual(state.activeId, active);
});

test("state is JSON round-trippable (needed for network sync)", () => {
  const state = startMatch(3);
  answer(state, answersFor(state.requiredLetter)[0]);
  const copy = JSON.parse(JSON.stringify(state));
  assert.deepEqual(Engine.standings(copy).map((p) => p.score), Engine.standings(state).map((p) => p.score));
  assert.equal(copy.deck[0].word, state.deck[0].word);
});

test("live validation reports every failure mode", () => {
  const state = createMatchWithLetter("G");
  const me = state.activeId;
  assert.equal(Engine.validate(state, me, "").status, "empty");
  assert.equal(Engine.validate(state, me, "ZEBRA").status, "wrong-letter");
  assert.equal(Engine.validate(state, me, "GOBII").status, "unknown");
  assert.equal(Engine.validate(state, state.players[1].id, "GOBI").status, "not-your-turn");
  assert.equal(Engine.validate(state, me, "GOBI").status, "ok");
  state.used.GOBI = true;
  assert.equal(Engine.validate(state, me, "GOBI").status, "used");
});

test("every category can be played for at least 12 turns without dead ends", () => {
  for (const cat of Object.keys(Data.categories)) {
    const state = Engine.createMatch({
      category: cat,
      turnSeconds: 30,
      players: players(3)
    });
    Engine.start(state);
    let turns = 0;
    let guard = 0;
    while (state.status === "playing" && turns < 12 && guard++ < 200) {
      const pool = Data.wordsFor(cat, state.requiredLetter).filter((w) => !state.used[w]);
      if (!pool.length) {
        // A dry letter is impossible now: the engine opens a fresh chain.
        assert.fail(`${cat}: dead letter ${state.requiredLetter} after ${turns} turns`);
      }
      const res = Engine.submit(state, state.activeId, pool[0]);
      if (res.ok) turns++;
      else Engine.tick(state, state.deadline + 1);
    }
    assert.ok(turns >= 12, `${cat} stalled after ${turns} turns`);
  }
});

test("a dry letter opens a fresh chain instead of stalling", () => {
  const state = Engine.createMatch({ category: "FOOD", turnSeconds: 30, players: players(3) });
  Engine.start(state, { letter: "Z" });

  // Burn every FOOD answer that starts with T, then play a word ending in T.
  Data.wordsFor("FOOD", "T").forEach((word) => { state.used[Data.normalize(word)] = true; });
  assert.equal(Engine.hasUnusedLetter(state, "T"), false);

  const res = Engine.submit(state, state.activeId, "ZEST");
  assert.equal(res.ok, true);
  assert.ok(state.letterReset, "no fresh chain was opened");
  assert.equal(state.letterReset.from, "T");
  assert.notEqual(state.requiredLetter, "T");
  assert.equal(Engine.hasUnusedLetter(state, state.requiredLetter), true,
    `letter ${state.requiredLetter} has no answers left`);
});

test("a playable letter is left alone", () => {
  const state = Engine.createMatch({ category: "FOOD", turnSeconds: 30, players: players(2) });
  Engine.start(state, { letter: "Z" });
  assert.equal(Engine.ensurePlayableLetter(state), false, "Z still has ZEST and ZUCCHINI");
  assert.equal(state.letterReset, null);

  Data.wordsFor("FOOD", "Z").forEach((word) => { state.used[Data.normalize(word)] = true; });
  assert.equal(Engine.ensurePlayableLetter(state), true);
  assert.ok(state.letterReset);
  assert.equal(state.letterReset.from, "Z");
  assert.equal(Engine.hasUnusedLetter(state, state.requiredLetter), true);
});

// ===========================================================================
// v4 — combo economy and power-ups
// ===========================================================================

function econMatch(cfg = {}) {
  const state = Engine.createMatch({
    category: "PLACES",
    turnSeconds: 20,
    startEnergy: 3,
    players: players(2),
    seed: "TEST-SEED",
    ...cfg
  });
  Engine.start(state, { letter: "A" });
  return state;
}

const give = (state, id, energy) => { Engine.playerById(state, id).energy = energy; };

test("players start with the configured energy and the economy can be disabled", () => {
  const on = econMatch();
  assert.equal(on.players[0].energy, 3);
  assert.equal(on.config.powerups, true);
  const off = Engine.createMatch({ players: players(2), powerups: false, combo: false });
  assert.equal(off.config.powerups, false);
  assert.equal(off.config.combo, false);
});

test("combo stays x1 for the first two links and climbs at three", () => {
  const state = econMatch();
  assert.equal(Engine.multiplierFor(state), 1);
  const first = Engine.submit(state, state.activeId, "AFRICA");
  assert.equal(first.multiplier, 1, "first card must score honestly");
  assert.equal(state.combo, 1);
  Engine.submit(state, state.activeId, "ASIA");
  assert.equal(Engine.multiplierFor(state), 1);
  const third = Engine.submit(state, state.activeId, "AMERICA");
  assert.equal(third.multiplier, 1.25);
  assert.equal(Engine.heatFor(state.combo).name, "Warming");
});

test("combo multiplier actually scales the card total", () => {
  const cold = econMatch();
  const coldRes = Engine.submit(cold, cold.activeId, "ATLANTIC OCEAN");
  const hot = econMatch();
  hot.combo = 8;
  const hotRes = Engine.submit(hot, hot.activeId, "ATLANTIC OCEAN");
  assert.ok(hotRes.points > coldRes.points, `${hotRes.points} should beat ${coldRes.points}`);
  assert.equal(hotRes.multiplier, 2);
  assert.equal(hotRes.card.breakdown.comboMultiplier, 2);
  assert.equal(hotRes.card.breakdown.raw, coldRes.card.breakdown.raw);
});

test("a timeout freezes the chain and a pass cools it by one", () => {
  const state = econMatch();
  Engine.submit(state, state.activeId, "AFRICA");
  Engine.submit(state, state.activeId, "ASIA");
  assert.equal(state.combo, 2);
  state.deadline = Date.now() - 1;
  Engine.tick(state, Date.now());
  assert.equal(state.combo, 0, "timeout must freeze the chain");

  const p = econMatch();
  Engine.submit(p, p.activeId, "AFRICA");
  Engine.submit(p, p.activeId, "ASIA");
  Engine.pass(p, p.activeId);
  assert.equal(p.combo, 1, "pass cools by exactly one link");
});

test("accepted cards charge energy and the meter is capped", () => {
  const state = econMatch({ maxEnergy: 6, startEnergy: 5 });
  const me = state.players[0];
  Engine.submit(state, state.activeId, "ATLANTIC OCEAN"); // fast + long + no heat
  assert.ok(me.energy > 5, "a good card must charge energy");
  assert.ok(me.energy <= 6, "energy must respect the cap");
  assert.ok(me.energyEarned >= 1);
});

test("hint reveals a mask without leaking the answer", () => {
  const state = econMatch({ startEnergy: 5 });
  const me = state.players[0];
  const res = Engine.usePower(state, me.id, "hint");
  assert.equal(res.ok, true);
  assert.ok(res.effect.pattern.includes("\u2022"), "pattern must be masked");
  assert.equal(res.effect.pattern[0], state.requiredLetter);
  assert.equal(me.energy, 2, "hint costs 3");
  assert.equal(me.powersUsed.hint, 1);
  // The state must not contain the revealed word.
  const leaked = Data.wordsFor("PLACES", state.requiredLetter)
    .filter((w) => !state.used[Data.normalize(w)])
    .some((w) => JSON.stringify(state.powerLog).includes(w));
  assert.equal(leaked, false, "the masked answer must not cross into state");
});

test("freeze extends the deadline and the turn budget", () => {
  const state = econMatch({ startEnergy: 5 });
  const before = state.deadline;
  const res = Engine.usePower(state, state.activeId, "freeze");
  assert.equal(res.ok, true);
  assert.equal(res.effect.addedSeconds, state.config.freezeSeconds);
  assert.ok(state.deadline > before, "deadline must move out");
  assert.equal(state.turnBudgetMs, state.turnSeconds * 1000 + state.config.freezeSeconds * 1000);
});

test("double arms, then doubles exactly the next card", () => {
  const state = econMatch({ startEnergy: 6 });
  const armed = Engine.usePower(state, state.activeId, "double");
  assert.equal(armed.ok, true);
  assert.equal(state.players[0].armed.double, true);

  const plain = econMatch();
  const plainRes = Engine.submit(plain, plain.activeId, "AFRICA");
  const dbl = Engine.submit(state, state.activeId, "AFRICA");
  assert.equal(dbl.multiplier, 2);
  assert.equal(dbl.points, plainRes.points * 2);
  assert.equal(state.players[0].armed.double, false, "double is consumed by the card");
  assert.equal(state.players[0].doublesCashed, 1);
});

test("an armed double that times out is burned with an energy penalty", () => {
  const state = econMatch({ startEnergy: 8 });
  const me = state.players[0];
  Engine.usePower(state, me.id, "double");
  const before = me.energy;
  state.deadline = Date.now() - 1;
  const res = Engine.tick(state, Date.now());
  const types = res.events.map((e) => e.type);
  assert.ok(types.includes("double_lost"), "double_lost event expected");
  assert.equal(me.armed.double, false);
  assert.equal(me.energy, before - state.config.doublePenalty);
});

test("shield absorbs the strike instead of the player", () => {
  const state = econMatch({ startEnergy: 8 });
  const me = state.players[0];
  Engine.usePower(state, me.id, "shield");
  assert.equal(me.armed.shield, true);
  state.deadline = Date.now() - 1;
  const res = Engine.tick(state, Date.now());
  assert.ok(res.events.some((e) => e.type === "shield_saved"));
  assert.equal(me.strikes, 0, "the shield ate the strike");
  assert.equal(me.shieldsUsed, 1);
  assert.equal(me.armed.shield, false, "shield is single-use");
});

test("wild swaps the required letter and rejects dead or same letters", () => {
  const state = econMatch({ startEnergy: 9 });
  const from = state.requiredLetter;
  const bad = Engine.usePower(state, state.activeId, "wild", { letter: from });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "same-letter");

  // PLACES answers every letter, so burn the Q pool to make it dead.
  Data.wordsFor("PLACES", "Q").forEach((w) => { state.used[Data.normalize(w)] = true; });
  const dead = Engine.usePower(state, state.activeId, "wild", { letter: "Q" });
  assert.equal(dead.ok, false, "Q has no unused answers left");
  assert.equal(dead.reason, "dead-letter");

  const ok = Engine.usePower(state, state.activeId, "wild", { letter: "K" });
  assert.equal(ok.ok, true);
  assert.equal(state.requiredLetter, "K");
  assert.equal(state.letterReset.wild, true);
  assert.equal(state.letterReset.from, from);
});

test("power limits: per-match charges and per-turn cap are enforced", () => {
  // Raise the per-turn cap so we can exercise the per-match charge limit first.
  const state = econMatch({ startEnergy: 30, maxPowersPerTurn: 5 });
  const me = state.players[0];
  for (let i = 0; i < Engine.POWERS.hint.limit; i++) {
    assert.equal(Engine.usePower(state, me.id, "hint").ok, true);
  }
  const exhausted = Engine.usePower(state, me.id, "hint");
  assert.equal(exhausted.ok, false);
  assert.equal(exhausted.reason, "exhausted");

  const fresh = econMatch({ startEnergy: 30, maxPowersPerTurn: 1 });
  assert.equal(Engine.usePower(fresh, fresh.activeId, "hint").ok, true);
  const capped = Engine.usePower(fresh, fresh.activeId, "freeze");
  assert.equal(capped.ok, false);
  assert.equal(capped.reason, "turn-limit");
});

test("powers are refused off-turn when they need a turn", () => {
  const state = econMatch({ startEnergy: 9 });
  const other = state.players[1];
  const res = Engine.usePower(state, other.id, "freeze");
  assert.equal(res.ok, false);
  assert.equal(res.reason, "not-your-turn");
  // SHIELD is the exception: it may be armed on someone else's turn.
  const shield = Engine.usePower(state, other.id, "shield");
  assert.equal(shield.ok, true);
});

test("power status reports affordability and reasons without mutating", () => {
  const state = econMatch({ startEnergy: 0 });
  const before = JSON.stringify(state);
  const status = Engine.powerStatus(state, state.players[0].id);
  assert.equal(status.energy, 0);
  const double = status.powers.find((p) => p.key === "double");
  assert.equal(double.affordable, false);
  assert.equal(double.blocked, "Needs 5 energy");
  assert.equal(JSON.stringify(state), before, "powerStatus must be pure");
});

test("the seeded rng makes identical seeds reproduce identical choices", () => {
  const run = () => {
    const state = Engine.createMatch({ category: "FOOD", players: players(2), seed: "SAME" });
    Engine.start(state, { letter: "Z" });
    Data.wordsFor("FOOD", "T").forEach((w) => { state.used[Data.normalize(w)] = true; });
    Engine.submit(state, state.activeId, "ZEST");
    return state.letterReset.to;
  };
  assert.equal(run(), run(), "same seed must produce the same fresh-chain letter");
});

test("power log survives a JSON round-trip (needed for network sync)", () => {
  const state = econMatch({ startEnergy: 9 });
  Engine.usePower(state, state.activeId, "hint");
  Engine.usePower(state, state.activeId, "freeze");
  const copy = JSON.parse(JSON.stringify(state));
  assert.equal(copy.powerLog.length, state.powerLog.length);
  assert.equal(copy.players[0].powersUsed.hint, 1);
  assert.equal(copy.turnBudgetMs, state.turnBudgetMs);
});

test("house players fire powers through the engine and pay for them", () => {
  require("../js/bots.js"); // browser-style module: it registers on globalThis
  const Bots = globalThis.AtlasBots;
  assert.ok(Bots && typeof Bots.choosePower === "function", "bots module must expose choosePower");

  const state = econMatch({ startEnergy: 9, difficulty: "ruthless" });
  const bot = state.players[1];
  state.activeId = bot.id; // turn-based powers only fire on your own turn
  state.combo = 5;         // a hot chain is exactly when a double pays off
  let fired = null;
  for (let i = 0; i < 24 && !fired; i++) {
    const choice = Bots.choosePower(state, bot.id, Data, Engine, "ruthless");
    if (choice) {
      const res = Engine.usePower(state, bot.id, choice.key, { letter: choice.letter });
      if (res.ok) fired = res;
    }
  }
  assert.ok(fired, "a ruthless bot with energy should fire something");
  assert.ok(bot.energy < 9, "the bot must have paid real energy");
  assert.ok(state.powerLog.some((e) => e.playerId === bot.id), "bot power use is logged like a human's");
});
