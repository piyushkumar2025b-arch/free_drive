import React, { useState, useEffect } from 'react';
import { X, Edit2 } from 'lucide-react';
import { FileItem } from '../types';

interface RenameModalProps {
  file: FileItem | null;
  onClose: () => void;
  onRename: (fileId: string, newName: string) => Promise<void>;
}

export const RenameModal: React.FC<RenameModalProps> = ({ file, onClose, onRename }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (file) {
      setName(file.name);
    }
  }, [file]);

  if (!file) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === file.name) {
      onClose();
      return;
    }
    setIsSubmitting(true);
    try {
      await onRename(file.id, name.trim());
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
      aria-labelledby="rename-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-sm w-full shadow-xl overflow-hidden p-5 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-blue-500" />
            <h3 id="rename-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Rename {file.isFolder ? 'Folder' : 'File'}
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="rename-input" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              New Name
            </label>
            <input
              id="rename-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-lg outline-none focus:border-blue-500 text-zinc-900 dark:text-zinc-100"
            />
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
              disabled={!name.trim() || isSubmitting}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
