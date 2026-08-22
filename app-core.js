const GROUP_NAME = '信州大学 山歩会（長野県松本市旭 3-1-1）';
const UNIVERSITY_PHONE = '0263-37-2197';
const MOUNTAIN_SAFETY_PHONE = '026-233-0110';

const state = {
  step: 1,
  uploads: [],
  metrics: { durationMinutes: null, distanceKm: null, ascentM: null, descentM: null },
  itinerary: [],
  routeImage: '',
  analyzing: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function normalizeCjkSpacing(text = '') {
  let value = String(text)
    .replace(/：/g, ':')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\r/g, '')
    .replace(/[‐‑–—]/g, '-')
    .replace(/[ \t]+/g, ' ');
  for (let i = 0; i < 4; i += 1) {
    value = value.replace(/([一-龯ぁ-んァ-ヶー])[ \t]+([一-龯ぁ-んァ-ヶー])/g, '$1$2');
  }
  return value.trim();
}

function parseMetrics(raw = '') {
  const text = normalizeCjkSpacing(raw).replace(/\n+/g, ' ');
  let durationMinutes = null;
  const durationClock = text.match(/(?:タイム|合計時間|合計)[\s\S]{0,220}?(\d{1,2})\s*:\s*([0-5]\d)/);
  const durationWords = text.match(/(?:タイム|合計時間|合計)[\s\S]{0,220}?(\d{1,2})\s*時間\s*(\d{1,2})\s*分/);
  if (durationWords) durationMinutes = Number(durationWords[1]) * 60 + Number(durationWords[2]);
  else if (durationClock) durationMinutes = Number(durationClock[1]) * 60 + Number(durationClock[2]);

  let distanceKm = null;
  const distanceMatch = text.match(/距離[\s\S]{0,220}?(\d+(?:\.\d+)?)\s*km/i);
  if (distanceMatch) distanceKm = Number(distanceMatch[1]);
  if (distanceKm === null) {
    const vals = [...text.matchAll(/(\d+(?:\.\d+)?)\s*km/gi)].map(m => Number(m[1])).filter(v => v > 0.5 && v < 100);
    if (vals.length) distanceKm = Math.max(...vals);
  }

  let ascentM = null, descentM = null;
  const labelIndex = Math.min(...['のぼり','上り','登り','くだり','下り'].map(k => text.indexOf(k)).filter(i => i >= 0));
  if (Number.isFinite(labelIndex)) {
    const slice = text.slice(labelIndex, labelIndex + 450);
    const meters = [...slice.matchAll(/\b(\d{3,4})\s*m\b/gi)].map(m => Number(m[1])).filter(v => v > 100 && v < 2000);
    if (meters.length >= 2) { ascentM = meters[0]; descentM = meters[1]; }
  }
  if (ascentM === null) {
    const m = text.match(/(?:のぼり|上り|登り)[\s\S]{0,220}?(\d{3,4})\s*m/i); if (m) ascentM = Number(m[1]);
  }
  if (descentM === null) {
    const afterAscent = ascentM !== null ? text.indexOf(String(ascentM)) + String(ascentM).length : 0;
    const candidate = text.slice(afterAscent).match(/\b(\d{3,4})\s*m\b/i); if (candidate) descentM = Number(candidate[1]);
  }
  return { durationMinutes, distanceKm, ascentM, descentM };
}

const PLACE_NOISE = ['時間','休憩','日出','日入','合計','距離','のぼり','くだり','YAMAP','提出','自治体','登山計画を編集','コース','未入力','活動日記','ペース','計画データ','1日目'];

function cleanPlace(input = '') {
  let s = normalizeCjkSpacing(input)
    .replace(/[>›→]+/g, ' ')
    .replace(/^[\s○〇OQ@©®●◎◇◆△▽SGB]+/i, '')
    .replace(/[\s○〇OQ@©®●◎◇◆△▽>›]+$/gi, '')
    .replace(/^[)）(（:：\-]+/, '')
    .trim();
  s = s.replace(/[六官]平牧場公衆トイレ/g, '菅平牧場公衆トイレ');
  s = s.replace(/[六官]平牧場/g, '菅平牧場');
  s = s.replace(/四阿山登山口\s*\(中四阿経由\)/g, '四阿山登山口（中四阿経由）');
  return s;
}

function isPlaceCandidate(input = '') {
  const s = cleanPlace(input);
  if (s.length < 2 || s.length > 40) return false;
  if (!/[一-龯ぁ-んァ-ヶ]/.test(s)) return false;
  if (PLACE_NOISE.some(n => s.includes(n))) return false;
  if (/^\d/.test(s)) return false;
  if (/^(?:\d+\s*)?(?:時間|分)$/.test(s) || /\d+\s*(?:時間|分)/.test(s)) return false;
  return true;
}

function parseItinerary(raw = '') {
  const lines = normalizeCjkSpacing(raw).split('\n').map(s => s.trim()).filter(Boolean);
  const times = [];
  const places = [];

  lines.forEach((line, index) => {
    if (/(?:日出|日入)/.test(line) || (line.match(/\d{1,2}\s*:\s*\d{2}/g) || []).length > 1) return;
    const tm = line.match(/(?:^|\s)([0-2]?\d)\s*:\s*([0-5]\d)(?:\s|$)(.*)$/);
    if (tm) {
      const hour = Number(tm[1]);
      const minute = Number(tm[2]);
      const tail = cleanPlace(tm[3] || '');
      const entry = { index, hour, minute, inlinePlace: isPlaceCandidate(tail) ? tail : '' };
      times.push(entry);
      if (entry.inlinePlace) places.push({ index, place: entry.inlinePlace, inlineFor: times.length - 1 });
      return;
    }
    const candidate = cleanPlace(line);
    if (isPlaceCandidate(candidate)) places.push({ index, place: candidate, inlineFor: null });
  });

  const usedPlaces = new Set();
  const rows = [];
  times.forEach((tm, timeIndex) => {
    let place = tm.inlinePlace;
    let confidence = place ? 5 : 0;
    if (place) {
      const direct = places.findIndex(p => p.inlineFor === timeIndex);
      if (direct >= 0) usedPlaces.add(direct);
    } else {
      const candidates = places
        .map((p, pi) => ({...p, pi, distance: Math.abs(p.index - tm.index), after: p.index >= tm.index ? 0 : 1}))
        .filter(p => !usedPlaces.has(p.pi) && p.distance <= 4)
        .sort((a,b) => a.distance - b.distance || a.after - b.after || a.index - b.index);
      if (candidates.length) {
        const chosen = candidates[0];
        place = chosen.place;
        confidence = Math.max(1, 4 - chosen.distance);
        usedPlaces.add(chosen.pi);
      }
    }
    if (!place) return;
    const hour = tm.hour;
    const time = `${String(hour).padStart(2,'0')}:${String(tm.minute).padStart(2,'0')}`;
    rows.push({ time, place, major: place !== '分岐', restMinutes: 0, _confidence: confidence });
  });

  const byTime = new Map();
  const semantic = p => (p === '分岐' ? 4 : p.length + (/[山岳峰]/.test(p) ? 18 : 0) + (/登山口|牧場|トイレ/.test(p) ? 8 : 0));
  for (const row of rows) {
    if (PLACE_NOISE.some(n => row.place.includes(n))) continue;
    const old = byTime.get(row.time);
    const newScore = Number(row._confidence || 0) * 100 + semantic(row.place);
    const oldScore = old ? Number(old._confidence || 0) * 100 + semantic(old.place) : -1;
    if (!old || newScore > oldScore) byTime.set(row.time, row);
  }
  return [...byTime.values()].sort((a,b) => a.time.localeCompare(b.time));
}

function classifyText(text = '') {
  const normalized = normalizeCjkSpacing(text);
  const metricScore = ['距離','のぼり','くだり','タイム'].filter(k => normalized.includes(k)).length + (normalized.includes('km') ? 1 : 0);
  const times = normalized.match(/(?:^|\s)[0-2]?\d\s*:\s*[0-5]\d/gm) || [];
  if (times.length >= 4 || normalized.includes('分岐')) return 'itinerary';
  if (metricScore >= 3) return 'metrics';
  return 'unknown';
}

function minutesFromTime(time) {
  const [h,m] = time.split(':').map(Number); return h * 60 + m;
}
function timeFromMinutes(total) {
  const n = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2,'0')}:${String(n % 60).padStart(2,'0')}`;
}
function adjustedRows(rows = state.itinerary) {
  let offset = 0;
  return rows.map(row => {
    const adjustedTime = timeFromMinutes(minutesFromTime(row.time) + offset);
    const out = { ...row, adjustedTime };
    offset += Number(row.restMinutes || 0);
    return out;
  });
}

function buildJourneyHtml() {
  const rows = adjustedRows().filter(r => r.major);
  if (!rows.length) return '<span class="doc-muted">行程を確認してください。</span>';
  const parts = [];
  rows.forEach((row, index) => {
    const cls = index === 0 ? 'start' : index === rows.length - 1 ? 'goal' : /(?:山|岳|峰)$/.test(row.place) ? 'peak' : '';
    const marker = index === 0 ? 'Ⓢ' : index === rows.length - 1 ? 'Ⓖ' : cls === 'peak' ? 'Ⓟ' : '';
    parts.push(`<span class="${cls}">${escapeHtml(marker + row.place)} ${row.adjustedTime}</span>`);
    if (Number(row.restMinutes) > 0) parts.push(`<span class="peak">（休憩 ${Number(row.restMinutes)}分）</span>`);
    if (index < rows.length - 1) {
      const depart = minutesFromTime(row.adjustedTime) + Number(row.restMinutes || 0);
      let arrive = minutesFromTime(rows[index + 1].adjustedTime);
      if (arrive < depart) arrive += 1440;
      const delta = Math.max(0, arrive - depart);
      const h = Math.floor(delta / 60), m = delta % 60;
      const label = h ? `${h}時間${m ? `${m}分` : ''}` : `${m}分`;
      parts.push(`⇒（${label}）⇒`);
    }
  });
  return parts.join(' ');
}

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function readFileAsDataUrl(file) { return new Promise((resolve,reject) => { const r = new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }
