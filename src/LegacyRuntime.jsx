import { useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import configSource from '../config.js?raw';
import coreSource from '../app-core.js?raw';
import flowSource from '../app-flow.js?raw';
import viewSource from '../app-view.js?raw';
import shareSource from '../app-share.js?raw';

const compatibilityExports = `
window.normalizeVisionResult = normalizeVisionResult;
window.municipalityArea = municipalityArea;
window.applyPoliceFromRoute = applyPoliceFromRoute;
window.__tozanApp.draftRuntime = {
  root: document,
  state,
  renderUploads,
  renderRoutePreview,
  renderItinerary,
  syncMetricInputs,
  renderProgress,
  syncStep2Readiness: () => setStep2NextEnabled(!!state.itinerary.length && !!state.routeImage),
  invalidatePdf: () => { pendingPdfFile = null; markPreparedPdfDirty(); },
};
`;

function createScopedDocument(root, globalDocument) {
  return new Proxy(globalDocument, {
    get(target, key) {
      if (key === 'body') return root;
      if (key === 'baseURI') return root.ownerDocument.baseURI;
      if (key === 'querySelector') return (selector) => root.querySelector(selector);
      if (key === 'querySelectorAll') return (selector) => root.querySelectorAll(selector);
      if (key === 'getElementById') return (id) => root.querySelector(`#${CSS.escape(id)}`);
      if (key === 'addEventListener' || key === 'removeEventListener' || key === 'dispatchEvent') return root[key].bind(root);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function createScopedWindow(root, globalWindow, scopedDocument) {
  const localValues = new Map();
  const scope = new Proxy(Object.create(null), {
    has: () => true,
    get(_target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (key === 'window' || key === 'globalThis') return scope;
      if (key === 'document') return scopedDocument;
      if (key === '__tozanApp' || key === '__tozanShare') return localValues.get(key);
      if (key === 'scrollTo') return () => {};
      if (key === 'dispatchEvent' || key === 'addEventListener' || key === 'removeEventListener') return root[key].bind(root);
      if (key === 'TOZAN_AI_ENDPOINT') return globalWindow.TOZAN_AI_ENDPOINT;
      if (localValues.has(key)) return localValues.get(key);
      const fromWindow = Reflect.get(globalWindow, key, globalWindow);
      return fromWindow === undefined ? Reflect.get(globalThis, key) : fromWindow;
    },
    set(_target, key, value) {
      if (key === '__tozanApp' || key === '__tozanShare' || key === 'html2canvas' || key === 'jspdf') localValues.set(key, value);
      else localValues.set(key, value);
      return true;
    },
  });
  return scope;
}

/** Executes the existing classic-script runtime with DOM access limited to its workspace root. */
export default function LegacyRuntime({ rootRef, standalone = false, onRuntime, examples = {} }) {
  useEffect(() => {
    const root = rootRef?.current;
    if (!root) return undefined;
    const scopedDocument = createScopedDocument(root, document);
    const scopedWindow = createScopedWindow(root, window, scopedDocument);
    const startRuntime = new Function('scope', `with (scope) {\n${[
      configSource, coreSource, flowSource, viewSource, shareSource, compatibilityExports,
    ].join('\n\n;\n\n')}\n}`);

    scopedWindow.html2canvas = html2canvas;
    scopedWindow.jspdf = { jsPDF };
    startRuntime(scopedWindow);
    const runtime = scopedWindow.__tozanApp;
    runtime.exampleAssets = examples;
    runtime.addFiles = runtime.addFiles;
    runtime.dispose = () => {
      runtime.disposeDraftListeners?.();
      scopedWindow.__tozanShare?.dispose?.();
      root.removeAttribute('data-runtime-ready');
      if (standalone && window.__tozanApp === runtime) delete window.__tozanApp;
    };
    root.dataset.runtimeReady = 'true';
    if (standalone) window.__tozanApp = runtime;
    onRuntime?.(runtime);
    root.dispatchEvent(new CustomEvent('tozan:runtime-ready', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('tozan:runtime-ready', { detail: { runtime } }));

    return () => {
      runtime.dispose();
      onRuntime?.(null);
    };
  }, [rootRef, standalone, onRuntime, examples]);

  return null;
}
