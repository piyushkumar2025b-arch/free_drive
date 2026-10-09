import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
  Minimize,
  Maximize,
} from 'lucide-react';
import { loadPdfDocument, renderPdfPageToCanvas } from '../services/pdfService';
import { dataUrlToArrayBuffer } from '../services/documentParserService';

interface PdfViewerProps {
  dataUrl: string;
  fileName: string;
  fileSize: number;
  onDownload: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  dataUrl,
  fileName,
  fileSize,
  onDownload,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'native'>('canvas');
  const [isControlsFaded, setIsControlsFaded] = useState<boolean>(false);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<number>(0);
  const activeRenderTaskRef = useRef<any>(null);
  const fadeTimeoutRef = useRef<any>(null);

  // Generate safe blob URL for open-in-new-tab and native fallback
  useEffect(() => {
    let url: string | null = null;
    let isCancelled = false;

    dataUrlToArrayBuffer(dataUrl)
      .then((buffer) => {
        if (isCancelled || buffer.byteLength === 0) return;
        const blob = new Blob([buffer], { type: 'application/pdf' });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);

        // Load document via PDF.js
        setIsLoading(true);
        setErrorMessage(null);
        return loadPdfDocument(buffer);
      })
      .then((doc) => {
        if (isCancelled || !doc) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages || 1);
        setCurrentPage(1);
        setIsLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.warn('PDF.js canvas parse failed, falling back to browser embedded view:', err);
        setIsLoading(false);
        setViewMode('native');
      });

    return () => {
      isCancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [dataUrl]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || viewMode !== 'canvas') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cancel any in-flight render task on this canvas before starting a new one
    if (activeRenderTaskRef.current) {
      try {
        activeRenderTaskRef.current.cancel();
      } catch {}
      activeRenderTaskRef.current = null;
    }

    const currentTaskId = ++renderTaskRef.current;
    setIsRenderingPage(true);

    renderPdfPageToCanvas(pdfDoc, currentPage, canvas, scale)
      .then((res) => {
        if (currentTaskId === renderTaskRef.current) {
          activeRenderTaskRef.current = res.renderTask;
          setPageDimensions({ width: res.width, height: res.height });
          setIsRenderingPage(false);
        }
      })
      .catch((err) => {
        // Ignore expected cancellation when switching pages or scale rapidly
        if (err?.name === 'RenderingCancelledException') return;
        if (currentTaskId === renderTaskRef.current) {
          console.warn('Page render error:', err);
          setIsRenderingPage(false);
        }
      });

    return () => {
      if (activeRenderTaskRef.current) {
        try {
          activeRenderTaskRef.current.cancel();
        } catch {}
        activeRenderTaskRef.current = null;
      }
    };
  }, [pdfDoc, currentPage, scale, viewMode]);

  // Page handlers
  const handlePrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(numPages, p + 1));
  }, [numPages]);

  // Fit Width and Fit Page helpers
  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || !pdfDoc) return;
    pdfDoc.getPage(currentPage).then((page: any) => {
      const unscaledViewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const targetScale = Math.max(0.5, Math.min(3.0, (containerWidth - 48) / unscaledViewport.width));
      setScale(Number(targetScale.toFixed(2)));
    });
  }, [pdfDoc, currentPage]);

  const handleFitPage = useCallback(() => {
    if (!containerRef.current || !pdfDoc) return;
    pdfDoc.getPage(currentPage).then((page: any) => {
      const unscaledViewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const containerHeight = containerRef.current?.clientHeight || window.innerHeight;
      const scaleX = (containerWidth - 48) / unscaledViewport.width;
      const scaleY = (containerHeight - 48) / unscaledViewport.height;
      const targetScale = Math.max(0.4, Math.min(3.0, Math.min(scaleX, scaleY)));
      setScale(Number(targetScale.toFixed(2)));
    });
  }, [pdfDoc, currentPage]);

  // Keyboard navigation when viewer is focused or active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setScale((s) => Math.min(3.5, s + 0.2));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setScale((s) => Math.max(0.4, s - 0.2));
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(1.25);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextPage, handlePrevPage]);

  // Fullscreen mouse idle fading for controls HUD
  const handleMouseMove = () => {
    if (!isFullscreen) return;
    setIsControlsFaded(false);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      setIsControlsFaded(true);
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  const handleOpenNewTab = () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`w-full h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden select-none relative ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* WINDOWED TOP TOOLBAR (Hidden in Fullscreen for 100% pure document display) */}
      {!isFullscreen && (
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-2.5 bg-zinc-900 border-b border-zinc-800 text-xs gap-3">
          {/* Document Info */}
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-red-400 shrink-0" />
            <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
              {fileName}
            </span>
            <span className="text-zinc-500 hidden sm:inline">·</span>
            <span className="text-zinc-400 font-mono hidden sm:inline">
              {numPages > 0 ? `${numPages} page${numPages === 1 ? '' : 's'}` : 'PDF'}
            </span>
          </div>

          {/* Page Navigation & Zoom Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {viewMode === 'canvas' && numPages > 0 && (
              <div className="flex items-center gap-1.5 bg-zinc-800/90 rounded-lg px-2 py-1 border border-zinc-700">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1 || isRenderingPage}
                  className="p-1 hover:text-white disabled:opacity-30 transition rounded"
                  title="Previous Page (Left Arrow)"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1 font-mono text-xs tabular-nums text-zinc-200">
                  <span>{currentPage}</span>
                  <span className="text-zinc-500">/</span>
                  <span>{numPages}</span>
                </div>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages || isRenderingPage}
                  className="p-1 hover:text-white disabled:opacity-30 transition rounded"
                  title="Next Page (Right Arrow)"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div className="flex items-center gap-1 bg-zinc-800/90 rounded-lg px-2 py-1 border border-zinc-700">
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.2).toFixed(2))))}
                  className="p-1 hover:text-white transition"
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="font-mono text-xs tabular-nums w-12 text-center text-zinc-300">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setScale((s) => Math.min(3.5, Number((s + 0.2).toFixed(2))))}
                  className="p-1 hover:text-white transition"
                  title="Zoom In (+)"
                >
                  <ZoomIn size={15} />
                </button>
              </div>
            )}

            {/* Quick Fit Controls */}
            {viewMode === 'canvas' && (
              <div className="hidden md:flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleFitWidth}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-[11px] font-medium transition"
                  title="Fit to Width"
                >
                  Fit Width
                </button>
                <button
                  type="button"
                  onClick={handleFitPage}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-[11px] font-medium transition"
                  title="Fit Page"
                >
                  Fit Page
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {onToggleFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition text-xs font-medium"
                  title="Document Full Screen"
                >
                  <Maximize2 size={13} />
                  <span className="hidden sm:inline">Pure View</span>
                </button>
              )}

              {blobUrl && (
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition text-xs font-medium"
                  title="Open PDF in new browser tab"
                >
                  <ExternalLink size={13} />
                  <span className="hidden sm:inline">Tab</span>
                </button>
              )}

              <button
                type="button"
                onClick={onDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-xs font-medium shadow-xs"
                title="Download PDF file"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN DOCUMENT VIEWPORT: Clean centered scrolling paper sheet */}
      <div
        className={`flex-1 overflow-auto flex justify-center items-start relative bg-zinc-950 ${
          isFullscreen ? 'p-2 sm:p-6' : 'p-4 sm:p-8'
        }`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-zinc-400 my-auto py-16">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-sm font-medium">Parsing and rendering PDF document...</p>
          </div>
        ) : viewMode === 'canvas' ? (
          <div
            className={`relative flex flex-col items-center bg-white my-auto transition-all ${
              isFullscreen
                ? 'shadow-2xl rounded-sm border border-zinc-700/50'
                : 'shadow-2xl rounded-sm border border-zinc-300 dark:border-zinc-800'
            }`}
            style={{
              width: pageDimensions ? `${Math.floor(pageDimensions.width)}px` : 'auto',
              minHeight: pageDimensions ? `${Math.floor(pageDimensions.height)}px` : '400px',
            }}
          >
            {isRenderingPage && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-2xs flex items-center justify-center z-10 transition-opacity">
                <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              </div>
            )}
            <canvas ref={canvasRef} className="block shadow-xs" />
          </div>
        ) : blobUrl ? (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <iframe
              src={blobUrl}
              title={fileName}
              className={`w-full h-full bg-white ${
                isFullscreen ? 'border-0 rounded-none' : 'rounded-xl border border-zinc-800'
              }`}
            />
            {/* Quick action bar if browser blocks embedded PDF controls */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg text-xs">
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
              >
                Open in Tab
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="px-2.5 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-semibold transition"
              >
                Download
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-zinc-400">
            <AlertCircle size={36} className="mx-auto text-red-400 mb-2" />
            <p className="text-sm">Could not load PDF document.</p>
          </div>
        )}

        {/* FULLSCREEN FLOATING MINIMAL HUD (Unobtrusive, floating, auto-fading, zero outlines) */}
        {isFullscreen && (
          <div
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 sm:gap-3 bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl text-xs text-white transition-opacity duration-300 ${
              isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            {/* Page Navigation */}
            {numPages > 0 && (
              <div className="flex items-center gap-1.5 pr-2 border-r border-white/15">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1 || isRenderingPage}
                  className="p-1 hover:bg-white/15 rounded-full disabled:opacity-30 transition"
                  title="Previous Page (Left Arrow)"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-mono text-xs tabular-nums text-zinc-200 px-1">
                  {currentPage} / {numPages}
                </span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages || isRenderingPage}
                  className="p-1 hover:bg-white/15 rounded-full disabled:opacity-30 transition"
                  title="Next Page (Right Arrow)"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 pr-2 border-r border-white/15">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.2).toFixed(2))))}
                className="p-1 hover:bg-white/15 rounded-full transition"
                title="Zoom Out (-)"
              >
                <ZoomOut size={15} />
              </button>
              <span className="font-mono text-xs tabular-nums w-11 text-center text-zinc-300">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3.5, Number((s + 0.2).toFixed(2))))}
                className="p-1 hover:bg-white/15 rounded-full transition"
                title="Zoom In (+)"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            {/* Fit Width / Fit Page */}
            <button
              type="button"
              onClick={handleFitWidth}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-md text-[11px] font-medium transition hidden sm:inline"
              title="Fit to Width"
            >
              Width
            </button>
            <button
              type="button"
              onClick={handleFitPage}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-md text-[11px] font-medium transition hidden sm:inline"
              title="Fit Page"
            >
              Fit
            </button>

            {/* Download */}
            <button
              type="button"
              onClick={onDownload}
              className="p-1 hover:bg-white/15 rounded-full transition"
              title="Download PDF"
            >
              <Download size={15} />
            </button>

            {/* Exit Fullscreen */}
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-full transition text-xs shadow-xs"
                title="Exit Full Screen (Esc)"
              >
                <Minimize2 size={13} />
                <span>Exit</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
