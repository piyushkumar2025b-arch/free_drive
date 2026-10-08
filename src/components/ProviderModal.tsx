import React, { useState } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Copy,
  Layers,
  Check,
  AlertCircle,
} from 'lucide-react';
import { formatFileSize, FIREBASE_MAX_STORAGE_BYTES } from '../services/fileService';
import { isSupabaseConfigured } from '../lib/supabase';
import { ProviderConfig } from '../types';

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  firebaseBytes: number;
  supabaseFileCount: number;
  firebaseFileCount: number;
  forceSupabase: boolean;
  onToggleForceSupabase: (val: boolean) => void;
  providerConfig: ProviderConfig;
  onUpdateProviderConfig: (config: ProviderConfig) => void;
  onSyncNow: () => Promise<void>;
  onReplicateAll: (targetProvider: 'firebase' | 'supabase') => Promise<void>;
  isSyncing: boolean;
  lastSynced: Date | null;
}

export const ProviderModal: React.FC<ProviderModalProps> = ({
  isOpen,
  onClose,
  firebaseBytes,
  supabaseFileCount,
  firebaseFileCount,
  forceSupabase,
  onToggleForceSupabase,
  providerConfig,
  onUpdateProviderConfig,
  onSyncNow,
  onReplicateAll,
  isSyncing,
  lastSynced,
}) => {
  const [replicateStatus, setReplicateStatus] = useState<string | null>(null);
  const [providerWarning, setProviderWarning] = useState<string | null>(null);

  if (!isOpen) return null;

  const isFull = firebaseBytes >= FIREBASE_MAX_STORAGE_BYTES;
  const remainingFirebase = Math.max(0, FIREBASE_MAX_STORAGE_BYTES - firebaseBytes);
  const percentage = Math.min(100, (firebaseBytes / FIREBASE_MAX_STORAGE_BYTES) * 100);

  const toggleFirebase = () => {
    if (providerConfig.firebaseEnabled && !providerConfig.supabaseEnabled) {
      setProviderWarning('At least one database provider must remain enabled.');
      setTimeout(() => setProviderWarning(null), 3000);
      return;
    }
    setProviderWarning(null);
    onUpdateProviderConfig({
      ...providerConfig,
      firebaseEnabled: !providerConfig.firebaseEnabled,
    });
  };

  const toggleSupabase = () => {
    if (providerConfig.supabaseEnabled && !providerConfig.firebaseEnabled) {
      setProviderWarning('At least one database provider must remain enabled.');
      setTimeout(() => setProviderWarning(null), 3000);
      return;
    }
    setProviderWarning(null);
    onUpdateProviderConfig({
      ...providerConfig,
      supabaseEnabled: !providerConfig.supabaseEnabled,
    });
  };

  const handleReplicate = async (target: 'firebase' | 'supabase') => {
    setReplicateStatus(`Replicating files to ${target === 'supabase' ? 'Supabase' : 'Firebase'}...`);
    try {
      await onReplicateAll(target);
      setReplicateStatus(`Successfully backed up all files to ${target === 'supabase' ? 'Supabase' : 'Firebase'}!`);
      setTimeout(() => setReplicateStatus(null), 3500);
    } catch (e: any) {
      setReplicateStatus(`Replication failed: ${e.message || ''}`);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 sm:p-6"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Database size={19} />
            </div>
            <div>
              <h3 id="provider-modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Database Providers & Sync Configuration
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Control active databases, failover rules, and cloud synchronization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSyncing}
              onClick={onSyncNow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition disabled:opacity-50"
              title="Synchronize all enabled databases"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-500' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {providerWarning && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{providerWarning}</span>
          </div>
        )}

        {/* Sync Info Notification */}
        {lastSynced && (
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 px-1">
            <span>Last database sync: {lastSynced.toLocaleTimeString()}</span>
            <span>
              {providerConfig.firebaseEnabled && providerConfig.supabaseEnabled
                ? 'Dual-Database Redundancy Active'
                : providerConfig.firebaseEnabled
                ? 'Single Provider: Firebase Only'
                : 'Single Provider: Supabase Only'}
            </span>
          </div>
        )}

        {/* Providers List with Enable / Disable Toggles */}
        <div className="mt-4 space-y-4">
          {/* Provider 1: Firebase Firestore */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              providerConfig.firebaseEnabled
                ? 'border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Google Firebase Firestore
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  Primary Storage
                </span>
              </div>

              {/* Enable / Disable Toggle Switch */}
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-medium flex items-center gap-1 ${
                  providerConfig.firebaseEnabled
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}>
                  {providerConfig.firebaseEnabled ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Enabled</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={13} />
                      <span>Disabled</span>
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={toggleFirebase}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    providerConfig.firebaseEnabled ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                  title={providerConfig.firebaseEnabled ? 'Disable Firebase' : 'Enable Firebase'}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      providerConfig.firebaseEnabled ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Stored Files:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200 tabular-nums">
                  {firebaseFileCount} file{firebaseFileCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Free Tier Capacity:</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">1.0 GB (1,024 MB)</span>
              </div>
              <div className="flex justify-between">
                <span>Used:</span>
                <span className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                  {formatFileSize(firebaseBytes)} ({percentage.toFixed(2)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Remaining Free:</span>
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                  {formatFileSize(remainingFirebase)} free
                </span>
              </div>

              {/* Gauge */}
              <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isFull ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Provider 2: Supabase Database */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              providerConfig.supabaseEnabled
                ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/20'
                : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Supabase Database
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Secondary / Failover Storage
                </span>
              </div>

              {/* Enable / Disable Toggle Switch */}
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-medium flex items-center gap-1 ${
                  providerConfig.supabaseEnabled
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}>
                  {providerConfig.supabaseEnabled ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Enabled</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={13} />
                      <span>Disabled</span>
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={toggleSupabase}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    providerConfig.supabaseEnabled ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                  title={providerConfig.supabaseEnabled ? 'Disable Supabase' : 'Enable Supabase'}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      providerConfig.supabaseEnabled ? 'translate-x-4.5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Stored Files in Supabase:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200 tabular-nums">
                  {supabaseFileCount} file{supabaseFileCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SDK Driver Status:</span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {isSupabaseConfigured() ? '@supabase/supabase-js Live Connected' : 'Persistent Storage Adapter Ready'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
                {providerConfig.firebaseEnabled && providerConfig.supabaseEnabled
                  ? 'Active Failover Mode: When Firebase fills to 1.0 GB or encounters quota exhaustion, uploads automatically switch to Supabase.'
                  : providerConfig.supabaseEnabled
                  ? 'Direct Supabase Mode: All file uploads and queries are routed directly to Supabase.'
                  : 'Supabase is disabled. Files will only be stored in Firebase.'}
              </p>
            </div>
          </div>
        </div>

        {/* Manual Direct Toggle & Cross-Cloud Replication */}
        <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          {providerConfig.supabaseEnabled && providerConfig.firebaseEnabled && (
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 block">
                  Force Uploads to Supabase
                </span>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Direct new uploads to Supabase immediately even if Firebase has free space
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggleForceSupabase(!forceSupabase)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  forceSupabase ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    forceSupabase ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Cross-Cloud Replication Buttons */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3.5 border border-zinc-200/80 dark:border-zinc-700/60">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Cross-Cloud Synchronization & Replication
            </span>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2.5">
              Copy all files from one cloud provider to another to ensure complete bidirectional redundancy.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleReplicate('supabase')}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg transition flex items-center gap-1.5"
              >
                <Copy size={13} />
                <span>Replicate Firebase &rarr; Supabase</span>
              </button>
              <button
                type="button"
                onClick={() => handleReplicate('firebase')}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg transition flex items-center gap-1.5"
              >
                <Copy size={13} />
                <span>Replicate Supabase &rarr; Firebase</span>
              </button>
            </div>

            {replicateStatus && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                {replicateStatus}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-xl transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
