import React, { useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionItem,
  Button,
  Checkbox,
  DatePicker,
  DatePickerInput,
  FileUploaderDropContainer,
  Header,
  HeaderName,
  InlineNotification,
  Modal,
  NumberInput,
  ProgressIndicator,
  ProgressStep,
  Select,
  SelectItem,
  Tag,
  TextInput,
  Theme,
  Tile,
  TimePicker,
} from '@carbon/react';
import {
  Add,
  ArrowLeft,
  ArrowRight,
  CheckmarkFilled,
  DocumentPdf,
  Image as ImageIcon,
  Map,
  Renew,
  TrashCan,
} from '@carbon/react/icons';
import Cropper from 'react-easy-crop';
import { createWorker } from 'tesseract.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  applyRests,
  buildItineraryText,
  classifyOcr,
  parseItinerary,
  parseMetrics,
} from './yamap.js';

const GROUP_NAME = '信州大学 山歩会（長野県松本市旭 3-1-1）';
const UNIVERSITY_PHONE = '0263-37-2197';
const MOUNTAIN_SAFETY_PHONE = '026-233-0110';

const DEFAULT_FORM = {
  eventDate: '',
  meetingPlace: '信州大学 松本キャンパス サークルボックス前',
  meetingTime: '05:00',
  mountainName: '',
  areaMunicipality: '',
  plannerStudentId: '',
  plannerName: '',
  plannerPhone: '',
  baseName: '',
  basePhone: '',
  rainPolicy: '雨天中止',
  drinkLiters: 1.5,
  police1Name: '',
  police1Phone: '',
  police2Name: '',
  police2Phone: '',
};

function getCroppedDataUrl(imageSrc, cropPixels) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropPixels.width;
      canvas.height = cropPixels.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        image,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        cropPixels.width,
        cropPixels.height,
      );
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDateJP(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日（${weekdays[date.getDay()]}曜日）`;
}

function durationLabel(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) return '—';
  const h = Math.floor(Number(minutes) / 60);
  const m = Number(minutes) % 60;
  return `${h}時間${m ? `${m}分` : ''}`;
}

function TextField({ id, label, value, onChange, helperText, required = false, type = 'text' }) {
  return (
    <TextInput
      id={id}
      labelText={`${label}${required ? ' *' : ''}`}
      value={value}
      type={type}
      helperText={helperText}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function ManualStep({ form, setForm }) {
  const update = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="step-body">
      <div className="section-heading">
        <h2>基本情報</h2>
        <p>テンプレートで毎回変わる項目だけ入力します。団体名・大学連絡先などは固定値として扱います。</p>
      </div>

      <div className="form-grid">
        <DatePicker datePickerType="single" dateFormat="Y-m-d" onChange={(dates) => {
          const date = dates?.[0];
          if (date) setForm((prev) => ({ ...prev, eventDate: date.toISOString().slice(0, 10) }));
        }}>
          <DatePickerInput id="event-date" labelText="実施日 *" placeholder="yyyy-mm-dd" value={form.eventDate} onChange={(e) => update('eventDate')(e.target.value)} />
        </DatePicker>
        <TimePicker id="meeting-time" labelText="集合時間 *" value={form.meetingTime} onChange={(e) => update('meetingTime')(e.target.value)} />
        <TextField id="meeting-place" label="集合場所" required value={form.meetingPlace} onChange={update('meetingPlace')} />
        <TextField id="mountain-name" label="山名・企画名" required value={form.mountainName} onChange={update('mountainName')} helperText="例：根子岳・四阿山" />
        <TextField id="area" label="山域 / 所在市町村" required value={form.areaMunicipality} onChange={update('areaMunicipality')} helperText="例：四阿山 / 上田市" />
        <Select id="rain-policy" labelText="雨天時" value={form.rainPolicy} onChange={(e) => update('rainPolicy')(e.target.value)}>
          <SelectItem value="雨天中止" text="雨天中止" />
          <SelectItem value="荒天中止" text="荒天中止" />
          <SelectItem value="小雨決行" text="小雨決行" />
        </Select>
      </div>

      <h3 className="subheading">企画者</h3>
      <div className="form-grid form-grid--three">
        <TextField id="student-id" label="学籍番号" required value={form.plannerStudentId} onChange={update('plannerStudentId')} />
        <TextField id="planner-name" label="氏名" required value={form.plannerName} onChange={update('plannerName')} />
        <TextField id="planner-phone" label="電話番号" required value={form.plannerPhone} onChange={update('plannerPhone')} type="tel" />
      </div>

      <h3 className="subheading">留守本部</h3>
      <div className="form-grid">
        <TextField id="base-name" label="氏名" required value={form.baseName} onChange={update('baseName')} />
        <TextField id="base-phone" label="電話番号" required value={form.basePhone} onChange={update('basePhone')} type="tel" />
      </div>

      <Accordion align="start" className="optional-accordion">
        <AccordionItem title="提出先・持参物の詳細設定">
          <div className="form-grid form-grid--three">
            <TextField id="police1-name" label="警察署 1" value={form.police1Name} onChange={update('police1Name')} />
            <TextField id="police1-phone" label="電話番号" value={form.police1Phone} onChange={update('police1Phone')} type="tel" />
            <NumberInput id="drink" label="飲料量（L）" min={0.5} max={10} step={0.5} value={form.drinkLiters} onChange={(_, state) => update('drinkLiters')(state.value)} />
            <TextField id="police2-name" label="警察署 2" value={form.police2Name} onChange={update('police2Name')} />
            <TextField id="police2-phone" label="電話番号" value={form.police2Phone} onChange={update('police2Phone')} type="tel" />
          </div>
        </AccordionItem>
      </Accordion>

      <Tile className="fixed-values">
        <div>
          <span className="eyebrow">テンプレート固定</span>
          <strong>{GROUP_NAME}</strong>
        </div>
        <div>学生総合支援センター課外活動：{UNIVERSITY_PHONE}</div>
        <div>長野県警察本部地域部山岳安全対策課：{MOUNTAIN_SAFETY_PHONE}</div>
      </Tile>
    </div>
  );
}

function UploadStep({ uploads, setUploads, onAnalyze, analyzing, analysisProgress, routeImage, setRouteImage }) {
  const [cropModal, setCropModal] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);

  const addFiles = async (files) => {
    const added = [];
    for (const file of Array.from(files || [])) {
      if (!file.type.startsWith('image/')) continue;
      added.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        name: file.name,
        url: await fileToDataUrl(file),
        ocrText: '',
        classification: 'pending',
      });
    }
    setUploads((prev) => [...prev, ...added]);
  };

  const remove = (id) => setUploads((prev) => prev.filter((u) => u.id !== id));

  const openCrop = (upload) => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropPixels(null);
    setCropModal(upload);
  };

  const saveCrop = async () => {
    if (!cropModal || !cropPixels) return;
    const cropped = await getCroppedDataUrl(cropModal.url, cropPixels);
    setRouteImage(cropped);
    setCropModal(null);
  };

  return (
    <div className="step-body">
      <div className="section-heading">
        <h2>YAMAPスクリーンショット</h2>
        <p>計画データ画面・行程画面をまとめて追加してください。OCRで距離・標高差・時刻・地点名を読み取ります。</p>
      </div>

      <FileUploaderDropContainer
        accept={['image/png', 'image/jpeg', 'image/webp']}
        labelText="画像をここにドロップ、またはタップして選択"
        helperText="PNG / JPEG / WebP・複数選択可"
        multiple
        onAddFiles={(_, { addedFiles }) => addFiles(addedFiles)}
      />

      {uploads.length > 0 && (
        <div className="upload-grid">
          {uploads.map((upload) => (
            <Tile className="upload-card" key={upload.id}>
              <img src={upload.url} alt="YAMAPスクリーンショット" />
              <div className="upload-card__body">
                <div className="upload-card__title" title={upload.name}>{upload.name}</div>
                <div className="tag-row">
                  {upload.classification === 'metrics' && <Tag type="blue">計画データ</Tag>}
                  {upload.classification === 'itinerary' && <Tag type="green">行程</Tag>}
                  {upload.classification === 'unknown' && <Tag type="gray">未分類</Tag>}
                  {upload.classification === 'pending' && <Tag type="cool-gray">未解析</Tag>}
                </div>
                <div className="upload-card__actions">
                  <Button kind="ghost" size="sm" renderIcon={Map} onClick={() => openCrop(upload)}>ルートに使う</Button>
                  <Button kind="ghost" size="sm" hasIconOnly iconDescription="削除" renderIcon={TrashCan} onClick={() => remove(upload.id)} />
                </div>
              </div>
            </Tile>
          ))}
        </div>
      )}

      {routeImage && (
        <div className="route-preview-inline">
          <div>
            <CheckmarkFilled size={20} />
            <strong>ルート画像を設定済み</strong>
          </div>
          <img src={routeImage} alt="ルート用に切り抜いた画像" />
        </div>
      )}

      <div className="analysis-row">
        <Button renderIcon={analyzing ? Renew : ImageIcon} disabled={!uploads.length || analyzing} onClick={onAnalyze}>
          {analyzing ? `読み取り中 ${analysisProgress}%` : 'YAMAPから読み取る'}
        </Button>
        <span>OCR結果は次の画面で必ず確認・修正できます。</span>
      </div>

      <Modal
        open={Boolean(cropModal)}
        modalHeading="ルート画像の範囲を調整"
        primaryButtonText="この範囲を使用"
        secondaryButtonText="キャンセル"
        onRequestSubmit={saveCrop}
        onRequestClose={() => setCropModal(null)}
        size="lg"
      >
        <p className="crop-help">YAMAPの地図部分だけが枠内に入るように移動・拡大してください。</p>
        <div className="crop-stage">
          {cropModal && (
            <Cropper
              image={cropModal.url}
              crop={crop}
              zoom={zoom}
              aspect={16 / 10}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCropPixels(pixels)}
            />
          )}
        </div>
        <label className="zoom-control">
          拡大
          <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </Modal>
    </div>
  );
}

function ItineraryStep({ metrics, setMetrics, rows, setRows }) {
  const adjustedRows = useMemo(() => applyRests(rows), [rows]);
  const updateRow = (index, patch) => setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));
  const addRow = () => setRows((prev) => [...prev, { time: '12:00', place: '', major: true, restMinutes: 0 }]);

  return (
    <div className="step-body">
      <div className="section-heading">
        <h2>読み取り結果を確認</h2>
        <p>OCRの誤読だけ直してください。「分岐」は初期状態では提出用の主要地点から外します。</p>
      </div>

      <div className="metrics-grid">
        <NumberInput id="duration" label="合計時間（分）" min={0} value={metrics.durationMinutes ?? ''} onChange={(_, state) => setMetrics((p) => ({ ...p, durationMinutes: state.value === '' ? null : Number(state.value) }))} />
        <NumberInput id="distance" label="距離（km）" min={0} step={0.1} value={metrics.distanceKm ?? ''} onChange={(_, state) => setMetrics((p) => ({ ...p, distanceKm: state.value === '' ? null : Number(state.value) }))} />
        <NumberInput id="ascent" label="上り（m）" min={0} value={metrics.ascentM ?? ''} onChange={(_, state) => setMetrics((p) => ({ ...p, ascentM: state.value === '' ? null : Number(state.value) }))} />
        <NumberInput id="descent" label="下り（m）" min={0} value={metrics.descentM ?? ''} onChange={(_, state) => setMetrics((p) => ({ ...p, descentM: state.value === '' ? null : Number(state.value) }))} />
      </div>

      <div className="itinerary-header">
        <div>
          <h3>行程</h3>
          <p>{rows.length}地点・提出用 {rows.filter((r) => r.major).length}地点</p>
        </div>
        <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addRow}>地点を追加</Button>
      </div>

      {rows.length === 0 ? (
        <InlineNotification kind="warning" title="行程を読み取れませんでした" subtitle="行程スクリーンショットを追加して再解析するか、地点を手動で追加してください。" hideCloseButton />
      ) : (
        <div className="itinerary-list">
          {rows.map((row, index) => (
            <div className="itinerary-row" key={`${row.time}-${index}`}>
              <TextInput id={`time-${index}`} labelText="時刻" value={row.time} onChange={(e) => updateRow(index, { time: e.target.value })} />
              <TextInput id={`place-${index}`} labelText="地点" value={row.place} onChange={(e) => updateRow(index, { place: e.target.value })} />
              <NumberInput id={`rest-${index}`} label="休憩（分）" min={0} max={300} value={row.restMinutes || 0} onChange={(_, state) => updateRow(index, { restMinutes: Number(state.value) || 0 })} />
              <div className="adjusted-time">
                <span>提出時刻</span>
                <strong>{adjustedRows[index]?.adjustedTime}</strong>
              </div>
              <Checkbox id={`major-${index}`} labelText="提出に残す" checked={row.major} onChange={(_, { checked }) => updateRow(index, { major: checked })} />
              <Button kind="ghost" size="sm" hasIconOnly iconDescription="地点を削除" renderIcon={TrashCan} onClick={() => removeRow(index)} />
            </div>
          ))}
        </div>
      )}

      {rows.some((r) => Number(r.restMinutes) > 0) && (
        <InlineNotification kind="info" title="休憩時間を反映しました" subtitle="休憩を追加した地点より後ろの時刻は提出用の予定時刻として自動で繰り下げています。" hideCloseButton />
      )}
    </div>
  );
}

function PageOne({ form, metrics, rows }) {
  const adjusted = applyRests(rows).filter((r) => r.major);
  const entry = adjusted[0]?.adjustedTime || '—';
  const exit = adjusted.at(-1)?.adjustedTime || '—';
  return (
    <section className="doc-page">
      <h1 className="doc-title"><span>{form.mountainName || '山名'}</span>登山計画書</h1>
      <h2>≪概要≫</h2>
      <div className="doc-lines">
        <p><b>【団体名】</b>：{GROUP_NAME}</p>
        <p><b>【企画者】</b>：{form.plannerStudentId || '学籍番号'}　{form.plannerName || '氏名'}</p>
        <p><b>【入山エリア】</b>：{form.mountainName || '山名'}（{form.areaMunicipality || '山域 / 所在市町村'}）</p>
        <p><b>【日時】</b>：{formatDateJP(form.eventDate) || '20XX 年 X 月 X 日（曜日）'}　<span className="doc-red">{form.rainPolicy}</span></p>
        <p><b>【集合場所】</b>：{form.meetingPlace}</p>
        <p><b>【集合時間】</b>：<u>{form.meetingTime}</u> <span className="doc-red">※時間厳守</span></p>
      </div>
      <h2>≪行程≫</h2>
      <p className="doc-centered">入山予定時刻 {entry} / 下山予定時刻 {exit}</p>
      <p className="doc-centered">合計時間：約 {durationLabel(metrics.durationMinutes)}　上り：{metrics.ascentM ?? '—'}m / 下り：{metrics.descentM ?? '—'}m　距離：{metrics.distanceKm ?? '—'}km</p>
      <div className="doc-itinerary-box">{buildItineraryText(rows) || 'YAMAPから行程を読み取ると、ここに提出用の行程が入ります。'}</div>
      <p className="doc-legend"><span>Ⓢ</span>:Start　<span>Ⓟ</span>:Peak　<span>Ⓖ</span>:Goal</p>
    </section>
  );
}

const GEAR = [
  'ザック', '登山靴', '雨具（レインウェアやザックカバー等）', '登山に適した服', '防寒着', '帽子',
  '飲料', '昼食', 'ゴミ袋（5〜10L程度のビニール袋）', '行動食', 'お金', '携帯電話',
  'この登山計画書（印刷したもの）', '学生証', '保険証', '時計', 'モバイルバッテリー', '日焼け止め',
  '紙地図※', 'コンパス※', '常備薬※', 'ファーストエイドキット※', 'ヘッドライト※', 'その他必要な物※',
  '温泉セット（タオルと着替え）',
];

function PageTwo({ routeImage, form }) {
  return (
    <section className="doc-page">
      <h2>≪ルート≫</h2>
      <div className="doc-route">
        {routeImage ? <img src={routeImage} alt="YAMAPルート" /> : <span>YAMAPの地図画像を設定してください</span>}
      </div>
      <h2>≪持参物≫</h2>
      <div className="doc-gear-box">
        {GEAR.map((item) => <span key={item}>□{item === '飲料' ? `飲料（${form.drinkLiters || 1.5}L 程度）` : item}</span>)}
        <div className="doc-gear-note">（※ある人は持参する）</div>
        <div>（登山靴は駐車場で普段履きの靴と履き替えると良い。）</div>
      </div>
      <p className="doc-warning">※天候の急変、登山道の崩壊、熊の出没等の要因により企画続行不可能と判断した場合は、計画書のルートを使用し直ちに下山する。</p>
    </section>
  );
}

function PageThree({ form }) {
  return (
    <section className="doc-page">
      <h2>≪緊急連絡先≫</h2>
      <div className="doc-contact-list">
        <p>信州大学学生総合支援センター課外活動：{UNIVERSITY_PHONE}</p>
        <p>長野県警察本部地域部山岳安全対策課：{MOUNTAIN_SAFETY_PHONE}</p>
        <p>{form.police1Name || '警察署'}：{form.police1Phone || '（電話番号）'}</p>
        <p>{form.police2Name || '警察署'}：{form.police2Phone || '（電話番号）'}</p>
        <p>企画者（{form.plannerName || '氏名'}）：{form.plannerPhone || '（電話番号）'}</p>
        <p>留守本部（{form.baseName || '氏名'}）：{form.basePhone || '（電話番号）'}</p>
      </div>
    </section>
  );
}

function PreviewStep({ form, metrics, rows, routeImage, pageRefs, onPdf, exporting }) {
  return (
    <div className="step-body preview-step">
      <div className="section-heading">
        <h2>提出前プレビュー</h2>
        <p>元の3ページ構成に合わせた試作プレビューです。内容を確認してPDFを生成してください。</p>
      </div>
      <InlineNotification kind="info" title="初回プロトタイプ" subtitle="PDFはブラウザでA4に描画します。WordそのものをPDF変換する方式は、レイアウト検証後にバックエンドへ置き換えられます。" hideCloseButton />
      <div className="preview-toolbar">
        <Button renderIcon={DocumentPdf} disabled={exporting} onClick={onPdf}>{exporting ? 'PDF生成中…' : 'PDFを作成'}</Button>
        <Button kind="tertiary" href={`${import.meta.env.BASE_URL}登山計画書テンプレ.docx`} download>元Wordテンプレート</Button>
      </div>
      <div className="doc-preview-shell">
        <div ref={(el) => { pageRefs.current[0] = el; }}><PageOne form={form} metrics={metrics} rows={rows} /></div>
        <div ref={(el) => { pageRefs.current[1] = el; }}><PageTwo routeImage={routeImage} form={form} /></div>
        <div ref={(el) => { pageRefs.current[2] = el; }}><PageThree form={form} /></div>
      </div>
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [uploads, setUploads] = useState([]);
  const [metrics, setMetrics] = useState({ durationMinutes: null, distanceKm: null, ascentM: null, descentM: null });
  const [rows, setRows] = useState([]);
  const [routeImage, setRouteImage] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [exporting, setExporting] = useState(false);
  const pageRefs = useRef([]);

  const analyze = async () => {
    setAnalyzing(true);
    setAnalysisProgress(0);
    setMessage(null);
    let worker;
    try {
      worker = await createWorker('jpn+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') setAnalysisProgress(Math.round((m.progress || 0) * 100));
        },
      });
      const updated = [];
      let collectedRows = [];
      const collectedMetrics = { ...metrics };

      for (let i = 0; i < uploads.length; i += 1) {
        const upload = uploads[i];
        const { data } = await worker.recognize(upload.file);
        const classification = classifyOcr(data.text);
        updated.push({ ...upload, ocrText: data.text, classification });
        if (classification === 'itinerary') collectedRows = [...collectedRows, ...parseItinerary(data.text)];
        const parsed = parseMetrics(data.text);
        Object.entries(parsed).forEach(([key, value]) => {
          if (value !== null) collectedMetrics[key] = value;
        });
        setAnalysisProgress(Math.round(((i + 1) / uploads.length) * 100));
      }

      const deduped = collectedRows
        .sort((a, b) => a.time.localeCompare(b.time))
        .filter((row, index, array) => index === 0 || !(row.time === array[index - 1].time && row.place === array[index - 1].place));
      setUploads(updated);
      if (deduped.length) setRows(deduped);
      setMetrics(collectedMetrics);
      setMessage({ kind: deduped.length ? 'success' : 'warning', title: deduped.length ? `${deduped.length}地点を読み取りました` : '行程の文字認識を確認してください' });
      setStep(2);
    } catch (error) {
      console.error(error);
      setMessage({ kind: 'error', title: '画像の読み取りに失敗しました', subtitle: '画像を減らして再試行するか、行程を手動入力してください。' });
    } finally {
      if (worker) await worker.terminate();
      setAnalyzing(false);
    }
  };

  const createPdf = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < pageRefs.current.length; i += 1) {
        const element = pageRefs.current[i];
        if (!element) continue;
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const data = canvas.toDataURL('image/jpeg', 0.94);
        if (i > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(data, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }
      const safeName = (form.mountainName || '登山').replace(/[\\/:*?"<>|]/g, '');
      pdf.save(`${safeName}_登山計画書.pdf`);
      setMessage({ kind: 'success', title: 'PDFを作成しました' });
    } catch (error) {
      console.error(error);
      setMessage({ kind: 'error', title: 'PDF生成に失敗しました', subtitle: '画像サイズを小さくして再度お試しください。' });
    } finally {
      setExporting(false);
    }
  };

  const canNext = step !== 0 || (form.eventDate && form.mountainName && form.areaMunicipality && form.plannerName && form.plannerStudentId && form.plannerPhone && form.baseName && form.basePhone);

  return (
    <Theme theme="white">
      <Header aria-label="登山計画書メーカー">
        <HeaderName prefix="山歩会">登山計画書メーカー</HeaderName>
      </Header>

      <main className="app-main">
        <div className="hero-band">
          <div>
            <h1>登山計画書を、YAMAPから。</h1>
            <p>基本情報を入力して、YAMAPのスクリーンショットを追加。行程を確認したら、そのまま提出用PDFにします。</p>
          </div>
          <a className="template-link" href={`${import.meta.env.BASE_URL}登山計画書テンプレ.docx`} download>Wordテンプレートを確認</a>
        </div>

        <ProgressIndicator currentIndex={step} spaceEqually className="app-progress">
          <ProgressStep label="基本情報" description="手動入力" />
          <ProgressStep label="YAMAP" description="画像を追加" />
          <ProgressStep label="行程確認" description="OCRを修正" />
          <ProgressStep label="PDF" description="最終確認" />
        </ProgressIndicator>

        {message && (
          <InlineNotification className="global-message" kind={message.kind} title={message.title} subtitle={message.subtitle} onCloseButtonClick={() => setMessage(null)} />
        )}

        <div className="content-frame">
          {step === 0 && <ManualStep form={form} setForm={setForm} />}
          {step === 1 && <UploadStep uploads={uploads} setUploads={setUploads} onAnalyze={analyze} analyzing={analyzing} analysisProgress={analysisProgress} routeImage={routeImage} setRouteImage={setRouteImage} />}
          {step === 2 && <ItineraryStep metrics={metrics} setMetrics={setMetrics} rows={rows} setRows={setRows} />}
          {step === 3 && <PreviewStep form={form} metrics={metrics} rows={rows} routeImage={routeImage} pageRefs={pageRefs} onPdf={createPdf} exporting={exporting} />}
        </div>

        <div className="nav-actions">
          <Button kind="secondary" renderIcon={ArrowLeft} disabled={step === 0 || analyzing} onClick={() => setStep((s) => Math.max(0, s - 1))}>戻る</Button>
          {step < 3 && (
            <Button renderIcon={ArrowRight} disabled={!canNext || analyzing} onClick={() => setStep((s) => Math.min(3, s + 1))}>
              {step === 1 ? '読み取らず次へ' : '次へ'}
            </Button>
          )}
        </div>
      </main>
    </Theme>
  );
}
