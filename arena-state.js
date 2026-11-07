import { events as defaultEvents } from './data.js';

export const SHARED_STATE_KEY = 'strength-arena:shared-demo:v1';
export const SHARED_CHANNEL_NAME = 'strength-arena:shared-demo';
export const RESULT_STATUSES = Object.freeze(['valid', 'pending', 'DNS', 'DNF']);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateResult(result, event) {
  if (!result || !event || typeof result.athleteId !== 'string' || typeof result.eventId !== 'string') return false;
  if (!RESULT_STATUSES.includes(result.status)) return false;
  if (result.value === null || result.value === undefined) return result.status !== 'valid';
  if (!isFiniteNumber(result.value) || result.value < 0) return false;
  if (event.type === 'reps' && !Number.isInteger(result.value)) return false;
  if (event.type === 'time' && result.value === 0) return false;
  return true;
}

export function validateResults(results, eventList = defaultEvents) {
  if (!Array.isArray(results)) return false;
  const definitions = new Map(eventList.map((event) => [event.id, event]));
  const seen = new Set();
  return results.every((result) => {
    const key = `${result?.athleteId}:${result?.eventId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return validateResult(result, definitions.get(result?.eventId));
  });
}

export function resultFor(results, athleteId, eventId) {
  return results.find((result) => result.athleteId === athleteId && result.eventId === eventId) ?? {
    athleteId,
    eventId,
    value: null,
    status: 'pending',
  };
}

function clone(value) {
  return structuredClone(value);
}

function makeSourceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Creates a browser-only shared store. BroadcastChannel is used when available;
 * the storage event provides a second tab fallback for the same origin.
 */
export function createSharedStore({
  initialResults,
  eventList = defaultEvents,
  storage = globalThis.localStorage,
  channelFactory = (name) => new BroadcastChannel(name),
  storageKey = SHARED_STATE_KEY,
  channelName = SHARED_CHANNEL_NAME,
  sourceId = makeSourceId(),
} = {}) {
  const listeners = new Set();
  let results = clone(initialResults ?? []);
  let revision = 0;
  let channel = null;
  let storageListener = null;

  const emit = (meta = {}) => {
    const snapshot = { results: clone(results), revision, ...meta };
    for (const listener of listeners) listener(snapshot);
  };
  const apply = (payload, meta = {}) => {
    if (!payload || payload.sourceId === sourceId || !validateResults(payload.results, eventList)) return false;
    results = clone(payload.results);
    revision = Math.max(revision, Number(payload.revision) || 0);
    emit({ remote: true, ...meta });
    return true;
  };
  const broadcast = () => {
    const payload = { sourceId, revision: ++revision, results: clone(results) };
    try { storage?.setItem(storageKey, JSON.stringify(payload)); } catch { /* local-only fallback */ }
    try { channel?.postMessage(payload); } catch { /* closed or unavailable channel */ }
    emit({ remote: false });
  };

  try {
    const saved = storage?.getItem(storageKey);
    if (saved) apply(JSON.parse(saved), { initial: true });
  } catch { /* use the supplied initial results */ }
  try {
    channel = channelFactory?.(channelName) ?? null;
    if (channel) channel.onmessage = (event) => apply(event.data);
  } catch { channel = null; }
  if (typeof globalThis.addEventListener === 'function') {
    storageListener = (event) => {
      if (event.key === storageKey && event.newValue) {
        try { apply(JSON.parse(event.newValue)); } catch { /* ignore malformed peer data */ }
      }
    };
    globalThis.addEventListener('storage', storageListener);
  }

  return {
    getState: () => ({ results: clone(results), revision }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setResult(nextResult) {
      const event = eventList.find((item) => item.id === nextResult?.eventId);
      if (!validateResult(nextResult, event)) throw new TypeError('Invalid result for the selected event');
      const next = results.filter((result) => !(result.athleteId === nextResult.athleteId && result.eventId === nextResult.eventId));
      next.push({ ...nextResult });
      if (!validateResults(next, eventList)) throw new TypeError('Result set is invalid');
      results = next;
      broadcast();
      return this.getState();
    },
    reset(nextResults) {
      if (!validateResults(nextResults, eventList)) throw new TypeError('Invalid result set');
      results = clone(nextResults);
      broadcast();
      return this.getState();
    },
    close() {
      if (storageListener && typeof globalThis.removeEventListener === 'function') globalThis.removeEventListener('storage', storageListener);
      try { channel?.close?.(); } catch { /* already closed */ }
      listeners.clear();
    },
  };
}
