/**
 * ATLAS — card art + deck component
 *
 * The deck is the heart of the game: one empty card waits for the active
 * player, the answer fills it with its icon and photo, the card swipes away,
 * and the next empty card is already underneath.
 */
(function (root) {
  "use strict";

  /**
   * Art rotation. brand.config.js can repoint every slot, which is how a
   * white-label build ships its own photography. Fall back to the bundled
   * desert set when the config is missing or a slot is empty.
   */
  var FALLBACK_ART = [
    "assets/img/hero-dunes.jpg",
    "assets/img/card-coast.jpg",
    "assets/img/hero-ridge.jpg",
    "assets/img/card-camp.jpg"
  ];

  function resolveArt() {
    var brand = root.AtlasBrand && root.AtlasBrand.config ? root.AtlasBrand.config.art : null;
    if (!brand) return FALLBACK_ART.slice();
    var art = [
      brand.dunes || FALLBACK_ART[0],
      brand.coast || FALLBACK_ART[1],
      brand.ridge || FALLBACK_ART[2],
      brand.camp || FALLBACK_ART[3]
    ];
    // Never ship a duplicate path into the rotation.
    var seen = {};
    return art.filter(function (path, i) {
      if (seen[path]) return false;
      seen[path] = true;
      return true;
    });
  }

  var ART = resolveArt();

  // Each world gets a consistent lead photo so the deck changes character.
  var CATEGORY_ART = {
    PLACES: 0,
    CITIES: 1,
    COUNTRIES: 2,
    MOVIES: 3,
    ANIMALS: 1,
    FOOD: 0
  };

  var CATEGORY_TINT = {
    PLACES: "rgba(201, 150, 74, 0.22)",
    CITIES: "rgba(90, 146, 158, 0.2)",
    COUNTRIES: "rgba(150, 112, 78, 0.22)",
    MOVIES: "rgba(60, 52, 44, 0.34)",
    ANIMALS: "rgba(126, 145, 96, 0.2)",
    FOOD: "rgba(176, 108, 60, 0.2)"
  };

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function photoFor(card, category) {
    var base = CATEGORY_ART[category] != null ? CATEGORY_ART[category] : 0;
    var offset = hash(card.norm || card.word || "") % ART.length;
    return ART[(base + offset) % ART.length];
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Markup for the face of an accepted card. */
  function filledMarkup(card, category, options) {
    var opts = options || {};
    var photo = photoFor(card, category);
    var tint = CATEGORY_TINT[category] || CATEGORY_TINT.PLACES;
    return (
      '<div class="deck-card__art" style="background-image:url(\'' + photo + '\')"></div>' +
      '<div class="deck-card__tint" style="background:' +
      "linear-gradient(180deg, " + tint + " 0%, rgba(10,9,8,0.2) 45%, rgba(10,9,8,0.94) 100%)" +
      '"></div>' +
      '<div class="deck-card__points">' + (opts.showPoints === false ? "" : "+" + (card.points || 0) + " pts") + "</div>" +
      '<div class="deck-card__content">' +
      '<div class="deck-card__emoji" aria-hidden="true">' + (card.emoji || "◈") + "</div>" +
      '<div class="deck-card__word">' + escapeText(card.word) + "</div>" +
      '<div class="deck-card__note">' + escapeText(card.note || "") + "</div>" +
      '<div class="deck-card__by">' + escapeText(card.byName || "") + "</div>" +
      "</div>"
    );
  }

  /** Markup for the waiting card. */
  function emptyMarkup(letter, hint, label) {
    return (
      '<div class="deck-empty">' +
      '<span class="deck-empty__label">' + escapeText(label || "Starting letter") + "</span>" +
      '<div class="deck-empty__letter">' + escapeText(letter || "?") + "</div>" +
      '<p class="deck-empty__hint">' + escapeText(hint || "") + "</p>" +
      "</div>"
    );
  }

  /**
   * createDeck(rootEl)
   *  deck.setBase({category, letter, hint, label})
   *  deck.reveal(card, { onDone })
   *  deck.reset()
   */
  function createDeck(rootEl) {
    var history = [];
    var revealing = false;
    var finishCurrent = null; // lets a fast new card complete the previous animation

    function baseState() {
      return {
        category: "PLACES",
        letter: "A",
        hint: "",
        label: "Starting letter"
      };
    }
    var baseInfo = baseState();

    function buildHistoryCard(card, depth) {
      var el = document.createElement("div");
      el.className = "deck-card deck-card--back-" + depth + " is-filled";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = filledMarkup(card, baseInfo.category, { showPoints: false });
      return el;
    }

    function render() {
      if (!rootEl) return;
      rootEl.innerHTML = "";

      // Oldest first so the newest history card sits closest to the top.
      for (var i = Math.min(history.length, 2) - 1; i >= 0; i--) {
        var depth = i + 1; // 1 = closest to top
        rootEl.appendChild(buildHistoryCard(history[i], depth));
      }

      var base = document.createElement("div");
      base.className = "deck-card deck-card--top";
      base.setAttribute("data-role", "empty");
      base.innerHTML = emptyMarkup(baseInfo.letter, baseInfo.hint, baseInfo.label);
      rootEl.appendChild(base);
    }

    function setBase(info) {
      baseInfo = Object.assign({}, baseInfo, info || {});
      var node = rootEl && rootEl.querySelector('[data-role="empty"]');
      if (node) node.innerHTML = emptyMarkup(baseInfo.letter, baseInfo.hint, baseInfo.label);
      // keep history art in the current category palette
      Array.prototype.forEach.call(rootEl.querySelectorAll(".deck-card--back-1, .deck-card--back-2"), function (el, idx) {
        var card = history[idx];
        if (card) el.innerHTML = filledMarkup(card, baseInfo.category, { showPoints: false });
      });
    }

    function reveal(card, options) {
      if (!rootEl || !card) return;
      var opts = options || {};

      // In fast multiplayer two cards can land within one animation window.
      // Finish the previous reveal immediately instead of stacking elements.
      if (finishCurrent) {
        var previous = finishCurrent;
        finishCurrent = null;
        previous();
      }
      revealing = true;

      var el = document.createElement("div");
      el.className = "deck-card deck-card--top deck-card--reveal deck-card--deal is-filled";
      el.setAttribute("data-role", "reveal");
      el.innerHTML = filledMarkup(card, baseInfo.category);

      // Entry animation, then swipe away.
      rootEl.appendChild(el);
      if (root.SoundEngine && root.SoundEngine.playDeal) root.SoundEngine.playDeal();

      var swipeAt = opts.holdMs != null ? opts.holdMs : 950;
      var doneTimer = null;
      var finished = false;

      function finish() {
        if (finished) return;
        finished = true;
        if (doneTimer) clearTimeout(doneTimer);
        if (finishCurrent === finish) finishCurrent = null;

        // A deck reset removes the card; in that case it must not enter history.
        if (!el.parentNode) {
          revealing = false;
          return;
        }
        el.parentNode.removeChild(el);
        history.unshift(card);
        history = history.slice(0, 2);
        revealing = false;
        render();
        if (typeof opts.onDone === "function") opts.onDone();
      }

      finishCurrent = finish;

      function swipe() {
        if (finished) return;
        el.classList.add("deck-card--swipe");
        if (root.SoundEngine && root.SoundEngine.playSwipe) root.SoundEngine.playSwipe();
        doneTimer = setTimeout(finish, 560);
      }

      var holdTimer = setTimeout(swipe, swipeAt);
      el.addEventListener("click", function () {
        clearTimeout(holdTimer);
        swipe();
      });
      // A hard failure of the animation should never leave a card stuck.
      setTimeout(function () {
        if (revealing && !finished) {
          clearTimeout(holdTimer);
          swipe();
        }
      }, swipeAt + 2600);
    }

    function reset(info) {
      history = [];
      revealing = false;
      finishCurrent = null;
      if (info) baseInfo = Object.assign(baseState(), info);
      render();
    }

    reset();

    return {
      setBase: setBase,
      reveal: reveal,
      reset: reset,
      history: function () { return history.slice(); }
    };
  }

  root.AtlasCards = {
    createDeck: createDeck,
    filledMarkup: filledMarkup,
    emptyMarkup: emptyMarkup,
    photoFor: photoFor,
    ART: ART,
    FALLBACK_ART: FALLBACK_ART,
    resolveArt: resolveArt,
    CATEGORY_ART: CATEGORY_ART,
    CATEGORY_TINT: CATEGORY_TINT
  };
})(typeof window !== "undefined" ? window : globalThis);
