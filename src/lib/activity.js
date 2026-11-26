// Shared browser activity and tab-visibility helpers for adaptive polling.

let lastActivityAt = Date.now();
let listenersAttached = false;

function markActive() {
  lastActivityAt = Date.now();
}

export function ensureActivityListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  const opts = { passive: true, capture: true };
  window.addEventListener("pointerdown", markActive, opts);
  window.addEventListener("keydown", markActive, opts);
  window.addEventListener("touchstart", markActive, opts);
  window.addEventListener("focus", markActive, true);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) markActive();
    });
  }
}

export function getLastUserActivityAt() {
  ensureActivityListeners();
  return lastActivityAt;
}

export function isUserIdle(idleMs = 90_000) {
  ensureActivityListeners();
  return Date.now() - lastActivityAt >= idleMs;
}

export function isTabHidden() {
  return typeof document !== "undefined" && document.hidden === true;
}

export function __resetActivityForTests(ts = Date.now()) {
  lastActivityAt = ts;
}
