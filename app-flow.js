const AI_ENDPOINT = window.TOZAN_AI_ENDPOINT || '';

const NAGANO_POLICE = {
  '信濃町':['長野中央警察署','026-244-0110'], '小川村':['長野中央警察署','026-244-0110'], '飯綱町':['長野中央警察署','026-244-0110'],
  '飯山市':['飯山警察署','0269-62-0110'], '栄村':['飯山警察署','0269-62-0110'], '木島平村':['飯山警察署','0269-62-0110'], '野沢温泉村':['飯山警察署','0269-62-0110'],
  '中野市':['中野警察署','0269-26-0110'], '山ノ内町':['中野警察署','0269-26-0110'],
  '須坂市':['須坂警察署','026-246-0110'], '小布施町':['須坂警察署','026-246-0110'], '高山村':['須坂警察署','026-246-0110'],
  '千曲市':['千曲警察署','026-272-0110'], '坂城町':['千曲警察署','026-272-0110'],
  '上田市':['上田警察署','0268-22-0110'], '東御市':['上田警察署','0268-22-0110'], '青木村':['上田警察署','0268-22-0110'], '長和町':['上田警察署','0268-22-0110'],
  '小諸市':['小諸警察署','0267-22-0110'],
  '佐久市':['佐久警察署','0267-68-0110'], '御代田町':['佐久警察署','0267-68-0110'], '立科町':['佐久警察署','0267-68-0110'], '小海町':['佐久警察署','0267-68-0110'], '川上村':['佐久警察署','0267-68-0110'], '南牧村':['佐久警察署','0267-68-0110'], '南相木村':['佐久警察署','0267-68-0110'], '北相木村':['佐久警察署','0267-68-0110'], '佐久穂町':['佐久警察署','0267-68-0110'],
  '軽井沢町':['軽井沢警察署','0267-42-0110'],
  '茅野市':['茅野警察署','0266-82-0110'], '富士見町':['茅野警察署','0266-82-0110'], '原村':['茅野警察署','0266-82-0110'],
  '諏訪市':['諏訪警察署','0266-57-0110'], '下諏訪町':['諏訪警察署','0266-57-0110'],
  '岡谷市':['岡谷警察署','0266-23-0110'],
  '伊那市':['伊那警察署','0265-72-0110'], '辰野町':['伊那警察署','0265-72-0110'], '箕輪町':['伊那警察署','0265-72-0110'], '南箕輪村':['伊那警察署','0265-72-0110'],
  '駒ヶ根市':['駒ヶ根警察署','0265-83-0110'], '飯島町':['駒ヶ根警察署','0265-83-0110'], '中川村':['駒ヶ根警察署','0265-83-0110'], '宮田村':['駒ヶ根警察署','0265-83-0110'],
  '飯田市':['飯田警察署','0265-22-0110'], '松川町':['飯田警察署','0265-22-0110'], '高森町':['飯田警察署','0265-22-0110'], '阿智村':['飯田警察署','0265-22-0110'], '平谷村':['飯田警察署','0265-22-0110'], '根羽村':['飯田警察署','0265-22-0110'], '喬木村':['飯田警察署','0265-22-0110'], '豊丘村':['飯田警察署','0265-22-0110'], '大鹿村':['飯田警察署','0265-22-0110'],
  '阿南町':['阿南警察署','0260-25-0110'], '下條村':['阿南警察署','0260-25-0110'], '売木村':['阿南警察署','0260-25-0110'], '天龍村':['阿南警察署','0260-25-0110'], '泰阜村':['阿南警察署','0260-25-0110'],
  '上松町':['木曽警察署','0264-22-0110'], '南木曽町':['木曽警察署','0264-22-0110'], '木祖村':['木曽警察署','0264-22-0110'], '王滝村':['木曽警察署','0264-22-0110'], '大桑村':['木曽警察署','0264-22-0110'], '木曽町':['木曽警察署','0264-22-0110'],
  '塩尻市':['塩尻警察署','0263-54-0110'], '朝日村':['塩尻警察署','0263-54-0110'],
  '松本市':['松本警察署','0263-25-0110'], '山形村':['松本警察署','0263-25-0110'],
  '安曇野市':['安曇野警察署','0263-72-0110'], '麻績村':['安曇野警察署','0263-72-0110'], '生坂村':['安曇野警察署','0263-72-0110'], '筑北村':['安曇野警察署','0263-72-0110'],
  '大町市':['大町警察署','0261-22-0110'], '池田町':['大町警察署','0261-22-0110'], '松川村':['大町警察署','0261-22-0110'], '白馬村':['大町警察署','0261-22-0110'], '小谷村':['大町警察署','0261-22-0110'],
};

function dataUrlPayload(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('画像データを読み込めませんでした。');
  return { mimeType: match[1], data: match[2] };
}

async function analyzeWithVision() {
  if (!AI_ENDPOINT) throw new Error('画像理解AIの接続先がまだ設定されていません。');
  const images = state.uploads.map(upload => dataUrlPayload(upload.url));
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `AI解析に失敗しました（${response.status}）`);
  return payload;
}

function normalizeVisionResult(result) {
  const itinerary = Array.isArray(result.itinerary) ? result.itinerary
    .filter(row => row && /^\d{2}:\d{2}$/.test(String(row.time || '')) && String(row.place || '').trim())
    .map(row => ({
      time: String(row.time),
      place: String(row.place).trim(),
      major: row.major !== false && String(row.place).trim() !== '分岐',
      restMinutes: 0,
      _confidence: 10,
    })) : [];
  return {
    mountainName: typeof result.mountainName === 'string' ? result.mountainName.trim() : '',
    areaMunicipality: typeof result.areaMunicipality === 'string' ? result.areaMunicipality.trim() : '',
    municipalities: Array.isArray(result.municipalities) ? result.municipalities.map(String).map(v=>v.trim()).filter(Boolean) : [],
    metrics: {
      durationMinutes: Number.isFinite(Number(result.durationMinutes)) ? Number(result.durationMinutes) : null,
      distanceKm: Number.isFinite(Number(result.distanceKm)) ? Number(result.distanceKm) : null,
      ascentM: Number.isFinite(Number(result.ascentM)) ? Number(result.ascentM) : null,
      descentM: Number.isFinite(Number(result.descentM)) ? Number(result.descentM) : null,
    },
    itinerary,
    routeImageIndex: Number.isInteger(result.routeImageIndex) ? result.routeImageIndex : null,
    warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : [],
  };
}

function resolveNaganoPoliceStations(municipalities = [], areaText = '') {
  const detected = [...new Set(municipalities.map(v => v.replace(/^長野県/, '').trim()).filter(Boolean))];
  if (!detected.length && areaText) {
    for (const municipality of Object.keys(NAGANO_POLICE)) if (areaText.includes(municipality)) detected.push(municipality);
    if (areaText.includes('長野市')) detected.push('長野市');
  }
  const stations = [];
  const unmapped = [];
  let naganoCityAmbiguous = false;
  for (const municipality of [...new Set(detected)]) {
    if (municipality === '長野市') {
      naganoCityAmbiguous = true;
      for (const pair of [['長野中央警察署','026-244-0110'],['長野南警察署','026-292-0110']]) stations.push({name:pair[0],phone:pair[1]});
      continue;
    }
    const pair = NAGANO_POLICE[municipality];
    if (!pair) { unmapped.push(municipality); continue; }
    stations.push({name:pair[0], phone:pair[1]});
  }
  const unique = [...new Map(stations.map(s => [s.name, s])).values()];
  return { stations: unique, unmapped, naganoCityAmbiguous };
}

function applyPoliceFromRoute(municipalities, areaText) {
  const { stations, unmapped, naganoCityAmbiguous } = resolveNaganoPoliceStations(municipalities, areaText);
  if (stations[0]) { $('#police1Name').value = stations[0].name; $('#police1Phone').value = stations[0].phone; }
  if (stations[1]) { $('#police2Name').value = stations[1].name; $('#police2Phone').value = stations[1].phone; }
  const warnings = [];
  if (stations.length > 2) warnings.push(`管轄警察署が${stations.length}署あります。3署目以降は確認してください`);
  if (naganoCityAmbiguous) warnings.push('長野市は長野中央・長野南の2署に分かれるため両方を候補入力しました');
  if (unmapped.length) warnings.push(`長野県警の自動判定対象外: ${unmapped.join('・')}`);
  return warnings;
}

async function analyzeUploads() {
  if (!state.uploads.length || state.analyzing) return;
  state.analyzing = true;
  $('#analyze-button').disabled = true;
  showStatus('YAMAP画像を画像理解AIで解析しています…', false);
  try {
    const raw = await analyzeWithVision();
    const result = normalizeVisionResult(raw);
    state.metrics = result.metrics;
    state.itinerary = result.itinerary.sort((a,b) => a.time.localeCompare(b.time));

    if (!$('#mountainName').value.trim() && result.mountainName) $('#mountainName').value = result.mountainName;
    if (!$('#areaMunicipality').value.trim() && result.areaMunicipality) $('#areaMunicipality').value = result.areaMunicipality;
    const policeWarnings = applyPoliceFromRoute(result.municipalities, result.areaMunicipality);

    state.uploads.forEach((upload, index) => {
      upload.classification = index === result.routeImageIndex ? 'metrics' : 'itinerary';
      upload.routeSource = index === result.routeImageIndex;
    });

    if (result.routeImageIndex !== null && state.uploads[result.routeImageIndex]) {
      // 提出用ルート画像は元スクリーンショットをそのまま使う。固定クロップはしない。
      state.routeImage = state.uploads[result.routeImageIndex].url;
    }

    renderUploads();
    renderItinerary();
    syncMetricInputs();
    const named = state.itinerary.filter(r => r.place !== '分岐').length;
    const allWarnings = [...result.warnings, ...policeWarnings];
    const warningText = allWarnings.length ? ` 注意: ${allWarnings.join(' / ')}` : '';
    showStatus(`読み取り完了：${state.itinerary.length}地点（主要地点 ${named}）を取得しました。${warningText}`, false);
    goToStep(3);
  } catch (error) {
    console.error(error);
    showStatus(`読み取りに失敗しました：${error.message}`, true);
  } finally {
    state.analyzing = false;
    $('#analyze-button').disabled = !state.uploads.length;
  }
}

function showStatus(message, error=false) {
  const el = $('#analysis-status');
  el.textContent = message;
  el.classList.remove('is-hidden');
  el.classList.toggle('is-error', error);
}

function renderUploads() {
  const root = $('#upload-list');
  root.innerHTML = '';
  for (const upload of state.uploads) {
    const card = document.createElement('article');
    card.className = 'upload-card';
    const tag = upload.classification === 'metrics'
      ? '<span class="tag tag--blue">計画データ / 地図候補</span>'
      : upload.classification === 'itinerary'
        ? '<span class="tag tag--green">行程</span>'
        : `<span class="tag">${upload.classification === 'unknown' ? '未分類' : '未解析'}</span>`;
    card.innerHTML = `<img src="${upload.url}" alt="YAMAPスクリーンショット"><div class="upload-card__body"><div class="upload-card__name">${escapeHtml(upload.name)}</div><div class="tag-row">${tag}${state.routeImage && upload.routeSource ? '<span class="route-mark">ルート画像</span>' : ''}</div><div class="upload-card__actions"><button class="btn btn--tertiary use-route" type="button">ルートに使う</button><button class="btn btn--danger-ghost remove-upload" type="button" aria-label="削除">削除</button></div></div>`;
    $('.use-route', card).onclick = () => {
      state.uploads.forEach(u => u.routeSource = false);
      upload.routeSource = true;
      // 元画像をそのまま保持する。切り抜きや再圧縮をしない。
      state.routeImage = upload.url;
      renderUploads();
    };
    $('.remove-upload', card).onclick = () => {
      state.uploads = state.uploads.filter(u => u.id !== upload.id);
      if (upload.routeSource) state.routeImage = '';
      renderUploads();
      $('#analyze-button').disabled = !state.uploads.length;
    };
    root.append(card);
  }
}
