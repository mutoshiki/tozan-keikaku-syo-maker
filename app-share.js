(() => {
  const app = window.__tozanApp;
  const button = document.querySelector('#print-button');
  const step3 = document.querySelector('.step[data-step="3"]');
  if (!app || !button || !step3) return;

  let preparedFile = null;
  let preparing = false;
  let prepareVersion = 0;
  let debounceTimer = null;

  const isStep3Active = () => step3.classList.contains('is-active');

  function setButton(label, disabled = false, ready = false) {
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
    debounceTimer = setTimeout(() => preparePdf(), 350);
  }

  async function preparePdf() {
    if (!isStep3Active() || preparing) return;
    const version = prepareVersion;
    preparing = true;
    setButton('PDFを準備中…', true, false);
    try {
      const file = await app.createPdfFile();
      if (version === prepareVersion && isStep3Active()) {
        preparedFile = file;
        setButton('PDFを共有', false, true);
      }
    } catch (error) {
      console.error(error);
      if (version === prepareVersion && isStep3Active()) setButton('PDFを共有', false, false);
    } finally {
      document.body.classList.remove('is-pdf-export');
      preparing = false;
      if (version !== prepareVersion && isStep3Active()) preparePdf();
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

  function sharePreparedPdf(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!preparedFile) {
      if (!preparing) preparePdf();
      return;
    }

    if (typeof navigator.share === 'function') {
      let sharePromise;
      try {
        // Safari の transient activation を失わないよう、クリック直後に共有を呼ぶ。
        sharePromise = navigator.share({ files: [preparedFile] });
      } catch (error) {
        console.error(error);
        window.alert('共有を開けませんでした。もう一度押してください。');
        return;
      }
      Promise.resolve(sharePromise).catch(error => {
        if (error?.name === 'AbortError') return;
        console.error(error);
        // 共有失敗時も自動ダウンロードへ落とさず、この画面と添付画像を保持する。
        window.alert('共有を開けませんでした。もう一度押してください。');
      });
      return;
    }

    downloadFile(preparedFile);
  }

  button.onclick = null;
  setButton('PDFを共有', false, false);
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
  };
})();
