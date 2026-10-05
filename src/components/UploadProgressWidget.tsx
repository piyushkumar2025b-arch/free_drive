import React from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

export interface UploadProgressData {
  isOpen: boolean;
  totalFiles: number;
  currentFileIndex: number;
  currentFileName: string;
  currentFilePercent: number;
  overallPercent: number;
  statusText: string;
  isComplete: boolean;
  error?: string | null;
}

interface UploadProgressWidgetProps {
  progress: UploadProgressData;
  onClose: () => void;
}

export const UploadProgressWidget: React.FC<UploadProgressWidgetProps> = ({
  progress,
  onClose,
}) => {
  if (!progress.isOpen) return null;

  return (
    <div
      role="region"
      aria-label="File upload progress"
      className="fixed bottom-6 right-6 z-50 w-88 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-4 sm:p-5 animate-in slide-in-from-bottom-5 fade-in duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              progress.isComplete
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : progress.error
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
            }`}
          >
            {progress.isComplete ? (
              <CheckCircle2 size={18} />
            ) : progress.error ? (
              <AlertCircle size={18} />
            ) : (
              <UploadCloud size={18} className="animate-pulse" />
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {progress.isComplete
                ? `Upload complete (${progress.totalFiles} item${progress.totalFiles === 1 ? '' : 's'})`
                : progress.error
                ? 'Upload failed'
                : `Uploading ${progress.totalFiles > 1 ? `${progress.currentFileIndex} of ${progress.totalFiles}` : 'file'}`}
            </h4>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
              {progress.isComplete
                ? 'Saved securely to cloud storage'
                : progress.error || progress.currentFileName}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition"
          title="Dismiss progress"
        >
          <X size={15} />
        </button>
      </div>

      {/* Progress Bars & Status */}
      <div className="mt-3.5 space-y-2.5">
        {/* Percentage and step status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600 dark:text-zinc-400 text-[11px] flex items-center gap-1.5 truncate max-w-[240px]">
            {!progress.isComplete && !progress.error && (
              <Loader2 size={12} className="animate-spin text-blue-500 shrink-0" />
            )}
            <span className="truncate">{progress.statusText}</span>
          </span>
          <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums shrink-0">
            {progress.isComplete ? '100%' : `${progress.overallPercent}%`}
          </span>
        </div>

        {/* Primary Progress Bar */}
        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              progress.isComplete
                ? 'bg-emerald-500'
                : progress.error
                ? 'bg-rose-500'
                : 'bg-blue-600'
            }`}
            style={{ width: `${progress.isComplete ? 100 : progress.overallPercent}%` }}
          />
        </div>

        {/* Sub-bar for multi-file batches */}
        {progress.totalFiles > 1 && !progress.isComplete && (
          <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 pt-0.5">
            <span className="truncate">Current: {progress.currentFileName}</span>
            <span className="font-mono">{progress.currentFilePercent}%</span>
          </div>
        )}
      </div>
    </div>
  );
};
