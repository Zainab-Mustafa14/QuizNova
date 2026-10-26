

export function createTimer({
  onTick = () => {},
  onExpire = () => {},
  tickMs = 200,
  now = () => performance.now(), 
} = {}) {
  let intervalId = null;
  let deadline = 0;
  let durationMs = 0;

  function tick() {
    if (intervalId === null) return;
    const remainingMs = Math.max(0, deadline - now()); // never negative
    onTick({
      remainingMs,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      fraction: durationMs > 0 ? remainingMs / durationMs : 0, 
    });
    if (remainingMs <= 0) {
      stop(); 
      onExpire();
    }
  }

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function start(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new RangeError("Timer duration must be a positive number of seconds.");
    }
    stop(); 
    durationMs = seconds * 1000;
    deadline = now() + durationMs;
    intervalId = setInterval(tick, tickMs);
    tick(); 
  }

  return Object.freeze({
    start,
    stop,
    isRunning: () => intervalId !== null,
  });
}