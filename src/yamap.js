export function normalizeOcrText(text = '') {
  let value = String(text)
    .replace(/：/g, ':')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\r/g, '')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[ \t]+/g, ' ');
  for (let i = 0; i < 4; i += 1) {
    value = value.replace(/([一-龯ぁ-んァ-ヶー])[ \t]+([一-龯ぁ-んァ-ヶー])/g, '$1$2');
  }
  return value.trim();
}

export function parseMetrics(rawText = '') {
  const text = normalizeOcrText(rawText).replace(/\n+/g, ' ');

  let durationMinutes = null;
  const durationClock = text.match(/(?:タイム|合計時間|合計)[\s\S]{0,220}?(\d{1,2})\s*:\s*([0-5]\d)/);
  const durationWords = text.match(/(?:タイム|合計時間|合計)[\s\S]{0,220}?(\d{1,2})\s*時間\s*(\d{1,2})\s*分/);
  if (durationWords) durationMinutes = Number(durationWords[1]) * 60 + Number(durationWords[2]);
  else if (durationClock) durationMinutes = Number(durationClock[1]) * 60 + Number(durationClock[2]);

  let distanceKm = null;
  const distanceMatch = text.match(/距離[\s\S]{0,220}?(\d+(?:\.\d+)?)\s*km/i);
  if (distanceMatch) distanceKm = Number(distanceMatch[1]);
  if (distanceKm === null) {
    const values = [...text.matchAll(/(\d+(?:\.\d+)?)\s*km/gi)]
      .map((m) => Number(m[1]))
      .filter((value) => value > 0.5 && value < 100);
    if (values.length) distanceKm = Math.max(...values);
  }

  let ascentM = null;
  let descentM = null;
  const labelIndexes = ['のぼり', '上り', '登り', 'くだり', '下り']
    .map((key) => text.indexOf(key))
    .filter((index) => index >= 0);
  if (labelIndexes.length) {
    const slice = text.slice(Math.min(...labelIndexes), Math.min(...labelIndexes) + 450);
    const meters = [...slice.matchAll(/\b(\d{3,4})\s*m\b/gi)]
      .map((m) => Number(m[1]))
      .filter((value) => value > 100 && value < 2000);
    if (meters.length >= 2) {
      ascentM = meters[0];
      descentM = meters[1];
    }
  }
  if (ascentM === null) {
    const match = text.match(/(?:のぼり|上り|登り)[\s\S]{0,220}?(\d{3,4})\s*m/i);
    if (match) ascentM = Number(match[1]);
  }
  if (descentM === null) {
    const afterAscent = ascentM !== null ? text.indexOf(String(ascentM)) + String(ascentM).length : 0;
    const candidate = text.slice(afterAscent).match(/\b(\d{3,4})\s*m\b/i);
    if (candidate) descentM = Number(candidate[1]);
  }

  return { durationMinutes, distanceKm, ascentM, descentM };
}

const PLACE_NOISE = [
  '時間', '休憩', '日出', '日入', '合計', '距離', 'のぼり', 'くだり',
  'YAMAP', '提出', '自治体', '登山計画を編集', 'コース', '未入力',
  '活動日記', 'ペース', '計画データ', '1日目',
];

function cleanPlace(input = '') {
  let value = normalizeOcrText(input)
    .replace(/[>›→]+/g, ' ')
    .replace(/^[\s○〇OQ@©®●◎◇◆△▽SGB]+/i, '')
    .replace(/[\s○〇OQ@©®●◎◇◆△▽>›]+$/gi, '')
    .replace(/^[)）(（:：\-]+/, '')
    .trim();

  value = value.replace(/[六官]平牧場公衆トイレ/g, '菅平牧場公衆トイレ');
  value = value.replace(/[六官]平牧場/g, '菅平牧場');
  value = value.replace(/四阿山登山口\s*\(中四阿経由\)/g, '四阿山登山口（中四阿経由）');
  return value;
}

function isPlaceCandidate(input = '') {
  const value = cleanPlace(input);
  if (value.length < 2 || value.length > 40) return false;
  if (!/[一-龯ぁ-んァ-ヶ]/.test(value)) return false;
  if (PLACE_NOISE.some((noise) => value.includes(noise))) return false;
  if (/^\d/.test(value)) return false;
  if (/^(?:\d+\s*)?(?:時間|分)$/.test(value) || /\d+\s*(?:時間|分)/.test(value)) return false;
  return true;
}

export function parseItinerary(rawText = '') {
  const lines = normalizeOcrText(rawText).split('\n').map((line) => line.trim()).filter(Boolean);
  const times = [];
  const places = [];

  lines.forEach((line, index) => {
    if (/(?:日出|日入)/.test(line) || (line.match(/\d{1,2}\s*:\s*\d{2}/g) || []).length > 1) return;
    const match = line.match(/(?:^|\s)([0-2]?\d)\s*:\s*([0-5]\d)(?:\s|$)(.*)$/);
    if (match) {
      const tail = cleanPlace(match[3] || '');
      const entry = {
        index,
        hour: Number(match[1]),
        minute: Number(match[2]),
        inlinePlace: isPlaceCandidate(tail) ? tail : '',
      };
      times.push(entry);
      if (entry.inlinePlace) places.push({ index, place: entry.inlinePlace, inlineFor: times.length - 1 });
      return;
    }
    const candidate = cleanPlace(line);
    if (isPlaceCandidate(candidate)) places.push({ index, place: candidate, inlineFor: null });
  });

  const usedPlaces = new Set();
  const rows = [];
  times.forEach((timeEntry, timeIndex) => {
    let place = timeEntry.inlinePlace;
    let confidence = place ? 5 : 0;
    if (place) {
      const directIndex = places.findIndex((item) => item.inlineFor === timeIndex);
      if (directIndex >= 0) usedPlaces.add(directIndex);
    } else {
      const candidates = places
        .map((item, placeIndex) => ({
          ...item,
          placeIndex,
          distance: Math.abs(item.index - timeEntry.index),
          after: item.index >= timeEntry.index ? 0 : 1,
        }))
        .filter((item) => !usedPlaces.has(item.placeIndex) && item.distance <= 4)
        .sort((a, b) => a.distance - b.distance || a.after - b.after || a.index - b.index);
      if (candidates.length) {
        const chosen = candidates[0];
        place = chosen.place;
        confidence = Math.max(1, 4 - chosen.distance);
        usedPlaces.add(chosen.placeIndex);
      }
    }

    if (!place) return;
    const time = `${String(timeEntry.hour).padStart(2, '0')}:${String(timeEntry.minute).padStart(2, '0')}`;
    rows.push({ time, place, major: place !== '分岐', restMinutes: 0, _confidence: confidence });
  });

  const byTime = new Map();
  const semanticScore = (place) => (
    place === '分岐'
      ? 4
      : place.length + (/[山岳峰]/.test(place) ? 18 : 0) + (/登山口|牧場|トイレ/.test(place) ? 8 : 0)
  );
  for (const row of rows) {
    if (PLACE_NOISE.some((noise) => row.place.includes(noise))) continue;
    const previous = byTime.get(row.time);
    const score = Number(row._confidence || 0) * 100 + semanticScore(row.place);
    const previousScore = previous
      ? Number(previous._confidence || 0) * 100 + semanticScore(previous.place)
      : -1;
    if (!previous || score > previousScore) byTime.set(row.time, row);
  }

  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export function classifyOcr(rawText = '') {
  const text = normalizeOcrText(rawText);
  const metricScore = ['距離', 'のぼり', 'くだり', 'タイム'].filter((key) => text.includes(key)).length
    + (text.includes('km') ? 1 : 0);
  const times = text.match(/(?:^|\s)[0-2]?\d\s*:\s*[0-5]\d/gm) || [];
  if (times.length >= 4 || text.includes('分岐')) return 'itinerary';
  if (metricScore >= 3) return 'metrics';
  return 'unknown';
}

export function minutesFromTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
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
  const adjusted = applyRests(rows).filter((row) => row.major);
  if (!adjusted.length) return '';
  const parts = [];
  adjusted.forEach((row, index) => {
    const marker = index === 0
      ? 'Ⓢ'
      : index === adjusted.length - 1
        ? 'Ⓖ'
        : /(?:山|岳|峰)$/.test(row.place)
          ? 'Ⓟ'
          : '';
    parts.push(`${marker}${row.place} ${row.adjustedTime}`.trim());
    if (row.restMinutes > 0) parts.push(`（休憩 ${row.restMinutes}分）`);
    if (index < adjusted.length - 1) {
      const currentDeparture = minutesFromTime(row.adjustedTime) + Number(row.restMinutes || 0);
      let nextArrival = minutesFromTime(adjusted[index + 1].adjustedTime);
      if (nextArrival < currentDeparture) nextArrival += 1440;
      const delta = Math.max(0, nextArrival - currentDeparture);
      const hours = Math.floor(delta / 60);
      const minutes = delta % 60;
      const label = hours > 0 ? `${hours}時間${minutes ? `${minutes}分` : ''}` : `${minutes}分`;
      parts.push(`⇒（${label}）⇒`);
    }
  });
  return parts.join(' ');
}
