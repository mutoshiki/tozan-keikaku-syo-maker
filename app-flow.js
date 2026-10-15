const AI_ENDPOINT = window.TOZAN_AI_ENDPOINT || '';

// ルート上の市町村から管轄署を引く。電話番号は警察公式情報を固定値として保持する。
const POLICE_BY_MUNICIPALITY = {
  '信濃町':['長野中央警察署','026-244-0110'],'小川村':['長野中央警察署','026-244-0110'],'飯綱町':['長野中央警察署','026-244-0110'],
  '飯山市':['飯山警察署','0269-62-0110'],'栄村':['飯山警察署','0269-62-0110'],'木島平村':['飯山警察署','0269-62-0110'],'野沢温泉村':['飯山警察署','0269-62-0110'],
  '中野市':['中野警察署','0269-26-0110'],'山ノ内町':['中野警察署','0269-26-0110'],
  '須坂市':['須坂警察署','026-246-0110'],'小布施町':['須坂警察署','026-246-0110'],'高山村':['須坂警察署','026-246-0110'],
  '千曲市':['千曲警察署','026-272-0110'],'坂城町':['千曲警察署','026-272-0110'],
  '上田市':['上田警察署','0268-22-0110'],'東御市':['上田警察署','0268-22-0110'],'青木村':['上田警察署','0268-22-0110'],'長和町':['上田警察署','0268-22-0110'],
  '小諸市':['小諸警察署','0267-22-0110'],
  '佐久市':['佐久警察署','0267-68-0110'],'御代田町':['佐久警察署','0267-68-0110'],'立科町':['佐久警察署','0267-68-0110'],'小海町':['佐久警察署','0267-68-0110'],'川上村':['佐久警察署','0267-68-0110'],'南牧村':['佐久警察署','0267-68-0110'],'南相木村':['佐久警察署','0267-68-0110'],'北相木村':['佐久警察署','0267-68-0110'],'佐久穂町':['佐久警察署','0267-68-0110'],
  '軽井沢町':['軽井沢警察署','0267-42-0110'],
  '茅野市':['茅野警察署','0266-82-0110'],'富士見町':['茅野警察署','0266-82-0110'],'原村':['茅野警察署','0266-82-0110'],
  '諏訪市':['諏訪警察署','0266-57-0110'],'下諏訪町':['諏訪警察署','0266-57-0110'],
  '岡谷市':['岡谷警察署','0266-23-0110'],
  '伊那市':['伊那警察署','0265-72-0110'],'辰野町':['伊那警察署','0265-72-0110'],'箕輪町':['伊那警察署','0265-72-0110'],'南箕輪村':['伊那警察署','0265-72-0110'],
  '駒ヶ根市':['駒ヶ根警察署','0265-83-0110'],'飯島町':['駒ヶ根警察署','0265-83-0110'],'中川村':['駒ヶ根警察署','0265-83-0110'],'宮田村':['駒ヶ根警察署','0265-83-0110'],
  '飯田市':['飯田警察署','0265-22-0110'],'松川町':['飯田警察署','0265-22-0110'],'高森町':['飯田警察署','0265-22-0110'],'阿智村':['飯田警察署','0265-22-0110'],'平谷村':['飯田警察署','0265-22-0110'],'根羽村':['飯田警察署','0265-22-0110'],'喬木村':['飯田警察署','0265-22-0110'],'豊丘村':['飯田警察署','0265-22-0110'],'大鹿村':['飯田警察署','0265-22-0110'],
  '阿南町':['阿南警察署','0260-25-0110'],'下條村':['阿南警察署','0260-25-0110'],'売木村':['阿南警察署','0260-25-0110'],'天龍村':['阿南警察署','0260-25-0110'],'泰阜村':['阿南警察署','0260-25-0110'],
  '上松町':['木曽警察署','0264-22-0110'],'南木曽町':['木曽警察署','0264-22-0110'],'木祖村':['木曽警察署','0264-22-0110'],'王滝村':['木曽警察署','0264-22-0110'],'大桑村':['木曽警察署','0264-22-0110'],'木曽町':['木曽警察署','0264-22-0110'],
  '塩尻市':['塩尻警察署','0263-54-0110'],'朝日村':['塩尻警察署','0263-54-0110'],
  '松本市':['松本警察署','0263-25-0110'],'山形村':['松本警察署','0263-25-0110'],
  '安曇野市':['安曇野警察署','0263-72-0110'],'麻績村':['安曇野警察署','0263-72-0110'],'生坂村':['安曇野警察署','0263-72-0110'],'筑北村':['安曇野警察署','0263-72-0110'],
  '大町市':['大町警察署','0261-22-0110'],'池田町':['大町警察署','0261-22-0110'],'松川村':['大町警察署','0261-22-0110'],'白馬村':['大町警察署','0261-22-0110'],'小谷村':['大町警察署','0261-22-0110'],
  '長野原町':['長野原警察署','0279-82-0110'],'嬬恋村':['長野原警察署','0279-82-0110'],'草津町':['長野原警察署','0279-82-0110']
};

function dataUrlPayload(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('画像を読み込めません。');
  return { mimeType: match[1], data: match[2] };
}

async function analyzeWithVision() {
  if (!AI_ENDPOINT) throw new Error('接続先が設定されていません。');
  const images = state.uploads.map(upload => dataUrlPayload(upload.url));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let response;
  try {
    response = await fetch(AI_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({images}), signal:controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('読み取りが120秒以内に完了しませんでした。通信状態を確認して再試行してください。');
    throw new Error('画像解析サービスへ接続できませんでした。通信状態を確認して再試行してください。');
  } finally { clearTimeout(timer); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '読み取りに失敗しました。');
  return payload;
}

function normalizeClock(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

function cleanMunicipality(value) {
  return String(value || '').replace(/^(?:長野県|群馬県)/,'').trim();
}

function municipalityArea(municipalities = [], fallback = '') {
  const cleaned = [...new Set(municipalities.map(cleanMunicipality).filter(Boolean))];
  return cleaned.length ? cleaned.join('・') : String(fallback || '').trim();
}

function normalizeVisionResult(result) {
  const itinerary = Array.isArray(result.itinerary) ? result.itinerary
    .map(row => ({ row, time: normalizeClock(row?.time) }))
    .filter(({row,time}) => row && time && String(row.place || '').trim())
    .map(({row,time}) => ({ time, place:String(row.place).trim(), major:row.major !== false && String(row.place).trim() !== '分岐', restMinutes:0, _confidence:10 })) : [];
  return {
    mountainName: typeof result.mountainName === 'string' ? result.mountainName.trim() : '',
    areaMunicipality: typeof result.areaMunicipality === 'string' ? result.areaMunicipality.trim() : '',
    municipalities: Array.isArray(result.municipalities) ? [...new Set(result.municipalities.map(cleanMunicipality).filter(Boolean))] : [],
    metrics: {
      durationMinutes:Number.isFinite(Number(result.durationMinutes)) ? Number(result.durationMinutes) : null,
      distanceKm:Number.isFinite(Number(result.distanceKm)) ? Number(result.distanceKm) : null,
      ascentM:Number.isFinite(Number(result.ascentM)) ? Number(result.ascentM) : null,
      descentM:Number.isFinite(Number(result.descentM)) ? Number(result.descentM) : null
    },
    itinerary,
    routeImageIndex:Number.isInteger(result.routeImageIndex) ? result.routeImageIndex : null,
    warnings:Array.isArray(result.warnings) ? result.warnings.map(String) : []
  };
}

function resolveNaganoPoliceStations(municipalities = [], areaText = '') {
  const detected = [...new Set(municipalities.map(cleanMunicipality).filter(Boolean))];
  if (!detected.length) for (const municipality of Object.keys(POLICE_BY_MUNICIPALITY)) if (areaText.includes(municipality)) detected.push(municipality);
  if (areaText.includes('長野市')) detected.push('長野市');
  const stations = [];
  const unresolved = [];
  for (const municipality of [...new Set(detected)]) {
    if (municipality === '長野市') {
      stations.push({name:'長野中央警察署',phone:'026-244-0110'},{name:'長野南警察署',phone:'026-292-0110'});
      continue;
    }
    const pair = POLICE_BY_MUNICIPALITY[municipality];
    if (pair) stations.push({name:pair[0],phone:pair[1]}); else unresolved.push(municipality);
  }
  return { stations:[...new Map(stations.map(s => [s.name,s])).values()], unresolved };
}

function applyPoliceFromRoute(municipalities = [], areaText = '') {
  const { stations, unresolved } = resolveNaganoPoliceStations(municipalities, areaText);
  $('#police1Name').value = stations[0]?.name || '';
  $('#police1Phone').value = stations[0]?.phone || '';
  $('#police2Name').value = stations[1]?.name || '';
  $('#police2Phone').value = stations[1]?.phone || '';
  $('#police3Name').value = stations[2]?.name || '';
  $('#police3Phone').value = stations[2]?.phone || '';
  $('#police-secondary').hidden = !stations[1];
  $('#police-tertiary').hidden = !stations[2];
  $('#add-police').disabled = !!stations[2];
  const note = $('#police-note');
  const needsCheck = !stations.length || unresolved.length || stations.length > 3;
  note.textContent = !stations.length ? '管轄署を確認してください。' : stations.length > 3 ? '複数の管轄があります。' : unresolved.length ? '管轄を確認してください。' : '';
  note.classList.toggle('is-hidden', !needsCheck);
  return stations;
}

function setStep2NextEnabled(enabled) {
  const button = $('#step2-next');
  if (!button) return;
  button.disabled = !enabled;
  document.dispatchEvent(new CustomEvent('tozan:step2-readiness', { detail: { enabled: !!enabled } }));
}

function markImportIncomplete() {
  state.maxReachedStep = Math.min(state.maxReachedStep, 1);
  setStep2NextEnabled(false);
  renderProgress();
}

async function analyzeUploads() {
  if (!state.uploads.length || state.analyzing) return;
  state.analyzing = true;
  setStep2NextEnabled(false);
  showStatus('読み取り中');
  try {
    const result = normalizeVisionResult(await analyzeWithVision());
    state.metrics = result.metrics;
    state.itinerary = result.itinerary.sort((a,b) => a.time.localeCompare(b.time));
    if (result.mountainName) $('#mountainName').value = result.mountainName;
    const area = municipalityArea(result.municipalities, result.areaMunicipality);
    if (area) $('#areaMunicipality').value = area;
    applyPoliceFromRoute(result.municipalities, area);

    state.uploads.forEach(upload => {
      upload.routeSource = upload.kind === 'route';
      upload.classification = upload.kind === 'route' ? 'route' : 'itinerary';
    });
    if (!state.routeImage && result.routeImageIndex !== null && state.uploads[result.routeImageIndex]) {
      state.routeImage = state.uploads[result.routeImageIndex].url;
    }

    renderUploads();
    syncMetricInputs();
    renderItinerary();
    renderRoutePreview();
    const canContinue = state.itinerary.length > 0 && !!state.routeImage;
    if (canContinue) {
      state.maxReachedStep = Math.max(state.maxReachedStep, 2);
      showStatus(`読み取り完了。行程${state.itinerary.length}地点を取り込みました。確認画面で内容を照合してください。`);
    }
    else showStatus('読み取りは完了しましたが、行程を確認画面へ進めるだけ読み取れませんでした。行程画像を追加するか、画像を差し替えて再試行してください。', true, true);
    setStep2NextEnabled(canContinue);
  } catch (error) {
    console.error(error);
    showStatus(`画像を読み取れませんでした。${error.message || '画像を確認してください。'} 画像を差し替えるか、再試行してください。`, true, true);
  } finally {
    state.analyzing = false;
  }
}

function showStatus(message, error = false, canRetry = false) {
  const el = $('#analysis-status');
  el.replaceChildren(document.createTextNode(message));
  if (canRetry && canAnalyzeUploads()) {
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'btn btn--danger-ghost'; retry.textContent = '読み取りを再試行';
    retry.onclick = () => analyzeUploads();
    el.append(document.createElement('br'), retry);
  }
  el.classList.remove('is-hidden');
  el.classList.toggle('is-error', error);
}

function renderUploadList(kind, selector) {
  const root = $(selector);
  root.innerHTML = '';
  const uploads = state.uploads.filter(upload => upload.kind === kind);
  for (const upload of uploads) {
    const card = document.createElement('article');
    card.className = 'upload-card';
    const position = kind === 'route' ? 'ルート' : `行程${uploads.indexOf(upload) + 1}`;
    card.innerHTML = `<details class="upload-card__zoom"><summary aria-label="${position}画像を拡大"><img class="upload-card__thumb" src="${upload.url}" alt=""><span>${position}画像を拡大</span></summary><img class="upload-card__zoom-image" src="${upload.url}" alt="${position}画像の拡大表示"></details><div class="upload-card__body"><strong class="upload-card__meta">${position}</strong><div class="upload-card__name">${escapeHtml(upload.name)}</div></div><div class="upload-card__actions"><button class="btn btn--danger-ghost remove-upload" type="button" aria-label="${position}画像 ${escapeHtml(upload.name)}を削除">削除</button></div>`;
    $('.remove-upload',card).onclick = async () => {
      state.uploads = state.uploads.filter(item => item.id !== upload.id);
      markImportIncomplete();
      pendingPdfFile = null;
      markPreparedPdfDirty();
      if (kind === 'route') state.routeImage = '';
      if (kind === 'itinerary' && !state.uploads.some(item => item.kind === 'itinerary')) state.itinerary = [];
      renderUploads();
      renderRoutePreview();
      setStep2NextEnabled(false);
      if (state.uploads.some(item => item.kind === 'route') && state.uploads.some(item => item.kind === 'itinerary')) await analyzeUploads();
      else showStatus(kind === 'route' ? 'ルート画像を削除しました。別のルート画像を追加してください。' : '行程画像を削除しました。行程画像を追加してください。', true);
    };
    root.append(card);
  }
}

function renderUploads() {
  renderUploadList('route','#route-upload-list');
  renderUploadList('itinerary','#itinerary-upload-list');
}
