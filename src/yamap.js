export function normalizeOcrText(text = '') {
  return text
    .replace(/：/g, ':')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function parseMetrics(rawText = '') {
  const text = normalizeOcrText(rawText);
  const compact = text.replace(/\s+/g, ' ');

  const durationColon = compact.match(/(?:タイム|合計時間)[^0-9]{0,16}(\d{1,2})\s*:\s*(\d{2})/);
  const durationWords = compact.match(/(?:合計時間|タイム)[^0-9]{0,16}(\d{1,2})\s*時間\s*(\d{1,2})\s*分/);
  const distance = compact.match(/距離[^0-9]{0,16}(\d+(?:\.\d+)?)\s*km/i);
  const ascent = compact.match(/(?:のぼり|上り|登り)[^0-9]{0,16}(\d{2,5})\s*m/i);
  const descent = compact.match(/(?:くだり|下り)[^0-9]{0,16}(\d{2,5})\s*m/i);

  let durationMinutes = null;
  if (durationWords) durationMinutes = Number(durationWords[1]) * 60 + Number(durationWords[2]);
  else if (durationColon) durationMinutes = Number(durationColon[1]) * 60 + Number(durationColon[2]);

  return {
    durationMinutes,
    distanceKm: distance ? Number(distance[1]) : null,
    ascentM: ascent ? Number(ascent[1]) : null,
    descentM: descent ? Number(descent[1]) : null,
  };
}

const NOISE = [
  '日出', '日入', '合計', '時間', '距離', 'のぼり', 'くだり', '休憩',
  'YAMAP', '提出', '未入力', '自治体', '登山計画', 'コース定数',
];

function looksLikePlace(value = '') {
  const s = value.replace(/[>›→]/g, '').trim();
  if (s.length < 2 || s.length > 38) return false;
  if (/^\d/.test(s)) return false;
  if (NOISE.some((n) => s.includes(n))) return false;
  if (/^[()（）\-—_\/\s]+$/.test(s)) return false;
  return /[一-龯ぁ-んァ-ヶA-Za-z]/.test(s);
}

export function parseItinerary(rawText = '') {
  const text = normalizeOcrText(rawText);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/(?:^|\s)([0-2]?\d)\s*:\s*([0-5]\d)(?:\s+|$)(.*)$/);
    if (!match) continue;

    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    const time = `${hh}:${mm}`;
    let place = match[3].replace(/[>›→]+$/g, '').trim();

    if (!looksLikePlace(place)) {
      for (let j = 1; j <= 2; j += 1) {
        const candidate = lines[i + j] || '';
        if (/^\d{1,2}\s*[:：]\s*\d{2}/.test(candidate)) break;
        if (looksLikePlace(candidate)) {
          place = candidate.replace(/[>›→]+$/g, '').trim();
          break;
        }
      }
    }

    if (!looksLikePlace(place)) continue;
    if (rows.some((r) => r.time === time && r.place === place)) continue;
    rows.push({ time, place, major: place !== '分岐', restMinutes: 0 });
  }

  return rows.sort((a, b) => a.time.localeCompare(b.time));
}

export function classifyOcr(rawText = '') {
  const text = normalizeOcrText(rawText);
  const metrics = parseMetrics(text);
  const itinerary = parseItinerary(text);
  const metricScore = [metrics.distanceKm, metrics.ascentM, metrics.descentM, metrics.durationMinutes]
    .filter((v) => v !== null).length;

  if (itinerary.length >= 3) return 'itinerary';
  if (metricScore >= 2) return 'metrics';
  return 'unknown';
}

export function minutesFromTime(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function timeFromMinutes(total) {
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function applyRests(rows = []) {
  let offset = 0;
  return rows.map((row) => {
    const adjusted = timeFromMinutes(minutesFromTime(row.time) + offset);
    const result = { ...row, adjustedTime: adjusted };
    offset += Number(row.restMinutes || 0);
    return result;
  });
}

export function buildItineraryText(rows = []) {
  const adjusted = applyRests(rows).filter((r) => r.major);
  if (!adjusted.length) return '';
  const parts = [];
  adjusted.forEach((row, index) => {
    const marker = index === 0 ? 'Ⓢ' : index === adjusted.length - 1 ? 'Ⓖ' : row.place.includes('山') ? 'Ⓟ' : '';
    parts.push(`${marker}${row.place} ${row.adjustedTime}`.trim());
    if (row.restMinutes > 0) parts.push(`（休憩 ${row.restMinutes}分）`);
    if (index < adjusted.length - 1) {
      const currentDeparture = minutesFromTime(row.adjustedTime) + Number(row.restMinutes || 0);
      const nextArrival = minutesFromTime(adjusted[index + 1].adjustedTime);
      const delta = Math.max(0, nextArrival - currentDeparture);
      const h = Math.floor(delta / 60);
      const m = delta % 60;
      const label = h > 0 ? `${h}時間${m ? `${m}分` : ''}` : `${m}分`;
      parts.push(`⇒（${label}）⇒`);
    }
  });
  return parts.join(' ');
}
