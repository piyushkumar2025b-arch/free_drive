import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Trash2,
  Edit2,
  Save,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileText,
  Code,
  Table,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Volume2,
  Loader2,
} from 'lucide-react';
import { FileItem } from '../types';
import { formatFileSize, isTextFile, loadFullFileDataUrl, updateFileContent } from '../services/fileService';
import { FileIcon } from './FileIcon';

interface FilePreviewModalProps {
  file: FileItem | null;
  siblingFiles?: FileItem[];
  onClose: () => void;
  onNavigateFile?: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onFileUpdated?: (fileId: string, newContent: string) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  siblingFiles = [],
  onClose,
  onNavigateFile,
  onDelete,
  onRename,
  onFileUpdated,
}) => {
  if (!file) return null;

  const [activeDataUrl, setActiveDataUrl] = useState<string | null>(file.dataUrl || null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isModalFullscreen, setIsModalFullscreen] = useState<boolean>(false);

  // Image controls
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Text / Code editing
  const [isEditingText, setIsEditingText] = useState<boolean>(false);
  const [textContent, setTextContent] = useState<string>(file.textContent || '');
  const [isSavingText, setIsSavingText] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [wrapLines, setWrapLines] = useState<boolean>(true);

  // Markdown toggle
  const [markdownViewMode, setMarkdownViewMode] = useState<'preview' | 'raw'>('preview');

  // Load chunked / remote data if not loaded
  useEffect(() => {
    setTextContent(file.textContent || '');
    setIsEditingText(false);
    setZoom(1);
    setRotation(0);

    if (file.dataUrl) {
      setActiveDataUrl(file.dataUrl);
      setIsLoadingData(false);
      return;
    }

    if (file.isFolder) {
      setActiveDataUrl(null);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    loadFullFileDataUrl(file)
      .then((url) => {
        if (url) {
          setActiveDataUrl(url);
          // If textContent was empty, decode it from data URL
          if (!file.textContent) {
            const commaIdx = url.indexOf(',');
            if (commaIdx !== -1) {
              const mimePart = url.substring(0, commaIdx);
              const payload = url.substring(commaIdx + 1);
              if (
                mimePart.includes('text') ||
                mimePart.includes('json') ||
                mimePart.includes('javascript') ||
                mimePart.includes('xml') ||
                mimePart.includes('csv') ||
                mimePart.includes('svg')
              ) {
                try {
                  if (mimePart.includes(';base64')) {
                    setTextContent(decodeURIComponent(escape(atob(payload))));
                  } else {
                    setTextContent(decodeURIComponent(payload));
                  }
                } catch {
                  try {
                    setTextContent(atob(payload));
                  } catch {
                    // ignore
                  }
                }
              }
            }
          }
        }
      })
      .catch((e) => {
        console.warn('Could not load file data for preview', e);
      })
      .finally(() => {
        setIsLoadingData(false);
      });
  }, [file]);

  // Keyboard navigation across sibling files
  const currentIndex = siblingFiles.findIndex((f) => f.id === file.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < siblingFiles.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onNavigateFile) {
        onNavigateFile(siblingFiles[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && hasNext && onNavigateFile) {
        onNavigateFile(siblingFiles[currentIndex + 1]);
      } else if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsModalFullscreen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasPrev, hasNext, currentIndex, siblingFiles, onNavigateFile, isEditingText]);

  const ext = file.extension.toLowerCase();
  const mime = file.mimeType.toLowerCase();

  const isImage =
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext);

  const isVideo =
    mime.startsWith('video/') ||
    ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext);

  const isAudio =
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);

  const isPdf = ext === 'pdf' || mime.includes('pdf');

  const isCsv = ['csv', 'tsv'].includes(ext) || mime.includes('csv');

  const isMarkdown = ['md', 'markdown'].includes(ext);

  const isCodeOrText =
    isTextFile(file.mimeType, file.extension) ||
    file.textContent !== undefined ||
    isMarkdown ||
    isCsv;

  // Handle Download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = file.name;

    if (activeDataUrl) {
      link.href = activeDataUrl;
    } else if (file.textContent !== undefined) {
      const blob = new Blob([file.textContent], { type: file.mimeType || 'text/plain' });
      link.href = URL.createObjectURL(blob);
    } else {
      return;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveTextChanges = async () => {
    if (!file.id) return;
    setIsSavingText(true);
    try {
      await updateFileContent(file.id, textContent, file.provider);
      onFileUpdated?.(file.id, textContent);
      setSaveSuccess(true);
      setIsEditingText(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save file updates', e);
    } finally {
      setIsSavingText(false);
    }
  };

  // CSV parser for tabular preview
  const csvData = useMemo(() => {
    if (!isCsv || !textContent) return null;
    const delimiter = ext === 'tsv' ? '\t' : ',';
    const lines = textContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return null;

    const rows = lines.map((line) => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === delimiter && !inQuotes) {
          cells.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += c;
        }
      }
      cells.push(current.trim().replace(/^"|"$/g, ''));
      return cells;
    });

    return {
      headers: rows[0] || [],
      rows: rows.slice(1, 150),
      totalRows: Math.max(0, rows.length - 1),
    };
  }, [isCsv, textContent, ext]);

  // Hex preview for binary / unknown files
  const hexPreview = useMemo(() => {
    if (isImage || isVideo || isAudio || isPdf || isCodeOrText || !activeDataUrl) return null;
    try {
      const base64Index = activeDataUrl.indexOf('base64,');
      if (base64Index === -1) return null;
      const b64 = activeDataUrl.substring(base64Index + 7);
      const binaryString = atob(b64.substring(0, 512));
      const lines: { offset: string; hex: string; ascii: string }[] = [];

      for (let i = 0; i < Math.min(binaryString.length, 256); i += 16) {
        const slice = binaryString.slice(i, i + 16);
        const hex = Array.from(slice)
          .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(' ');
        const ascii = Array.from(slice)
          .map((c) => {
            const code = c.charCodeAt(0);
            return code >= 32 && code <= 126 ? c : '.';
          })
          .join('');
        lines.push({
          offset: i.toString(16).padStart(8, '0'),
          hex: hex.padEnd(48, ' '),
          ascii,
        });
      }
      return lines;
    } catch {
      return null;
    }
  }, [activeDataUrl, isImage, isVideo, isAudio, isPdf, isCodeOrText]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs transition-all ${
        isModalFullscreen ? 'p-0' : 'p-4 sm:p-8'
      }`}
    >
      <div
        className={`relative flex flex-col w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden transition-all duration-150 ${
          isModalFullscreen
            ? 'h-screen w-screen rounded-none border-none'
            : 'max-w-6xl h-[90vh] rounded-2xl'
        }`}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 select-none">
          <div className="flex items-center gap-4 min-w-0">
            <FileIcon
              isFolder={file.isFolder}
              mimeType={file.mimeType}
              extension={file.extension}
              size={24}
            />
            <div className="min-w-0">
              <h2 id="preview-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {file.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                <span>{formatFileSize(file.size)}</span>
                <span>·</span>
                <span className="uppercase font-mono">{file.extension || 'file'}</span>
                <span>·</span>
                <span>{file.mimeType}</span>
              </div>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {isEditingText && textContent !== (file.textContent || '') && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 rounded-lg flex items-center gap-1.5 border border-amber-200 dark:border-amber-900/60 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Unsaved edits</span>
              </span>
            )}

            {saveSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg flex items-center gap-1 border border-emerald-200 dark:border-emerald-900/60">
                <Check size={13} />
                <span>Saved &amp; Updated</span>
              </span>
            )}

            {isCodeOrText && !isEditingText && (
              <button
                type="button"
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                title="Copy contents"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}

            {isCodeOrText && !isEditingText && (
              <button
                type="button"
                onClick={() => setIsEditingText(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                title="Edit text"
              >
                <Edit2 size={14} />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            {isEditingText && (
              <button
                type="button"
                disabled={isSavingText}
                onClick={handleSaveTextChanges}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 shadow-xs"
              >
                {isSavingText ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Changes</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              title="Download file"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span>
            </button>

            {/* Modal Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsModalFullscreen(!isModalFullscreen)}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              title={isModalFullscreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isModalFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              type="button"
              onClick={() => onRename(file)}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              title="Rename"
            >
              <Edit2 size={16} />
            </button>

            <button
              type="button"
              onClick={() => {
                onDelete(file);
                onClose();
              }}
              className="p-1.5 text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Content Area */}
        <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-center relative">
          {/* Sibling File Navigation Arrows */}
          {hasPrev && onNavigateFile && (
            <button
              type="button"
              onClick={() => onNavigateFile(siblingFiles[currentIndex - 1])}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition"
              title="Previous File (Left Arrow)"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {hasNext && onNavigateFile && (
            <button
              type="button"
              onClick={() => onNavigateFile(siblingFiles[currentIndex + 1])}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition"
              title="Next File (Right Arrow)"
            >
              <ChevronRight size={20} />
            </button>
          )}

          {isLoadingData ? (
            <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Assembling and loading file data...</p>
            </div>
          ) : isImage ? (
            /* IMAGE PREVIEW */
            <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
              <div
                className="overflow-auto w-full h-full flex items-center justify-center p-6 select-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, rgba(120,120,120,0.15) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              >
                {activeDataUrl || (ext === 'svg' && (textContent || file.textContent)) ? (
                  <img
                    src={
                      activeDataUrl ||
                      (ext === 'svg'
                        ? `data:image/svg+xml;utf8,${encodeURIComponent(textContent || file.textContent || '')}`
                        : '')
                    }
                    alt={file.name}
                    className="max-h-full max-w-full object-contain transition-transform duration-100 shadow-xl rounded-lg"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                ) : (
                  <div className="text-center text-zinc-400 p-8 flex flex-col items-center gap-3">
                    <p className="text-sm font-medium">Image preview not available</p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      Download Image
                    </button>
                  </div>
                )}
              </div>

              {/* Floating Image Control Bar */}
              <div className="absolute bottom-6 flex items-center gap-2 bg-white/95 dark:bg-zinc-800/95 backdrop-blur border border-zinc-200 dark:border-zinc-700 px-4 py-2 rounded-full shadow-xl text-xs text-zinc-700 dark:text-zinc-300">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.2, z - 0.25))}
                  className="p-1 hover:text-blue-500 transition"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="w-14 text-center font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
                  className="p-1 hover:text-blue-500 transition"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 hover:text-blue-500 transition"
                  title="Rotate 90°"
                >
                  <RotateCw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  className="px-2 py-0.5 text-xs font-medium hover:text-blue-500 transition"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : isVideo && activeDataUrl ? (
            /* VIDEO PREVIEW */
            <div className="w-full h-full flex flex-col items-center justify-center p-6">
              <video
                src={activeDataUrl}
                controls
                className="max-h-full max-w-full rounded-xl shadow-2xl border border-zinc-300 dark:border-zinc-800 bg-black"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : isAudio && activeDataUrl ? (
            /* AUDIO PREVIEW */
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
                <Volume2 size={42} />
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-xs">
                  {file.name}
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  {formatFileSize(file.size)} · {file.mimeType}
                </p>
              </div>
              <audio src={activeDataUrl} controls className="w-full" />
            </div>
          ) : isPdf && activeDataUrl ? (
            /* PDF PREVIEW */
            <div className="w-full h-full flex flex-col p-4">
              <iframe
                src={activeDataUrl}
                title={file.name}
                className="w-full flex-1 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white"
              />
            </div>
          ) : isCsv && csvData && !isEditingText ? (
            /* CSV / SPREADSHEET TABULAR PREVIEW */
            <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-900 rounded-none overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <Table size={15} className="text-emerald-500" />
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    Table Preview ({csvData.headers.length} columns, showing {csvData.rows.length} of{' '}
                    {csvData.totalRows} rows)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingText(true)}
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  Edit Raw Data
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 sticky top-0 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-700 font-mono text-zinc-400 w-12 text-center">
                        #
                      </th>
                      {csvData.headers.map((h, i) => (
                        <th
                          key={i}
                          className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-700 font-semibold truncate max-w-xs"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono">
                    {csvData.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                      >
                        <td className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 text-zinc-400 text-center select-none">
                          {rIdx + 1}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 truncate max-w-xs"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : isMarkdown && markdownViewMode === 'preview' && !isEditingText ? (
            /* MARKDOWN RENDERED PREVIEW */
            <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-900 rounded-none overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  Rendered Markdown Document
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMarkdownViewMode('raw')}
                    className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    View Raw Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingText(true)}
                    className="text-zinc-700 dark:text-zinc-300 hover:underline font-medium"
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-8 text-zinc-800 dark:text-zinc-200 prose dark:prose-invert max-w-3xl mx-auto text-sm leading-relaxed space-y-4 font-sans">
                {textContent.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={idx} className="text-2xl font-bold border-b border-zinc-200 dark:border-zinc-800 pb-2">{line.replace('# ', '')}</h1>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={idx} className="text-xl font-semibold mt-5 mb-2">{line.replace('## ', '')}</h2>;
                  }
                  if (line.startsWith('### ')) {
                    return <h3 key={idx} className="text-lg font-medium mt-4 mb-1">{line.replace('### ', '')}</h3>;
                  }
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    return (
                      <li key={idx} className="ml-5 list-disc">
                        {line.replace(/^[-*]\s+/, '')}
                      </li>
                    );
                  }
                  if (line.startsWith('> ')) {
                    return (
                      <blockquote key={idx} className="border-l-4 border-blue-500 pl-4 italic text-zinc-600 dark:text-zinc-400">
                        {line.replace('> ', '')}
                      </blockquote>
                    );
                  }
                  if (line.trim() === '') {
                    return <div key={idx} className="h-3" />;
                  }
                  return <p key={idx}>{line}</p>;
                })}
              </div>
            </div>
          ) : isCodeOrText ? (
            /* CODE / TEXT FILE PREVIEW & EDITOR */
            <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-200">
              <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 select-none">
                <div className="flex items-center gap-3">
                  <Code size={15} className="text-indigo-400" />
                  <span className="font-mono text-zinc-200">{file.name}</span>
                  <span>·</span>
                  <span className="tabular-nums font-mono">{textContent.split('\n').length} lines</span>
                  <span>·</span>
                  <span className="tabular-nums font-mono">{textContent.length.toLocaleString()} chars</span>
                </div>

                <div className="flex items-center gap-4">
                  {isMarkdown && (
                    <button
                      type="button"
                      onClick={() => setMarkdownViewMode('preview')}
                      className="hover:text-zinc-200 transition font-medium"
                    >
                      Formatted Preview
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setWrapLines(!wrapLines)}
                    className="hover:text-zinc-200 transition font-medium"
                  >
                    {wrapLines ? 'No Wrap' : 'Wrap Lines'}
                  </button>
                  {isEditingText && (
                    <span className="text-amber-400 text-xs font-mono font-medium">Editing</span>
                  )}
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden font-mono text-xs leading-6">
                {/* Line Numbers Gutter */}
                <div className="select-none py-4 px-4 bg-zinc-950 text-zinc-600 border-r border-zinc-800/80 text-right overflow-hidden tabular-nums">
                  {textContent.split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>

                {/* Text View / Edit Area */}
                {isEditingText ? (
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className={`flex-1 p-4 bg-transparent text-zinc-100 resize-none outline-none font-mono text-xs leading-6 ${
                      wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre overflow-x-auto'
                    }`}
                    spellCheck={false}
                    autoFocus
                  />
                ) : (
                  <pre
                    className={`flex-1 p-4 text-zinc-100 overflow-auto font-mono text-xs leading-6 ${
                      wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'
                    }`}
                  >
                    {textContent || '(Empty file)'}
                  </pre>
                )}
              </div>
            </div>
          ) : hexPreview ? (
            /* BINARY / UNKNOWN FILE HEX VIEWER */
            <div className="w-full h-full flex flex-col bg-zinc-950 font-mono text-xs text-zinc-300">
              <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                <span className="font-semibold text-zinc-200">Binary / Hex Inspector (First 256 bytes)</span>
                <span className="tabular-nums">{formatFileSize(file.size)}</span>
              </div>
              <div className="flex-1 overflow-auto p-6 select-text">
                <table className="border-collapse">
                  <tbody>
                    {hexPreview.map((line, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/60">
                        <td className="text-zinc-600 pr-6 select-none">{line.offset}</td>
                        <td className="text-indigo-400 pr-8 tracking-wider">{line.hex}</td>
                        <td className="text-emerald-400 tracking-wide border-l border-zinc-800 pl-6">
                          {line.ascii}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* GENERIC UNKNOWN FILE INFO CARD */
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                <FileIcon
                  isFolder={file.isFolder}
                  mimeType={file.mimeType}
                  extension={file.extension}
                  size={48}
                />
              </div>

              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-xs">
                  {file.name}
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  Binary or Archive format · {formatFileSize(file.size)}
                </p>
              </div>

              <div className="w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-xs text-left space-y-2 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700/60">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Type:</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">{file.mimeType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Extension:</span>
                  <span className="font-mono uppercase text-zinc-800 dark:text-zinc-200">
                    {file.extension || 'None'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Size:</span>
                  <span className="text-zinc-800 dark:text-zinc-200 tabular-nums">
                    {formatFileSize(file.size)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Storage Mode:</span>
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {file.isChunked ? `Multi-part (${file.totalChunks} chunks)` : 'Single Document'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              >
                <Download size={15} /> Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
