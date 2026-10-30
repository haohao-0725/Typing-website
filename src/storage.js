const KEY = 'zijian.sessions.v1';
function readSessions(storage) {
    const value = JSON.parse(storage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter(s => s && typeof s.id === 'string' && ['zh', 'en'].includes(s.language)
      && ['words', 'articles'].includes(s.mode) && Number.isFinite(Date.parse(s.date))
      && ['speed', 'elapsed', 'accuracy', 'minutes', 'correct', 'errors', 'typed', 'total'].every(key => Number.isFinite(s[key]) && s[key] >= 0)
      && Array.isArray(s.records) && s.records.every(r => r && typeof r.expected === 'string'
        && typeof r.actual === 'string' && Number.isFinite(r.elapsed))).slice(0, 50) : [];
}
export function loadSessions(storage) {
  try {
    storage ??= globalThis.localStorage;
    return readSessions(storage);
  } catch { return []; }
}
export function deleteSession(id, storage) {
  try {
    storage ??= globalThis.localStorage;
    const sessions = readSessions(storage);
    if (!sessions.some(session => session.id === id)) return false;
    storage.setItem(KEY, JSON.stringify(sessions.filter(session => session.id !== id)));
    return true;
  } catch { return false; }
}
export function saveSession(session, storage) {
  try { storage ??= globalThis.localStorage; storage.setItem(KEY, JSON.stringify([session, ...loadSessions(storage)].slice(0, 50))); return true; }
  catch { return false; }
}
export function clearSessions(storage) {
  try { storage ??= globalThis.localStorage; storage.removeItem(KEY); return true; } catch { return false; }
}
