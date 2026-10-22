/**
 * ATLAS — app controller
 *
 * Owns the screens, the deck, the local match loop and the online room.
 * The engine (js/engine.js) holds the rules; this file never re-implements them.
 */
(function (root) {
  "use strict";

  var E = root.AtlasEngine;
  var D = root.AtlasData;
  var Cards = root.AtlasCards;
  var Profile = root.AtlasProfile;

  if (!E || !D || !Cards || !Profile) {
    // A missing script would otherwise produce a silent, broken screen.
    console.error("ATLAS: a required script failed to load.");
    return;
  }

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var CATEGORY_NOUN = {
    PLACES: "place", CITIES: "city", COUNTRIES: "country",
    MOVIES: "film", ANIMALS: "animal", FOOD: "food"
  };

  var app = {
    screen: "welcome",
    category: "PLACES",
    match: null,
    role: "solo",           // solo | host | guest
    meId: null,
    net: null,
    deck: null,
    renderedDeck: 0,
    clockOffset: 0,
    botTimer: null,
    botKey: null,
    lastTickSecond: null,
    recordedMatchId: null,
    showResultsFor: null,
    code: null,
    peerPlayers: {},        // host only: peerId -> playerId
    startingOnline: false,
    wakeLock: null
  };

  // --------------------------------------------------------------- utilities

  function vibrate(pattern) {
    if (!Profile.read().haptics) return;
    try {
      if (navigator && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
    } catch (e) {}
  }

  var toastTimer = null;
  function toast(message, ms) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-on"); }, ms || 2600);
  }

  function hostNow() {
    return Date.now() - app.clockOffset;
  }

  // Keep the screen awake while a match is live (mobile only, best effort).
  function keepAwake() {
    if (!app.match || app.match.status !== E.STATUS.PLAYING) return;
    if (!("wakeLock" in navigator)) return;
    if (app.wakeLock) return;
    try {
      navigator.wakeLock.request("screen").then(function (lock) {
        app.wakeLock = lock;
        lock.addEventListener("release", function () { app.wakeLock = null; });
      }).catch(function () {});
    } catch (e) {}
  }

  function releaseAwake() {
    if (!app.wakeLock) return;
    try { app.wakeLock.release(); } catch (e) {}
    app.wakeLock = null;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") keepAwake();
  });

  function categoryMeta(key) {
    return D.categories[key] || D.categories.PLACES;
  }

  function showScreen(name) {
    app.screen = name;
    document.body.setAttribute("data-screen", name);
    $$(".screen").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-screen") === name);
    });
    $$(".tab").forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-tab") === name);
    });
    if (name === "ranking") renderRanking();
    if (name === "profile") renderProfile();
    if (name === "home") renderHome();
  }

  function openSheet(id) {
    var sheet = document.getElementById(id);
    if (!sheet) return;
    sheet.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeSheet(sheetOrId) {
    var sheet = typeof sheetOrId === "string" ? document.getElementById(sheetOrId) : sheetOrId;
    if (!sheet) return;
    sheet.classList.remove("is-open");
    if (!$$(".sheet.is-open").length) document.body.style.overflow = "";
  }

  function closeAllSheets() {
    $$(".sheet").forEach(function (s) { s.classList.remove("is-open"); });
    document.body.style.overflow = "";
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(area);
      }
    });
  }

  function initials(name) {
    return String(name || "?").trim().slice(0, 2).toUpperCase();
  }

  // ------------------------------------------------------------------ sheets

  function bindSheets() {
    $$("[data-close-sheet]").forEach(function (btn) {
      btn.addEventListener("click", function () { closeSheet(btn.closest(".sheet")); });
    });
    $$(".sheet").forEach(function (sheet) {
      sheet.addEventListener("click", function (event) {
        if (event.target === sheet) closeSheet(sheet);
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeAllSheets();
    });
  }

  // -------------------------------------------------------------- home screen

  function renderHome() {
    var profile = Profile.read();
    $("#homeName").textContent = profile.name;
    $("#homeAvatar").textContent = profile.avatar;

    var stack = $("#worldStack");
    var dots = $("#stackDots");
    if (!stack) return;

    var categories = D.list();
    var index = categories.findIndex(function (c) { return c.key === app.category; });
    if (index < 0) index = 0;

    stack.innerHTML = "";
    // Render back-to-front so the selected card is last (and on top).
    categories.forEach(function (cat, i) {
      var offset = (i - index + categories.length) % categories.length;
      var cls = offset === 0 ? "is-front" : offset === 1 ? "is-mid" : offset === 2 ? "is-back" : "is-hidden";
      var card = document.createElement("button");
      card.className = "world-card " + cls;
      card.type = "button";
      card.setAttribute("data-category", cat.key);
      card.setAttribute("aria-label", cat.label);
      card.innerHTML =
        '<div class="world-card__art" style="background-image:url(\'' + Cards.ART[Cards.CATEGORY_ART[cat.key] != null ? Cards.CATEGORY_ART[cat.key] : 0] + '\')"></div>' +
        '<div class="world-card__scrim"></div>' +
        '<div class="world-card__count">' + cat.count + " entries</div>" +
        '<div class="world-card__body">' +
        '<div class="world-card__glyph">' + cat.glyph + "</div>" +
        '<div class="world-card__title">' + cat.label + "</div>" +
        '<div class="world-card__sub">' + cat.blurb + "</div>" +
        "</div>";
      card.addEventListener("click", function () {
        if (app.category !== cat.key) {
          app.category = cat.key;
          if (root.SoundEngine) root.SoundEngine.playClick();
          renderHome();
        } else {
          openSheet("sheetCreate");
        }
      });
      stack.appendChild(card);
    });

    if (dots) {
      dots.innerHTML = "";
      categories.forEach(function (cat) {
        var dot = document.createElement("i");
        if (cat.key === app.category) dot.className = "is-on";
        dots.appendChild(dot);
      });
    }

    var chips = $("#createCategories");
    if (chips) {
      chips.innerHTML = "";
      categories.forEach(function (cat) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (cat.key === app.category ? " is-on" : "");
        chip.setAttribute("data-cat", cat.key);
        chip.textContent = cat.label;
        chip.addEventListener("click", function () {
          app.category = cat.key;
          Array.prototype.forEach.call(chips.children, function (c) { c.classList.remove("is-on"); });
          chip.classList.add("is-on");
          renderHome();
        });
        chips.appendChild(chip);
      });
    }
  }

  function bindHomeSwipe() {
    var stack = $("#worldStack");
    if (!stack) return;
    var startX = null;
    stack.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    stack.addEventListener("pointerup", function (e) {
      if (startX == null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) < 46) return;
      var cats = D.list().map(function (c) { return c.key; });
      var i = cats.indexOf(app.category);
      app.category = cats[(i + (dx < 0 ? 1 : cats.length - 1)) % cats.length];
      renderHome();
    });
  }

  // ------------------------------------------------------------------ ranking

  function renderRanking() {
    var profile = Profile.read();
    var data = Profile.rankings();
    var progress = Profile.levelProgress();

    var levelEl = $("#rankLevelLabel");
    if (levelEl) levelEl.textContent = "Level " + progress.level;

    var stats = $("#rankStats");
    if (stats) {
      stats.innerHTML =
        '<div class="stat"><b>' + data.stats.matches + "</b><span>Matches</span></div>" +
        '<div class="stat"><b>' + data.stats.wins + "</b><span>Wins</span></div>" +
        '<div class="stat"><b>' + data.stats.bestScore + "</b><span>Best score</span></div>" +
        '<div class="stat"><b>' + progress.points + "</b><span>Total points</span></div>";
    }

    var cats = $("#rankCategories");
    if (cats) {
      if (!data.categories.length) {
        cats.innerHTML = '<p class="empty-state">No matches yet. Play a round to start your ranking.</p>';
      } else {
        cats.innerHTML = data.categories.map(function (c) {
          var meta = categoryMeta(c.category);
          return (
            '<div class="list-row">' +
            '<span class="rank-badge is-gold">' + (meta.glyph || "◈") + "</span>" +
            '<div class="list-row__main"><div class="list-row__title">' + meta.label + "</div>" +
            '<div class="list-row__sub">' + c.matches + " matches · " + c.wins + " wins</div></div>" +
            '<span class="list-row__value">' + c.best + "</span>" +
            "</div>"
          );
        }).join("");
      }
    }

    var history = $("#rankHistory");
    if (history) {
      if (!data.history.length) {
        history.innerHTML = '<p class="empty-state">Your last matches will appear here.</p>';
      } else {
        history.innerHTML = data.history.map(function (h, i) {
          var meta = categoryMeta(h.category);
          var when = new Date(h.at);
          var date = when.toLocaleDateString(undefined, { day: "numeric", month: "short" });
          return (
            '<div class="list-row">' +
            '<span class="rank-badge' + (h.place === 1 ? " is-gold" : "") + '">' + (h.place || i + 1) + "</span>" +
            '<div class="list-row__main"><div class="list-row__title">' + meta.label +
            (h.won ? " · won" : "") + "</div>" +
            '<div class="list-row__sub">' + date + " · " + h.words + " cards · " + h.players + " players</div></div>" +
            '<span class="list-row__value">' + h.score + "</span>" +
            "</div>"
          );
        }).join("");
      }
    }

    var profileSub = $("#profileSub");
    if (profileSub) profileSub.textContent = "Level " + progress.level + " · " + progress.points + " pts";
  }

  // ------------------------------------------------------------------ profile

  function renderProfile() {
    var profile = Profile.read();
    $("#profileName").textContent = profile.name;
    $("#profileAvatar").textContent = profile.avatar;
    var progress = Profile.levelProgress();
    var sub = $("#profileSub");
    if (sub) sub.textContent = "Level " + progress.level + " · " + progress.points + " pts";

    setSwitch($("#soundSwitch"), profile.sound);
    setSwitch($("#hapticSwitch"), profile.haptics);
    setSwitch($("#validateSwitch"), profile.liveValidation);

    renderInstallSlot();
    renderAvatarRow();
  }

  function setSwitch(el, on) {
    if (!el) return;
    el.classList.toggle("is-on", !!on);
    el.setAttribute("aria-checked", on ? "true" : "false");
  }

  function renderAvatarRow() {
    var row = $("#avatarRow");
    if (!row) return;
    var current = Profile.read().avatar;
    row.innerHTML = "";
    Profile.AVATARS.forEach(function (emoji) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (emoji === current ? " is-on" : "");
      chip.style.fontSize = "18px";
      chip.textContent = emoji;
      chip.addEventListener("click", function () {
        Profile.update({ avatar: emoji });
        renderAvatarRow();
      });
      row.appendChild(chip);
    });
  }

  function bindProfile() {
    $("#settingsBtn").addEventListener("click", function () { showScreen("profile"); });

    $$(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-tab");
        if (target === "home" && !app.match) showScreen("home");
        else showScreen(target);
        if (root.SoundEngine) root.SoundEngine.playClick();
      });
    });

    $("#soundSwitch").addEventListener("click", function () {
      var next = !Profile.read().sound;
      Profile.update({ sound: next });
      if (root.SoundEngine) {
        root.SoundEngine.setEnabled(next);
        if (next) root.SoundEngine.playClick();
      }
      setSwitch($("#soundSwitch"), next);
    });

    $("#hapticSwitch").addEventListener("click", function () {
      var next = !Profile.read().haptics;
      Profile.update({ haptics: next });
      if (root.SoundEngine) root.SoundEngine.setHaptics(next);
      setSwitch($("#hapticSwitch"), next);
      if (next) vibrate(12);
    });

    $("#validateSwitch").addEventListener("click", function () {
      var next = !Profile.read().liveValidation;
      Profile.update({ liveValidation: next });
      setSwitch($("#validateSwitch"), next);
      updateAnswerHint();
    });

    $("#profileRulesBtn").addEventListener("click", function () { openSheet("sheetRules"); });
    $("#profileEditBtn").addEventListener("click", openNameSheet);

    $("#resetBtn").addEventListener("click", function () {
      if (!window.confirm("Reset your stats, ranking and history on this device?")) return;
      Profile.reset();
      renderProfile();
      renderRanking();
      toast("Progress reset.");
    });

    $("#saveNameBtn").addEventListener("click", function () {
      var value = ($("#nameInput").value || "").trim().slice(0, 14);
      Profile.update({ name: value || "Player" });
      closeSheet("sheetName");
      renderProfile();
      renderHome();
      toast("Saved.");
    });
  }

  function openNameSheet() {
    $("#nameInput").value = Profile.read().name;
    renderAvatarRow();
    openSheet("sheetName");
  }

  // ---------------------------------------------------------------- install

  function renderInstallSlot() {
    var slot = $("#installSlot");
    if (!slot) return;
    if (root.AtlasPWA && root.AtlasPWA.isStandalone()) {
      slot.innerHTML = '<div class="install-card"><div class="install-card__icon">✓</div>' +
        '<div class="install-card__main"><b>Installed</b><span>ATLAS is running as an app.</span></div></div>';
      return;
    }
    if (root.AtlasPWA && root.AtlasPWA.canInstall()) {
      slot.innerHTML =
        '<div class="install-card"><div class="install-card__icon">◆</div>' +
        '<div class="install-card__main"><b>Install ATLAS</b><span>Add it to your home screen, works offline.</span></div>' +
        '<button class="btn btn-cream btn-sm" id="installBtn">Install</button></div>';
      var btn = $("#installBtn");
      if (btn) btn.addEventListener("click", function () { root.AtlasPWA.promptInstall(); });
      return;
    }
    if (root.AtlasPWA && root.AtlasPWA.isIOS()) {
      slot.innerHTML =
        '<div class="install-card"><div class="install-card__icon">◆</div>' +
        '<div class="install-card__main"><b>Add to Home Screen</b><span>Tap Share, then “Add to Home Screen”.</span></div></div>';
      return;
    }
    slot.innerHTML = "";
  }

  // ------------------------------------------------------------------- lobby

  function renderLobby() {
    var state = app.match;
    if (!state) return;
    $("#lobbyCode").textContent = app.code || state.code || "-----";
    $("#lobbyCount").textContent = state.players.length + " / " + state.config.maxPlayers;
    $("#lobbyModePill").textContent = app.role === "host" ? "HOSTING" : app.role === "guest" ? "JOINED" : "OFFLINE";

    var list = $("#lobbyPlayers");
    list.innerHTML = "";
    state.players.forEach(function (p) {
      var row = document.createElement("div");
      row.className = "player-row" + (p.id === app.meId ? " is-you" : "");
      var ready = p.id === state.players[0].id || p.ready || app.role !== "host";
      row.innerHTML =
        '<span class="avatar" style="width:34px;height:34px;font-size:14px;">' + initials(p.name) + "</span>" +
        '<div class="player-row__name">' + p.name + (p.id === app.meId ? ' <span class="player-row__tag">you</span>' : "") + "</div>" +
        '<span class="player-row__state' + (ready ? "" : " is-waiting") + '">' + (p.id === state.players[0].id ? "Host" : ready ? "Ready" : "Waiting") + "</span>";
      list.appendChild(row);
    });

    var startBtn = $("#startMatchBtn");
    var note = $("#lobbyNote");
    if (app.role === "guest") {
      startBtn.disabled = true;
      startBtn.textContent = "Waiting for host";
      note.textContent = "The host starts the match. Keep this screen open.";
    } else {
      startBtn.disabled = state.players.length < 2;
      startBtn.textContent = "Start match";
      note.textContent = state.players.length < 2
        ? "Share the code — at least one friend has to join."
        : state.players.length + " players ready.";
    }
  }

  function bindLobby() {
    $("#lobbyBackBtn").addEventListener("click", leaveMatch);
    $("#copyCodeBtn").addEventListener("click", function () {
      copyText(app.code || "")
        .then(function () { toast("Room code copied."); })
        .catch(function () { toast("Could not copy the code."); });
    });
    $("#shareCodeBtn").addEventListener("click", function () {
      var url = location.origin + location.pathname;
      var text = "Join my ATLAS room: " + app.code;
      if (navigator.share) {
        navigator.share({ title: "ATLAS", text: text + " " + url, url: url }).catch(function () {});
      } else {
        copyText(text + " " + url)
          .then(function () { toast("Invite copied."); })
          .catch(function () { toast("Could not copy the invite."); });
      }
    });
    $("#startMatchBtn").addEventListener("click", function () {
      if (app.role !== "host") return;
      if (!app.match || app.match.players.length < 2) {
        toast("At least one friend needs to join.");
        return;
      }
      E.start(app.match, { letter: E.pickStartLetter(app.match.category) });
      afterState();
    });
  }

  // -------------------------------------------------------------------- game

  function setupDeck() {
    var rootEl = $("#deck");
    if (!rootEl) return;
    app.deck = Cards.createDeck(rootEl);
  }

  function renderGame() {
    var state = app.match;
    if (!state) return;

    $("#gameRoomPill").textContent = app.role === "solo" ? "SOLO" : (state.code || "ROOM");
    $("#gameRound").textContent = state.round;
    $("#categoryText").textContent = categoryMeta(state.category).label;

    var active = E.activePlayer(state);
    var isMyTurn = !!active && active.id === app.meId && state.status === E.STATUS.PLAYING;

    var turnText = $("#turnText");
    if (state.status === E.STATUS.MATCH_END) {
      turnText.textContent = "Match complete";
    } else if (isMyTurn) {
      turnText.textContent = "Your turn";
    } else if (active) {
      turnText.textContent = active.bot ? active.name + " is thinking…" : active.name + "'s turn";
    } else {
      turnText.textContent = "Starting…";
    }

    // Deck: let the component animate only genuinely new cards.
    if (app.deck) {
      var base = {
        category: state.category,
        letter: state.requiredLetter,
        label: isMyTurn ? "Your turn" : "Waiting for " + (active ? active.name : "next card"),
        hint: "Type a " + (CATEGORY_NOUN[state.category] || "word") + " starting with " + (state.requiredLetter || "?")
      };
      var newCards = state.deck.length - app.renderedDeck;

      if (newCards === 1) {
        app.deck.setBase(base);
        app.deck.reveal(state.deck[state.deck.length - 1], {
          onDone: function () { if (app.match) renderGame(); }
        });
        app.renderedDeck = state.deck.length;
      } else if (newCards > 1) {
        app.deck.reset(base);
        app.renderedDeck = state.deck.length;
      } else {
        app.deck.setBase(base);
        app.renderedDeck = state.deck.length;
      }
    }

    renderPlayersStrip();
    updateInputState(isMyTurn, active);
    renderTimer(E.remainingMs(state, hostNow()), state.turnSeconds);

    var passBtn = $("#passBtn");
    var me = state.players.filter(function (p) { return p.id === app.meId; })[0];
    if (passBtn && me) {
      passBtn.textContent = "Pass · " + me.passes + " left";
      passBtn.disabled = !isMyTurn || me.passes <= 0;
    }

    if (state.roundBanner && state.roundBanner.at !== app.lastRoundAt) {
      app.lastRoundAt = state.roundBanner.at;
      toast("Round " + state.roundBanner.round);
      if (root.SoundEngine) root.SoundEngine.playRound();
    }

    // The deck can run dry for a letter; the engine opens a fresh chain.
    if (state.letterReset && state.letterReset.at !== app.lastResetAt) {
      app.lastResetAt = state.letterReset.at;
      toast("No " + (CATEGORY_NOUN[state.category] || "word") + "s left for " +
        state.letterReset.from + " — new letter " + state.letterReset.to, 3200);
      if (root.SoundEngine) root.SoundEngine.playRound();
    }

    if (state.status === E.STATUS.MATCH_END) handleMatchEnd();
    else keepAwake();
  }

  function renderPlayersStrip() {
    var state = app.match;
    var strip = $("#playersStrip");
    if (!strip) return;
    strip.innerHTML = "";
    E.standings(state).forEach(function (p) {
      var chip = document.createElement("div");
      chip.className = "pchip" + (p.id === state.activeId ? " is-turn" : "") + (p.eliminated ? " is-out" : "");
      chip.innerHTML =
        '<span class="pchip__av">' + initials(p.name) + "</span>" +
        '<span class="pchip__name">' + (p.id === app.meId ? "You" : p.name) + "</span>" +
        '<span class="pchip__score">' + p.score + "</span>";
      strip.appendChild(chip);
    });
  }

  function updateInputState(isMyTurn, active) {
    var input = $("#answerInput");
    var send = $("#sendBtn");
    if (!input || !send) return;

    var wasDisabled = input.disabled;
    input.disabled = !isMyTurn;
    send.disabled = !isMyTurn;

    var state = app.match;
    if (isMyTurn) {
      input.placeholder = 'Start with "' + (state.requiredLetter || "?") + '"';
      if (wasDisabled) {
        // Only pull focus when the turn genuinely becomes ours.
        setTimeout(function () {
          if (document.activeElement === document.body) input.focus({ preventScroll: true });
        }, 240);
      }
    } else {
      input.placeholder = active ? "Waiting for " + active.name + "…" : "Waiting…";
    }
    updateAnswerHint();
  }

  function updateAnswerHint() {
    var hint = $("#answerHint");
    var input = $("#answerInput");
    var state = app.match;
    if (!hint || !input || !state) return;

    var profile = Profile.read();
    var value = input.value.trim();
    input.classList.remove("is-good", "is-bad");
    hint.classList.remove("is-good", "is-bad");

    if (state.status !== E.STATUS.PLAYING) {
      hint.textContent = "";
      return;
    }
    if (!value) {
      hint.textContent = profile.liveValidation
        ? "Answers need to start with " + (state.requiredLetter || "?") + "."
        : "";
      return;
    }
    if (!profile.liveValidation) {
      hint.textContent = "";
      return;
    }

    var check = E.validate(state, app.meId || "__none__", value, hostNow());
    if (check.status === "ok") {
      input.classList.add("is-good");
      hint.classList.add("is-good");
      hint.textContent = "✓ " + check.entry.word + " — press enter";
    } else if (check.status === "unknown") {
      input.classList.add("is-bad");
      hint.classList.add("is-bad");
      hint.textContent = "✕ Not in this deck" + (check.suggestion ? " — did you mean " + check.suggestion + "?" : "");
    } else if (check.status === "used") {
      input.classList.add("is-bad");
      hint.classList.add("is-bad");
      hint.textContent = "✕ " + check.message;
    } else if (check.status === "wrong-letter") {
      input.classList.add("is-bad");
      hint.classList.add("is-bad");
      hint.textContent = "✕ " + check.message;
    } else if (check.status === "not-your-turn") {
      hint.textContent = "Waiting for your turn.";
    } else {
      hint.textContent = check.message || "";
    }
  }

  function renderTimer(remainingMs, turnMs) {
    var ring = $("#timerRing");
    var value = $("#timerValue");
    if (!ring || !value) return;
    var seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    var pct = turnMs > 0 ? Math.max(0, Math.min(100, (remainingMs / (turnMs * 1000)) * 100)) : 0;
    ring.style.setProperty("--p", pct.toFixed(1));
    value.textContent = seconds;
    ring.classList.toggle("is-urgent", seconds <= 5);

    var state = app.match;
    var isMyTurn = state && state.activeId === app.meId;
    if (seconds <= 5 && seconds > 0 && isMyTurn && app.lastTickSecond !== seconds) {
      app.lastTickSecond = seconds;
      if (root.SoundEngine) root.SoundEngine.playTimerTick(true);
    }
    if (seconds > 5) app.lastTickSecond = null;
  }

  // -------------------------------------------------------------- match flow

  function clearBotTimer() {
    if (app.botTimer) clearTimeout(app.botTimer);
    app.botTimer = null;
    app.botKey = null;
  }

  function scheduleBots() {
    var state = app.match;
    if (!state) return;
    if (app.role === "guest") return;
    if (state.status !== E.STATUS.PLAYING) return;

    var active = E.activePlayer(state);
    if (!active || !active.bot) { clearBotTimer(); return; }

    var key = state.turn + ":" + active.id;
    if (app.botKey === key) return;
    clearBotTimer();
    app.botKey = key;

    var plan = root.AtlasBots.plan(state, active.id);
    var delay = Math.min(plan.delay, Math.max(600, state.deadline - hostNow() - 1200));

    app.botTimer = setTimeout(function () {
      app.botTimer = null;
      var current = app.match;
      if (!current || current.status !== E.STATUS.PLAYING || current.activeId !== active.id) return;

      var choice = root.AtlasBots.chooseAnswer(current, active.id, D, E);
      if (choice.word) {
        var res = E.submit(current, active.id, choice.word, hostNow());
        if (res.ok) {
          afterState();
          return;
        }
      }
      if (choice.pass) E.pass(current, active.id);
      else E.tick(current, current.deadline + 1);
      afterState();
    }, delay);
  }

  function afterState(options) {
    var opts = options || {};
    var state = app.match;
    if (!state) return;

    // Host-authoritative sync
    if (app.role === "host" && app.net) {
      app.net.broadcast({ t: "state", state: state, now: Date.now() });
    }

    if (state.status === E.STATUS.PLAYING || state.status === E.STATUS.MATCH_END) {
      if (app.screen !== "game") showScreen("game");
      renderGame();
    } else if (state.status === E.STATUS.LOBBY) {
      if (app.screen !== "lobby") showScreen("lobby");
      renderLobby();
    }

    if (!opts.noBots) scheduleBots();
  }

  function startSolo(category, turnSeconds, botCount) {
    var profile = Profile.read();
    var state = E.createMatch({
      category: category,
      turnSeconds: turnSeconds,
      maxPasses: 3,
      mode: "solo",
      players: [{ name: profile.name, id: "me", ready: true }]
    });
    state.code = E.randomCode(5);

    var bots = root.AtlasBots.createBots(botCount);
    bots.forEach(function (bot) {
      E.addPlayer(state, { name: bot.name, bot: true, ready: true });
    });

    app.match = state;
    app.role = "solo";
    app.meId = "me";
    app.code = state.code;
    app.renderedDeck = 0;
    app.recordedMatchId = null;
    app.showResultsFor = null;
    app.lastRoundAt = null;
    app.lastResetAt = null;

    E.start(state, { letter: E.pickStartLetter(category) });
    closeAllSheets();
    if (app.deck) app.deck.reset();
    showScreen("game");
    renderGame();
    scheduleBots();
  }

  function hostOnline(category, turnSeconds, attempt) {
    if (!root.AtlasNet || !root.AtlasNet.available()) {
      toast("Online play needs the network script. Reload and try again.");
      return;
    }
    var tries = attempt || 0;
    var code = E.randomCode(5);
    closeAllSheets();
    toast("Creating your room…");

    var net = root.AtlasNet.createRoom(code, {
      onReady: function (readyCode) {
        var profile = Profile.read();
        var state = E.createMatch({
          category: category,
          turnSeconds: turnSeconds,
          maxPasses: 3,
          mode: "host",
          code: readyCode,
          players: [{ name: profile.name, id: "me", ready: true }]
        });
        app.match = state;
        app.role = "host";
        app.meId = "me";
        app.code = readyCode;
        app.net = net;
        app.peerPlayers = {};
        app.renderedDeck = 0;
        app.recordedMatchId = null;
        app.showResultsFor = null;
        showScreen("lobby");
        renderLobby();
        toast("Room " + readyCode + " is live.");
      },
      onMessage: handleHostMessage,
      onPeerOpen: function () {},
      onPeerClose: function (peerId) {
        var playerId = app.peerPlayers[peerId];
        if (!playerId || !app.match) return;
        delete app.peerPlayers[peerId];
        E.removePlayer(app.match, playerId);
        toast("A player left the room.");
        afterState();
      },
      onError: function (message, raw) {
        if (raw && raw.type === "unavailable-id" && tries < 2) {
          try { net.close(); } catch (e) {}
          hostOnline(category, turnSeconds, tries + 1);
          return;
        }
        toast(message || "Could not create the room.");
        app.net = null;
      }
    });
  }

  function handleHostMessage(peerId, msg) {
    if (!msg || typeof msg !== "object" || !app.match) return;

    if (msg.t === "hello") {
      var name = String(msg.name || "Player").slice(0, 14).trim() || "Player";
      var added = E.addPlayer(app.match, { name: name, ready: true });
      if (!added.ok) {
        app.net.send(peerId, { t: "error", message: added.error });
        return;
      }
      app.peerPlayers[peerId] = added.playerId;
      app.net.send(peerId, { t: "welcome", you: added.playerId, state: app.match, now: Date.now(), code: app.code });
      toast(name + " joined.");
      afterState({ noBots: true });
      return;
    }

    var playerId = app.peerPlayers[peerId];
    if (!playerId) return;

    if (msg.t === "action" && msg.action) {
      var action = msg.action;
      if (action.type === "submit") {
        var result = E.submit(app.match, playerId, action.word, hostNow());
        if (!result.ok) {
          app.net.send(peerId, { t: "reject", message: result.error, reason: result.reason, suggestion: result.suggestion || null });
          return;
        }
        afterState();
      } else if (action.type === "pass") {
        var passed = E.pass(app.match, playerId);
        if (!passed.ok) app.net.send(peerId, { t: "reject", message: passed.error });
        else afterState();
      } else if (action.type === "leave") {
        delete app.peerPlayers[peerId];
        E.removePlayer(app.match, playerId);
        afterState();
      }
    }
  }

  function joinOnline(code, name) {
    if (!root.AtlasNet || !root.AtlasNet.available()) {
      toast("Online play needs the network script. Reload and try again.");
      return;
    }
    toast("Joining " + code + "…");

    var net = root.AtlasNet.joinRoom(code, {
      onOpen: function () {
        net.send({ t: "hello", name: name });
      },
      onMessage: handleGuestMessage,
      onError: function (message) {
        toast(message || "Could not join that room.");
        app.net = null;
      },
      onClose: function () {
        if (app.role === "guest") {
          toast("Disconnected from the room.");
          resetToHome();
        }
      }
    });

    app.net = net;
    app.role = "guest";
    app.code = code;
    closeAllSheets();
  }

  function handleGuestMessage(msg) {
    if (!msg || typeof msg !== "object") return;

    if (msg.t === "welcome") {
      app.meId = msg.you;
      app.match = msg.state;
      app.renderedDeck = msg.state.deck.length;
      app.clockOffset = Date.now() - (msg.now || Date.now());
      app.recordedMatchId = null;
      app.showResultsFor = null;
      app.lastRoundAt = null;
      if (app.deck) app.deck.reset();
      toast("Joined room " + (msg.code || app.code) + ".");
      afterGuestState();
      return;
    }

    if (msg.t === "state") {
      app.clockOffset = Date.now() - (msg.now || Date.now());
      app.match = msg.state;
      afterGuestState();
      return;
    }

    if (msg.t === "reject") {
      var hint = $("#answerHint");
      if (hint) {
        hint.classList.remove("is-good");
        hint.classList.add("is-bad");
        hint.textContent = "✕ " + (msg.message || "Not accepted");
      }
      if (root.SoundEngine) root.SoundEngine.playInvalidBuzz();
      var form = $("#answerForm");
      if (form) form.classList.add("shake");
      setTimeout(function () { if (form) form.classList.remove("shake"); }, 400);
      return;
    }

    if (msg.t === "error") {
      toast(msg.message || "The host rejected the connection.");
      resetToHome();
    }
  }

  function afterGuestState() {
    var state = app.match;
    if (!state) return;
    if (state.status === E.STATUS.LOBBY) {
      showScreen("lobby");
      renderLobby();
    } else {
      if (app.screen !== "game") showScreen("game");
      renderGame();
    }
  }

  function submitAnswer(word) {
    if (!app.match) return;
    var state = app.match;

    if (app.role === "guest") {
      if (!app.net) return;
      var localCheck = E.validate(state, app.meId, word, hostNow());
      if (localCheck.status !== "ok") {
        rejectLocally(localCheck);
        return;
      }
      app.net.send({ t: "action", action: { type: "submit", word: word } });
      var hint = $("#answerHint");
      if (hint) { hint.classList.remove("is-bad"); hint.textContent = "Checking with the host…"; }
      return;
    }

    var result = E.submit(state, app.meId, word, hostNow());
    if (!result.ok) {
      rejectLocally(result);
      return;
    }
    if (root.SoundEngine) root.SoundEngine.playValidChime();
    vibrate([10, 30, 12]);
    $("#answerInput").value = "";
    afterState();
  }

  function rejectLocally(result) {
    var form = $("#answerForm");
    var hint = $("#answerHint");
    if (form) {
      form.classList.add("shake");
      setTimeout(function () { form.classList.remove("shake"); }, 380);
    }
    if (hint) {
      hint.classList.remove("is-good");
      hint.classList.add("is-bad");
      hint.textContent = "✕ " + (result.message || result.error || "Not accepted") +
        (result.suggestion ? " — did you mean " + result.suggestion + "?" : "");
    }
    if (root.SoundEngine) root.SoundEngine.playInvalidBuzz();
    vibrate([40, 40, 40]);
  }

  function passTurn() {
    if (!app.match) return;
    if (app.match.activeId !== app.meId) return;
    if (app.role === "guest") {
      if (app.net) app.net.send({ t: "action", action: { type: "pass" } });
      return;
    }
    var res = E.pass(app.match, app.meId);
    if (!res.ok) toast(res.error);
    else {
      if (root.SoundEngine) root.SoundEngine.playClick();
      afterState();
    }
  }

  // ---------------------------------------------------------------- results

  function handleMatchEnd() {
    var state = app.match;
    if (!state || state.status !== E.STATUS.MATCH_END) return;
    if (app.showResultsFor === state.id + ":" + state.version) return;

    var standings = E.standings(state);
    var me = standings.filter(function (p) { return p.id === app.meId; })[0] || standings[standings.length - 1];
    var winner = standings[0];

    if (app.recordedMatchId !== state.id) {
      app.recordedMatchId = state.id;
      Profile.recordMatch({
        category: state.category,
        score: me.score,
        place: me.place,
        players: state.players.length,
        words: me.words,
        bestStreak: me.bestStreak,
        won: winner && winner.id === app.meId,
        mode: app.role
      });
    }

    app.showResultsFor = state.id + ":" + state.version;

    var title = winner && winner.id === app.meId ? "You win." : (winner ? winner.name + " wins." : "Match over.");
    $("#resultTitle").textContent = title;
    $("#resultSub").textContent = state.deck.length + " cards across " + state.round + " rounds.";
    $("#resultCategory").textContent = categoryMeta(state.category).label;

    $("#resultList").innerHTML = standings.map(function (p) {
      return (
        '<div class="result-row' + (p.id === app.meId ? " is-you" : "") + '">' +
        '<span class="result-place">' + p.place + "</span>" +
        '<span class="result-name">' + (p.id === app.meId ? "You" : p.name) + "</span>" +
        '<span class="result-words">' + p.words + " cards</span>" +
        '<span class="result-score">' + p.score + "</span>" +
        "</div>"
      );
    }).join("");

    var deckRow = $("#resultDeck");
    if (deckRow) {
      deckRow.innerHTML = state.deck.slice(-8).reverse().map(function (card) {
        return '<span class="chip">' + (card.emoji || "◈") + " " + card.word + "</span>";
      }).join("") || '<span class="chip">No cards played</span>';
    }

    showScreen("results");
    if (root.SoundEngine) root.SoundEngine.playFanfare();
    vibrate([20, 40, 20]);
    celebrate();
  }

  function celebrate() {
    if (typeof root.confetti !== "function") return;
    try {
      var probe = document.createElement("canvas");
      if (!probe.getContext || !probe.getContext("2d")) return;
      root.confetti({ particleCount: 90, spread: 70, origin: { y: 0.62 }, colors: ["#d8b25a", "#f2ebdd", "#a9793a"] });
    } catch (e) {}
  }

  function shareResult() {
    var state = app.match;
    if (!state) return;
    var standings = E.standings(state);
    var lines = standings.map(function (p) {
      return p.place + ". " + (p.id === app.meId ? "You" : p.name) + " — " + p.score;
    });
    var text = "ATLAS · " + categoryMeta(state.category).label + "\n" +
      standings[0].name + " wins with " + standings[0].score + " points\n" + lines.join("\n");
    var url = location.origin + location.pathname;
    if (navigator.share) {
      navigator.share({ title: "ATLAS", text: text, url: url }).catch(function () {});
    } else {
      copyText(text + "\n" + url)
        .then(function () { toast("Score copied."); })
        .catch(function () { toast("Could not copy the score."); });
    }
  }

  // ------------------------------------------------------------- navigation

  function resetToHome() {
    clearBotTimer();
    releaseAwake();
    if (app.net) { try { app.net.close(); } catch (e) {} }
    app.net = null;
    app.match = null;
    app.role = "solo";
    app.meId = null;
    app.code = null;
    app.peerPlayers = {};
    app.renderedDeck = 0;
    app.showResultsFor = null;
    app.lastRoundAt = null;
    app.lastResetAt = null;
    if (app.deck) app.deck.reset();
    showScreen("home");
  }

  function leaveMatch() {
    var live = app.match && app.match.status === E.STATUS.PLAYING;
    if (live && !window.confirm("Leave this match? Your progress will not be saved.")) return;
    var wasHost = app.role === "host";
    if (app.role === "guest" && app.net) {
      app.net.send({ t: "action", action: { type: "leave" } });
    }
    resetToHome();
    if (wasHost) toast("Room closed.");
  }

  function bindGame() {
    $("#answerForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var input = $("#answerInput");
      var value = (input.value || "").trim();
      if (!value) return;
      if (!app.match || app.match.activeId !== app.meId) {
        toast("Wait for your turn.");
        return;
      }
      submitAnswer(value);
    });

    $("#answerInput").addEventListener("input", updateAnswerHint);
    $("#passBtn").addEventListener("click", passTurn);
    $("#leaveBtn").addEventListener("click", leaveMatch);
    $("#gameBackBtn").addEventListener("click", leaveMatch);
    $("#deckInfoBtn").addEventListener("click", function () { openSheet("sheetRules"); });

    $("#playAgainBtn").addEventListener("click", function () {
      var state = app.match;
      if (!state) { showScreen("home"); return; }

      if (app.role === "guest") {
        resetToHome();
        toast("Ask the host to start a rematch.");
        return;
      }

      if (app.role === "host") {
        // Same room, fresh match: everyone already in the room stays in it.
        E.start(state, { letter: E.pickStartLetter(state.category) });
        app.renderedDeck = 0;
        app.showResultsFor = null;
        app.recordedMatchId = null;
        app.lastRoundAt = null;
        app.lastResetAt = null;
        if (app.deck) app.deck.reset();
        afterState();
        return;
      }

      var category = state.category;
      var seconds = state.turnSeconds;
      var bots = state.players.filter(function (p) { return p.bot; }).length || 2;
      resetToHome();
      startSolo(category, seconds, bots);
    });
    $("#homeBtn").addEventListener("click", resetToHome);
    $("#shareScoreBtn").addEventListener("click", shareResult);
  }

  // ------------------------------------------------------------------- boot

  function bindWelcome() {
    $("#welcomeStartBtn").addEventListener("click", function () {
      Profile.completeOnboarding();
      if (root.SoundEngine) { root.SoundEngine.init(); root.SoundEngine.playClick(); }
      showScreen("home");
    });
    $("#welcomeRulesBtn").addEventListener("click", function () { openSheet("sheetRules"); });
  }

  function bindCreateSheet() {
    $$("#createTimers .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(chip.parentNode.children, function (c) { c.classList.remove("is-on"); });
        chip.classList.add("is-on");
      });
    });
    $$("#createBots .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.forEach.call(chip.parentNode.children, function (c) { c.classList.remove("is-on"); });
        chip.classList.add("is-on");
      });
    });

    function currentTimer() {
      var on = $("#createTimers .chip.is-on");
      return on ? parseInt(on.getAttribute("data-sec"), 10) : 20;
    }
    function currentBots() {
      var on = $("#createBots .chip.is-on");
      return on ? parseInt(on.getAttribute("data-bots"), 10) : 2;
    }

    $("#createSoloBtn").addEventListener("click", function () {
      startSolo(app.category, currentTimer(), currentBots());
    });
    $("#createOnlineBtn").addEventListener("click", function () {
      hostOnline(app.category, currentTimer());
    });
    $("#onlineCreateBtn").addEventListener("click", function () {
      closeSheet("sheetOnline");
      openSheet("sheetCreate");
    });
    $("#onlineJoinBtn").addEventListener("click", function () {
      closeSheet("sheetOnline");
      openSheet("sheetJoin");
    });
  }

  function bindJoinSheet() {
    $("#joinCode").addEventListener("input", function () {
      var input = $("#joinCode");
      var clean = (input.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
      if (input.value !== clean) input.value = clean;
    });

    $("#joinRoomBtn").addEventListener("click", function () {
      var code = ($("#joinCode").value || "").trim().toUpperCase();
      var name = ($("#joinName").value || "").trim().slice(0, 14) || Profile.read().name;
      if (code.length !== 5) {
        toast("Enter the five-letter room code.");
        return;
      }
      Profile.update({ name: name });
      joinOnline(code, name);
    });
  }

  function bindTimerLoop() {
    setInterval(function () {
      var state = app.match;
      if (!state || state.status !== E.STATUS.PLAYING) return;

      var now = hostNow();
      var remaining = state.deadline - now;
      renderTimer(Math.max(0, remaining), state.turnSeconds);

      if (remaining <= 0 && app.role !== "guest") {
        var res = E.tick(state, now);
        if (res.ok) afterState();
      }
    }, 220);
  }

  function bindNetworkStatus() {
    window.addEventListener("online", function () { toast("Back online."); });
    window.addEventListener("offline", function () { toast("You are offline. Solo play still works."); });
  }

  function boot() {
    var profile = Profile.read();
    if (root.SoundEngine) {
      root.SoundEngine.setEnabled(profile.sound);
      root.SoundEngine.setHaptics(profile.haptics);
    }

    setupDeck();
    bindSheets();
    bindWelcome();
    bindHomeSwipe();
    bindCreateSheet();
    bindJoinSheet();
    bindLobby();
    bindGame();
    bindProfile();
    bindTimerLoop();
    bindNetworkStatus();

    $("#quickPlayBtn").addEventListener("click", function () {
      startSolo(app.category, 20, 2);
    });
    $("#onlineBtn").addEventListener("click", function () { openSheet("sheetOnline"); });
    $("#joinShortcutBtn").addEventListener("click", function () { openSheet("sheetJoin"); });
    $("#joinName").value = profile.name;

    if (profile.onboarded) showScreen("home");
    else showScreen("welcome");

    // Manifest shortcuts: ./?play=solo and ./?screen=ranking
    try {
      var params = new URLSearchParams(location.search);
      var wanted = params.get("screen");
      if (params.get("play") === "solo" && profile.onboarded) {
        startSolo(app.category, 20, 2);
      } else if (wanted && document.querySelector('.screen[data-screen="' + wanted + '"]') && profile.onboarded) {
        showScreen(wanted);
      }
    } catch (e) {}

    renderHome();
    renderRanking();
    renderProfile();

    if (root.AtlasPWA) {
      root.AtlasPWA.init({
        onInstallAvailable: function () { renderInstallSlot(); toast("ATLAS can be installed as an app."); },
        onInstalled: function () { renderInstallSlot(); toast("ATLAS installed."); },
        onUpdate: function () { toast("A new version is ready — reopen the app to update."); }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  root.AtlasApp = {
    state: function () { return app; },
    showScreen: showScreen,
    startSolo: startSolo,
    hostOnline: hostOnline,
    joinOnline: joinOnline,
    toast: toast
  };
})(typeof window !== "undefined" ? window : globalThis);
