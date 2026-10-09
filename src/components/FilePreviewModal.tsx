import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Volume2,
  Loader2,
  Presentation,
  FolderArchive,
  Folder,
  ExternalLink,
  FolderOpen,
  Search,
} from 'lucide-react';
import { FileItem } from '../types';
import {
  formatFileSize,
  isTextFile,
  loadFullFileDataUrl,
  updateFileContent,
} from '../services/fileService';
import {
  parseDocxToHtml,
  parsePptxSlides,
  PptxSlide,
  inspectZipArchive,
  ZipEntryItem,
  readZipEntryContent,
  parseXlsxSpreadsheet,
  XlsxSheet,
  getColumnLetter,
} from '../services/documentParserService';
import {
  highlightCode,
  getLanguageFromExtension,
} from '../services/syntaxHighlightService';
import { FileIcon } from './FileIcon';
import { PdfViewer } from './PdfViewer';

interface FilePreviewModalProps {
  file: FileItem | null;
  siblingFiles?: FileItem[];
  onClose: () => void;
  onNavigateFile?: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onFileUpdated?: (fileId: string, newContent: string) => void;
  onExtractZip?: (file: FileItem, dataUrl: string) => Promise<void>;
}

function extractTextFromDataUrl(url: string): string {
  const commaIdx = url.indexOf(',');
  if (commaIdx === -1) return '';
  const meta = url.substring(0, commaIdx);
  const payload = url.substring(commaIdx + 1);

  try {
    if (meta.includes(';base64')) {
      const cleanB64 = payload.replace(/\s+/g, '');
      const binaryString = atob(cleanB64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } else {
      return decodeURIComponent(payload);
    }
  } catch {
    try {
      return atob(payload);
    } catch {
      return '';
    }
  }
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  siblingFiles = [],
  onClose,
  onNavigateFile,
  onDelete,
  onRename,
  onFileUpdated,
  onExtractZip,
}) => {
  if (!file) return null;

  const [activeDataUrl, setActiveDataUrl] = useState<string | null>(file.dataUrl || null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isModalFullscreen, setIsModalFullscreen] = useState<boolean>(false);
  const [isControlsFaded, setIsControlsFaded] = useState<boolean>(false);
  const fadeTimeoutRef = useRef<any>(null);

  const handleMouseMove = () => {
    if (!isModalFullscreen) return;
    setIsControlsFaded(false);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      setIsControlsFaded(true);
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, []);

  // Image controls
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Text / Code editing
  const [isEditingText, setIsEditingText] = useState<boolean>(false);
  const [textContent, setTextContent] = useState<string>(file.textContent || '');
  const [isSavingText, setIsSavingText] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [wrapLines, setWrapLines] = useState<boolean>(false);

  // Markdown toggle
  const [markdownViewMode, setMarkdownViewMode] = useState<'preview' | 'raw'>('preview');

  // DOCX State
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [isLoadingDocx, setIsLoadingDocx] = useState<boolean>(false);

  // PPTX State
  const [slides, setSlides] = useState<PptxSlide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isLoadingPptx, setIsLoadingPptx] = useState<boolean>(false);

  // XLSX Spreadsheet State
  const [xlsxSheets, setXlsxSheets] = useState<XlsxSheet[]>([]);
  const [activeXlsxSheetIndex, setActiveXlsxSheetIndex] = useState<number>(0);
  const [isLoadingXlsx, setIsLoadingXlsx] = useState<boolean>(false);
  const [sheetSearch, setSheetSearch] = useState<string>('');

  // ZIP State
  const [zipEntries, setZipEntries] = useState<ZipEntryItem[]>([]);
  const [isLoadingZip, setIsLoadingZip] = useState<boolean>(false);
  const [isExtractingZip, setIsExtractingZip] = useState<boolean>(false);
  const [zipSearch, setZipSearch] = useState<string>('');
  const [previewArchiveEntry, setPreviewArchiveEntry] = useState<{
    name: string;
    content?: string;
    dataUrl?: string;
  } | null>(null);
  const [isLoadingEntry, setIsLoadingEntry] = useState<boolean>(false);

  // SVG & Code View Toggles
  const [svgViewMode, setSvgViewMode] = useState<'image' | 'code'>('image');
  const [codeSearch, setCodeSearch] = useState<string>('');

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

  const isXlsx =
    ['xlsx', 'xls', 'ods'].includes(ext) ||
    mime.includes('spreadsheetml') ||
    mime.includes('ms-excel');

  const isSpreadsheet = isCsv || isXlsx;

  const isMarkdown = ['md', 'markdown'].includes(ext);

  const isDocx =
    ['docx', 'doc'].includes(ext) ||
    mime.includes('wordprocessingml') ||
    mime.includes('msword');

  const isPptx =
    ['pptx', 'ppt'].includes(ext) ||
    mime.includes('presentationml') ||
    mime.includes('powerpoint');

  const isArchive =
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'jar', 'war'].includes(ext) ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('archive');

  const isCodeOrText =
    isTextFile(file.mimeType, file.extension) ||
    file.textContent !== undefined ||
    isMarkdown ||
    isCsv ||
    ['ts', 'tsx', 'js', 'jsx', 'py', 'json', 'html', 'css', 'sql', 'sh', 'yaml', 'yml', 'xml', 'rs', 'go', 'cpp', 'c', 'php'].includes(ext);

  // Load chunked / remote data if not loaded
  useEffect(() => {
    let initialText = file.textContent || '';
    if (!initialText && file.dataUrl) {
      initialText = extractTextFromDataUrl(file.dataUrl);
    }
    setTextContent(initialText);
    setIsEditingText(false);
    setZoom(1);
    setRotation(0);
    setDocxHtml(null);
    setSlides([]);
    setCurrentSlideIndex(0);
    setZipEntries([]);
    setXlsxSheets([]);
    setActiveXlsxSheetIndex(0);
    setSheetSearch('');

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
          if (!initialText) {
            const decoded = extractTextFromDataUrl(url);
            if (decoded) setTextContent(decoded);
          }
        } else {
          setActiveDataUrl(null);
        }
      })
      .catch((e) => {
        console.warn('Could not load file data for preview', e);
        setActiveDataUrl(null);
      })
      .finally(() => {
        setIsLoadingData(false);
      });
  }, [file]);

  // Handle format-specific parsers once activeDataUrl is available
  useEffect(() => {
    if (!activeDataUrl) return;

    if (isXlsx) {
      setIsLoadingXlsx(true);
      parseXlsxSpreadsheet(activeDataUrl)
        .then((sheets) => {
          setXlsxSheets(sheets);
          setActiveXlsxSheetIndex(0);
        })
        .catch((e) => {
          console.warn('XLSX parser failed', e);
        })
        .finally(() => setIsLoadingXlsx(false));
    }

    if (isDocx) {
      setIsLoadingDocx(true);
      parseDocxToHtml(activeDataUrl)
        .then((html) => setDocxHtml(html))
        .catch((e) => {
          console.warn('DOCX parser failed', e);
          setDocxHtml('<p class="text-zinc-500 italic">Could not extract Word document preview. Please download the original file to view it.</p>');
        })
        .finally(() => setIsLoadingDocx(false));
    }

    if (isPptx) {
      setIsLoadingPptx(true);
      parsePptxSlides(activeDataUrl)
        .then((parsed) => {
          setSlides(parsed);
          setCurrentSlideIndex(0);
        })
        .catch((e) => {
          console.warn('PPTX parser failed', e);
        })
        .finally(() => setIsLoadingPptx(false));
    }

    if (isArchive) {
      setIsLoadingZip(true);
      inspectZipArchive(activeDataUrl)
        .then((entries) => {
          setZipEntries(entries);
        })
        .catch((e) => {
          console.warn('Archive inspect failed', e);
        })
        .finally(() => setIsLoadingZip(false));
    }
  }, [activeDataUrl, isDocx, isPptx, isArchive, isXlsx]);

  // Keyboard navigation across sibling files
  const currentIndex = siblingFiles.findIndex((f) => f.id === file.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < siblingFiles.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText) return;

      // Inner zip entry preview
      if (previewArchiveEntry) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPreviewArchiveEntry(null);
          return;
        }
      }

      // Escape key exits fullscreen first, or closes modal
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isModalFullscreen) {
          setIsModalFullscreen(false);
        } else {
          onClose();
        }
        return;
      }

      // Slideshow navigation for PPT
      if (isPptx && slides.length > 0) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          setCurrentSlideIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          setCurrentSlideIndex((i) => Math.min(slides.length - 1, i + 1));
          return;
        }
      }

      // For PDF, let PdfViewer handle internal page flips
      if (isPdf) {
        return;
      }

      // Sibling files navigation in windowed mode
      if (!isModalFullscreen) {
        if (e.key === 'ArrowLeft' && hasPrev && onNavigateFile) {
          onNavigateFile(siblingFiles[currentIndex - 1]);
        } else if (e.key === 'ArrowRight' && hasNext && onNavigateFile) {
          onNavigateFile(siblingFiles[currentIndex + 1]);
        }
      }

      // Toggle fullscreen with Ctrl/Cmd + F
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsModalFullscreen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onClose,
    hasPrev,
    hasNext,
    currentIndex,
    siblingFiles,
    onNavigateFile,
    isEditingText,
    isModalFullscreen,
    isPptx,
    isPdf,
    slides.length,
    previewArchiveEntry,
  ]);

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

  // Safe CSV / TSV parser with uniform column count
  const csvData = useMemo(() => {
    if (!isCsv || !textContent) return null;
    const delimiter = ext === 'tsv' ? '\t' : ',';
    const lines = textContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return null;

    const rawRows = lines.map((line) => {
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

    const maxCols = Math.max(...rawRows.map((r) => r.length), 1);
    const uniformRows = rawRows.map((r) => {
      const padded = [...r];
      while (padded.length < maxCols) {
        padded.push('');
      }
      return padded;
    });

    return {
      headers: uniformRows[0] || [],
      rows: uniformRows.slice(1, 200),
      totalRows: Math.max(0, uniformRows.length - 1),
    };
  }, [isCsv, textContent, ext]);

  // Unified Spreadsheet data source (XLSX sheets or CSV/TSV table)
  const activeSpreadsheetData = useMemo(() => {
    if (isXlsx) {
      if (xlsxSheets.length === 0) return null;
      const sheet = xlsxSheets[activeXlsxSheetIndex] || xlsxSheets[0];
      return {
        sheetName: sheet.name,
        headers: sheet.headers,
        rows: sheet.rows,
        totalRows: sheet.totalRows,
        sheetCount: xlsxSheets.length,
      };
    }
    if (isCsv && csvData) {
      return {
        sheetName: file.name,
        headers: csvData.headers,
        rows: csvData.rows,
        totalRows: csvData.totalRows,
        sheetCount: 1,
      };
    }
    return null;
  }, [isXlsx, xlsxSheets, activeXlsxSheetIndex, isCsv, csvData, file.name]);

  // Filtered rows matching search query in spreadsheet
  const filteredSpreadsheetRows = useMemo(() => {
    if (!activeSpreadsheetData) return [];
    if (!sheetSearch.trim()) return activeSpreadsheetData.rows;
    const q = sheetSearch.toLowerCase();
    return activeSpreadsheetData.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(q))
    );
  }, [activeSpreadsheetData, sheetSearch]);

  // Syntax highlighted HTML for code files
  const highlightedCodeHtml = useMemo(() => {
    if (!isCodeOrText || isEditingText || !textContent) return '';
    const lang = getLanguageFromExtension(ext);
    return highlightCode(textContent, lang);
  }, [isCodeOrText, isEditingText, textContent, ext]);

  // Word DOCX Statistics
  const docxStats = useMemo(() => {
    if (!docxHtml) return null;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = docxHtml;
    const text = tempDiv.textContent || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const readTime = Math.max(1, Math.ceil(words / 200));
    return { words, readTime, text };
  }, [docxHtml]);

  // Filtered Archive Entries
  const filteredZipEntries = useMemo(() => {
    if (!zipSearch.trim()) return zipEntries;
    const q = zipSearch.toLowerCase();
    return zipEntries.filter(
      (e) => e.name.toLowerCase().includes(q) || e.relativePath.toLowerCase().includes(q)
    );
  }, [zipEntries, zipSearch]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      onMouseMove={handleMouseMove}
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
        {/* Modal Top Bar (Hidden in Fullscreen for 100% distraction-free pure document viewing) */}
        {!isModalFullscreen && (
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
                  <span className="truncate max-w-[200px]">{file.mimeType}</span>
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
                title={isModalFullscreen ? 'Exit Full Screen' : 'Full Screen Pure View'}
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
        )}

        {/* Modal Content Area */}
        <div
          className={`flex-1 overflow-auto flex flex-col items-center justify-start relative min-h-0 min-w-0 ${
            isModalFullscreen ? 'bg-zinc-950 p-0 w-full h-full' : 'bg-zinc-100 dark:bg-zinc-950'
          }`}
        >
          {/* Sibling File Navigation Arrows (Windowed mode only so full screen remains completely clean) */}
          {!isModalFullscreen && hasPrev && onNavigateFile && (
            <button
              type="button"
              onClick={() => onNavigateFile(siblingFiles[currentIndex - 1])}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition"
              title="Previous File (Left Arrow)"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {!isModalFullscreen && hasNext && onNavigateFile && (
            <button
              type="button"
              onClick={() => onNavigateFile(siblingFiles[currentIndex + 1])}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-zinc-200 dark:border-zinc-700 shadow-md flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition"
              title="Next File (Right Arrow)"
            >
              <ChevronRight size={20} />
            </button>
          )}

          {/* Universal Floating Exit Fullscreen pill for non-document viewers */}
          {isModalFullscreen && !isPdf && !isDocx && !isPptx && (
            <button
              type="button"
              onClick={() => setIsModalFullscreen(false)}
              className={`absolute top-4 right-4 z-40 flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-white border border-white/20 rounded-full shadow-2xl text-xs font-medium transition-all duration-300 backdrop-blur-md ${
                isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
              title="Exit Full Screen (Esc)"
            >
              <Minimize2 size={13} />
              <span>Exit Full Screen (Esc)</span>
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
              {ext === 'svg' && svgViewMode === 'code' ? (
                <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-100 font-mono text-xs p-4 overflow-auto">
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="w-full h-full bg-transparent resize-none outline-none font-mono text-xs leading-6"
                    spellCheck={false}
                  />
                </div>
              ) : (
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
                      className={`max-h-full max-w-full object-contain transition-transform duration-100 ${
                        isModalFullscreen ? 'shadow-none rounded-none border-0' : 'shadow-xl rounded-lg'
                      }`}
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
              )}

              {/* Floating Image Control Bar */}
              <div
                className={`absolute bottom-6 flex items-center gap-2 bg-white/95 dark:bg-zinc-800/95 backdrop-blur border border-zinc-200 dark:border-zinc-700 px-4 py-2 rounded-full shadow-xl text-xs text-zinc-700 dark:text-zinc-300 transition-opacity duration-300 ${
                  isModalFullscreen && isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              >
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

                {isModalFullscreen && (
                  <>
                    <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />
                    <button
                      type="button"
                      onClick={() => setIsModalFullscreen(false)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-full transition text-xs shadow-xs"
                      title="Exit Full Screen (Esc)"
                    >
                      <Minimize2 size={13} />
                      <span>Exit (Esc)</span>
                    </button>
                  </>
                )}

                {ext === 'svg' && (
                  <>
                    <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-600 mx-1" />
                    <button
                      type="button"
                      onClick={() => setSvgViewMode(svgViewMode === 'image' ? 'code' : 'image')}
                      className="px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline transition"
                    >
                      {svgViewMode === 'image' ? 'Source Code' : 'Graphic'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : isPdf ? (
            /* DEDICATED PDF VIEWER WITH NATIVE CANVAS & ZERO-OUTLINE PURE DOCUMENT VIEW */
            activeDataUrl ? (
              <PdfViewer
                dataUrl={activeDataUrl}
                fileName={file.name}
                fileSize={file.size}
                onDownload={handleDownload}
                isFullscreen={isModalFullscreen}
                onToggleFullscreen={() => setIsModalFullscreen(!isModalFullscreen)}
              />
            ) : isLoadingData ? (
              <div className="flex flex-col items-center gap-3 text-zinc-400 p-12">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                <p className="text-sm font-medium">Assembling and loading PDF file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center text-zinc-400 p-12">
                <FileText size={48} className="text-red-400" />
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Unable to load PDF preview</p>
                <p className="text-xs text-zinc-500 max-w-sm">The PDF content could not be assembled from cloud storage.</p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Download Original PDF
                </button>
              </div>
            )
          ) : isDocx ? (
            /* MICROSOFT WORD DOCX PREVIEW */
            <div className="w-full h-full flex flex-col bg-zinc-100 dark:bg-zinc-950 overflow-hidden relative">
              {/* Top toolbar only shown in windowed mode */}
              {!isModalFullscreen && (
                <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{file.name}</span>
                    <span className="text-zinc-400">· Word Document</span>
                    {docxStats && (
                      <span className="text-zinc-400 font-mono hidden sm:inline">
                        ({docxStats.words.toLocaleString()} words · ~{docxStats.readTime} min read)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalFullscreen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg font-medium text-xs transition"
                      title="Read in Distraction-Free Pure Fullscreen"
                    >
                      <Maximize2 size={13} />
                      <span>Pure View</span>
                    </button>
                    {docxStats && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(docxStats.text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg font-medium text-xs transition"
                        title="Copy all document text"
                      >
                        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        <span>{copied ? 'Copied' : 'Copy Text'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs transition shadow-xs"
                    >
                      <Download size={13} />
                      <span>Download Original</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Document Paper Sheet: Centered, realistic paper sheet maintaining letters on page */}
              <div
                className={`flex-1 overflow-auto flex flex-col items-center justify-start bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-10 min-h-0 min-w-0 w-full`}
              >
                <div
                  className={`w-full max-w-4xl docx-rendered-sheet bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-xl rounded-xl p-8 sm:p-16 text-zinc-900 dark:text-zinc-100 my-4 min-h-[600px] shrink-0`}
                >
                  {isLoadingDocx ? (
                    <div className="flex flex-col items-center justify-center p-16 text-zinc-400 gap-3">
                      <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
                      <p className="text-sm font-medium">Rendering Word document...</p>
                    </div>
                  ) : docxHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: docxHtml }} />
                  ) : (
                    <p className="text-zinc-400">Document content unavailable.</p>
                  )}
                </div>
              </div>

              {/* Fullscreen Floating Minimal HUD */}
              {isModalFullscreen && (
                <div
                  className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl text-xs text-white transition-opacity duration-300 ${
                    isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <span className="font-semibold truncate max-w-[150px]">{file.name}</span>
                  {docxStats && (
                    <span className="text-zinc-400 font-mono hidden sm:inline">
                      {docxStats.words.toLocaleString()} words
                    </span>
                  )}
                  <div className="h-3 w-px bg-white/20" />
                  {docxStats && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(docxStats.text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 hover:text-blue-400 transition"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-1 hover:text-blue-400 transition"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalFullscreen(false)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-full transition text-xs shadow-xs"
                    title="Exit Full Screen (Esc)"
                  >
                    <Minimize2 size={13} />
                    <span>Exit (Esc)</span>
                  </button>
                </div>
              )}
            </div>
          ) : isPptx ? (
            /* POWERPOINT PPTX SLIDE DECK PREVIEW */
            <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden relative select-none">
              {/* Windowed Mode Top Bar */}
              {!isModalFullscreen && (
                <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-xs shrink-0">
                  <div className="flex items-center gap-3">
                    <Presentation size={16} className="text-amber-400" />
                    <span className="font-semibold text-white">{file.name}</span>
                    <span className="text-zinc-400">({slides.length} slides)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalFullscreen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition text-xs font-medium"
                      title="Present Slideshow Fullscreen"
                    >
                      <Maximize2 size={13} />
                      <span>Present</span>
                    </button>
                    <button
                      type="button"
                      disabled={currentSlideIndex === 0}
                      onClick={() => setCurrentSlideIndex((i) => Math.max(0, i - 1))}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition text-white"
                      title="Previous slide (Left Arrow)"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-3 font-mono text-xs tabular-nums text-zinc-300">
                      Slide {slides.length > 0 ? currentSlideIndex + 1 : 0} of {slides.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentSlideIndex >= slides.length - 1}
                      onClick={() => setCurrentSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition text-white"
                      title="Next slide (Right Arrow / Space)"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Current Slide Canvas (16:9 widescreen) - Presentation Mode with stable proportions */}
              <div
                className={`flex-1 overflow-auto flex items-center justify-center bg-zinc-950 ${
                  isModalFullscreen ? 'p-4 sm:p-8' : 'p-6 sm:p-10'
                }`}
              >
                {isLoadingPptx ? (
                  <div className="flex flex-col items-center gap-3 text-zinc-400">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    <p>Extracting presentation slides...</p>
                  </div>
                ) : slides.length > 0 ? (
                  <div
                    className={`w-full max-w-5xl aspect-video max-h-[85vh] bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 flex flex-col justify-between transition-all rounded-2xl border border-zinc-800 shadow-2xl ${
                      isModalFullscreen ? 'p-8 sm:p-14' : 'p-8 sm:p-12'
                    }`}
                  >
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                        Slide {currentSlideIndex + 1}
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white mt-3 leading-tight">
                        {slides[currentSlideIndex].title}
                      </h2>
                      <div className="mt-8 space-y-4">
                        {slides[currentSlideIndex].content.map((point, idx) => (
                          <div key={idx} className="flex items-start gap-3.5 text-base text-zinc-300 leading-relaxed">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-2 shrink-0 shadow-xs" />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 pt-6 border-t border-zinc-800/80">
                      <span>{file.name}</span>
                      <span className="font-mono">
                        {currentSlideIndex + 1} / {slides.length}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-zinc-400">
                    <Presentation size={36} className="mx-auto text-amber-500 mb-2 opacity-60" />
                    <p>No slides found in presentation.</p>
                  </div>
                )}
              </div>

              {/* Thumbnails Tray in Windowed Mode only */}
              {!isModalFullscreen && slides.length > 1 && (
                <div className="h-24 bg-zinc-900 border-t border-zinc-800 p-3 flex items-center gap-3 overflow-x-auto select-none shrink-0">
                  {slides.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentSlideIndex(idx)}
                      className={`h-full aspect-video rounded-lg border p-2 text-left flex flex-col justify-between shrink-0 transition ${
                        currentSlideIndex === idx
                          ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                          : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-zinc-400 font-bold">#{s.slideNumber}</span>
                      <span className="text-[11px] font-semibold text-zinc-200 truncate">{s.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Fullscreen Floating Presenter HUD */}
              {isModalFullscreen && (
                <div
                  className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl text-xs text-white transition-opacity duration-300 ${
                    isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    disabled={currentSlideIndex === 0}
                    onClick={() => setCurrentSlideIndex((i) => Math.max(0, i - 1))}
                    className="p-1 hover:bg-white/15 rounded-full disabled:opacity-30 transition"
                    title="Previous Slide (Left Arrow)"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-mono text-xs tabular-nums text-zinc-200 px-2">
                    Slide {slides.length > 0 ? currentSlideIndex + 1 : 0} of {slides.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentSlideIndex >= slides.length - 1}
                    onClick={() => setCurrentSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
                    className="p-1 hover:bg-white/15 rounded-full disabled:opacity-30 transition"
                    title="Next Slide (Right Arrow / Space)"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="h-3 w-px bg-white/20" />
                  <button
                    type="button"
                    onClick={() => setIsModalFullscreen(false)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-full transition text-xs shadow-xs"
                    title="Exit Presentation Mode (Esc)"
                  >
                    <Minimize2 size={13} />
                    <span>Exit (Esc)</span>
                  </button>
                </div>
              )}
            </div>
          ) : isArchive ? (
            /* ZIP ARCHIVE INSPECTOR & UNZIPPER */
            <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs">
                <div className="flex items-center gap-3">
                  <FolderArchive size={17} className="text-amber-500" />
                  <div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{file.name}</span>
                    <span className="text-zinc-400 ml-2">({zipEntries.length} items inside archive)</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Search inside archive */}
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search archive..."
                      value={zipSearch}
                      onChange={(e) => setZipSearch(e.target.value)}
                      className="pl-7 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none focus:border-amber-500 w-36 sm:w-48 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  {onExtractZip && (
                    <button
                      type="button"
                      disabled={isExtractingZip}
                      onClick={async () => {
                        if (!activeDataUrl) return;
                        setIsExtractingZip(true);
                        try {
                          await onExtractZip(file, activeDataUrl);
                        } finally {
                          setIsExtractingZip(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs transition shadow-xs disabled:opacity-50"
                    >
                      {isExtractingZip ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FolderOpen size={14} />
                      )}
                      <span>{isExtractingZip ? 'Extracting...' : 'Extract / Unzip to Drive'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Archive File List */}
              <div className="flex-1 overflow-auto relative">
                {isLoadingZip ? (
                  <div className="flex flex-col items-center justify-center p-12 text-zinc-400 gap-3">
                    <Loader2 className="animate-spin text-amber-500 w-8 h-8" />
                    <p>Reading archive contents...</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100 dark:bg-zinc-900/90 text-zinc-600 dark:text-zinc-400 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 font-medium">
                      <tr>
                        <th className="py-2.5 px-6">Name</th>
                        <th className="py-2.5 px-4">Path</th>
                        <th className="py-2.5 px-4">Size</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4 text-right pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                      {filteredZipEntries.map((entry, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                        >
                          <td className="py-2.5 px-6 font-sans">
                            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-medium">
                              {entry.isFolder ? (
                                <Folder size={15} className="text-amber-500 shrink-0" />
                              ) : (
                                <FileText size={15} className="text-blue-500 shrink-0" />
                              )}
                              <span className="truncate">{entry.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-zinc-500 truncate max-w-xs">{entry.relativePath}</td>
                          <td className="py-2.5 px-4 text-zinc-500 tabular-nums">
                            {entry.isFolder ? '-' : formatFileSize(entry.size)}
                          </td>
                          <td className="py-2.5 px-4 text-zinc-500">{entry.date.toLocaleDateString()}</td>
                          <td className="py-2.5 px-4 text-right pr-6">
                            {!entry.isFolder && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!activeDataUrl) return;
                                  setIsLoadingEntry(true);
                                  try {
                                    const res = await readZipEntryContent(activeDataUrl, entry.relativePath);
                                    setPreviewArchiveEntry({
                                      name: entry.name,
                                      content: res.text,
                                      dataUrl: res.dataUrl,
                                    });
                                  } catch (err) {
                                    console.warn('Could not preview zip entry', err);
                                  } finally {
                                    setIsLoadingEntry(false);
                                  }
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition"
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredZipEntries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-zinc-400 font-sans">
                            No matching items found in archive.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Inner Entry Preview Modal / Overlay */}
                {previewArchiveEntry && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 z-30">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                        <div className="flex items-center gap-2">
                          <FileText size={15} className="text-blue-500" />
                          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                            {previewArchiveEntry.name} (inside archive)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewArchiveEntry(null)}
                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="p-4 overflow-auto flex-1 font-mono text-xs leading-relaxed">
                        {previewArchiveEntry.dataUrl ? (
                          <div className="flex items-center justify-center p-4">
                            <img
                              src={previewArchiveEntry.dataUrl}
                              alt={previewArchiveEntry.name}
                              className="max-h-80 max-w-full rounded-lg object-contain shadow"
                            />
                          </div>
                        ) : previewArchiveEntry.content !== undefined ? (
                          <pre className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                            {previewArchiveEntry.content || '(Empty text)'}
                          </pre>
                        ) : (
                          <p className="text-zinc-400">Binary format preview unavailable inside zip.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : isVideo && activeDataUrl ? (
            /* VIDEO PREVIEW */
            <div className={`w-full h-full flex flex-col items-center justify-center relative ${isModalFullscreen ? 'p-0 bg-black' : 'p-6'}`}>
              <video
                src={activeDataUrl}
                controls
                className={`max-h-full max-w-full ${
                  isModalFullscreen
                    ? 'w-full h-full object-contain rounded-none shadow-none border-0 bg-black'
                    : 'rounded-xl shadow-2xl border border-zinc-300 dark:border-zinc-800 bg-black'
                }`}
              >
                Your browser does not support the video tag.
              </video>

              {isModalFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsModalFullscreen(false)}
                  className={`absolute top-4 right-4 z-40 flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-white border border-white/20 rounded-full shadow-2xl text-xs font-medium transition-all duration-300 backdrop-blur-md ${
                    isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                  title="Exit Full Screen (Esc)"
                >
                  <Minimize2 size={13} />
                  <span>Exit Full Screen (Esc)</span>
                </button>
              )}
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
          ) : isSpreadsheet && (activeSpreadsheetData || isLoadingXlsx) && !isEditingText ? (
            /* SPREADSHEET (EXCEL XLSX & CSV / TSV) TABULAR PREVIEW */
            <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-900 rounded-none overflow-hidden relative min-h-0 min-w-0">
              {isLoadingXlsx ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <p className="text-sm font-medium">Extracting Excel workbook sheets...</p>
                </div>
              ) : activeSpreadsheetData ? (
                <>
                  {/* Top toolbar */}
                  {!isModalFullscreen && (
                    <div className="flex flex-wrap items-center justify-between px-6 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-500 gap-3 shrink-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-2">
                          <Table size={16} className="text-emerald-500 shrink-0" />
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {activeSpreadsheetData.sheetName}
                          </span>
                        </div>
                        <span className="text-zinc-400 hidden sm:inline">·</span>
                        <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs hidden sm:inline">
                          {activeSpreadsheetData.headers.length} columns · {activeSpreadsheetData.totalRows} rows
                        </span>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Search inside sheet */}
                        <div className="relative flex items-center">
                          <Search size={12} className="absolute left-2.5 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Filter sheet..."
                            value={sheetSearch}
                            onChange={(e) => setSheetSearch(e.target.value)}
                            className="pl-7 pr-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs outline-none focus:border-emerald-500 w-28 sm:w-36 text-zinc-800 dark:text-zinc-200"
                          />
                        </div>

                        {isCsv && (
                          <button
                            type="button"
                            onClick={() => setIsEditingText(true)}
                            className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium transition"
                          >
                            Edit Raw Data
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setIsModalFullscreen(true)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium transition"
                          title="Distraction-Free Pure Fullscreen"
                        >
                          <Maximize2 size={12} />
                          <span className="hidden sm:inline">Pure View</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Multiple Sheet Tabs bar for Excel files */}
                  {xlsxSheets.length > 1 && (
                    <div className="flex items-center gap-1.5 px-6 py-2 bg-zinc-100/90 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto text-xs shrink-0 select-none">
                      <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mr-1">
                        Sheets:
                      </span>
                      {xlsxSheets.map((sh, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveXlsxSheetIndex(idx)}
                          className={`px-3 py-1 rounded-md font-medium text-xs transition shrink-0 ${
                            activeXlsxSheetIndex === idx
                              ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80'
                          }`}
                        >
                          {sh.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Pixel-Perfect Locked Spreadsheet Grid: border-separate + border-spacing-0 prevents any cell/letter detachment */}
                  <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900 min-h-0 min-w-0">
                    <table className="min-w-full text-left text-xs border-separate border-spacing-0 select-text">
                      <thead className="sticky top-0 z-20 shadow-2xs">
                        <tr>
                          <th className="px-3 py-2 border-r border-b border-zinc-300 dark:border-zinc-700 font-mono text-zinc-500 w-12 min-w-[48px] max-w-[48px] text-center sticky left-0 z-30 bg-zinc-200 dark:bg-zinc-800 select-none font-semibold">
                            #
                          </th>
                          {activeSpreadsheetData.headers.map((h, i) => (
                            <th
                              key={i}
                              className="px-4 py-2 border-r border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 font-semibold whitespace-nowrap min-w-[130px]"
                            >
                              <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider font-normal">
                                  Col {getColumnLetter(i)}
                                </span>
                                <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                                  {h || `Column ${getColumnLetter(i)}`}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y-0">
                        {filteredSpreadsheetRows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                          >
                            <td className="px-3 py-2 border-r border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-center select-none sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900 font-sans tabular-nums w-12 min-w-[48px] max-w-[48px]">
                              {rIdx + 1}
                            </td>
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-4 py-2 border-r border-b border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 whitespace-nowrap min-w-[130px] font-sans text-xs"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Fullscreen Floating Spreadsheet HUD */}
                  {isModalFullscreen && (
                    <div
                      className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl text-xs text-white transition-opacity duration-300 ${
                        isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
                      }`}
                    >
                      <span className="font-semibold truncate max-w-[150px]">
                        {activeSpreadsheetData.sheetName}
                      </span>
                      <span className="text-zinc-400 font-mono">
                        {activeSpreadsheetData.headers.length} cols · {activeSpreadsheetData.totalRows} rows
                      </span>
                      <div className="h-3 w-px bg-white/20" />
                      {isCsv && (
                        <button
                          type="button"
                          onClick={() => setIsEditingText(true)}
                          className="hover:text-emerald-400 transition"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="flex items-center gap-1 hover:text-emerald-400 transition"
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsModalFullscreen(false)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-full transition text-xs shadow-xs"
                        title="Exit Full Screen (Esc)"
                      >
                        <Minimize2 size={13} />
                        <span>Exit (Esc)</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-400 gap-3">
                  <Table size={48} className="text-emerald-500" />
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Unable to parse spreadsheet
                  </p>
                  <p className="text-xs text-zinc-500">The spreadsheet format could not be decoded.</p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                  >
                    Download Original Spreadsheet
                  </button>
                </div>
              )}
            </div>
          ) : isMarkdown && markdownViewMode === 'preview' && !isEditingText ? (
            /* MARKDOWN RENDERED PREVIEW */
            <div className="w-full h-full flex flex-col bg-white dark:bg-zinc-900 rounded-none overflow-hidden relative">
              {!isModalFullscreen && (
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
              )}
              <div className={`flex-1 overflow-auto ${isModalFullscreen ? 'p-6 sm:p-16 bg-zinc-950 text-zinc-100' : 'p-8 text-zinc-800 dark:text-zinc-200'} prose dark:prose-invert max-w-3xl mx-auto text-sm leading-relaxed space-y-4 font-sans`}>
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

              {/* Fullscreen Floating Markdown HUD */}
              {isModalFullscreen && (
                <div
                  className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl text-xs text-white transition-opacity duration-300 ${
                    isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <span className="font-semibold">{file.name}</span>
                  <div className="h-3 w-px bg-white/20" />
                  <button
                    type="button"
                    onClick={() => setMarkdownViewMode('raw')}
                    className="hover:text-blue-400 transition"
                  >
                    Raw Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingText(true)}
                    className="hover:text-blue-400 transition"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-1 hover:text-blue-400 transition"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalFullscreen(false)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-full transition text-xs shadow-xs"
                    title="Exit Full Screen (Esc)"
                  >
                    <Minimize2 size={13} />
                    <span>Exit (Esc)</span>
                  </button>
                </div>
              )}
            </div>
          ) : isCodeOrText ? (
            /* CODE / TEXT FILE PREVIEW WITH PRISM SYNTAX HIGHLIGHTING */
            <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-200 relative">
              {!isModalFullscreen && (
                <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 select-none">
                  <div className="flex items-center gap-3">
                    <Code size={15} className="text-indigo-400" />
                    <span className="font-mono text-zinc-200">{file.name}</span>
                    <span>·</span>
                    <span className="tabular-nums font-mono">{textContent.split('\n').length} lines</span>
                    <span>·</span>
                    <span className="tabular-nums font-mono">{textContent.length.toLocaleString()} chars</span>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Find in code */}
                    <div className="relative flex items-center gap-2">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Find in file..."
                        value={codeSearch}
                        onChange={(e) => setCodeSearch(e.target.value)}
                        className="pl-7 pr-3 py-1 bg-zinc-800/80 border border-zinc-700 rounded-lg text-xs outline-none focus:border-indigo-500 w-28 sm:w-36 text-zinc-200"
                      />
                      {codeSearch && (
                        <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                          {(textContent.toLowerCase().split(codeSearch.toLowerCase()).length - 1)} match(es)
                        </span>
                      )}
                    </div>

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
              )}

              <div className="flex-1 overflow-auto flex font-mono text-xs leading-6 bg-zinc-950">
                {/* Line Numbers Gutter: Sticky to left margin, scrolls vertically in 100% lockstep with code */}
                <div className="select-none py-4 px-3 sm:px-4 bg-zinc-950 text-zinc-600 border-r border-zinc-800/80 text-right sticky left-0 z-10 tabular-nums shrink-0">
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
                      wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre min-w-[600px]'
                    }`}
                    spellCheck={false}
                    autoFocus
                  />
                ) : (
                  <pre
                    className={`flex-1 p-4 text-zinc-100 font-mono text-xs leading-6 ${
                      wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre min-w-max'
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: highlightedCodeHtml || textContent || '(Empty file)',
                    }}
                  />
                )}
              </div>

              {/* Fullscreen Floating Code HUD */}
              {isModalFullscreen && (
                <div
                  className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-2xl text-xs text-white transition-opacity duration-300 ${
                    isControlsFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <span className="font-mono text-indigo-400 font-semibold">{file.name}</span>
                  <span className="text-zinc-400 font-mono">
                    {textContent.split('\n').length} lines
                  </span>
                  <div className="h-3 w-px bg-white/20" />
                  <button
                    type="button"
                    onClick={() => setWrapLines(!wrapLines)}
                    className="hover:text-blue-400 transition"
                  >
                    {wrapLines ? 'No Wrap' : 'Wrap'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="flex items-center gap-1 hover:text-blue-400 transition"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-1 hover:text-blue-400 transition"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalFullscreen(false)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-full transition text-xs shadow-xs"
                    title="Exit Full Screen (Esc)"
                  >
                    <Minimize2 size={13} />
                    <span>Exit (Esc)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* GENERIC FILE INFO CARD */
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
                  Format · {formatFileSize(file.size)}
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
                    {file.extension || 'none'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <Download size={14} />
                <span>Download File</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
