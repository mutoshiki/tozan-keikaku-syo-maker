import React, { useEffect, useState } from 'react';
import { Button, Column, FileUploaderDropContainer, Grid, Header, HeaderName, SkipToContent } from '@carbon/react';
import { ThemeHeaderControl } from './ThemeToggle.jsx';
import LegacyRuntime from './LegacyRuntime.jsx';

const example = (name) => `${import.meta.env.BASE_URL}examples/${name}`;
const acceptedImageTypes = ['image/png', 'image/jpeg', 'image/webp'];

function addSelectedFiles(kind, inputId) {
  return (_event, { addedFiles }) => {
    const files = [...addedFiles];
    const input = document.getElementById(inputId);
    if (input) input.value = '';
    window.__tozanApp?.addFiles(files, kind);
  };
}

function NativeField({ id, label, type = 'text', defaultValue, required = false, optional = false, ...props }) {
  return (
    <label className="field">
      <span>{label}{optional && <span className="field-optional">（任意）</span>}</span>
      <input id={id} type={type} defaultValue={defaultValue} required={required} {...props} />
    </label>
  );
}

export default function App() {
  const [step2Ready, setStep2Ready] = useState(false);

  useEffect(() => {
    const onReadiness = (event) => setStep2Ready(!!event.detail?.enabled);
    document.addEventListener('tozan:step2-readiness', onReadiness);
    return () => {
      document.removeEventListener('tozan:step2-readiness', onReadiness);
    };
  }, []);

  return (
    <>
      <Header aria-label="登山計画書メーカー">
        <SkipToContent href="#main-content" />
        <HeaderName href="#main-content" prefix="">登山計画書メーカー</HeaderName>
        <ThemeHeaderControl />
      </Header>

      <main id="main-content">
        <Grid className="app-shell">
        <Column className="app-shell-progress" sm={4} md={8} lg={16}>
        <nav className="progress" aria-label="作成手順">
          <button className="progress__step is-current" data-step-target="1" type="button" aria-current="step" aria-label="基本情報、現在のステップ"><span className="progress__dot" /><span>基本情報</span></button>
          <button className="progress__step" data-step-target="2" type="button" aria-label="YAMAP、未開始" disabled><span className="progress__dot" /><span>YAMAP</span></button>
          <button className="progress__step" data-step-target="3" type="button" aria-label="確認、未開始" disabled><span className="progress__dot" /><span>確認</span></button>
        </nav>
        </Column>

        <Column className="app-shell-sample-notice" sm={4} md={8} lg={16}>
          <div id="sample-data-notice" className="sample-data-notice is-hidden" role="status" aria-live="polite">
            サンプルデータを表示中です。連絡先・山名・管轄などは架空です。実際の登山や提出には使用しないでください。
          </div>
        </Column>

        <Column className="app-shell-step" sm={4} md={8} lg={16}>
        <section className="step is-active" data-step="1" aria-labelledby="step-heading-1">
          <Grid narrow className="section-grid">
            <Column className="section-heading-column" sm={4} md={2} lg={4}><h1 id="step-heading-1" tabIndex="-1">基本情報</h1></Column>
            <Column className="section-body-column" sm={4} md={6} lg={12}><div className="section-body">
              <p className="form-intro">必須項目を入力してください。入力内容はPDFに記載されます。</p>
              <div className="form-grid form-grid--2">
                <NativeField id="eventDate" label="実施日" type="date" required />
                <NativeField id="meetingTime" label="集合時間" type="time" defaultValue="05:00" required />
              </div>

              <fieldset className="form-fieldset">
                <legend>企画者</legend>
                <div className="form-grid form-grid--3">
                  <NativeField id="plannerStudentId" label="学籍番号" required />
                  <NativeField id="plannerName" label="企画者の氏名" required />
                  <NativeField id="plannerPhone" label="企画者の電話番号" type="tel" inputMode="tel" required />
                </div>
              </fieldset>

              <fieldset className="form-fieldset">
                <legend>留守本部</legend>
                <div className="form-grid form-grid--2">
                  <NativeField id="baseName" label="留守本部の氏名" required />
                  <NativeField id="basePhone" label="留守本部の電話番号" type="tel" inputMode="tel" required />
                </div>
              </fieldset>
              <label className="checkbox-row"><input id="rememberContacts" type="checkbox" /><span>このブラウザに連絡先を保存</span></label>

              <details className="details-panel">
                <summary><span>集合場所・雨天</span></summary>
                <div className="details-panel__body form-grid form-grid--2">
                  <label className="field field--wide"><span>集合場所<span className="field-optional">（任意）</span></span><textarea id="meetingPlace" rows="2" defaultValue="信州大学 松本キャンパス サークルボックス前" /></label>
                  <label className="field"><span>雨天時<span className="field-optional">（任意）</span></span><select id="rainPolicy" defaultValue="雨天中止"><option>雨天中止</option><option>荒天中止</option><option>小雨決行</option></select></label>
                </div>
              </details>
            </div></Column>
          </Grid>
          <Grid narrow className="step-actions-grid"><Column className="step-actions-column" sm={4} md={{ span: 6, offset: 2 }} lg={{ span: 12, offset: 4 }}><div className="step-actions step-actions--end"><Button id="step1-next" type="button">次へ</Button></div></Column></Grid>
        </section>
        </Column>

        <Column className="app-shell-step" sm={4} md={8} lg={16}>
        <section className="step" data-step="2" aria-labelledby="step-heading-2">
          <Grid narrow className="section-grid">
            <Column className="section-heading-column" sm={4} md={2} lg={4}><h1 id="step-heading-2" tabIndex="-1">YAMAP画像の取り込み</h1></Column>
            <Column className="section-body-column" sm={4} md={6} lg={12}><div className="section-body">
              <p className="form-intro">ルート画像を1枚、行程画像を必要な枚数追加してください。</p>
              <section className="yamap-upload-group" aria-labelledby="route-upload-heading">
                <h3 id="route-upload-heading">ルート画像</h3>
                <div id="route-drop-zone">
                  <FileUploaderDropContainer
                    className="drop-zone"
                    id="route-file-input"
                    accept={acceptedImageTypes}
                    labelText="ルート画像を追加"
                    aria-describedby="route-file-help"
                    onAddFiles={addSelectedFiles('route', 'route-file-input')}
                  />
                  <p className="upload-help" id="route-file-help">PNG、JPEG、WebP形式の画像を1枚選択できます。</p>
                </div>
                <div id="route-upload-list" className="upload-grid upload-grid--route" />
                <details className="example-details"><summary>ルート画像の例を見る</summary><div className="example-grid example-grid--route" aria-label="ルート画像の例">
                  <figure className="example-card">
                    <span className="example-badge">例</span>
                    <img src={example('yamap-route.webp')} alt="YAMAPのルート画像の例" />
                  </figure>
                </div></details>
              </section>

              <section className="yamap-upload-group" aria-labelledby="itinerary-upload-heading">
                <h3 id="itinerary-upload-heading">行程画像</h3>
                <div id="itinerary-drop-zone">
                  <FileUploaderDropContainer
                    className="drop-zone"
                    id="itinerary-file-input"
                    accept={acceptedImageTypes}
                    multiple
                    labelText="行程画像を追加"
                    aria-describedby="itinerary-file-help"
                    onAddFiles={addSelectedFiles('itinerary', 'itinerary-file-input')}
                  />
                  <p className="upload-help" id="itinerary-file-help">PNG、JPEG、WebP形式。行程が複数枚の場合はまとめて選択できます。</p>
                </div>
                <div id="itinerary-upload-list" className="upload-grid" />
                <details className="example-details"><summary>行程画像の例を見る</summary><div className="example-grid example-grid--itinerary" aria-label="行程画像の例">
                  <figure className="example-card">
                    <span className="example-badge">例</span>
                    <img src={example('yamap-itinerary-1.webp')} alt="YAMAPの行程画像の例 1" />
                  </figure>
                  <figure className="example-card">
                    <span className="example-badge">例</span>
                    <img src={example('yamap-itinerary-2.webp')} alt="YAMAPの行程画像の例 2" />
                  </figure>
                </div></details>
              </section>

          <div id="analysis-status" className="inline-status is-hidden" role="status" aria-live="polite" />
            </div></Column>
          </Grid>
          <Grid narrow className="step-actions-grid"><Column className="step-actions-column" sm={4} md={{ span: 6, offset: 2 }} lg={{ span: 12, offset: 4 }}><div className="step-actions">
            <Button kind="secondary" id="step2-back" type="button">戻る</Button>
            <Button id="step2-next" type="button" disabled={!step2Ready}>次へ</Button>
          </div></Column></Grid>
        </section>
        </Column>

        <Column className="app-shell-step" sm={4} md={8} lg={16}>
        <section className="step" data-step="3" aria-labelledby="step-heading-3">
          <Grid narrow className="section-grid">
            <Column className="section-heading-column" sm={4} md={2} lg={4}><h1 id="step-heading-3" tabIndex="-1">確認と修正</h1></Column>
            <Column className="section-body-column" sm={4} md={6} lg={12}><div className="section-body">
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
              <fieldset className="form-fieldset form-fieldset--compact">
                <legend>第一管轄</legend>
                <div className="form-grid form-grid--2 police-row">
                  <NativeField id="police1Name" label="第一管轄の警察署" required />
                  <NativeField id="police1Phone" label="第一管轄の電話番号" type="tel" inputMode="tel" required />
                </div>
              </fieldset>
              <fieldset id="police-secondary" className="form-fieldset form-fieldset--compact police-row is-hidden">
                <legend>第二管轄</legend>
                <div className="form-grid form-grid--2">
                  <NativeField id="police2Name" label="第二管轄の警察署" optional />
                  <NativeField id="police2Phone" label="第二管轄の電話番号" type="tel" inputMode="tel" optional />
                </div>
              </fieldset>
              <fieldset id="police-tertiary" className="form-fieldset form-fieldset--compact police-row is-hidden">
                <legend>第三管轄</legend>
                <div className="form-grid form-grid--2">
                  <NativeField id="police3Name" label="第三管轄の警察署" optional />
                  <NativeField id="police3Phone" label="第三管轄の電話番号" type="tel" inputMode="tel" optional />
                </div>
              </fieldset>
              <Button id="add-police" kind="ghost" type="button">管轄を追加</Button>
              <div id="police-note" className="field-note is-hidden" />

              <h3>ルート</h3>
              <div id="route-preview" className="route-preview" />
            </div></Column>
          </Grid>
          <Grid narrow className="step-actions-grid"><Column className="step-actions-column" sm={4} md={{ span: 6, offset: 2 }} lg={{ span: 12, offset: 4 }}><div className="step-actions">
            <Button kind="secondary" id="step3-back" type="button">戻る</Button>
            <Button id="print-button" type="button">PDFを共有</Button>
          </div></Column></Grid>
        </section>
        </Column>

        </Grid>
        <div id="document-preview" className="pdf-source" aria-hidden="true" />
      </main>
      <LegacyRuntime />
    </>
  );
}
