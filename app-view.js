function syncMetricInputs() {
  for (const key of ['durationMinutes','distanceKm','ascentM','descentM']) $(`#${key}`).value = state.metrics[key] ?? '';
}

function renderItinerary() {
  const body=$('#itinerary-body'); body.innerHTML=''; const adjusted=adjustedRows();
  state.itinerary.forEach((row,index)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input class="row-time" type="time" value="${row.time}"><div class="adjusted">提出 ${adjusted[index]?.adjustedTime||row.time}</div></td><td><input class="row-place" type="text" value="${escapeHtml(row.place)}"></td><td><input class="row-major" type="checkbox" ${row.major?'checked':''} aria-label="提出用に含める"></td><td><input class="row-rest" type="number" min="0" step="5" value="${Number(row.restMinutes||0)}" aria-label="休憩分"></td><td><button class="btn btn--danger-ghost row-remove" type="button">削除</button></td>`;
    $('.row-time',tr).onchange=e=>{row.time=e.target.value; state.itinerary.sort((a,b)=>a.time.localeCompare(b.time)); renderItinerary();};
    $('.row-place',tr).oninput=e=>{row.place=e.target.value;}; $('.row-major',tr).onchange=e=>{row.major=e.target.checked;};
    $('.row-rest',tr).oninput=e=>{row.restMinutes=Number(e.target.value||0); renderItinerary();};
    $('.row-remove',tr).onclick=()=>{state.itinerary.splice(index,1);renderItinerary();}; body.append(tr);
  });
}

function getFormData() {
  const ids=['eventDate','meetingTime','meetingPlace','mountainName','areaMunicipality','rainPolicy','plannerStudentId','plannerName','plannerPhone','baseName','basePhone','police1Name','police1Phone','police2Name','police2Phone','drinkLiters'];
  return Object.fromEntries(ids.map(id=>[id,$(`#${id}`).value.trim()]));
}
function formatDateJP(value){ if(!value)return ''; const d=new Date(`${value}T00:00:00`); const wd=['日','月','火','水','木','金','土']; return `${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日（${wd[d.getDay()]}曜日）`; }
function durationLabel(min){ if(min===null||min===''||Number.isNaN(Number(min)))return '—'; const n=Number(min), h=Math.floor(n/60),m=n%60; return `${h}時間${m?`${m}分`:''}`; }

function renderDocument() {
  const form=getFormData();
  const major=adjustedRows().filter(r=>r.major); const start=major[0]?.adjustedTime||'—'; const goal=major.at(-1)?.adjustedTime||'—';
  $('#summary-strip').innerHTML=`<div><small>入山</small><strong>${start}</strong></div><div><small>下山</small><strong>${goal}</strong></div><div><small>距離</small><strong>${state.metrics.distanceKm??'—'} km</strong></div><div><small>上り / 下り</small><strong>${state.metrics.ascentM??'—'} / ${state.metrics.descentM??'—'} m</strong></div>`;
  const route = state.routeImage ? `<img src="${state.routeImage}" alt="YAMAPルート地図">` : '<div class="route-placeholder">ルート画像を設定してください</div>';
  const title = form.mountainName ? `${escapeHtml(form.mountainName)}登山計画書` : '登山計画書';
  const densityClass = major.length >= 11 ? ' journey-box--dense' : major.length >= 8 ? ' journey-box--compact' : '';
  const extraContact = (form.police2Name || form.police2Phone)
    ? `<p>${escapeHtml(form.police2Name || '追加連絡先')}：${escapeHtml(form.police2Phone || '（電話番号）')}</p>`
    : '';
  $('#document-preview').innerHTML=`
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
    <p style="text-align:center">合計時間：約 ${durationLabel(state.metrics.durationMinutes)}　上り：${state.metrics.ascentM??'—'}m / 下り：${state.metrics.descentM??'—'}m　距離：${state.metrics.distanceKm??'—'}km</p>
    <div class="journey-box${densityClass}">${buildJourneyHtml()}<div class="journey-legend"><span class="start">Ⓢ</span>:Start　<span class="peak">Ⓟ</span>:Peak　<span class="goal">Ⓖ</span>:Goal</div></div>
  </article>
  <article class="doc-page" data-page="2">
    <h2>≪ルート≫</h2><div class="route-image-frame route-image-frame--large">${route}</div>
    <p class="warning">※天候の急変、登山道の崩壊、熊の出没等の要因により企画続行不可能と判断した場合は、計画書のルートを使用し直ちに下山する。</p>
  </article>
  <article class="doc-page" data-page="3">
    <h2>≪持参物≫</h2><div class="gear-box">□ザック　□登山靴　□雨具（レインウェアやザックカバー等）<br>□登山に適した服　□防寒着　□帽子　□飲料（${escapeHtml(form.drinkLiters)}L 程度）　□昼食<br>□ゴミ袋（5~10L 程度のビニール袋） □行動食　□お金　□携帯電話<br>□この登山計画書（印刷したもの）　□学生証　□保険証　□時計<br>□モバイルバッテリー　□日焼け止め　□紙地図※　□コンパス※<br>□常備薬※　□ファーストエイドキット※　□ヘッドライト※<br>□その他必要な物※　□温泉セット（タオルと着替え）<br><span class="doc-muted">（※ある人は持参する）</span><br><span class="doc-muted">（登山靴は駐車場で普段履きの靴と履き替えると良い。）</span></div>
    <h2 class="contact-heading">≪緊急連絡先≫</h2><div class="contact-list">
      <p>信州大学学生総合支援センター課外活動：${UNIVERSITY_PHONE}</p>
      <p>長野県警察本部地域部山岳安全対策課：${MOUNTAIN_SAFETY_PHONE}</p>
      <p>${escapeHtml(form.police1Name)}：${escapeHtml(form.police1Phone)}</p>
      ${extraContact}
      <p>企画者（${escapeHtml(form.plannerName)}）：${escapeHtml(form.plannerPhone)}</p>
      <p>留守本部（${escapeHtml(form.baseName)}）：${escapeHtml(form.basePhone)}</p>
    </div>
  </article>`;
}

function focusFirst(ids) {
  const id=ids.find(item=>!$(`#${item}`).value.trim());
  if(!id) return true;
  const el=$(`#${id}`); el.focus(); el.scrollIntoView({block:'center',behavior:'smooth'}); return false;
}

function validateStep1() {
  return focusFirst(['eventDate','meetingTime','plannerStudentId','plannerName','plannerPhone','baseName','basePhone']);
}

function validateStep3() {
  if(!focusFirst(['mountainName','areaMunicipality','durationMinutes','distanceKm','ascentM','descentM','police1Name','police1Phone','drinkLiters'])) return false;
  const major=adjustedRows().filter(r=>r.major && r.place.trim());
  if(major.length<2){ window.alert('提出用の行程地点を2件以上確認してください。'); return false; }
  if(!state.routeImage){ window.alert('提出用のルート画像を設定してください。'); return false; }
  return true;
}

function goToStep(step) {
  if(step>1 && state.step===1 && !validateStep1()) return;
  if(step>2 && state.step===2 && !state.uploads.length) return;
  if(step>3 && state.step===3 && !validateStep3()) return;
  state.step=Math.max(1,Math.min(4,step));
  $$('.step').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.step)===state.step));
  $$('.progress__step').forEach((el,i)=>{ const n=i+1; el.classList.toggle('is-current',n===state.step); el.classList.toggle('is-complete',n<state.step); });
  $('#back-button').disabled=state.step===1; $('#next-button').textContent=state.step===4?'完了':'次へ'; $('#next-button').style.visibility=state.step===4?'hidden':'visible';
  if(state.step===4) renderDocument(); window.scrollTo({top:0,behavior:'instant'});
}

async function addFiles(files) {
  for(const file of files){ if(!file.type.startsWith('image/'))continue; state.uploads.push({id:crypto.randomUUID(),name:file.name,url:await readFileAsDataUrl(file),classification:'pending',ocrText:'',routeSource:false}); }
  renderUploads(); $('#analyze-button').disabled=!state.uploads.length;
}

const PLANNER_STORAGE_KEY='tozanPlannerProfileV1';
function loadPlannerProfile(){
  try{
    const saved=JSON.parse(localStorage.getItem(PLANNER_STORAGE_KEY)||'null');
    if(!saved) return;
    for(const id of ['plannerStudentId','plannerName','plannerPhone']) if(saved[id]) $(`#${id}`).value=saved[id];
    $('#rememberPlanner').checked=true;
  }catch(error){ console.warn('企画者情報の読み込みに失敗しました',error); }
}
function savePlannerProfile(){
  if(!$('#rememberPlanner').checked) return;
  const data=Object.fromEntries(['plannerStudentId','plannerName','plannerPhone'].map(id=>[id,$(`#${id}`).value.trim()]));
  try{ localStorage.setItem(PLANNER_STORAGE_KEY,JSON.stringify(data)); }catch(error){ console.warn('企画者情報の保存に失敗しました',error); }
}

function waitForImages(root){
  return Promise.all($$('img',root).map(img=>img.complete ? Promise.resolve() : new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});})));
}
function nextFrame(){ return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))); }
function safeFilename(value){ return String(value||'未設定').replace(/[\\/:*?"<>|]/g,'_').trim()||'未設定'; }

async function downloadPdf(){
  const button=$('#print-button');
  const oldText=button.textContent;
  button.disabled=true; button.textContent='PDFを作成中…';
  try{
    if(!window.html2canvas || !window.jspdf?.jsPDF) throw new Error('PDF生成ライブラリを読み込めませんでした。通信状態を確認してください。');
    renderDocument();
    await document.fonts?.ready;
    await waitForImages($('#document-preview'));
    document.body.classList.add('is-pdf-export');
    await nextFrame();
    const pages=$$('.doc-page',$('#document-preview'));
    const { jsPDF }=window.jspdf;
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    for(let i=0;i<pages.length;i+=1){
      const page=pages[i];
      const canvas=await window.html2canvas(page,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,width:page.scrollWidth,height:page.scrollHeight,windowWidth:page.scrollWidth,windowHeight:page.scrollHeight});
      if(i>0) pdf.addPage('a4','portrait');
      const image=canvas.toDataURL('image/jpeg',0.94);
      pdf.addImage(image,'JPEG',0,0,210,297,undefined,'FAST');
    }
    pdf.save(`登山計画書_${safeFilename($('#mountainName').value)}.pdf`);
  }catch(error){
    console.error(error);
    window.alert(`PDF作成に失敗しました：${error.message}`);
  }finally{
    document.body.classList.remove('is-pdf-export');
    button.disabled=false; button.textContent=oldText;
  }
}

function bind() {
  $('#file-input').addEventListener('change',e=>addFiles([...e.target.files]));
  const dz=$('#drop-zone'); dz.addEventListener('dragover',e=>{e.preventDefault();}); dz.addEventListener('drop',e=>{e.preventDefault();addFiles([...e.dataTransfer.files]);});
  $('#analyze-button').onclick=analyzeUploads;
  ['durationMinutes','distanceKm','ascentM','descentM'].forEach(key=>{ $(`#${key}`).addEventListener('input',e=>{state.metrics[key]=e.target.value===''?null:Number(e.target.value);}); });
  $('#add-row').onclick=()=>{state.itinerary.push({time:'12:00',place:'',major:true,restMinutes:0});state.itinerary.sort((a,b)=>a.time.localeCompare(b.time));renderItinerary();};
  $('#back-button').onclick=()=>goToStep(state.step-1); $('#next-button').onclick=()=>goToStep(state.step+1);
  $$('.progress__step').forEach(btn=>btn.onclick=()=>{ const n=Number(btn.dataset.stepTarget); if(n<=state.step || n===state.step+1)goToStep(n); });
  $('#print-button').onclick=downloadPdf;
  const remember=$('#rememberPlanner');
  remember.onchange=()=>{ if(remember.checked) savePlannerProfile(); else localStorage.removeItem(PLANNER_STORAGE_KEY); };
  ['plannerStudentId','plannerName','plannerPhone'].forEach(id=>$(`#${id}`).addEventListener('input',savePlannerProfile));
}

bind(); loadPlannerProfile(); syncMetricInputs(); renderItinerary();
window.__tozanApp = { state, parseMetrics, parseItinerary, classifyText, adjustedRows, renderDocument, goToStep, downloadPdf, validateStep3 };
