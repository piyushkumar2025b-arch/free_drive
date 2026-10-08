import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  X,
  ArrowRight,
} from 'lucide-react';
import { FileItem } from '../types';
import { verifyFilePassword } from '../services/fileService';
import { FileIcon } from './FileIcon';

interface UnlockPasswordModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUnlockSuccess: (file: FileItem) => void;
}

export const UnlockPasswordModal: React.FC<UnlockPasswordModalProps> = ({
  file,
  isOpen,
  onClose,
  onUnlockSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (file && isOpen) {
      setPassword('');
      setError(null);
      setShowPassword(false);
    }
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the password.');
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);
      const isMatch = await verifyFilePassword(password, file.passwordHash || '');
      if (isMatch) {
        onUnlockSuccess(file);
        onClose();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch {
      setError('Verification error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <X size={16} />
        </button>

        <div className="p-6 text-center space-y-4">
          {/* Lock Icon + Thumbnail */}
          <div className="relative inline-block mx-auto mt-2">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-2xs">
              <FileIcon
                isFolder={file.isFolder}
                mimeType={file.mimeType}
                extension={file.extension}
                size={34}
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs border-2 border-white dark:border-zinc-900">
              <Lock size={13} />
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Password Protected {file.isFolder ? 'Folder' : 'File'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto truncate" title={file.name}>
              {file.name}
            </p>
          </div>

          {/* Optional Password Hint */}
          {file.passwordHint && (
            <div className="p-2.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 rounded-xl text-left text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <HelpCircle size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-[11px] text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                  Password Hint
                </span>
                <span className="text-xs">{file.passwordHint}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2 text-left">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1 text-left">
            <div>
              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                Enter Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to unlock"
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 pr-10 text-xs bg-zinc-50 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isVerifying || !password}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
              >
                <span>{isVerifying ? 'Checking...' : 'Unlock & Open'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
