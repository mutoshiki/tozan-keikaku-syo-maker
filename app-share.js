(() => {
  const app = window.__tozanApp;
  const button = document.querySelector('#print-button');
  const step3 = document.querySelector('.step[data-step="3"]');
  if (!app || !button || !step3) return;

  let preparedFile = null;
  let preparing = false;
  let sharing = false;
  let forceSave = false;
  let disposed = false;
  let prepareVersion = 0;
  let debounceTimer = null;

  const isStep3Active = () => step3.classList.contains('is-active');
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function actionLabel() {
    const probe = new File([''], '登山計画書.pdf', { type:'application/pdf' });
    return !forceSave && shouldUseNativeShare(probe) ? 'PDFを共有' : 'PDFを保存';
  }

  function setButton(label = actionLabel(), disabled = false, ready = false) {
    button.textContent = label;
    button.disabled = disabled;
    button.dataset.pdfReady = ready ? 'true' : 'false';
  }

  function markDirty() {
    preparedFile = null;
    prepareVersion += 1;
    if (!isStep3Active()) return;
    setButton('PDFを準備中…', true, false);
    clearTimeout(debounceTimer);
    // 編集中に何度も重いPDF生成を走らせず、操作が止まってからまとめて準備する。
    debounceTimer = setTimeout(() => preparePdf(), 1200);
  }

  function saveAfterShareFailure(file) {
    forceSave = true;
    downloadFile(file);
    if (isStep3Active()) setButton('PDFを保存', false, true);
  }

  function startNativeShare(file) {
    if (sharing) return;
    sharing = true;
    button.disabled = true;
    button.textContent = '共有を開いています…';

    let result;
    try {
      // Safari の transient activation を失わないよう、クリック直後に呼ぶ。
      result = navigator.share({ files:[file] });
    } catch (error) {
      console.error(error);
      sharing = false;
      saveAfterShareFailure(file);
      return;
    }

    Promise.resolve(result).catch(error => {
      if (error?.name === 'AbortError') return;
      console.error(error);
      saveAfterShareFailure(file);
    }).finally(() => {
      sharing = false;
      if (isStep3Active() && preparedFile === file) setButton(actionLabel(), false, true);
    });
  }

  async function preparePdf() {
    if (disposed || !isStep3Active() || preparing) return;
    const version = prepareVersion;
    preparing = true;
    setButton('PDFを準備中…', true, false);
    try {
      const file = await app.createPdfFile();
      if (!disposed && version === prepareVersion && isStep3Active()) {
        preparedFile = file;
        setButton(actionLabel(), false, true);
      }
    } catch (error) {
      console.error(error);
      if (!disposed && version === prepareVersion && isStep3Active()) setButton(actionLabel(), false, false);
    } finally {
      document.body.classList.remove('is-pdf-export');
      preparing = false;
      if (!disposed && version !== prepareVersion && isStep3Active()) preparePdf();
    }
  }

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

  function shouldUseNativeShare(file) {
    if (typeof navigator.share !== 'function') return false;
    // iOS Safari は PDF ファイル共有が可能でも canShare() が false になるケースがあるため、直接 share() を試す。
    if (isIOS()) return true;
    if (typeof navigator.canShare !== 'function') return false;
    try { return navigator.canShare({ files: [file] }); } catch { return false; }
  }

  function sharePreparedPdf(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    // Revalidate at the final action: the user may have changed fields after
    // preparation or reached this control through a non-standard route.
    if (typeof app.validateStep3 === 'function' && !app.validateStep3()) return;
    if (sharing) return;

    if (!preparedFile) {
      if (!preparing) preparePdf();
      return;
    }

    if (!forceSave && shouldUseNativeShare(preparedFile)) {
      startNativeShare(preparedFile);
      return;
    }

    downloadFile(preparedFile);
  }

  button.onclick = null;
  setButton(actionLabel(), false, false);
  button.addEventListener('click', sharePreparedPdf, true);

  step3.addEventListener('input', markDirty);
  step3.addEventListener('change', markDirty);

  const observer = new MutationObserver(() => {
    if (isStep3Active()) markDirty();
    else clearTimeout(debounceTimer);
  });
  observer.observe(step3, { attributes: true, attributeFilter: ['class'] });

  if (isStep3Active()) markDirty();

  window.__tozanShare = {
    preparePdf,
    markDirty,
    getPreparedFile: () => preparedFile,
    shouldUseNativeShare,
    dispose: () => {
      disposed = true;
      prepareVersion += 1;
      clearTimeout(debounceTimer);
      observer.disconnect();
      button.removeEventListener('click', sharePreparedPdf, true);
      step3.removeEventListener('input', markDirty);
      step3.removeEventListener('change', markDirty);
    },
  };
})();
