import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  uploadToSupabase,
  fetchSupabaseFiles,
  deleteFromSupabase,
  renameInSupabase,
  moveInSupabase,
  updateContentInSupabase,
  isSupabaseConfigured,
  getLocalSupabaseFiles,
} from '../lib/supabase';
import { FileItem, ProviderConfig } from '../types';

const CHUNK_SIZE = 500 * 1024; // 500KB chunk size for base64
export const FIREBASE_MAX_STORAGE_BYTES = 1024 * 1024 * 1024; // 1 GiB (1,073,741,824 bytes)

const PROVIDER_STORAGE_KEY = 'cloudfile_provider_settings_v1';

let cachedFirebaseBytes = 0;
let forceSupabaseMode = false;

export function getStoredProviderConfig(): ProviderConfig {
  try {
    const raw = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        firebaseEnabled: parsed.firebaseEnabled !== false,
        supabaseEnabled: parsed.supabaseEnabled !== false,
      };
    }
  } catch {
    // fallback
  }
  return { firebaseEnabled: true, supabaseEnabled: true };
}

export function saveStoredProviderConfig(config: ProviderConfig) {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed saving provider configuration', e);
  }
}

export function setForceSupabaseMode(val: boolean) {
  forceSupabaseMode = val;
}

export function getForceSupabaseMode(): boolean {
  return forceSupabaseMode;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export function isTextFile(mimeType: string, extension: string): boolean {
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('xml') ||
    mimeType.includes('yaml') ||
    mimeType.includes('csv')
  ) {
    return true;
  }
  const textExtensions = [
    'txt', 'md', 'markdown', 'json', 'js', 'jsx', 'ts', 'tsx',
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'py', 'rb',
    'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php',
    'sh', 'bash', 'zsh', 'yaml', 'yml', 'xml', 'sql', 'csv',
    'tsv', 'log', 'env', 'conf', 'ini', 'dockerfile', 'gitignore',
    'svg',
  ];
  return textExtensions.includes(extension.toLowerCase());
}

// Unified subscription merging enabled providers
export function subscribeToUserFiles(
  userId: string,
  providerConfig: ProviderConfig,
  onUpdate: (files: FileItem[]) => void,
  onError: (error: Error) => void
) {
  let firebaseFiles: FileItem[] = [];
  let supabaseFiles: FileItem[] = [];

  const emitCombined = () => {
    const map = new Map<string, FileItem>();
    if (providerConfig.firebaseEnabled) {
      firebaseFiles.forEach((f) => map.set(f.id, f));
    }
    if (providerConfig.supabaseEnabled) {
      supabaseFiles.forEach((f) => map.set(f.id, f));
    }
    const combined = Array.from(map.values());

    cachedFirebaseBytes = firebaseFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    onUpdate(combined);
  };

  // If Supabase is enabled, fetch files
  if (providerConfig.supabaseEnabled) {
    fetchSupabaseFiles(userId).then((sFiles) => {
      supabaseFiles = sFiles;
      emitCombined();
    });
  } else {
    supabaseFiles = [];
    emitCombined();
  }

  // If Firebase is enabled, listen via onSnapshot
  if (providerConfig.firebaseEnabled) {
    const q = query(collection(db, 'files'), where('userId', '==', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const files: FileItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          files.push({
            id: docSnap.id,
            name: data.name || 'Untitled',
            isFolder: !!data.isFolder,
            parentId: data.parentId ?? null,
            size: Number(data.size || 0),
            mimeType: data.mimeType || 'application/octet-stream',
            extension: data.extension || '',
            userId: data.userId,
            dataUrl: data.dataUrl || undefined,
            textContent: data.textContent || undefined,
            isChunked: !!data.isChunked,
            totalChunks: data.totalChunks || 0,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
            provider: 'firebase',
          });
        });
        firebaseFiles = files;
        emitCombined();
      },
      (err) => {
        onError(err);
        handleFirestoreError(err, OperationType.LIST, 'files');
      }
    );

    return () => unsubscribe();
  } else {
    firebaseFiles = [];
    emitCombined();
    return () => {};
  }
}

// Manual database synchronization action
export async function syncDatabases(
  userId: string,
  providerConfig: ProviderConfig
): Promise<{ totalCount: number; firebaseCount: number; supabaseCount: number; timestamp: Date }> {
  let firebaseCount = 0;
  let supabaseCount = 0;

  if (providerConfig.firebaseEnabled) {
    try {
      const q = query(collection(db, 'files'), where('userId', '==', userId));
      const snap = await getDocs(q);
      firebaseCount = snap.size;
    } catch (e) {
      console.warn('Firebase manual sync query error', e);
    }
  }

  if (providerConfig.supabaseEnabled) {
    try {
      const sFiles = await fetchSupabaseFiles(userId);
      supabaseCount = sFiles.length;
    } catch (e) {
      console.warn('Supabase manual sync query error', e);
    }
  }

  return {
    totalCount: firebaseCount + supabaseCount,
    firebaseCount,
    supabaseCount,
    timestamp: new Date(),
  };
}

// Replicate a file from one provider to another
export async function replicateFileToOtherProvider(
  file: FileItem,
  targetProvider: 'firebase' | 'supabase',
  userId: string
): Promise<void> {
  if (targetProvider === 'supabase') {
    await uploadToSupabase({
      id: file.id + '_replica_' + Date.now().toString(36),
      name: file.name,
      isFolder: file.isFolder,
      parentId: file.parentId,
      size: file.size,
      mimeType: file.mimeType,
      extension: file.extension,
      userId,
      dataUrl: file.dataUrl,
      textContent: file.textContent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    const fileId = file.id + '_replica_' + Date.now().toString(36);
    const fileRef = doc(db, 'files', fileId);
    await setDoc(fileRef, {
      name: file.name,
      isFolder: file.isFolder,
      parentId: file.parentId,
      size: file.size,
      mimeType: file.mimeType,
      extension: file.extension,
      userId,
      textContent: file.textContent || null,
      dataUrl: file.dataUrl || null,
      isChunked: false,
      totalChunks: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export interface UploadResult {
  fileId: string;
  provider: 'firebase' | 'supabase';
  didFailover: boolean;
}

export async function uploadFile(
  file: File,
  userId: string,
  parentId: string | null,
  providerConfig: ProviderConfig,
  onProgress?: (percent: number, status: string) => void
): Promise<UploadResult> {
  if (!providerConfig.firebaseEnabled && !providerConfig.supabaseEnabled) {
    throw new Error('All storage providers are disabled. Please enable Firebase or Supabase in the Provider settings.');
  }

  onProgress?.(10, 'Reading file contents...');

  const extension = getFileExtension(file.name);
  const isText = isTextFile(file.type, extension);
  const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  let textContent: string | undefined;
  let dataUrl: string | undefined;

  try {
    if (isText && file.size < 800 * 1024) {
      textContent = await readFileAsText(file);
      if (file.type.includes('svg')) {
        dataUrl = await readFileAsDataUrl(file);
      }
    } else {
      dataUrl = await readFileAsDataUrl(file);
    }
  } catch (e) {
    console.error('Failed reading file contents', e);
  }

  onProgress?.(30, 'Selecting storage destination...');

  // Determine target provider based on enable/disable switches and quota
  let targetProvider: 'firebase' | 'supabase' = 'firebase';
  let didFailover = false;

  if (!providerConfig.firebaseEnabled && providerConfig.supabaseEnabled) {
    targetProvider = 'supabase';
  } else if (providerConfig.firebaseEnabled && !providerConfig.supabaseEnabled) {
    targetProvider = 'firebase';
    if (cachedFirebaseBytes + file.size > FIREBASE_MAX_STORAGE_BYTES) {
      throw new Error(
        'Firebase storage limit (1.0 GB) reached and Supabase failover is disabled. Enable Supabase to continue uploading.'
      );
    }
  } else {
    // Both are enabled: auto-failover if Firebase is full or user forced Supabase
    if (forceSupabaseMode || cachedFirebaseBytes + file.size > FIREBASE_MAX_STORAGE_BYTES) {
      targetProvider = 'supabase';
      didFailover = true;
    }
  }

  if (targetProvider === 'supabase') {
    onProgress?.(60, 'Saving to Supabase Database...');
    const saved = await uploadToSupabase({
      id: fileId,
      name: file.name,
      isFolder: false,
      parentId: parentId ?? null,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      extension,
      userId,
      dataUrl,
      textContent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    onProgress?.(100, 'Uploaded to Supabase');
    return { fileId: saved.id, provider: 'supabase', didFailover };
  }

  // Save to Firebase
  const fileRef = doc(db, 'files', fileId);
  const isLarge = dataUrl && dataUrl.length > 650 * 1024;

  try {
    if (isLarge && dataUrl) {
      const totalChunks = Math.ceil(dataUrl.length / CHUNK_SIZE);
      onProgress?.(35, `Creating multipart document (${totalChunks} chunks)...`);

      await setDoc(fileRef, {
        name: file.name,
        isFolder: false,
        parentId: parentId ?? null,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        extension,
        userId,
        isChunked: true,
        totalChunks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (let i = 0; i < totalChunks; i++) {
        const chunkPercent = Math.round(35 + ((i + 1) / totalChunks) * 60);
        onProgress?.(chunkPercent, `Uploading chunk ${i + 1} of ${totalChunks}...`);

        const chunkData = dataUrl.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkId = `chunk_${i.toString().padStart(4, '0')}`;
        const chunkRef = doc(db, `files/${fileId}/chunks`, chunkId);

        await setDoc(chunkRef, {
          fileId,
          chunkIndex: i,
          data: chunkData,
          userId,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      onProgress?.(60, 'Writing document to Firebase Firestore...');
      const payload: Record<string, any> = {
        name: file.name,
        isFolder: false,
        parentId: parentId ?? null,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        extension,
        userId,
        isChunked: false,
        totalChunks: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (textContent !== undefined) payload.textContent = textContent;
      if (dataUrl !== undefined) payload.dataUrl = dataUrl;

      await setDoc(fileRef, payload);
    }
    onProgress?.(100, 'Uploaded successfully');
    return { fileId, provider: 'firebase', didFailover: false };
  } catch (error: any) {
    // If Firebase errors out and Supabase is enabled, failover to Supabase
    if (providerConfig.supabaseEnabled) {
      console.warn('Firebase write failed. Automatic failover to Supabase triggered!');
      onProgress?.(70, 'Failing over to Supabase...');
      const saved = await uploadToSupabase({
        id: fileId,
        name: file.name,
        isFolder: false,
        parentId: parentId ?? null,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        extension,
        userId,
        dataUrl,
        textContent,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      onProgress?.(100, 'Uploaded to Supabase (Failover)');
      return { fileId: saved.id, provider: 'supabase', didFailover: true };
    }

    handleFirestoreError(error, OperationType.CREATE, `files/${fileId}`);
  }
}

export async function createFolder(
  name: string,
  userId: string,
  parentId: string | null,
  providerConfig: ProviderConfig
): Promise<string> {
  if (!providerConfig.firebaseEnabled && !providerConfig.supabaseEnabled) {
    throw new Error('All storage providers are disabled. Please enable a provider.');
  }

  const folderId = 'folder_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  const useSupabase = !providerConfig.firebaseEnabled || forceSupabaseMode;

  if (useSupabase) {
    await uploadToSupabase({
      id: folderId,
      name: name.trim(),
      isFolder: true,
      parentId: parentId ?? null,
      size: 0,
      mimeType: 'folder',
      extension: '',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return folderId;
  }

  const folderRef = doc(db, 'files', folderId);
  try {
    await setDoc(folderRef, {
      name: name.trim(),
      isFolder: true,
      parentId: parentId ?? null,
      size: 0,
      mimeType: 'folder',
      extension: '',
      userId,
      isChunked: false,
      totalChunks: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return folderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `files/${folderId}`);
  }
}

export async function createTextFile(
  name: string,
  content: string,
  userId: string,
  parentId: string | null,
  providerConfig: ProviderConfig
): Promise<string> {
  if (!providerConfig.firebaseEnabled && !providerConfig.supabaseEnabled) {
    throw new Error('All storage providers are disabled. Please enable a provider.');
  }

  const extension = getFileExtension(name) || 'txt';
  const finalName = name.includes('.') ? name : `${name}.txt`;
  const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  const size = new Blob([content]).size;

  const useSupabase =
    !providerConfig.firebaseEnabled ||
    forceSupabaseMode ||
    (providerConfig.supabaseEnabled && cachedFirebaseBytes + size > FIREBASE_MAX_STORAGE_BYTES);

  if (useSupabase) {
    await uploadToSupabase({
      id: fileId,
      name: finalName,
      isFolder: false,
      parentId: parentId ?? null,
      size,
      mimeType: 'text/plain',
      extension,
      textContent: content,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return fileId;
  }

  const fileRef = doc(db, 'files', fileId);
  try {
    await setDoc(fileRef, {
      name: finalName,
      isFolder: false,
      parentId: parentId ?? null,
      size,
      mimeType: 'text/plain',
      extension,
      textContent: content,
      userId,
      isChunked: false,
      totalChunks: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return fileId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `files/${fileId}`);
  }
}

export async function updateFileContent(
  target: FileItem | string,
  newContent: string,
  provider?: 'firebase' | 'supabase'
): Promise<void> {
  const fileId = typeof target === 'string' ? target : target.id;
  const isSupabase =
    typeof target === 'string' ? provider === 'supabase' : target.provider === 'supabase';

  if (isSupabase) {
    await updateContentInSupabase(fileId, newContent);
    return;
  }

  const fileRef = doc(db, 'files', fileId);
  try {
    await updateDoc(fileRef, {
      textContent: newContent,
      size: new Blob([newContent]).size,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `files/${fileId}`);
  }
}

export async function renameFileItem(
  target: FileItem | string,
  newName: string,
  provider?: 'firebase' | 'supabase'
): Promise<void> {
  const fileId = typeof target === 'string' ? target : target.id;
  const isSupabase =
    typeof target === 'string' ? provider === 'supabase' : target.provider === 'supabase';

  if (isSupabase) {
    await renameInSupabase(fileId, newName);
    return;
  }

  const fileRef = doc(db, 'files', fileId);
  const extension = getFileExtension(newName);
  try {
    await updateDoc(fileRef, {
      name: newName.trim(),
      extension,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `files/${fileId}`);
  }
}

export async function moveFileItem(
  target: FileItem | string,
  newParentId: string | null,
  provider?: 'firebase' | 'supabase'
): Promise<void> {
  const fileId = typeof target === 'string' ? target : target.id;
  const isSupabase =
    typeof target === 'string' ? provider === 'supabase' : target.provider === 'supabase';

  if (isSupabase) {
    await moveInSupabase(fileId, newParentId);
    return;
  }

  const fileRef = doc(db, 'files', fileId);
  try {
    await updateDoc(fileRef, {
      parentId: newParentId ?? null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `files/${fileId}`);
  }
}

export async function deleteFileItem(
  fileItem: FileItem,
  allFiles: FileItem[]
): Promise<void> {
  if (fileItem.provider === 'supabase') {
    await deleteFromSupabase(fileItem.id);
    return;
  }

  try {
    if (fileItem.isFolder) {
      const toDeleteIds: string[] = [fileItem.id];
      const findDescendants = (parentId: string) => {
        const children = allFiles.filter((f) => f.parentId === parentId);
        for (const child of children) {
          toDeleteIds.push(child.id);
          if (child.isFolder) {
            findDescendants(child.id);
          }
        }
      };
      findDescendants(fileItem.id);

      for (const id of toDeleteIds) {
        await deleteDoc(doc(db, 'files', id));
      }
    } else {
      if (fileItem.isChunked) {
        try {
          const chunksSnap = await getDocs(collection(db, `files/${fileItem.id}/chunks`));
          for (const chunkDoc of chunksSnap.docs) {
            await deleteDoc(chunkDoc.ref);
          }
        } catch (e) {
          console.warn('Error cleaning up chunks', e);
        }
      }
      await deleteDoc(doc(db, 'files', fileItem.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `files/${fileItem.id}`);
  }
}

export async function loadFullFileDataUrl(file: FileItem): Promise<string | null> {
  if (file.dataUrl) return file.dataUrl;

  // Supabase fallback check
  if (file.provider === 'supabase') {
    try {
      const localFiles = getLocalSupabaseFiles();
      const match = localFiles.find((f) => f.id === file.id);
      if (match?.dataUrl) return match.dataUrl;
      if (match?.textContent) {
        return `data:${match.mimeType || 'text/plain'};charset=utf-8,` + encodeURIComponent(match.textContent);
      }
    } catch (e) {
      console.warn('Error reading local Supabase file:', e);
    }
  }

  // Chunked Firebase file assembly
  if (file.isChunked && file.id && file.provider !== 'supabase') {
    try {
      const chunksCollection = collection(db, `files/${file.id}/chunks`);
      const chunksSnap = await getDocs(chunksCollection);

      if (!chunksSnap.empty) {
        const chunksList: { chunkIndex: number; data: string }[] = [];
        chunksSnap.forEach((d) => {
          const data = d.data();
          chunksList.push({
            chunkIndex: Number(data.chunkIndex ?? 0),
            data: data.data || '',
          });
        });

        chunksList.sort((a, b) => a.chunkIndex - b.chunkIndex);
        const assembled = chunksList.map((c) => c.data).join('');
        if (assembled) return assembled;
      }
    } catch (error) {
      console.warn('Could not load chunks for file:', error);
    }
  }

  // Direct Firestore doc fetch if dataUrl wasn't in memory
  if (file.id && file.provider !== 'supabase') {
    try {
      const docSnap = await getDoc(doc(db, 'files', file.id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.dataUrl) return data.dataUrl;
        if (data.textContent) {
          return `data:${data.mimeType || 'text/plain'};charset=utf-8,` + encodeURIComponent(data.textContent);
        }
      }
    } catch (e) {
      console.warn('Error fetching file document:', e);
    }
  }

  if (file.textContent) {
    return `data:${file.mimeType || 'text/plain'};charset=utf-8,` + encodeURIComponent(file.textContent);
  }

  return null;
}
