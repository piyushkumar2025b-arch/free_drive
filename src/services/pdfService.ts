import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// Ensure Promise.try is polyfilled if needed
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function (fn: any, ...args: any[]) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

// Configure PDF.js worker using legacy same-origin Vite bundled asset
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface PdfDocumentInfo {
  numPages: number;
  fingerprint: string;
}

/**
 * Loads a PDF document from an ArrayBuffer
 */
export async function loadPdfDocument(data: ArrayBuffer): Promise<any> {
  const bytes = new Uint8Array(data);
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      cMapPacked: true,
    });
    return await loadingTask.promise;
  } catch (err) {
    console.warn('PDF.js primary load attempt notice, trying fallback:', err);
    try {
      const fallbackTask = pdfjsLib.getDocument({
        data: bytes.slice(0),
      });
      return await fallbackTask.promise;
    } catch (fallbackErr) {
      throw fallbackErr;
    }
  }
}

/**
 * Renders a specific PDF page onto an HTML canvas element
 */
export async function renderPdfPageToCanvas(
  pdfDoc: any,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number; renderTask: any }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas 2D context');

  // Support high-DPI displays
  const outputScale = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = Math.floor(viewport.width) + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';

  context.save();
  context.scale(outputScale, outputScale);

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  const renderTask = page.render(renderContext);
  await renderTask.promise;
  context.restore();

  return { width: viewport.width, height: viewport.height, renderTask };
}
