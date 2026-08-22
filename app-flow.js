const AI_ENDPOINT = window.TOZAN_AI_ENDPOINT || '';

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
    const warningText = result.warnings.length ? ` 注意: ${result.warnings.join(' / ')}` : '';
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
