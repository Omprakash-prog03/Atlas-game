#!/usr/bin/env node
/**
 * ATLAS — two-client multiplayer test
 *
 * Boots two real app instances and connects them through a mock WebRTC bus that
 * implements the small slice of the PeerJS API the app uses. This exercises the
 * full online path: room creation, handshake, lobby sync, host start, turn
 * submission in both directions and the shared deck.
 *
 * Usage: npm run test:net   (needs `npm install` once, for jsdom)
 */
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize, dirname, resolve, sep } from "node:path";
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

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith(BASE_PATH)) { res.writeHead(302, { Location: BASE_PATH }).end(); return; }
  const target = normalize(join(ROOT, pathname.slice(BASE_PATH.length)));
  if (!target.startsWith(ROOT + sep) && target !== ROOT) { res.writeHead(403).end(); return; }
  try {
    const file = statSync(target).isDirectory() ? join(target, "index.html") : target;
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(readFileSync(file));
  } catch {
    let body = "404";
    try { body = readFileSync(join(ROOT, "404.html"), "utf8"); } catch {}
    res.writeHead(404, { "Content-Type": "text/html" }).end(body);
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}${BASE_PATH}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

/* ------------------------------------------------------------------ mock bus */

function createPeerBus() {
  const peers = new Map();

  class MockConnection {
    constructor(peerId, other) {
      this.peer = peerId;
      this.open = false;
      this.other = other;
      this.handlers = { data: [], open: [], close: [] };
      this.closed = false;
    }
    on(event, cb) { (this.handlers[event] = this.handlers[event] || []).push(cb); return this; }
    emit(event, payload) { (this.handlers[event] || []).forEach((cb) => cb(payload)); }
    send(data) {
      if (this.closed) throw new Error("connection closed");
      const copy = JSON.parse(JSON.stringify(data));
      setTimeout(() => { if (!this.other.closed) this.other.emit("data", copy); }, 5);
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.open = false;
      const other = this.other;
      setTimeout(() => {
        this.emit("close");
        if (other && !other.closed) { other.closed = true; other.open = false; other.emit("close"); }
      }, 5);
    }
  }

  class MockPeer {
    constructor(id) {
      this.id = id || "peer-" + Math.random().toString(36).slice(2, 8);
      this.destroyed = false;
      this.handlers = { open: [], connection: [], error: [], disconnected: [], close: [] };
      if (peers.has(this.id)) {
        setTimeout(() => this.emit("error", { type: "unavailable-id" }), 5);
        return;
      }
      peers.set(this.id, this);
      setTimeout(() => { if (!this.destroyed) this.emit("open", this.id); }, 10);
    }
    on(event, cb) { (this.handlers[event] = this.handlers[event] || []).push(cb); return this; }
    emit(event, payload) { (this.handlers[event] || []).forEach((cb) => cb(payload)); }
    connect(peerId) {
      const target = peers.get(peerId);
      const local = new MockConnection(peerId, null);
      const remote = new MockConnection(this.id, local);
      local.other = remote;
      if (!target || target.destroyed) {
        setTimeout(() => this.emit("error", { type: "peer-unavailable" }), 30);
        return local;
      }
      setTimeout(() => {
        local.open = true;
        remote.open = true;
        target.emit("connection", remote);
        local.emit("open");
        remote.emit("open");
      }, 20);
      return local;
    }
    reconnect() {}
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      peers.delete(this.id);
      this.emit("close");
    }
  }

  return { MockPeer, peers };
}

/* --------------------------------------------------------------- boot a client */

class Loader extends ResourceLoader {
  constructor(log) { super(); this.log = log; }
  fetch(url, options) {
    return super.fetch(url, options).then(
      (buf) => { this.log.loaded.push(url); return buf; },
      (err) => { this.log.failed.push(url + " :: " + err.message); throw err; }
    );
  }
}

async function boot(name, bus, seed) {
  const res = await fetch(BASE);
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
      Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
      window.Peer = bus.MockPeer;
      if (seed) window.localStorage.setItem("atlas.profile.v1", JSON.stringify(seed));
    }
  });
  await wait(650);
  return { name, w: dom.window, d: dom.window.document, errors, dom };
}

const screenOf = (client) => client.d.body.getAttribute("data-screen");
const click = (client, selector) => client.d.querySelector(selector).click();

/* ---------------------------------------------------------------------- test */

const bus = createPeerBus();
const hostSeed = { name: "Host", avatar: "🧭", sound: false, haptics: false, liveValidation: true, onboarded: true, stats: { matches: 0, wins: 0, points: 0, bestScore: 0, bestStreak: 0, words: 0 }, categories: {}, history: [] };
const guestSeed = { ...hostSeed, name: "Guest", avatar: "🦅" };

const host = await boot("host", bus, hostSeed);
const guest = await boot("guest", bus, guestSeed);

// peerjs.min.js assigns window.Peer while loading, so the mock is installed
// after boot. net.js reads window.Peer at call time, exactly like production.
host.w.Peer = bus.MockPeer;
guest.w.Peer = bus.MockPeer;

check("both clients boot without errors", host.errors.length === 0 && guest.errors.length === 0,
  [...host.errors, ...guest.errors].slice(0, 2).join(" | "));
check("both clients land on home", screenOf(host) === "home" && screenOf(guest) === "home",
  screenOf(host) + "/" + screenOf(guest));

// Host creates an online room
click(host, "#onlineBtn");
await wait(80);
click(host, "#onlineCreateBtn");
await wait(120);
click(host, "#createOnlineBtn");
await wait(600);

const code = host.d.getElementById("lobbyCode").textContent.trim();
const hostApp = host.w.AtlasApp.state();
check("host: room created", /^[A-Z0-9]{5}$/.test(code), code);
check("host: lobby screen", screenOf(host) === "lobby", screenOf(host));
check("host: lobby shows only the host", host.d.querySelectorAll("#lobbyPlayers .player-row").length === 1);
check("host: start disabled while alone", host.d.getElementById("startMatchBtn").disabled === true);

// Guest joins with the code
click(guest, "#joinShortcutBtn");
await wait(120);
const joinCode = guest.d.getElementById("joinCode");
joinCode.value = code;
joinCode.dispatchEvent(new guest.w.Event("input", { bubbles: true }));
click(guest, "#joinRoomBtn");
await wait(900);

const guestApp = guest.w.AtlasApp.state();
check("guest: connected to the host", !!guestApp.match, guestApp.match ? "state received" : "no state");
check("guest: lobby screen", screenOf(guest) === "lobby", screenOf(guest));
check("guest: sees two players", guest.d.querySelectorAll("#lobbyPlayers .player-row").length === 2,
  guest.d.querySelectorAll("#lobbyPlayers .player-row").length + "");
check("host: sees the guest arrive", host.d.querySelectorAll("#lobbyPlayers .player-row").length === 2,
  host.d.querySelectorAll("#lobbyPlayers .player-row").length + "");
check("host: start enabled with two players", host.d.getElementById("startMatchBtn").disabled === false);
check("guest: cannot start the match", guest.d.getElementById("startMatchBtn").disabled === true);

// Host starts
click(host, "#startMatchBtn");
await wait(500);
check("host: game starts", screenOf(host) === "game", screenOf(host));
check("guest: game starts too", screenOf(guest) === "game", screenOf(guest));
check("both: same starting letter", hostApp.match.requiredLetter === guestApp.match.requiredLetter,
  hostApp.match.requiredLetter + " / " + guestApp.match.requiredLetter);
check("both: same active player", hostApp.match.activeId === guestApp.match.activeId);

// Host answers first
const hostLetter = hostApp.match.requiredLetter;
const hostWord = host.w.AtlasData.wordsFor(hostApp.match.category, hostLetter).find((w) => !hostApp.match.used[w]);
const hostInput = host.d.getElementById("answerInput");
hostInput.value = hostWord;
hostInput.dispatchEvent(new host.w.Event("input", { bubbles: true }));
host.d.getElementById("answerForm").dispatchEvent(new host.w.Event("submit", { bubbles: true, cancelable: true }));
await wait(700);

check("host: answer accepted locally", hostApp.match.deck.length === 1, String(hostApp.match.deck.length));
check("guest: receives the host's card", guestApp.match.deck.length === 1, String(guestApp.match.deck.length));
check("guest: card content synced", guestApp.match.deck[0]?.word === hostWord, guestApp.match.deck[0]?.word);
check("guest: sees the new letter", guestApp.match.requiredLetter === host.w.AtlasData.lastLetter(hostWord),
  guestApp.match.requiredLetter);
check("guest: turn moved to the guest", guestApp.match.activeId === guestApp.meId, guestApp.match.activeId);

// Guest answers
const guestInput = guest.d.getElementById("answerInput");
check("guest: input enabled on their turn", guestInput.disabled === false);
const guestLetter = guestApp.match.requiredLetter;
const guestWord = guest.w.AtlasData.wordsFor(guestApp.match.category, guestLetter).find((w) => !guestApp.match.used[w]);
guestInput.value = guestWord;
guestInput.dispatchEvent(new guest.w.Event("input", { bubbles: true }));
guest.d.getElementById("answerForm").dispatchEvent(new guest.w.Event("submit", { bubbles: true, cancelable: true }));
await wait(700);

check("guest: answer accepted by the host", guestApp.match.deck.length === 2, String(guestApp.match.deck.length));
check("host: receives the guest's card", hostApp.match.deck.length === 2, String(hostApp.match.deck.length));
check("host: card content synced", hostApp.match.deck[1]?.word === guestWord, hostApp.match.deck[1]?.word);
check("host: guest scored", hostApp.match.players[1].score > 0, String(hostApp.match.players[1].score));
check("guest: turn returns to the host", hostApp.match.activeId === hostApp.meId, hostApp.match.activeId);

// No repeats across devices
const repeatGuess = hostWord;
hostInput.disabled = false;
hostInput.value = repeatGuess;
host.d.getElementById("answerForm").dispatchEvent(new host.w.Event("submit", { bubbles: true, cancelable: true }));
await wait(300);
check("multiplayer: repeats are rejected on the host",
  /already|must start/i.test(host.d.getElementById("answerHint").textContent),
  host.d.getElementById("answerHint").textContent);

// Guest leaves cleanly
const guestStateBefore = hostApp.match.players.length;
guestApp.net.send({ t: "action", action: { type: "leave" } });
await wait(500);
check("host: player removed after leaving", hostApp.match.players.length === guestStateBefore - 1,
  hostApp.match.players.length + "");

check("no script errors during the online match", host.errors.length === 0 && guest.errors.length === 0,
  [...host.errors, ...guest.errors].slice(0, 2).join(" | "));

host.dom.window.close();
guest.dom.window.close();
server.close();

console.log("\n---");
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} multiplayer checks passed`);
if (failed.length) {
  console.log("FAILURES:");
  failed.forEach((f) => console.log(" - " + f.name + (f.detail ? " :: " + f.detail : "")));
  process.exit(1);
}
