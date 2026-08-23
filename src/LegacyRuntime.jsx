import { useLayoutEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import configSource from '../config.js?raw';
import coreSource from '../app-core.js?raw';
import flowSource from '../app-flow.js?raw';
import viewSource from '../app-view.js?raw';
import shareSource from '../app-share.js?raw';

const RUNTIME_KEY = '__TOZAN_REACT_RUNTIME_READY__';
const compatibilityExports = `
window.normalizeVisionResult = normalizeVisionResult;
window.municipalityArea = municipalityArea;
window.applyPoliceFromRoute = applyPoliceFromRoute;
`;

/**
 * Transitional compatibility bridge while React becomes the sole DOM owner.
 *
 * The current production behavior is implemented by classic scripts that share
 * one top-level lexical scope. Executing their source as one bundle preserves
 * that tested behavior without keeping a second hand-authored production DOM.
 * This bridge can be removed after those functions are migrated module-by-module.
 */
export default function LegacyRuntime() {
  useLayoutEffect(() => {
    if (window[RUNTIME_KEY]) return undefined;

    window.html2canvas = html2canvas;
    window.jspdf = { ...(window.jspdf || {}), jsPDF };

    const source = [configSource, coreSource, flowSource, viewSource, shareSource, compatibilityExports]
      .join('\n\n;\n\n');

    // Keep the classic files in a single lexical scope exactly as they ran when
    // loaded by the previous production index.html.
    const startRuntime = new Function(source);
    startRuntime();
    window[RUNTIME_KEY] = true;

    return undefined;
  }, []);

  return null;
}
