// Server-side scheduling only. No Firebase writes without a trusted adapter.
export function createTrendPublisher({
  readSummary, publishSummary, intervalMs = 2000,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = handle => clearTimeout(handle),
  onError = () => {}
}) {
  if (typeof readSummary !== "function" || typeof publishSummary !== "function" ||
      !Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error("Invalid publisher configuration");
  let timer = null, inFlight = null, dirty = false, sealed = false;
  let lastPublished = null, finalTask = null;
  async function sync() {
    // Read the authoritative aggregate, never a vote delta supplied by a client.
    const summary = await readSummary();
    const signature = JSON.stringify([summary.tour, summary.totalPlayers,
      summary.validatedVotes, Object.entries(summary.counts).sort(([a], [b]) => Number(a) - Number(b))]);
    if (signature === lastPublished) return false;
    // Adapter MUST await a guarded, idempotent server write for this game/round/group.
    await publishSummary(summary);
    lastPublished = signature;
    return true;
  }
  function schedule() {
    if (sealed || !dirty || timer !== null || inFlight) return;
    // Fixed window from the first change, not a sliding debounce.
    timer = setTimer(() => {
      timer = null;
      if (sealed || !dirty) return;
      dirty = false;
      inFlight = Promise.resolve().then(sync).catch(error => {
        dirty = true; // Retry in another window, not a tight loop.
        try { onError(error); } catch { /* Reporting must not stop retry. */ }
      }).finally(() => { inFlight = null; schedule(); });
      return inFlight;
    }, intervalMs);
  }
  function notify() {
    if (sealed) return false;
    dirty = true;
    schedule();
    return true;
  }
  function flushFinal() {
    // Caller must first close voting authoritatively and settle all accepted writes.
    // One publisher per immutable event / game / round / group.
    sealed = true;
    if (timer !== null) { clearTimer(timer); timer = null; }
    if (!finalTask) {
      finalTask = (async () => {
        await inFlight;
        dirty = false;
        // Always re-read at closure, even if no notification arrived.
        return sync();
      })().catch(error => { finalTask = null; throw error; });
    }
    return finalTask;
  }
  return { notify, flushFinal };
}
