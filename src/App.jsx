import React from 'react';
import { Button, Header, HeaderName } from '@carbon/react';
import { ThemeHeaderControl } from './ThemeToggle.jsx';
import LegacyRuntime from './LegacyRuntime.jsx';

const example = (name) => `${import.meta.env.BASE_URL}examples/${name}`;

function NativeField({ id, label, type = 'text', defaultValue, required = false, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input id={id} type={type} defaultValue={defaultValue} required={required} {...props} />
    </label>
  );
}

export default function App() {
  return (
    <>
      <Header aria-label="登山計画書メーカー">
        <HeaderName href="#main-content" prefix="">登山計画書メーカー</HeaderName>
        <ThemeHeaderControl />
      </Header>

      <main id="main-content" className="app-shell">
        <h1>登山計画書</h1>

        <nav className="progress" aria-label="作成手順">
          <button className="progress__step is-current" data-step-target="1" type="button"><span className="progress__dot" /><span>基本情報</span></button>
          <button className="progress__step" data-step-target="2" type="button"><span className="progress__dot" /><span>YAMAP</span></button>
          <button className="progress__step" data-step-target="3" type="button"><span className="progress__dot" /><span>確認</span></button>
        </nav>

        <section className="step is-active" data-step="1">
          <div className="section-grid">
            <h2>基本情報</h2>
            <div className="section-body">
              <div className="form-grid form-grid--2">
                <NativeField id="eventDate" label="実施日" type="date" required />
                <NativeField id="meetingTime" label="集合時間" type="time" defaultValue="05:00" required />
              </div>

              <h3>企画者</h3>
              <div className="form-grid form-grid--3">
                <NativeField id="plannerStudentId" label="学籍番号" required />
                <NativeField id="plannerName" label="氏名" required />
                <NativeField id="plannerPhone" label="電話番号" type="tel" inputMode="tel" required />
              </div>

              <h3>留守本部</h3>
              <div className="form-grid form-grid--2">
                <NativeField id="baseName" label="氏名" required />
                <NativeField id="basePhone" label="電話番号" type="tel" inputMode="tel" required />
              </div>
              <label className="checkbox-row"><input id="rememberContacts" type="checkbox" /><span>連絡先を保存</span></label>

              <details className="details-panel">
                <summary><span>集合場所・雨天</span></summary>
                <div className="details-panel__body form-grid form-grid--2">
                  <label className="field field--wide"><span>集合場所</span><input id="meetingPlace" type="text" defaultValue="信州大学 松本キャンパス サークルボックス前" /></label>
                  <label className="field"><span>雨天時</span><select id="rainPolicy" defaultValue="雨天中止"><option>雨天中止</option><option>荒天中止</option><option>小雨決行</option></select></label>
                </div>
              </details>
            </div>
          </div>
          <div className="step-actions step-actions--end"><Button id="step1-next" type="button">次へ</Button></div>
        </section>

        <section className="step" data-step="2">
          <div className="section-grid">
            <h2>YAMAP</h2>
            <div className="section-body">
              <section className="yamap-upload-group" aria-labelledby="route-upload-heading">
                <h3 id="route-upload-heading">ルート画像</h3>
                <div className="example-grid example-grid--route" aria-label="ルート画像の例">
                  <figure className="example-card">
                    <span className="example-badge">例</span>
                    <img src={example('yamap-route.webp')} alt="YAMAPのルート画像の例" />
                  </figure>
                </div>
                <label className="drop-zone" id="route-drop-zone">
                  <input id="route-file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
                  <strong>ルート画像を追加</strong>
                  <span>PNG、JPEG、WebP</span>
                </label>
                <div id="route-upload-list" className="upload-grid upload-grid--route" />
              </section>

              <section className="yamap-upload-group" aria-labelledby="itinerary-upload-heading">
                <h3 id="itinerary-upload-heading">行程画像</h3>
                <div className="example-grid example-grid--itinerary" aria-label="行程画像の例">
                  <figure className="example-card">
                    <span className="example-badge">例</span>
                    <img src={example('yamap-itinerary-1.webp')} alt="YAMAPの行程画像の例 1" />
                  </figure>
                  <figure className="example-card">
                    <span className="example-badge">例</span>
                    <img src={example('yamap-itinerary-2.webp')} alt="YAMAPの行程画像の例 2" />
                  </figure>
                </div>
                <label className="drop-zone" id="itinerary-drop-zone">
                  <input id="itinerary-file-input" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden />
                  <strong>行程画像を追加</strong>
                  <span>複数選択できます</span>
                </label>
                <div id="itinerary-upload-list" className="upload-grid" />
              </section>

              <div id="analysis-status" className="inline-status is-hidden" role="status" />
            </div>
          </div>
          <div className="step-actions">
            <Button kind="secondary" id="step2-back" type="button">戻る</Button>
            <Button id="step2-next" type="button" disabled>次へ</Button>
          </div>
        </section>

        <section className="step" data-step="3">
          <div className="section-grid">
            <h2>確認</h2>
            <div className="section-body">
              <div className="form-grid form-grid--2">
                <NativeField id="mountainName" label="山名" required />
                <NativeField id="areaMunicipality" label="市町村" required />
              </div>

              <h3>計画</h3>
              <div className="form-grid form-grid--4">
                <NativeField id="durationMinutes" label="時間（分）" type="number" min="0" required />
                <NativeField id="distanceKm" label="距離（km）" type="number" step="0.1" min="0" required />
                <NativeField id="ascentM" label="上り（m）" type="number" min="0" required />
                <NativeField id="descentM" label="下り（m）" type="number" min="0" required />
                <NativeField id="drinkLiters" label="飲料（L）" type="number" min="0.5" max="10" step="0.5" defaultValue="2.0" required />
              </div>

              <h3>管轄</h3>
              <div className="form-grid form-grid--2 police-row">
                <NativeField id="police1Name" label="警察署" required />
                <NativeField id="police1Phone" label="電話番号" type="tel" inputMode="tel" required />
              </div>
              <div id="police-secondary" className="form-grid form-grid--2 police-row">
                <NativeField id="police2Name" label="警察署" />
                <NativeField id="police2Phone" label="電話番号" type="tel" inputMode="tel" />
              </div>
              <div id="police-tertiary" className="form-grid form-grid--2 police-row">
                <NativeField id="police3Name" label="警察署" />
                <NativeField id="police3Phone" label="電話番号" type="tel" inputMode="tel" />
              </div>
              <div id="police-note" className="field-note is-hidden" />

              <h3>行程</h3>
              <div className="table-wrap">
                <table className="itinerary-table">
                  <thead><tr><th>時刻</th><th>地点</th><th>掲載</th><th>休憩（分）</th><th /></tr></thead>
                  <tbody id="itinerary-body" />
                </table>
              </div>
              <Button id="add-row" kind="ghost" type="button">地点を追加</Button>

              <h3>ルート</h3>
              <div id="route-preview" className="route-preview" />
            </div>
          </div>
          <div className="step-actions">
            <Button kind="secondary" id="step3-back" type="button">戻る</Button>
            <Button id="print-button" type="button">PDFを共有</Button>
          </div>
        </section>

        <div id="document-preview" className="pdf-source" aria-hidden="true" />
      </main>
      <LegacyRuntime />
    </>
  );
}
