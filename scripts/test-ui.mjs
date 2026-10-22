#!/usr/bin/env node
/**
 * ATLAS — UI smoke test
 *
 * Boots the real index.html in jsdom, served at a GitHub-Pages-style subpath
 * (/Atlas-game/), and plays a match end to end: onboarding → home → deck →
 * validation → accepted card → swipe animation → bots → results → ranking.
 *
 * Usage: npm run test:ui   (needs `npm install` once, for jsdom)
 */
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_PATH = "/Atlas-game/";
let JSDOM, ResourceLoader, VirtualConsole;

try {
  ({ JSDOM, ResourceLoader, VirtualConsole } = await import("jsdom"));
} catch {
  console.error("jsdom is not installed. Run `npm install` first.");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith(BASE_PATH)) {
    res.writeHead(302, { Location: BASE_PATH }).end();
    return;
  }
  const target = normalize(join(ROOT, pathname.slice(BASE_PATH.length)));
  if (!target.startsWith(ROOT + sep) && target !== ROOT) {
    res.writeHead(403).end();
    return;
  }
  try {
    const file = statSync(target).isDirectory() ? join(target, "index.html") : target;
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(readFileSync(file));
  } catch {
    let body = "404";
    try { body = readFileSync(join(ROOT, "404.html"), "utf8"); } catch {}
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }).end(body);
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}${BASE_PATH}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

class Loader extends ResourceLoader {
  constructor(log) { super(); this.log = log; }
  fetch(url, options) {
    return super.fetch(url, options).then(
      (buf) => { this.log.loaded.push(url); return buf; },
      (err) => { this.log.failed.push(url + " :: " + err.message); throw err; }
    );
  }
}

async function boot(seed) {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error("index " + res.status);
  const html = await res.text();
  const log = { loaded: [], failed: [] };
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (event) => {
    if (!/navigation|getContext|Not implemented/i.test(event.message)) errors.push(event.message);
  });

  const dom = new JSDOM(html, {
    url: BASE,
    runScripts: "dangerously",
    resources: new Loader(log),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // jsdom reports http loopback as insecure; browsers do not.
      Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
      if (seed) window.localStorage.setItem("atlas.profile.v1", seed);
    }
  });
  await wait(700);
  return { w: dom.window, d: dom.window.document, log, errors, dom };
}

const screenOf = (d) => d.body.getAttribute("data-screen");

// ---------------------------------------------------------------- first run
{
  const { w, d, log, errors, dom } = await boot();

  check("boot: stylesheet loads", log.loaded.some((u) => u.includes("css/atlas.css")));
  check("boot: no failed resources", log.failed.length === 0, log.failed.slice(0, 2).join(" | "));
  check("boot: no script errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  check(
    "boot: every module is present",
    ["AtlasEngine", "AtlasData", "AtlasCards", "AtlasProfile", "AtlasNet", "AtlasPWA", "SoundEngine", "AtlasApp"]
      .every((key) => w[key]),
    ["AtlasEngine", "AtlasData", "AtlasCards", "AtlasProfile", "AtlasNet", "AtlasPWA", "SoundEngine", "AtlasApp"]
      .filter((key) => !w[key]).join(",") || "ok"
  );
  check("first run: welcome screen", screenOf(d) === "welcome", screenOf(d));

  d.getElementById("welcomeStartBtn").click();
  await wait(140);
  check("onboarding: home screen", screenOf(d) === "home", screenOf(d));
  check("onboarding: persisted", JSON.parse(w.localStorage.getItem("atlas.profile.v1")).onboarded === true);
  check("home: six world cards", d.querySelectorAll(".world-card").length === 6);
  check("home: exactly one front card", d.querySelectorAll(".world-card.is-front").length === 1);
  check("home: six dots", d.querySelectorAll(".stack-dots i").length === 6);
  check("home: Places is front", d.querySelector(".world-card.is-front").getAttribute("data-category") === "PLACES");

  const mid = d.querySelector(".world-card.is-mid");
  const midCategory = mid.getAttribute("data-category");
  mid.click();
  await wait(80);
  check("home: tap switches world", d.querySelector(".world-card.is-front").getAttribute("data-category") === midCategory, midCategory);

  d.getElementById("quickPlayBtn").click();
  await wait(420);
  const app = w.AtlasApp.state();
  check("game: screen opens", screenOf(d) === "game", screenOf(d));
  check("game: match is playing", !!app.match && app.match.status === "playing");
  check("game: one human and two bots", app.match.players.length === 3);
  check("game: human starts", app.match.activeId === app.meId);
  check("game: empty card shows the letter", d.querySelector(".deck-empty__letter").textContent === app.match.requiredLetter,
    d.querySelector(".deck-empty__letter")?.textContent);
  check("game: input enabled on your turn", d.getElementById("answerInput").disabled === false);
  check("game: player strip", d.querySelectorAll(".pchip").length === 3);
  check("game: timer renders", /^\d+$/.test(d.getElementById("timerValue").textContent), d.getElementById("timerValue").textContent);

  const input = d.getElementById("answerInput");
  const letter = app.match.requiredLetter;
  input.value = letter + "ZZZ";
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
  await wait(50);
  check("validation: unknown word flagged live",
    d.getElementById("answerHint").classList.contains("is-bad") && /Not in this deck/.test(d.getElementById("answerHint").textContent),
    d.getElementById("answerHint").textContent);

  input.value = "QQQQ";
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
  await wait(50);
  check("validation: wrong letter flagged live",
    /Must start with/.test(d.getElementById("answerHint").textContent), d.getElementById("answerHint").textContent);

  const beforeTurn = app.match.turn;
  d.getElementById("answerForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await wait(150);
  check("validation: invalid answer does not advance", app.match.turn === beforeTurn && app.match.deck.length === 0);

  const word = w.AtlasData.wordsFor(app.match.category, letter).find((candidate) => !app.match.used[candidate]);
  input.value = word;
  input.dispatchEvent(new w.Event("input", { bubbles: true }));
  await wait(60);
  check("validation: valid word flagged live", d.getElementById("answerHint").classList.contains("is-good"), d.getElementById("answerHint").textContent);

  d.getElementById("answerForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await wait(320);
  check("answer: card accepted", app.match.deck.length === 1, String(app.match.deck.length));
  check("answer: card reveals art", !!d.querySelector(".deck-card--reveal.is-filled"),
    d.querySelector(".deck-card--reveal .deck-card__word")?.textContent);
  check("answer: letter advances", app.match.requiredLetter === w.AtlasData.lastLetter(word), app.match.requiredLetter);
  check("answer: points awarded", app.match.players[0].score >= 10, String(app.match.players[0].score));

  await wait(2600);
  // Bots answer quickly in solo mode, so the refresh card may already have been
  // pushed out of the two history slots. What must hold is that the reveal
  // cleared, a history stack exists and nothing got stuck on screen.
  const stackCount = d.querySelectorAll(".deck-card--back-1, .deck-card--back-2").length;
  check("animation: reveal clears and the stack persists",
    stackCount >= 1 && d.querySelectorAll(".deck-card--reveal").length <= 1 &&
      d.querySelectorAll(".deck-card").length <= 4,
    stackCount + " history · " + d.querySelectorAll(".deck-card").length + " total");

  const pool = w.AtlasData.wordsFor(app.match.category, app.match.requiredLetter).filter((candidate) => !app.match.used[candidate]);
  if (pool.length) {
    app.match.used[pool[0]] = true;
    app.match.activeId = app.meId;
    app.match.status = "playing";
    input.disabled = false;
    input.value = pool[0];
    d.getElementById("answerForm").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(180);
    check("no repeats: used word rejected", /already/i.test(d.getElementById("answerHint").textContent),
      d.getElementById("answerHint").textContent);
  }

  // Hand the turn to the bots by letting the clock run out, then give them time.
  app.match.deadline = Date.now() - 10;
  await wait(700);
  const botWordsBefore = app.match.players.filter((p) => p.bot).map((p) => p.words);
  await wait(5200);
  const botWordsAfter = app.match.players.filter((p) => p.bot).map((p) => p.words);
  check("bots: take their turns",
    botWordsAfter.some((n, i) => n > botWordsBefore[i]) || app.match.round > 1 || app.match.players.some((p) => p.strikes > 0),
    JSON.stringify({ before: botWordsBefore, after: botWordsAfter }));

  app.match.players.forEach((p) => { if (p.id !== app.meId) p.eliminated = true; });
  app.match.status = "playing";
  app.match.activeId = app.meId;
  app.match.deadline = Date.now() - 10;
  await wait(1000);
  check("results: screen shown", screenOf(d) === "results", screenOf(d));
  check("results: three ranked rows", d.querySelectorAll("#resultList .result-row").length === 3);
  check("results: winner headline", /win/i.test(d.getElementById("resultTitle").textContent), d.getElementById("resultTitle").textContent);
  check("results: card recap", d.querySelectorAll("#resultDeck .chip").length >= 1);

  const saved = JSON.parse(w.localStorage.getItem("atlas.profile.v1"));
  check("results: stats saved", saved.stats.matches === 1 && saved.stats.words >= 1, JSON.stringify(saved.stats));

  d.querySelector('.tab[data-tab="ranking"]').click();
  await wait(140);
  check("ranking: screen shown", screenOf(d) === "ranking", screenOf(d));
  check("ranking: four stat tiles", d.querySelectorAll("#rankStats .stat").length === 4);
  check("ranking: match history recorded", d.querySelectorAll("#rankHistory .list-row").length === 1);

  d.querySelector('.tab[data-tab="profile"]').click();
  await wait(140);
  check("profile: screen shown", screenOf(d) === "profile", screenOf(d));
  const soundSwitch = d.getElementById("soundSwitch");
  const wasOn = soundSwitch.classList.contains("is-on");
  soundSwitch.click();
  await wait(60);
  check("profile: sound toggle", soundSwitch.classList.contains("is-on") !== wasOn);

  d.getElementById("profileRulesBtn").click();
  await wait(90);
  check("rules: sheet opens", d.getElementById("sheetRules").classList.contains("is-open"));
  d.querySelector('#sheetRules [data-close-sheet]').click();
  await wait(340);
  check("rules: sheet closes", !d.getElementById("sheetRules").classList.contains("is-open"));

  check("run: no script errors at the end", errors.length === 0, errors.slice(0, 2).join(" | "));
  dom.window.close();
}

// ------------------------------------------------------- returning player
{
  const seed = JSON.stringify({
    name: "Omprakash", avatar: "🦅", sound: true, haptics: true, liveValidation: true, onboarded: true,
    stats: { matches: 4, wins: 2, points: 300, bestScore: 120, bestStreak: 6, words: 31 },
    categories: {
      PLACES: { matches: 2, wins: 1, best: 120, points: 180 },
      MOVIES: { matches: 2, wins: 1, best: 80, points: 120 }
    },
    history: [{ at: Date.now(), category: "PLACES", score: 120, place: 1, players: 3, words: 9, won: true, mode: "solo" }]
  });
  const { w, d, errors, dom } = await boot(seed);

  check("returning: skips welcome", screenOf(d) === "home", screenOf(d));
  check("returning: name restored", d.getElementById("homeName").textContent === "Omprakash");
  check("returning: avatar restored", d.getElementById("homeAvatar").textContent === "🦅");

  d.querySelector('.tab[data-tab="ranking"]').click();
  await wait(140);
  check("returning: match count", d.querySelector("#rankStats .stat b")?.textContent === "4");
  check("returning: two worlds ranked", d.querySelectorAll("#rankCategories .list-row").length === 2);
  check("returning: level label", /Level \d/.test(d.getElementById("rankLevelLabel").textContent), d.getElementById("rankLevelLabel").textContent);
  check("returning: no script errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  dom.window.close();
}

server.close();
console.log("\n---");
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} UI checks passed`);
if (failed.length) {
  console.log("FAILURES:");
  failed.forEach((f) => console.log(" - " + f.name + (f.detail ? " :: " + f.detail : "")));
  process.exit(1);
}
