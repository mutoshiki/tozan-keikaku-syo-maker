function syncMetricInputs() {
  for (const key of ['durationMinutes','distanceKm','ascentM','descentM']) $(`#${key}`).value = state.metrics[key] ?? '';
}

function markPreparedPdfDirty() {
  window.__tozanShare?.markDirty();
  closePdfPreview();
}

let pdfPreviewGeneration = 0;
function closePdfPreview() {
  pdfPreviewGeneration += 1;
  const preview = $('#pdf-preview');
  if (preview && !preview.classList.contains('is-hidden')) {
    if (preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
    preview.replaceChildren(); preview.classList.add('is-hidden');
    const toggle = $('#toggle-pdf-preview');
    toggle?.setAttribute('aria-expanded','false');
    if (toggle) toggle.textContent = 'PDFプレビューを表示';
  }
}

function renderItinerary(focusTarget = null) {
  const body = $('#itinerary-body');
  if (!body) return;
  body.innerHTML = '';
  const adjusted = adjustedRows();
  state.itinerary.forEach((row,index) => {
    const tr = document.createElement('tr');
    const adjustedTime = adjusted[index]?.adjustedTime || row.time;
    const point = row.place.trim() || `地点${index + 1}`;
    const includeStatus = row.major ? 'PDFに掲載' : 'PDFに掲載しない';
    const editorId = `itinerary-editor-${index}`;
    tr.innerHTML = `<td data-label="時刻"><time class="itinerary-time" datetime="${escapeHtml(adjustedTime)}">${escapeHtml(adjustedTime)}</time>${adjustedTime !== row.time ? `<span class="adjusted">休憩反映後（元 ${escapeHtml(row.time)}）</span>` : ''}</td><td data-label="地点"><span class="itinerary-place">${escapeHtml(point)}</span></td><td data-label="掲載"><span class="itinerary-inclusion ${row.major ? '' : 'is-excluded'}">${includeStatus}</span></td><td data-label="操作"><button class="itinerary-edit" type="button" aria-expanded="${!!row._editing}" aria-controls="${editorId}" aria-label="${escapeHtml(row.time)} ${escapeHtml(point)}を編集">編集</button><div class="itinerary-editor" id="${editorId}" ${row._editing ? '' : 'hidden'}><div class="itinerary-editor__fields"><label class="field"><span>時刻</span><input class="row-time" type="time" value="${escapeHtml(row.time)}" aria-label="${escapeHtml(row.time)} ${escapeHtml(point)}の時刻"></label><label class="field"><span>地点</span><input class="row-place" type="text" value="${escapeHtml(row.place)}" aria-label="${escapeHtml(row.time)} ${escapeHtml(point)}の地点名"></label><label class="checkbox-row"><input class="row-major" type="checkbox" ${row.major ? 'checked' : ''} aria-label="${escapeHtml(row.time)} ${escapeHtml(point)}をPDFに掲載"><span>PDFに掲載</span></label><label class="field"><span>休憩（分）</span><input class="row-rest" type="number" min="0" step="5" value="${Number(row.restMinutes || 0)}" aria-label="${escapeHtml(row.time)} ${escapeHtml(point)}の休憩時間（分）"></label><p class="itinerary-editor__hint">休憩時間は、この地点より後の到着予定時刻に加算されます。</p><button class="btn btn--danger-ghost row-remove" type="button" aria-label="${escapeHtml(row.time)} ${escapeHtml(point)}を削除">地点を削除</button></div></div></td>`;
    const editButton = $('.itinerary-edit',tr), editor = $('.itinerary-editor',tr);
    editButton.onclick = () => {
      row._editing = !row._editing;
      editor.hidden = !row._editing;
      editButton.setAttribute('aria-expanded', String(row._editing));
      if (row._editing) $('.row-time',tr).focus();
    };
    editor.onkeydown = e => {
      if (e.key === 'Escape') {
        row._editing = false; editor.hidden = true; editButton.setAttribute('aria-expanded','false'); editButton.focus();
      }
    };
    $('.row-time',tr).onchange = e => { row.time = e.target.value; state.itinerary.sort((a,b)=>a.time.localeCompare(b.time)); renderItinerary({row, control:'row-time'}); markPreparedPdfDirty(); };
    $('.row-place',tr).oninput = e => {
      row.place = e.target.value;
      const name = row.place.trim() || `地点${index + 1}`;
      $('.row-time',tr).setAttribute('aria-label', `${row.time} ${name}の時刻`);
      e.target.setAttribute('aria-label', `${row.time} ${name}の地点名`);
      $('.row-major',tr).setAttribute('aria-label', `${row.time} ${name}をPDFに掲載`);
      $('.row-rest',tr).setAttribute('aria-label', `${row.time} ${name}の休憩時間（分）`);
      $('.row-remove',tr).setAttribute('aria-label', `${row.time} ${name}を削除`);
      editButton.setAttribute('aria-label', `${row.time} ${name}を編集`);
      $('.itinerary-place',tr).textContent = name;
      markPreparedPdfDirty();
    };
    $('.row-major',tr).onchange = e => {
      row.major = e.target.checked;
      const status = $('.itinerary-inclusion',tr);
      status.textContent = row.major ? 'PDFに掲載' : 'PDFに掲載しない';
      status.classList.toggle('is-excluded', !row.major);
      markPreparedPdfDirty();
    };
    $('.row-rest',tr).oninput = e => {
      row.restMinutes = Number(e.target.value || 0);
      const adjustedNow = adjustedRows();
      $$('#itinerary-body tr').forEach((line, lineIndex) => {
        const cell = line.cells[0];
        const old = $('.adjusted', cell);
        const next = adjustedNow[lineIndex]?.adjustedTime || state.itinerary[lineIndex]?.time;
        if (next && next !== state.itinerary[lineIndex]?.time) {
          if (old) old.textContent = `→ ${next}`;
          else { const label = document.createElement('div'); label.className = 'adjusted'; label.textContent = `→ ${next}`; cell.append(label); }
        } else old?.remove();
      });
      markPreparedPdfDirty();
    };
    $('.row-remove',tr).onclick = () => {
      state.itinerary.splice(index,1);
      const neighbor = state.itinerary[Math.min(index, state.itinerary.length - 1)] || null;
      if (neighbor) neighbor._editing = true;
      renderItinerary({row:neighbor, control:neighbor ? 'row-remove' : null, fallback:neighbor ? null : '#add-row'});
      markPreparedPdfDirty();
    };
    body.append(tr);
  });
  if (focusTarget) {
    const index = focusTarget.row ? state.itinerary.indexOf(focusTarget.row) : -1;
    const target = index >= 0 ? $(`.${focusTarget.control}`, body.rows[index]) : focusTarget.fallback ? $(focusTarget.fallback) : null;
    target?.focus();
  }
}

function renderRoutePreview() {
  const root = $('#route-preview');
  root.innerHTML = state.routeImage ? `<img src="${state.routeImage}" alt="ルート">` : '';
}

function normalizePhoneNumber(value) {
  const input = String(value || '').trim().replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0));
  if (!input) return '';
  if (!/^[0-9\s\u3000\-‐‑‒–—―ー−]+$/.test(input)) return null;
  const digits = input.replace(/[^0-9]/g, '');
  if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  if (digits.length !== 10) return null;

  const groups = input.split(/[\s\u3000\-‐‑‒–—―ー−]+/).filter(Boolean);
  if (groups.length === 3 && groups.every(group => group.length >= 2 && group.length <= 4) && groups.join('') === digits) {
    return groups.join('-');
  }
  if (digits.startsWith('03') || digits.startsWith('06')) return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6)}`;
  if (/^0(?:261|263|264|265|266|267|268|269|270|274|276|277|278|279)/.test(digits)) {
    return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
}

function getFormData() {
  const ids = ['eventDate','meetingTime','meetingPlace','mountainName','areaMunicipality','rainPolicy','plannerStudentId','plannerName','plannerPhone','baseName','basePhone','police1Name','police1Phone','police2Name','police2Phone','police3Name','police3Phone','drinkLiters'];
  return Object.fromEntries(ids.map(id => {
    const value = $(`#${id}`).value.trim();
    return [id, id.endsWith('Phone') ? (normalizePhoneNumber(value) || value) : value];
  }));
}

function formatDateJP(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  const wd = ['日','月','火','水','木','土'];
  wd.splice(5,0,'金');
  return `${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日（${wd[d.getDay()]}曜日）`;
}
function durationLabel(min) {
  if (min === null || min === '' || Number.isNaN(Number(min))) return '—';
  const n = Number(min), h = Math.floor(n/60), m = n%60;
  return `${h}時間${m ? `${m}分` : ''}`;
}

function fitJourneyToPage() {
  const page = $('.doc-page[data-page="1"]', $('#document-preview'));
  const box = page ? $('.journey-box', page) : null;
  if (!page || !box) return 'normal';
  box.classList.remove('journey-box--compact','journey-box--dense');
  if (page.scrollHeight <= page.clientHeight + 1) return 'normal';
  box.classList.add('journey-box--compact');
  if (page.scrollHeight <= page.clientHeight + 1) return 'compact';
  box.classList.remove('journey-box--compact');
  box.classList.add('journey-box--dense');
  return 'dense';
}

function fitRouteImageForPdf() {
  const frame = $('.route-image-frame', $('#document-preview'));
  const img = $('img', frame || document.createElement('div'));
  if (!frame || !img || !img.naturalWidth || !img.naturalHeight) return false;
  const scale = Math.min(frame.clientWidth / img.naturalWidth, frame.clientHeight / img.naturalHeight);
  img.style.width = `${img.naturalWidth * scale}px`;
  img.style.height = `${img.naturalHeight * scale}px`;
  return true;
}

function renderDocument() {
  const form = getFormData();
  const major = adjustedRows().filter(r => r.major);
  const start = major[0]?.adjustedTime || '—';
  const goal = major.at(-1)?.adjustedTime || '—';
  const route = state.routeImage ? `<img src="${state.routeImage}" alt="YAMAPルート地図">` : '<div class="route-placeholder">ルート画像なし</div>';
  const title = form.mountainName ? `${escapeHtml(form.mountainName)}登山計画書` : '登山計画書';
  const secondPolice = form.police2Name && form.police2Phone ? `<p>${escapeHtml(form.police2Name)}：${escapeHtml(form.police2Phone)}</p>` : '';
  const thirdPolice = form.police3Name && form.police3Phone ? `<p>${escapeHtml(form.police3Name)}：${escapeHtml(form.police3Phone)}</p>` : '';

  $('#document-preview').innerHTML = `
  <article class="doc-page" data-page="1">
    <h1>${title}</h1><h2>≪概要≫</h2>
    <p class="doc-line"><strong>【団体名】：</strong>${GROUP_NAME}</p>
    <p class="doc-line"><strong>【企画者】：</strong>${escapeHtml(form.plannerStudentId)}　${escapeHtml(form.plannerName)}</p>
    <p class="doc-line"><strong>【入山エリア】：</strong>${escapeHtml(form.mountainName)}（${escapeHtml(form.areaMunicipality)}）</p>
    <p class="doc-line"><strong>【日時】：</strong>${formatDateJP(form.eventDate)}　<span style="color:#da1e28">${escapeHtml(form.rainPolicy)}</span></p>
    <p class="doc-line"><strong>【集合場所】：</strong>${escapeHtml(form.meetingPlace)}</p>
    <p class="doc-line"><strong>【集合時間】：</strong>${escapeHtml(form.meetingTime)} <span style="color:#da1e28">※時間厳守</span></p>
    <h2>≪行程≫</h2>
    <p style="text-align:center">入山予定時刻 ${start} / 下山予定時刻 ${goal}</p>
    <p style="text-align:center">合計時間：約 ${durationLabel(state.metrics.durationMinutes)}　上り：${state.metrics.ascentM ?? '—'}m / 下り：${state.metrics.descentM ?? '—'}m　距離：${state.metrics.distanceKm ?? '—'}km</p>
    <div class="journey-box">${buildJourneyHtml()}<div class="journey-legend"><span class="start">Ⓢ</span>:Start　<span class="peak">Ⓟ</span>:Peak　<span class="goal">Ⓖ</span>:Goal</div></div>
  </article>
  <article class="doc-page" data-page="2">
    <h2>≪ルート≫</h2><div class="route-image-frame">${route}</div>
    <p class="warning">※天候の急変、登山道の崩壊、熊の出没等の要因により企画続行不可能と判断した場合は、計画書のルートを使用し直ちに下山する。</p>
  </article>
  <article class="doc-page" data-page="3">
    <h2>≪持参物≫</h2><div class="gear-box">□ザック　□登山靴　□雨具（レインウェアやザックカバー等）<br>□登山に適した服　□防寒着　□帽子　□飲料（${escapeHtml(form.drinkLiters)}L 程度）　□昼食<br>□ゴミ袋（5~10L 程度のビニール袋） □行動食　□お金　□携帯電話<br>□この登山計画書（印刷したもの）　□学生証　□保険証　□時計<br>□モバイルバッテリー　□日焼け止め　□紙地図※　□コンパス※<br>□常備薬※　□ファーストエイドキット※　□ヘッドライト※<br>□その他必要な物※　□温泉セット（タオルと着替え）<br><span class="doc-muted">（※ある人は持参する）</span><br><span class="doc-muted">（登山靴は駐車場で普段履きの靴と履き替えると良い。）</span></div>
    <h2 class="contact-heading">≪緊急連絡先≫</h2><div class="contact-list">
      <p>信州大学学生総合支援センター課外活動：${UNIVERSITY_PHONE}</p>
      <p>長野県警察本部地域部山岳安全対策課：${MOUNTAIN_SAFETY_PHONE}</p>
      <p>${escapeHtml(form.police1Name)}：${escapeHtml(form.police1Phone)}</p>
      ${secondPolice}
      ${thirdPolice}
      <p>企画者（${escapeHtml(form.plannerName)}）：${escapeHtml(form.plannerPhone)}</p>
      <p>留守本部（${escapeHtml(form.baseName)}）：${escapeHtml(form.basePhone)}</p>
    </div>
  </article>`;
  fitJourneyToPage();
}

function showStepError(step, message) {
  const root = $(`.step[data-step="${step}"]`);
  let summary = $('.validation-summary', root);
  if (!summary) {
    summary = document.createElement('div');
    summary.className = 'validation-summary';
    summary.setAttribute('role', 'alert');
    root.insertBefore(summary, $('.section-grid', root));
  }
  summary.textContent = message;
}

function clearStepError(step) {
  $(`.step[data-step="${step}"] .validation-summary`)?.remove();
}

function setFieldError(el, message) {
  const field = el.closest('.field');
  if (!field) return;
  const errorId = `${el.id}-error`;
  let error = document.getElementById(errorId);
  if (!error) {
    error = document.createElement('span');
    error.className = 'field-error';
    error.id = errorId;
    el.insertAdjacentElement('afterend', error);
  }
  error.textContent = message;
  el.setAttribute('aria-invalid', 'true');
  const describedBy = new Set((el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add(errorId);
  el.setAttribute('aria-describedby', [...describedBy].join(' '));
}

function clearFieldError(el) {
  if (!el?.id) return;
  document.getElementById(`${el.id}-error`)?.remove();
  el.removeAttribute('aria-invalid');
  const describedBy = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== `${el.id}-error`);
  if (describedBy.length) el.setAttribute('aria-describedby', describedBy.join(' '));
  else el.removeAttribute('aria-describedby');
}

function fieldLabel(el) {
  return $('.field > span', el.closest('.field'))?.textContent.trim() || el.id;
}

function fieldValidationMessage(el) {
  const label = fieldLabel(el);
  if (!el.value.trim() && el.required) return `${label}を入力してください。`;
  if (['plannerPhone','basePhone','police1Phone','police2Phone','police3Phone'].includes(el.id) && el.value.trim() && !normalizePhoneNumber(el.value)) {
    return '電話番号を確認してください（例：0267-22-0110、090-1234-5678）。';
  }
  if (el.validity.rangeUnderflow || el.validity.rangeOverflow) {
    const minimum = el.min ? Number(el.min) : null;
    const maximum = el.max ? Number(el.max) : null;
    if (minimum !== null && maximum !== null) return `${label}は${minimum}〜${maximum}の範囲で入力してください。`;
    if (minimum !== null) return `${label}は${minimum}以上で入力してください。`;
    if (maximum !== null) return `${label}は${maximum}以下で入力してください。`;
  }
  if (el.validity.stepMismatch) return `${label}は${el.step}刻みで入力してください。`;
  if (el.validity.badInput || el.validity.typeMismatch || el.validity.patternMismatch) return `${label}の形式を確認してください。`;
  return '';
}

function validateFields(step, ids) {
  const errors = [];
  for (const id of ids) {
    const el = $(`#${id}`);
    const message = fieldValidationMessage(el);
    if (message) {
      setFieldError(el, message);
      errors.push({el, message});
    } else clearFieldError(el);
  }
  if (!errors.length) {
    clearStepError(step);
    return true;
  }
  showStepError(step, errors[0].message);
  errors[0].el.focus();
  errors[0].el.scrollIntoView({block:'center',behavior:'smooth'});
  return false;
}

function validateStep1() {
  const valid = validateFields(1, ['eventDate','meetingTime','plannerStudentId','plannerName','plannerPhone','baseName','basePhone']);
  if (valid) state.maxReachedStep = Math.max(state.maxReachedStep, 1);
  return valid;
}
function validateStep3() {
  if (!validateFields(3, ['mountainName','areaMunicipality','durationMinutes','distanceKm','ascentM','descentM','police1Name','police1Phone','drinkLiters'])) return false;
  if (adjustedRows().filter(r => r.major && r.place.trim()).length < 2) {
    showStepError(3, '行程に掲載する地点を2か所以上入力してください。');
    $('.row-place', $('#itinerary-body'))?.focus();
    return false;
  }
  if (!state.routeImage) {
    showStepError(3, 'ルート画像を追加してください。');
    return false;
  }
  clearStepError(3);
  return true;
}

function renderProgress() {
  $$('.progress__step').forEach((el,i) => {
    const n = i + 1;
    el.classList.toggle('is-current', n === state.step);
    el.classList.toggle('is-complete', n < state.maxReachedStep);
    el.setAttribute('aria-current', n === state.step ? 'step' : 'false');
    el.setAttribute('aria-label', `${['基本情報','YAMAP','確認'][i]}、${n === state.step ? '現在のステップ' : n < state.maxReachedStep ? '完了、再表示できます' : '未開始'}`);
    el.disabled = n > state.maxReachedStep && n !== state.step;
  });
}

function goToStep(step) {
  const next = Math.max(1, Math.min(3, step));
  if (next > state.maxReachedStep + 1 && !(next === 2 && state.step === 1)) return;
  if (next > 1 && state.step === 1 && !validateStep1()) return;
  if (next > 2 && (!state.itinerary.length || !state.routeImage)) return;
  state.step = next;
  state.maxReachedStep = Math.max(state.maxReachedStep, next);
  $$('.step').forEach(el => el.classList.toggle('is-active', Number(el.dataset.step) === state.step));
  renderProgress();
  if (state.step !== 3) closePdfPreview();
  if (state.step === 3) { syncMetricInputs(); renderRoutePreview(); }
  window.scrollTo({top:0,behavior:'instant'});
  $(`#step-heading-${state.step}`)?.focus({preventScroll:true});
}

function hasUpload(kind) {
  return state.uploads.some(upload => upload.kind === kind);
}
function canAnalyzeUploads() {
  return hasUpload('route') && hasUpload('itinerary');
}

async function addFiles(files, kind) {
  const valid = files.filter(file => /^image\/(png|jpeg|webp)$/.test(file.type));
  if (files.length && !valid.length) { showStatus('PNG、JPEG、WebP形式の画像を選び直してください。', true); return; }
  pendingPdfFile = null;
  markPreparedPdfDirty();
  markImportIncomplete();

  if (kind === 'route') {
    const file = valid[0];
    const upload = {id:crypto.randomUUID(),name:file.name,url:await readFileAsDataUrl(file),kind:'route',classification:'route',routeSource:true};
    state.uploads = [upload, ...state.uploads.filter(item => item.kind !== 'route')];
    state.routeImage = upload.url;
  } else {
    for (const file of valid) {
      state.uploads.push({id:crypto.randomUUID(),name:file.name,url:await readFileAsDataUrl(file),kind:'itinerary',classification:'itinerary',routeSource:false});
    }
  }

  renderUploads();
  renderRoutePreview();
  $('#step2-next').disabled = true;
  if (canAnalyzeUploads()) await analyzeUploads();
  else {
    showStatus(kind === 'route' ? 'ルート画像を追加しました。続けて行程画像を追加してください。' : '行程画像を追加しました。ルート画像を追加すると読み取りを開始します。');
    if (!hasUpload('itinerary')) state.itinerary = [];
  }
}

const CONTACT_STORAGE_KEY = 'tozanContactsV2';
const CONTACT_IDS = ['plannerStudentId','plannerName','plannerPhone','baseName','basePhone'];
function loadContacts() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONTACT_STORAGE_KEY) || 'null');
    if (!saved) return;
    CONTACT_IDS.forEach(id => { if (saved[id]) $(`#${id}`).value = saved[id]; });
    $('#rememberContacts').checked = true;
  } catch (error) { console.warn(error); }
}
function saveContacts() {
  if (!$('#rememberContacts').checked) return;
  const data = Object.fromEntries(CONTACT_IDS.map(id => [id, $(`#${id}`).value.trim()]));
  try { localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(data)); } catch (error) { console.warn(error); }
}

function waitForImages(root) {
  return Promise.all($$('img',root).map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.addEventListener('load',resolve,{once:true}); img.addEventListener('error',resolve,{once:true}); })));
}
function nextFrame() { return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }
function safeFilename(value) { return String(value || '登山計画書').replace(/[\\/:*?"<>|]/g,'_').trim() || '登山計画書'; }

let pendingPdfFile = null;

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canShareFile(file) {
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return true;
  try { return navigator.canShare({files:[file]}); } catch { return false; }
}

async function shareFile(file) {
  await navigator.share({files:[file],title:file.name});
}

async function createPdfFile() {
  if (!window.html2canvas || !window.jspdf?.jsPDF) throw new Error('PDFを作成できません。');
  renderDocument();
  await document.fonts?.ready;
  await waitForImages($('#document-preview'));
  document.body.classList.add('is-pdf-export');
  await nextFrame();
  fitJourneyToPage();
  fitRouteImageForPdf();
  await nextFrame();
  const pages = $$('.doc-page', $('#document-preview'));
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  for (let i=0;i<pages.length;i+=1) {
    const page = pages[i];
    const canvas = await window.html2canvas(page,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,width:page.scrollWidth,height:page.scrollHeight,windowWidth:page.scrollWidth,windowHeight:page.scrollHeight});
    if (i > 0) pdf.addPage('a4','portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',0,0,210,297,undefined,'FAST');
  }
  const filename = `登山計画書_${safeFilename($('#mountainName').value)}.pdf`;
  return new File([pdf.output('blob')], filename, {type:'application/pdf'});
}

async function downloadPdf() {
  if (!validateStep3()) return;
  const button = $('#print-button');
  const originalLabel = 'PDFを共有';

  if (pendingPdfFile && canShareFile(pendingPdfFile)) {
    try {
      await shareFile(pendingPdfFile);
      pendingPdfFile = null;
      button.textContent = originalLabel;
    } catch (error) {
      if (error?.name !== 'AbortError') console.error(error);
    }
    return;
  }

  button.disabled = true;
  button.textContent = 'PDFを作成中…';
  try {
    const file = await createPdfFile();
    pendingPdfFile = file;
    if (canShareFile(file)) {
      try {
        await shareFile(file);
        pendingPdfFile = null;
        button.textContent = originalLabel;
      } catch (error) {
        if (error?.name === 'AbortError') {
          button.textContent = originalLabel;
        } else if (error?.name === 'NotAllowedError') {
          button.textContent = 'PDFを共有';
        } else {
          console.error(error);
          button.textContent = 'PDFを共有';
        }
      }
    } else {
      downloadFile(file);
      pendingPdfFile = null;
      button.textContent = originalLabel;
    }
  } catch (error) {
    console.error(error);
    window.alert(error.message);
    button.textContent = originalLabel;
  } finally {
    document.body.classList.remove('is-pdf-export');
    button.disabled = false;
  }
}

function bind() {
  ['durationMinutes','distanceKm','ascentM','descentM'].forEach(key => $(`#${key}`).addEventListener('input', e => { pendingPdfFile = null; state.metrics[key] = e.target.value === '' ? null : Number(e.target.value); }));
  $('#add-police').onclick = () => {
    const secondary = $('#police-secondary'), tertiary = $('#police-tertiary');
    if (secondary.hidden) {
      secondary.hidden = false; $('#police2Name').focus();
    } else if (tertiary.hidden) {
      tertiary.hidden = false; $('#police3Name').focus();
    }
    if (!tertiary.hidden) $('#add-police').disabled = true;
  };
  const policeRows = [['police-secondary','police2Name','police2Phone'],['police-tertiary','police3Name','police3Phone']];
  policeRows.forEach(([rowId,nameId,phoneId]) => {
    if ($(`#${nameId}`).value || $(`#${phoneId}`).value) $(`#${rowId}`).hidden = false;
  });
  $('#add-police').disabled = !$('#police-tertiary').hidden;
  $('#step1-next').onclick = () => goToStep(2);
  $('#step2-back').onclick = () => goToStep(1);
  $('#step2-next').onclick = () => goToStep(3);
  $('#step3-back').onclick = () => goToStep(2);
  $('#print-button').onclick = downloadPdf;
  $('#toggle-pdf-preview').onclick = async event => {
    const button = event.currentTarget;
    const root = $('#pdf-preview');
    if (!root.classList.contains('is-hidden')) {
      pdfPreviewGeneration += 1;
      root.classList.add('is-hidden'); button.setAttribute('aria-expanded','false'); button.textContent = 'PDFプレビューを表示';
      if (root.dataset.url) URL.revokeObjectURL(root.dataset.url);
      root.replaceChildren(); return;
    }
    button.disabled = true; button.textContent = 'プレビューを作成中…';
    const version = ++pdfPreviewGeneration;
    try {
      const file = await createPdfFile();
      if (version !== pdfPreviewGeneration) return;
      const url = URL.createObjectURL(file); root.dataset.url = url;
      const frame = document.createElement('iframe'); frame.title = '登山計画書PDFプレビュー'; frame.src = url;
      const fallback = document.createElement('a'); fallback.href = url; fallback.download = file.name; fallback.textContent = 'PDFを開けない場合は保存';
      root.replaceChildren(frame, fallback); root.classList.remove('is-hidden');
      button.setAttribute('aria-expanded','true'); button.textContent = 'PDFプレビューを閉じる';
    } catch (error) { showStepError(3, `プレビューを作成できませんでした。入力を確認して再試行してください。${error.message ? ` ${error.message}` : ''}`); }
    finally { button.disabled = false; if (button.textContent === 'プレビューを作成中…') button.textContent = 'PDFプレビューを表示'; document.body.classList.remove('is-pdf-export'); }
  };
  $$('.progress__step').forEach(btn => btn.onclick = () => { const n = Number(btn.dataset.stepTarget); if (n <= state.maxReachedStep) goToStep(n); });
  $('#rememberContacts').onchange = () => { if ($('#rememberContacts').checked) saveContacts(); else localStorage.removeItem(CONTACT_STORAGE_KEY); };
  CONTACT_IDS.forEach(id => $(`#${id}`).addEventListener('input', saveContacts));
  $('.step[data-step="3"]').addEventListener('input', () => { pendingPdfFile = null; closePdfPreview(); });
  $('.step[data-step="3"]').addEventListener('change', () => { closePdfPreview(); });
  [1,3].forEach(step => $(`.step[data-step="${step}"]`).addEventListener('input', e => {
    if (e.target.matches('.field input, .field select')) {
      clearFieldError(e.target);
      clearStepError(step);
      if (step === 1 && e.target.required && !e.target.checkValidity()) {
        state.maxReachedStep = 0;
        renderProgress();
      }
    }
  }));
}

bind();
loadContacts();
syncMetricInputs();
renderItinerary();
window.__tozanApp = { state, adjustedRows, renderDocument, renderUploads, renderProgress, goToStep, downloadPdf, validateStep3, resolveNaganoPoliceStations, addFiles, canAnalyzeUploads, fitJourneyToPage, fitRouteImageForPdf, createPdfFile };
