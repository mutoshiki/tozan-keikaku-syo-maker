async function preprocessImage(dataUrl, mode = 'full') {
  const img = await new Promise((resolve,reject) => { const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=dataUrl; });
  let sx=0, sy=0, sw=img.naturalWidth, sh=img.naturalHeight;
  if (mode === 'itinerary') { sx = 0; sy = img.naturalHeight * .21; sw = img.naturalWidth * .98; sh = img.naturalHeight * .64; }
  const scale = mode === 'itinerary' ? 1.65 : 1.2;
  const canvas = document.createElement('canvas'); canvas.width = Math.round(sw*scale); canvas.height=Math.round(sh*scale);
  const ctx = canvas.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(img, sx,sy,sw,sh, 0,0,canvas.width,canvas.height);
  const image = ctx.getImageData(0,0,canvas.width,canvas.height);
  const d=image.data;
  for (let p=0;p<d.length;p+=4){ const g=.299*d[p]+.587*d[p+1]+.114*d[p+2]; const v = g > 205 ? 255 : g < 70 ? 0 : Math.round((g-70)*255/135); d[p]=d[p+1]=d[p+2]=v; }
  ctx.putImageData(image,0,0);
  return canvas.toDataURL('image/png');
}

async function cropRouteMap(dataUrl) {
  const img = await new Promise((resolve,reject) => { const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=dataUrl; });
  const sx=img.naturalWidth*.035, sy=img.naturalHeight*.225, sw=img.naturalWidth*.93, sh=img.naturalHeight*.31;
  const canvas=document.createElement('canvas'); canvas.width=Math.round(sw); canvas.height=Math.round(sh);
  canvas.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.92);
}

async function ocr(dataUrl, logger) {
  if (!window.Tesseract?.recognize) throw new Error('OCRライブラリを読み込めませんでした。ネットワーク接続を確認してください。');
  const result = await window.Tesseract.recognize(dataUrl, 'jpn+eng', { logger });
  return result?.data?.text || '';
}

async function analyzeUploads() {
  if (!state.uploads.length || state.analyzing) return;
  state.analyzing = true; $('#analyze-button').disabled = true; showStatus('画像を解析しています…', false);
  try {
    let mergedRows = [];
    let foundMetrics = { ...state.metrics };
    for (let index=0; index<state.uploads.length; index += 1) {
      const upload = state.uploads[index];
      showStatus(`${index+1}/${state.uploads.length} 枚目を読み取り中…`, false);
      const fullInput = await preprocessImage(upload.url, 'full');
      let fullText = await ocr(fullInput, m => { if (m?.status === 'recognizing text') showStatus(`${index+1}/${state.uploads.length} 枚目を読み取り中… ${Math.round((m.progress||0)*100)}%`, false); });
      let classification = classifyText(fullText);
      let combinedText = fullText;
      if (classification === 'itinerary' || (classification === 'unknown' && (fullText.match(/[0-2]?\d\s*:\s*[0-5]\d/g)||[]).length >= 3)) {
        const focusInput = await preprocessImage(upload.url, 'itinerary');
        const focusText = await ocr(focusInput, () => {});
        combinedText += `\n${focusText}`;
        classification = 'itinerary';
      }
      upload.ocrText = combinedText;
      upload.classification = classification;
      const parsedMetrics = parseMetrics(combinedText);
      for (const key of Object.keys(foundMetrics)) if (parsedMetrics[key] !== null) foundMetrics[key] = parsedMetrics[key];
      if (classification === 'metrics' && !state.routeImage) state.routeImage = await cropRouteMap(upload.url);
      if (classification === 'itinerary') mergedRows.push(...parseItinerary(combinedText));
    }
    const byTime = new Map();
    const score = r => Number(r._confidence || 0) * 100 + (r.place === '分岐' ? 4 : r.place.length + (/[山岳峰]/.test(r.place) ? 18 : 0) + (/登山口|牧場|トイレ/.test(r.place) ? 8 : 0));
    for (const row of mergedRows) {
      const old=byTime.get(row.time); if (!old || score(row)>score(old)) byTime.set(row.time,row);
    }
    state.itinerary=[...byTime.values()].sort((a,b)=>a.time.localeCompare(b.time));
    state.metrics=foundMetrics;
    renderUploads(); renderItinerary(); syncMetricInputs();
    const named = state.itinerary.filter(r => r.place !== '分岐').length;
    showStatus(`読み取り完了：${state.itinerary.length}地点（主要地点 ${named}）を取得しました。`, false);
    goToStep(3);
  } catch (error) {
    console.error(error); showStatus(`読み取りに失敗しました：${error.message}`, true);
  } finally { state.analyzing=false; $('#analyze-button').disabled = !state.uploads.length; }
}

function showStatus(message, error=false) { const el=$('#analysis-status'); el.textContent=message; el.classList.remove('is-hidden'); el.classList.toggle('is-error',error); }

function renderUploads() {
  const root=$('#upload-list'); root.innerHTML='';
  for (const upload of state.uploads) {
    const card=document.createElement('article'); card.className='upload-card';
    const tag = upload.classification==='metrics' ? '<span class="tag tag--blue">計画データ</span>' : upload.classification==='itinerary' ? '<span class="tag tag--green">行程</span>' : `<span class="tag">${upload.classification==='unknown'?'未分類':'未解析'}</span>`;
    card.innerHTML=`<img src="${upload.url}" alt="YAMAPスクリーンショット"><div class="upload-card__body"><div class="upload-card__name">${escapeHtml(upload.name)}</div><div class="tag-row">${tag}${state.routeImage && upload.routeSource ? '<span class="route-mark">ルート画像</span>':''}</div><div class="upload-card__actions"><button class="btn btn--tertiary use-route" type="button">ルートに使う</button><button class="btn btn--danger-ghost remove-upload" type="button" aria-label="削除">削除</button></div></div>`;
    $('.use-route',card).onclick=async()=>{ state.uploads.forEach(u=>u.routeSource=false); upload.routeSource=true; state.routeImage=await cropRouteMap(upload.url); renderUploads(); };
    $('.remove-upload',card).onclick=()=>{ state.uploads=state.uploads.filter(u=>u.id!==upload.id); if(upload.routeSource) state.routeImage=''; renderUploads(); $('#analyze-button').disabled=!state.uploads.length; };
    root.append(card);
  }
}
