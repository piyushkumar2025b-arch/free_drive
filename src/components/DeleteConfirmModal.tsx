import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { FileItem } from '../types';

interface DeleteConfirmModalProps {
  file: FileItem | null;
  onClose: () => void;
  onConfirm: (file: FileItem) => Promise<void>;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  file,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!file) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(file);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-sm w-full shadow-xl overflow-hidden p-5 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 id="delete-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Delete {file.isFolder ? 'Folder' : 'File'}
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

        <div className="mt-4 space-y-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Are you sure you want to delete <strong className="text-zinc-800 dark:text-zinc-200">&ldquo;{file.name}&rdquo;</strong>?
            {file.isFolder && (
              <span className="block mt-1 text-rose-600 dark:text-rose-400">
                Warning: All files and subfolders inside this folder will also be permanently deleted.
              </span>
            )}
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="px-4 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
