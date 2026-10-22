/**
 * ATLAS — install + offline plumbing
 *
 * Registers the service worker (relative to the deployed sub-path, so it works
 * on GitHub Pages project sites) and exposes the install prompt to the UI.
 */
(function (root) {
  "use strict";

  var deferredPrompt = null;
  var handlers = {};
  var registered = null;
  var reloading = false;

  function isStandalone() {
    try {
      if (root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) return true;
      if (root.matchMedia && root.matchMedia("(display-mode: fullscreen)").matches) return true;
    } catch (e) {}
    return root.navigator && root.navigator.standalone === true;
  }

  function isIOS() {
    var ua = (root.navigator && root.navigator.userAgent) || "";
    var iOS = /iPad|iPhone|iPod/.test(ua);
    var iPadOS = /Macintosh/.test(ua) && "ontouchend" in document;
    return iOS || iPadOS;
  }

  function canInstall() {
    return !!deferredPrompt && !isStandalone();
  }

  function promptInstall() {
    if (!deferredPrompt) return Promise.resolve(false);
    var prompt = deferredPrompt;
    deferredPrompt = null;
    try { prompt.prompt(); } catch (e) { return Promise.resolve(false); }
    return prompt.userChoice.then(function (choice) {
      var accepted = choice && choice.outcome === "accepted";
      if (accepted && handlers.onInstalled) handlers.onInstalled();
      return accepted;
    }).catch(function () { return false; });
  }

  function registerWorker() {
    if (!("serviceWorker" in root.navigator)) return;
    if (root.location.protocol !== "https:" && root.location.hostname !== "localhost" && root.location.hostname !== "127.0.0.1") return;

    root.navigator.serviceWorker.register("sw.js").then(function (reg) {
      registered = reg;

      function watch(worker) {
        if (!worker) return;
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed" && root.navigator.serviceWorker.controller && !reloading) {
            reloading = true;
            if (handlers.onUpdate) handlers.onUpdate();
          }
        });
      }

      if (reg.installing) watch(reg.installing);
      reg.addEventListener("updatefound", function () { watch(reg.installing); });
    }).catch(function () {
      // Offline support is a bonus; the game must keep working without it.
    });
  }

  function init(options) {
    handlers = options || {};

    root.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredPrompt = event;
      if (handlers.onInstallAvailable) handlers.onInstallAvailable();
    });

    root.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      if (handlers.onInstalled) handlers.onInstalled();
    });

    if (document.readyState === "complete") registerWorker();
    else root.addEventListener("load", registerWorker);
  }

  root.AtlasPWA = {
    init: init,
    isStandalone: isStandalone,
    isIOS: isIOS,
    canInstall: canInstall,
    promptInstall: promptInstall,
    registration: function () { return registered; }
  };
})(typeof window !== "undefined" ? window : globalThis);
