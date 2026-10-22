/**
 * ATLAS — peer transport
 *
 * GitHub Pages is static, so multiplayer is peer-to-peer with PeerJS: the host's
 * phone owns the authoritative match state, guests send intents and receive
 * snapshots. Only the tiny signalling handshake touches a public server; game
 * traffic is direct between devices.
 *
 * The host's peer id is derived from the room code, so "join ABCD5" is enough to
 * find the room — no accounts, keys or configuration.
 */
(function (root) {
  "use strict";

  var PREFIX = "atlas3-";
  var JOIN_TIMEOUT = 14000;

  function peerAvailable() {
    return typeof root.Peer === "function";
  }

  function peerIdFor(code) {
    return PREFIX + String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function friendlyPeerError(err) {
    var type = err && (err.type || err.name);
    switch (type) {
      case "unavailable-id":
        return "That room code is already live. Try again.";
      case "peer-unavailable":
        return "Room not found. Check the code.";
      case "network":
        return "No connection to the room service. Check your internet.";
      case "server-error":
        return "Room service is busy. Try again in a moment.";
      case "browser-incompatible":
        return "This browser cannot do peer-to-peer play.";
      case "ssl-unavailable":
        return "Secure connection required. Open the site over HTTPS.";
      case "webrtc":
        return "Could not open a direct connection. Try again.";
      default:
        return (err && err.message) || "Connection failed.";
    }
  }

  /**
   * Host a room.
   * handlers: { onReady(code), onMessage(peerId, msg), onPeerOpen(peerId),
   *             onPeerClose(peerId), onError(message), onClosed() }
   */
  function createRoom(code, handlers) {
    var h = handlers || {};
    if (!peerAvailable()) {
      if (h.onError) h.onError("Peer-to-peer is unavailable. Reload and try again.");
      return { code: code, close: function () {}, broadcast: function () {}, send: function () {}, peers: function () { return []; }, isHost: true };
    }

    var connections = {};
    var peer = null;
    var closed = false;

    function destroy() {
      if (closed) return;
      closed = true;
      try {
        Object.keys(connections).forEach(function (id) {
          try { connections[id].close(); } catch (e) {}
        });
        connections = {};
        if (peer) peer.destroy();
      } catch (e) {}
    }

    peer = new root.Peer(peerIdFor(code), { debug: 0 });

    peer.on("open", function (id) {
      if (h.onReady) h.onReady(code, id);
    });

    peer.on("connection", function (conn) {
      connections[conn.peer] = conn;

      conn.on("open", function () {
        if (h.onPeerOpen) h.onPeerOpen(conn.peer);
      });

      conn.on("data", function (data) {
        if (h.onMessage) h.onMessage(conn.peer, data);
      });

      conn.on("close", function () {
        delete connections[conn.peer];
        if (h.onPeerClose) h.onPeerClose(conn.peer);
      });

      conn.on("error", function () {
        delete connections[conn.peer];
        if (h.onPeerClose) h.onPeerClose(conn.peer);
      });
    });

    peer.on("error", function (err) {
      var fatal = err && (err.type === "unavailable-id" || err.type === "network" || err.type === "server-error" || err.type === "browser-incompatible");
      if (h.onError) h.onError(friendlyPeerError(err), err);
      if (fatal) destroy();
    });

    peer.on("disconnected", function () {
      if (closed) return;
      try { peer.reconnect(); } catch (e) {}
    });

    return {
      code: code,
      isHost: true,
      broadcast: function (msg) {
        Object.keys(connections).forEach(function (id) {
          try {
            if (connections[id] && connections[id].open) connections[id].send(msg);
          } catch (e) {}
        });
      },
      send: function (peerId, msg) {
        var conn = connections[peerId];
        if (!conn || !conn.open) return false;
        try {
          conn.send(msg);
          return true;
        } catch (e) {
          return false;
        }
      },
      peers: function () { return Object.keys(connections); },
      close: destroy
    };
  }

  /**
   * Join a room.
   * handlers: { onOpen(), onMessage(msg), onError(message), onClose() }
   */
  function joinRoom(code, handlers) {
    var h = handlers || {};
    if (!peerAvailable()) {
      if (h.onError) h.onError("Peer-to-peer is unavailable. Reload and try again.");
      return { send: function () {}, close: function () {}, isHost: false };
    }

    var peer = null;
    var conn = null;
    var closed = false;
    var opened = false;

    var timeout = setTimeout(function () {
      if (!opened && !closed) {
        if (h.onError) h.onError("Room not found. Check the code and try again.");
        destroy();
      }
    }, JOIN_TIMEOUT);

    function destroy() {
      if (closed) return;
      closed = true;
      clearTimeout(timeout);
      try {
        if (conn) conn.close();
        if (peer) peer.destroy();
      } catch (e) {}
      if (h.onClose) h.onClose();
    }

    peer = new root.Peer(null, { debug: 0 });

    peer.on("open", function () {
      if (closed) return;
      conn = peer.connect(peerIdFor(code), { reliable: true });

      conn.on("open", function () {
        if (opened || closed) return;
        opened = true;
        clearTimeout(timeout);
        if (h.onOpen) h.onOpen();
      });

      conn.on("data", function (data) {
        if (h.onMessage) h.onMessage(data);
      });

      conn.on("close", function () {
        if (!closed) {
          if (h.onClose) h.onClose();
          destroy();
        }
      });

      conn.on("error", function () {
        if (!opened && !closed) {
          clearTimeout(timeout);
          if (h.onError) h.onError("Could not join that room.");
          destroy();
        }
      });
    });

    peer.on("error", function (err) {
      if (closed) return;
      clearTimeout(timeout);
      if (h.onError) h.onError(friendlyPeerError(err));
      destroy();
    });

    return {
      isHost: false,
      send: function (msg) {
        if (!conn || !conn.open) return false;
        try {
          conn.send(msg);
          return true;
        } catch (e) {
          return false;
        }
      },
      close: destroy
    };
  }

  root.AtlasNet = {
    available: peerAvailable,
    peerIdFor: peerIdFor,
    createRoom: createRoom,
    joinRoom: joinRoom,
    friendlyPeerError: friendlyPeerError
  };
})(typeof window !== "undefined" ? window : globalThis);
