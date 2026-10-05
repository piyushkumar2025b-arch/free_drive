import React, { useState } from 'react';
import { X, Folder, CornerDownRight } from 'lucide-react';
import { FileItem } from '../types';

interface MoveModalProps {
  file: FileItem | null;
  folders: FileItem[];
  onClose: () => void;
  onMove: (fileId: string, newParentId: string | null) => Promise<void>;
}

export const MoveModal: React.FC<MoveModalProps> = ({ file, folders, onClose, onMove }) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(file?.parentId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!file) return null;

  // Prevent moving a folder into itself or its own descendants
  const validFolders = folders.filter((f) => {
    if (f.id === file.id) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onMove(file.id, selectedFolderId);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-sm w-full shadow-xl overflow-hidden p-5 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <CornerDownRight className="w-4 h-4 text-indigo-500" />
            <h3 id="move-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Move &ldquo;{file.name}&rdquo;
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Select destination folder:
          </p>

          <div className="max-h-56 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800">
            {/* Root folder option */}
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition ${
                selectedFolderId === null
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Folder size={15} className="text-amber-500" />
              <span>Root (Top level)</span>
            </button>

            {validFolders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFolderId(f.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition ${
                  selectedFolderId === f.id
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <Folder size={15} className="text-amber-500" />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedFolderId === file.parentId}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {isSubmitting ? 'Moving...' : 'Move Here'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
