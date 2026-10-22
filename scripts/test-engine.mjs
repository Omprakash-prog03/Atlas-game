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
