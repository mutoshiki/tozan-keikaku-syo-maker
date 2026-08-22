import React, { useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionItem, Button, Checkbox, FileUploaderDropContainer, Header,
  HeaderName, InlineNotification, ProgressIndicator, ProgressStep, Select, SelectItem,
  Tag, TextInput, Theme, Tile,
} from '@carbon/react';
import { Add, ArrowLeft, ArrowRight, DocumentPdf, Image as ImageIcon, TrashCan } from '@carbon/react/icons';
import { createWorker } from 'tesseract.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { applyRests, buildItineraryText, classifyOcr, parseItinerary, parseMetrics } from './yamap.js';

const GROUP = '信州大学 山歩会（長野県松本市旭 3-1-1）';
const UNIVERSITY = '0263-37-2197';
const SAFETY = '026-233-0110';
const EMPTY_METRICS = { durationMinutes: null, distanceKm: null, ascentM: null, descentM: null };
const INITIAL = {
  eventDate: '', meetingPlace: '信州大学 松本キャンパス サークルボックス前', meetingTime: '05:00',
  mountainName: '', areaMunicipality: '', plannerStudentId: '', plannerName: '', plannerPhone: '',
  baseName: '', basePhone: '', rainPolicy: '雨天中止', drinkLiters: '1.5',
  police1Name: '', police1Phone: '', police2Name: '', police2Phone: '',
};

const fileDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
});
const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
});

async function preprocess(src, itinerary = false) {
  const image = await loadImage(src);
  const sx = 0;
  const sy = itinerary ? image.naturalHeight * 0.21 : 0;
  const sw = itinerary ? image.naturalWidth * 0.98 : image.naturalWidth;
  const sh = itinerary ? image.naturalHeight * 0.64 : image.naturalHeight;
  const scale = itinerary ? 1.65 : 1.2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const gray = .299 * pixels.data[i] + .587 * pixels.data[i + 1] + .114 * pixels.data[i + 2];
    const value = gray > 205 ? 255 : gray < 70 ? 0 : Math.round(((gray - 70) * 255) / 135);
    pixels.data[i] = value; pixels.data[i + 1] = value; pixels.data[i + 2] = value;
  }
  ctx.putImageData(pixels, 0, 0); return canvas.toDataURL('image/png');
}

async function cropMap(src) {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  const x = image.naturalWidth * .035, y = image.naturalHeight * .225;
  const w = image.naturalWidth * .93, h = image.naturalHeight * .31;
  canvas.width = Math.round(w); canvas.height = Math.round(h);
  canvas.getContext('2d').drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .92);
}

function Field({ id, label, value, set, type = 'text', required = false, helperText }) {
  return <TextInput id={id} labelText={`${label}${required ? ' *' : ''}`} value={value} type={type} helperText={helperText} onChange={(e) => set(e.target.value)} />;
}
function duration(value) {
  if (value === null || value === '' || Number.isNaN(Number(value))) return '—';
  const n = Number(value); const h = Math.floor(n / 60); const m = n % 60; return `${h}時間${m ? `${m}分` : ''}`;
}
function dateJa(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`); const wd = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日（${wd[d.getDay()]}曜日）`;
}

function Basic({ form, setForm }) {
  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));
  return <div className="step-body">
    <div className="section-heading"><h2>基本情報</h2><p>毎回変わる情報だけ入力します。団体名と大学の連絡先はテンプレートの固定値です。</p></div>
    <div className="form-grid">
      <Field id="date" label="実施日" required type="date" value={form.eventDate} set={set('eventDate')} />
      <Field id="meet-time" label="集合時間" required type="time" value={form.meetingTime} set={set('meetingTime')} />
      <Field id="meet-place" label="集合場所" required value={form.meetingPlace} set={set('meetingPlace')} />
      <Field id="mountain" label="山名・企画名" required value={form.mountainName} set={set('mountainName')} helperText="例：根子岳・四阿山" />
      <Field id="area" label="山域 / 所在市町村" required value={form.areaMunicipality} set={set('areaMunicipality')} helperText="例：四阿山 / 上田市" />
      <Select id="rain" labelText="雨天時" value={form.rainPolicy} onChange={(e) => set('rainPolicy')(e.target.value)}>
        <SelectItem value="雨天中止" text="雨天中止" /><SelectItem value="荒天中止" text="荒天中止" /><SelectItem value="小雨決行" text="小雨決行" />
      </Select>
    </div>
    <h3 className="subheading">企画者</h3>
    <div className="form-grid form-grid--three"><Field id="sid" label="学籍番号" required value={form.plannerStudentId} set={set('plannerStudentId')} /><Field id="pname" label="氏名" required value={form.plannerName} set={set('plannerName')} /><Field id="pphone" label="電話番号" required type="tel" value={form.plannerPhone} set={set('plannerPhone')} /></div>
    <h3 className="subheading">留守本部</h3>
    <div className="form-grid"><Field id="bname" label="氏名" required value={form.baseName} set={set('baseName')} /><Field id="bphone" label="電話番号" required type="tel" value={form.basePhone} set={set('basePhone')} /></div>
    <Accordion className="optional-accordion"><AccordionItem title="警察署・飲料量">
      <div className="form-grid form-grid--three"><Field id="police1" label="警察署 1" value={form.police1Name} set={set('police1Name')} /><Field id="police1p" label="電話番号" type="tel" value={form.police1Phone} set={set('police1Phone')} /><Field id="drink" label="飲料量（L）" type="number" value={form.drinkLiters} set={set('drinkLiters')} /><Field id="police2" label="警察署 2" value={form.police2Name} set={set('police2Name')} /><Field id="police2p" label="電話番号" type="tel" value={form.police2Phone} set={set('police2Phone')} /></div>
    </AccordionItem></Accordion>
    <Tile className="fixed-values"><strong>{GROUP}</strong><div>学生総合支援センター課外活動：{UNIVERSITY}</div><div>長野県警察本部地域部山岳安全対策課：{SAFETY}</div></Tile>
  </div>;
}

function UploadStep({ uploads, setUploads, analyze, busy, progress, routeImage }) {
  const add = async (files) => {
    const next = [];
    for (const file of Array.from(files || [])) if (file.type.startsWith('image/')) next.push({ id: `${file.name}-${file.lastModified}-${Math.random()}`, name: file.name, url: await fileDataUrl(file), classification: 'pending' });
    setUploads((p) => [...p, ...next]);
  };
  return <div className="step-body">
    <div className="section-heading"><h2>YAMAPスクリーンショット</h2><p>計画データ画面と、行程が最後まで分かるスクリーンショットをまとめて追加してください。</p></div>
    <FileUploaderDropContainer accept={['image/png','image/jpeg','image/webp']} multiple labelText="画像を追加" helperText="複数選択できます" onAddFiles={(_, data) => add(data.addedFiles)} />
    {uploads.length > 0 && <div className="upload-grid">{uploads.map((u) => <Tile className="upload-card" key={u.id}><img src={u.url} alt="YAMAP" /><div className="upload-card__body"><div className="upload-card__title">{u.name}</div><div className="tag-row"><Tag type={u.classification === 'metrics' ? 'blue' : u.classification === 'itinerary' ? 'green' : 'cool-gray'}>{u.classification === 'metrics' ? '計画データ' : u.classification === 'itinerary' ? '行程' : '未解析'}</Tag></div><Button kind="ghost" size="sm" hasIconOnly renderIcon={TrashCan} iconDescription="削除" onClick={() => setUploads((p) => p.filter((x) => x.id !== u.id))} /></div></Tile>)}</div>}
    {routeImage && <div className="route-preview-inline"><strong>ルート画像を自動抽出しました</strong><img src={routeImage} alt="ルート" /></div>}
    <div className="analysis-row"><Button renderIcon={ImageIcon} disabled={!uploads.length || busy} onClick={analyze}>{busy ? `読み取り中 ${progress}%` : 'YAMAPから読み取る'}</Button><span>読み取り結果は次の画面で修正できます。</span></div>
  </div>;
}

function Itinerary({ metrics, setMetrics, rows, setRows }) {
  const adjusted = useMemo(() => applyRests(rows), [rows]);
  const metric = (key) => (value) => setMetrics((p) => ({ ...p, [key]: value === '' ? null : Number(value) }));
  const patch = (i, value) => setRows((p) => p.map((r, n) => n === i ? { ...r, ...value } : r));
  return <div className="step-body">
    <div className="section-heading"><h2>読み取り結果を確認</h2><p>OCRの誤読だけ直してください。「分岐」は初期状態では提出用行程から外しています。</p></div>
    <div className="metrics-grid"><Field id="duration" label="合計時間（分）" type="number" value={metrics.durationMinutes ?? ''} set={metric('durationMinutes')} /><Field id="distance" label="距離（km）" type="number" value={metrics.distanceKm ?? ''} set={metric('distanceKm')} /><Field id="up" label="上り（m）" type="number" value={metrics.ascentM ?? ''} set={metric('ascentM')} /><Field id="down" label="下り（m）" type="number" value={metrics.descentM ?? ''} set={metric('descentM')} /></div>
    <div className="itinerary-header"><div><h3>行程</h3><p>{rows.length}地点</p></div><Button kind="tertiary" size="sm" renderIcon={Add} onClick={() => setRows((p) => [...p, { time: '12:00', place: '', major: true, restMinutes: 0 }])}>地点を追加</Button></div>
    <div className="itinerary-list">{rows.map((row, i) => <div className="itinerary-row" key={`${row.time}-${i}`}>
      <Field id={`time-${i}`} label="時刻" type="time" value={row.time} set={(v) => patch(i, { time: v })} />
      <Field id={`place-${i}`} label="地点" value={row.place} set={(v) => patch(i, { place: v, major: v === '分岐' ? false : row.major })} />
      <Field id={`rest-${i}`} label="休憩（分）" type="number" value={row.restMinutes || 0} set={(v) => patch(i, { restMinutes: Number(v) || 0 })} />
      <div className="adjusted-time"><span>提出時刻</span><strong>{adjusted[i]?.adjustedTime}</strong></div>
      <Checkbox id={`major-${i}`} labelText="計画書に載せる" checked={row.major} onChange={(_, state) => patch(i, { major: state.checked })} />
      <Button kind="ghost" size="sm" hasIconOnly renderIcon={TrashCan} iconDescription="削除" onClick={() => setRows((p) => p.filter((_, n) => n !== i))} />
    </div>)}</div>
  </div>;
}

const GEAR = ['ザック','登山靴','雨具（レインウェアやザックカバー等）','登山に適した服','防寒着','帽子','飲料','昼食','ゴミ袋（5〜10L程度のビニール袋）','行動食','お金','携帯電話','この登山計画書（印刷したもの）','学生証','保険証','時計','モバイルバッテリー','日焼け止め','紙地図※','コンパス※','常備薬※','ファーストエイドキット※','ヘッドライト※','その他必要な物※','温泉セット（タオルと着替え）'];
function PageOne({ form, metrics, rows }) {
  const shown = applyRests(rows).filter((r) => r.major); const entry = shown[0]?.adjustedTime || '—'; const exit = shown.at(-1)?.adjustedTime || '—';
  return <section className="doc-page"><h1 className="doc-title"><span>{form.mountainName || '山名'}</span>登山計画書</h1><h2>≪概要≫</h2><div className="doc-lines"><p><b>【団体名】</b>：{GROUP}</p><p><b>【企画者】</b>：{form.plannerStudentId}　{form.plannerName}</p><p><b>【入山エリア】</b>：{form.mountainName}（{form.areaMunicipality}）</p><p><b>【日時】</b>：{dateJa(form.eventDate)}　<span className="doc-red">{form.rainPolicy}</span></p><p><b>【集合場所】</b>：{form.meetingPlace}</p><p><b>【集合時間】</b>：<u>{form.meetingTime}</u> <span className="doc-red">※時間厳守</span></p></div><h2>≪行程≫</h2><p className="doc-centered">入山予定時刻 {entry} / 下山予定時刻 {exit}</p><p className="doc-centered">合計時間：約 {duration(metrics.durationMinutes)}　上り：{metrics.ascentM ?? '—'}m / 下り：{metrics.descentM ?? '—'}m　距離：{metrics.distanceKm ?? '—'}km</p><div className="doc-itinerary-box">{buildItineraryText(rows) || '行程を確認してください。'}</div><p className="doc-legend"><span>Ⓢ</span>:Start　<span>Ⓟ</span>:Peak　<span>Ⓖ</span>:Goal</p></section>;
}
function PageTwo({ routeImage, form }) { return <section className="doc-page"><h2>≪ルート≫</h2><div className="doc-route">{routeImage ? <img src={routeImage} alt="YAMAPルート" /> : <span>YAMAPの地図画像を設定してください</span>}</div><h2>≪持参物≫</h2><div className="doc-gear-box">{GEAR.map((x) => <span key={x}>□{x === '飲料' ? `飲料（${form.drinkLiters || 1.5}L 程度）` : x}</span>)}<div className="doc-gear-note">（※ある人は持参する）</div><div>（登山靴は駐車場で普段履きの靴と履き替えると良い。）</div></div><p className="doc-warning">※天候の急変、登山道の崩壊、熊の出没等の要因により企画続行不可能と判断した場合は、計画書のルートを使用し直ちに下山する。</p></section>; }
function PageThree({ form }) { return <section className="doc-page"><h2>≪緊急連絡先≫</h2><div className="doc-contact-list"><p>信州大学学生総合支援センター課外活動：{UNIVERSITY}</p><p>長野県警察本部地域部山岳安全対策課：{SAFETY}</p><p>{form.police1Name || '警察署'}：{form.police1Phone || '（電話番号）'}</p><p>{form.police2Name || '警察署'}：{form.police2Phone || '（電話番号）'}</p><p>企画者（{form.plannerName || '氏名'}）：{form.plannerPhone || '（電話番号）'}</p><p>留守本部（{form.baseName || '氏名'}）：{form.basePhone || '（電話番号）'}</p></div></section>; }

function Preview({ form, metrics, rows, routeImage, refs, onPdf, busy }) { return <div className="step-body preview-step"><div className="section-heading"><h2>提出前プレビュー</h2><p>3ページの内容を確認してPDFを生成してください。</p></div><div className="preview-toolbar"><Button renderIcon={DocumentPdf} disabled={busy} onClick={onPdf}>{busy ? 'PDF生成中…' : 'PDFを作成'}</Button><a className="template-link" href={`${import.meta.env.BASE_URL}登山計画書テンプレ.docx`} download>元のWordテンプレート</a></div><div className="doc-preview-shell"><div ref={(e) => { refs.current[0] = e; }}><PageOne form={form} metrics={metrics} rows={rows} /></div><div ref={(e) => { refs.current[1] = e; }}><PageTwo routeImage={routeImage} form={form} /></div><div ref={(e) => { refs.current[2] = e; }}><PageThree form={form} /></div></div></div>; }

export default function App() {
  const [step, setStep] = useState(0), [form, setForm] = useState(INITIAL), [uploads, setUploads] = useState([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS), [rows, setRows] = useState([]), [routeImage, setRouteImage] = useState('');
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [message, setMessage] = useState(null), refs = useRef([]);
  const analyze = async () => {
    setBusy(true); setProgress(0); setMessage(null); let worker;
    try {
      worker = await createWorker('jpn+eng', 1, { logger: (m) => m.status === 'recognizing text' && setProgress(Math.round((m.progress || 0) * 100)) });
      const updated = [], foundRows = [], nextMetrics = { ...metrics }; let map = routeImage;
      for (let i = 0; i < uploads.length; i += 1) {
        const u = uploads[i]; const full = await worker.recognize(await preprocess(u.url)); let text = full.data.text || '';
        let kind = classifyOcr(text); const clocks = (text.match(/[0-2]?\d\s*:\s*[0-5]\d/g) || []).length;
        if (kind === 'itinerary' || (kind === 'unknown' && clocks >= 3)) { const focused = await worker.recognize(await preprocess(u.url, true)); text += `\n${focused.data.text || ''}`; kind = classifyOcr(text); }
        updated.push({ ...u, classification: kind }); if (kind === 'itinerary') foundRows.push(...parseItinerary(text));
        for (const [key, value] of Object.entries(parseMetrics(text))) if (value !== null) nextMetrics[key] = value;
        if (kind === 'metrics' && !map) map = await cropMap(u.url); setProgress(Math.round(((i + 1) / uploads.length) * 100));
      }
      const score = (r) => Number(r._confidence || 0) * 100 + (r.place === '分岐' ? 4 : r.place.length + (/[山岳峰]/.test(r.place) ? 18 : 0) + (/登山口|牧場|トイレ/.test(r.place) ? 8 : 0));
      const byTime = new Map(); for (const row of foundRows) if (!byTime.has(row.time) || score(row) > score(byTime.get(row.time))) byTime.set(row.time, row);
      const deduped = [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
      setUploads(updated); setMetrics(nextMetrics); if (deduped.length) setRows(deduped); if (map) setRouteImage(map); setStep(2);
      setMessage({ kind: deduped.length ? 'success' : 'warning', title: deduped.length ? `${deduped.length}地点を読み取りました` : '行程を確認してください' });
    } catch (error) { console.error(error); setMessage({ kind: 'error', title: '画像の読み取りに失敗しました', subtitle: '画像を減らすか、行程を手動で入力してください。' }); }
    finally { if (worker) await worker.terminate(); setBusy(false); }
  };
  const makePdf = async () => {
    setBusy(true); setMessage(null);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < refs.current.length; i += 1) { const canvas = await html2canvas(refs.current[i], { scale: 2, useCORS: true, backgroundColor: '#fff' }); if (i) pdf.addPage('a4', 'portrait'); pdf.addImage(canvas.toDataURL('image/jpeg', .94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST'); }
      pdf.save(`${(form.mountainName || '登山').replace(/[\\/:*?"<>|]/g, '')}_登山計画書.pdf`); setMessage({ kind: 'success', title: 'PDFを作成しました' });
    } catch (error) { console.error(error); setMessage({ kind: 'error', title: 'PDF生成に失敗しました' }); } finally { setBusy(false); }
  };
  const canNext = step || (form.eventDate && form.mountainName && form.areaMunicipality && form.plannerStudentId && form.plannerName && form.plannerPhone && form.baseName && form.basePhone);
  return <Theme theme="white"><Header aria-label="登山計画書メーカー"><HeaderName prefix="山歩会">登山計画書メーカー</HeaderName></Header><main className="app-main">
    <div className="hero-band"><div><h1>登山計画書を、YAMAPから。</h1><p>基本情報とYAMAPのスクリーンショットから、そのまま提出用PDFを作ります。</p></div></div>
    <ProgressIndicator currentIndex={step} spaceEqually className="app-progress"><ProgressStep label="基本情報" description="手動入力" /><ProgressStep label="YAMAP" description="画像を追加" /><ProgressStep label="行程確認" description="OCRを修正" /><ProgressStep label="PDF" description="最終確認" /></ProgressIndicator>
    {message && <InlineNotification className="global-message" kind={message.kind} title={message.title} subtitle={message.subtitle} onCloseButtonClick={() => setMessage(null)} />}
    <div className="content-frame">{step === 0 && <Basic form={form} setForm={setForm} />}{step === 1 && <UploadStep uploads={uploads} setUploads={setUploads} analyze={analyze} busy={busy} progress={progress} routeImage={routeImage} />}{step === 2 && <Itinerary metrics={metrics} setMetrics={setMetrics} rows={rows} setRows={setRows} />}{step === 3 && <Preview form={form} metrics={metrics} rows={rows} routeImage={routeImage} refs={refs} onPdf={makePdf} busy={busy} />}</div>
    <div className="nav-actions"><Button kind="secondary" renderIcon={ArrowLeft} disabled={!step || busy} onClick={() => setStep((s) => Math.max(0, s - 1))}>戻る</Button>{step < 3 && <Button renderIcon={ArrowRight} disabled={!canNext || busy} onClick={() => setStep((s) => Math.min(3, s + 1))}>{step === 1 ? '読み取らず次へ' : '次へ'}</Button>}</div>
  </main></Theme>;
}
