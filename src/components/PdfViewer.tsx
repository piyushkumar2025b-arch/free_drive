import React, { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { loadPdfDocument, renderPdfPageToCanvas } from '../services/pdfService';
import { dataUrlToArrayBuffer } from '../services/documentParserService';

interface PdfViewerProps {
  dataUrl: string;
  fileName: string;
  fileSize: number;
  onDownload: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  dataUrl,
  fileName,
  fileSize,
  onDownload,
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<number>(0);

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
        // Fallback to native browser PDF embedding via blobUrl
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

    const currentTaskId = ++renderTaskRef.current;
    setIsRenderingPage(true);

    renderPdfPageToCanvas(pdfDoc, currentPage, canvas, scale)
      .then(() => {
        if (currentTaskId === renderTaskRef.current) {
          setIsRenderingPage(false);
        }
      })
      .catch((err) => {
        if (currentTaskId === renderTaskRef.current) {
          console.warn('Page render error:', err);
          setIsRenderingPage(false);
        }
      });
  }, [pdfDoc, currentPage, scale, viewMode]);

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(numPages, p + 1));
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-900 text-zinc-100 overflow-hidden select-none">
      {/* PDF Top Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-2.5 bg-zinc-800 border-b border-zinc-700 text-xs gap-3">
        {/* Document Info */}
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={16} className="text-red-400 shrink-0" />
          <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">{fileName}</span>
          <span className="text-zinc-400 hidden sm:inline">·</span>
          <span className="text-zinc-400 font-mono hidden sm:inline">
            {numPages > 0 ? `${numPages} page${numPages === 1 ? '' : 's'}` : 'PDF'}
          </span>
        </div>

        {/* Page Navigation & Zoom Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {viewMode === 'canvas' && numPages > 0 && (
            <div className="flex items-center gap-1.5 bg-zinc-900/80 rounded-lg px-2 py-1 border border-zinc-700">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1 || isRenderingPage}
                className="p-1 hover:text-white disabled:opacity-30 transition rounded"
                title="Previous Page"
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
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {viewMode === 'canvas' && (
            <div className="flex items-center gap-1 bg-zinc-900/80 rounded-lg px-2 py-1 border border-zinc-700">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
                className="p-1 hover:text-white transition"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span className="font-mono text-xs tabular-nums w-12 text-center text-zinc-300">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3.0, s + 0.2))}
                className="p-1 hover:text-white transition"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {blobUrl && (
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition text-xs font-medium"
                title="Open PDF in new browser tab"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">New Tab</span>
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

      {/* Main Canvas / Native Viewer Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 bg-zinc-950 relative">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-sm font-medium">Parsing and rendering PDF pages...</p>
          </div>
        ) : viewMode === 'canvas' ? (
          <div className="relative flex flex-col items-center shadow-2xl rounded-lg overflow-hidden bg-white">
            {isRenderingPage && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
                <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              </div>
            )}
            <canvas ref={canvasRef} className="block max-w-full" />
          </div>
        ) : blobUrl ? (
          <object
            data={blobUrl}
            type="application/pdf"
            className="w-full h-full rounded-xl border border-zinc-800 bg-white"
          >
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-400 gap-4">
              <FileText size={48} className="text-red-400" />
              <p className="text-sm font-medium text-white">Embedded browser viewer unavailable</p>
              <p className="text-xs max-w-sm">
                Your browser blocked embedded PDF framing. You can open the PDF in a new tab or download it directly.
              </p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
                >
                  Open in New Tab
                </button>
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-4 py-2 bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                >
                  Download PDF
                </button>
              </div>
            </div>
          </object>
        ) : (
          <div className="text-center text-zinc-400">
            <AlertCircle size={36} className="mx-auto text-red-400 mb-2" />
            <p className="text-sm">Could not load PDF document.</p>
          </div>
        )}
      </div>
    </div>
  );
};
