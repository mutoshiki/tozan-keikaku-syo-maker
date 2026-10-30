const HANDOFF_KEY = 'sanpo-project';
const MAX_HASH_LENGTH = 2048;
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{6,80}$/;

function validEventDate(value) {
  if (value === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function encodeProjectContext({ roomId, projectName, eventDate = '' } = {}) {
  const id = String(roomId || '').trim();
  const name = String(projectName || '').trim();
  const date = String(eventDate || '').trim();
  if (!ROOM_ID_PATTERN.test(id) || !name || name.length > 120 || !validEventDate(date)) return '';
  const payload = { version: 1, roomId: id, projectName: name, eventDate: date };
  const hash = `#${HANDOFF_KEY}=${encodeURIComponent(JSON.stringify(payload))}`;
  return hash.length <= MAX_HASH_LENGTH ? hash : '';
}

export function parseProjectContext(hash = '') {
  const value = String(hash || '');
  if (value.length > MAX_HASH_LENGTH) return null;
  const match = /^#sanpo-project=([^&]+)$/.exec(value);
  if (!match) return null;
  try {
    const payload = JSON.parse(decodeURIComponent(match[1]));
    const roomId = String(payload?.roomId || '').trim();
    const projectName = String(payload?.projectName || '').trim();
    const eventDate = String(payload?.eventDate || '').trim();
    if (payload?.version !== 1 || !ROOM_ID_PATTERN.test(roomId) || !projectName || projectName.length > 120 || !validEventDate(eventDate)) return null;
    return { roomId, projectName, eventDate };
  } catch {
    return null;
  }
}
