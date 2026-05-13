import type { PracticeRecord, WrongBookItem } from './types';

const DB_NAME = 'putonghua_db';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 不可用'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) {
        const recordsStore = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
        recordsStore.createIndex('type', 'type', { unique: false });
        recordsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('wrongbook')) {
        const wbStore = db.createObjectStore('wrongbook', { keyPath: 'id', autoIncrement: true });
        wbStore.createIndex('type', 'type', { unique: false });
        wbStore.createIndex('status', 'status', { unique: false });
        wbStore.createIndex('content', 'content', { unique: false });
      }
    };
  });
}

// ===== 练习记录 =====

export async function saveRecord(record: PracticeRecord): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getRecords(type?: string): Promise<PracticeRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const request = store.index('createdAt').openCursor(null, 'prev');
    const results: PracticeRecord[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const record = cursor.value;
        if (!type || type === 'all' || record.type === type) {
          results.push(record);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getRecordById(id: number): Promise<PracticeRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readonly');
    const store = tx.objectStore('records');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecord(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===== 错音本 =====

export async function addWrongBookItem(item: WrongBookItem): Promise<{ id: number; isNew: boolean }> {
  const db = await openDB();
  // 检查去重
  const existing = await getWrongBookByContent(item.content);
  const existingActive = existing.find(w => w.status !== 'mastered');

  if (existingActive) {
    return { id: existingActive.id!, isNew: false };
  }

  // 如果有已掌握的，重置为 learning
  const existingMastered = existing.find(w => w.status === 'mastered');
  if (existingMastered) {
    await updateWrongBookItem(existingMastered.id!, {
      status: 'learning',
      consecutiveCorrect: 0,
      updatedAt: Date.now(),
      masteredAt: null,
    });
    return { id: existingMastered.id!, isNew: true };
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongbook', 'readwrite');
    const store = tx.objectStore('wrongbook');
    const request = store.add(item);
    request.onsuccess = () => resolve({ id: request.result as number, isNew: true });
    request.onerror = () => reject(request.error);
  });
}

function getWrongBookByContent(content: string): Promise<WrongBookItem[]> {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    const tx = db.transaction('wrongbook', 'readonly');
    const store = tx.objectStore('wrongbook');
    const request = store.index('content').getAll(content);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getWrongBookItems(
  type?: string,
  status?: string
): Promise<WrongBookItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongbook', 'readonly');
    const store = tx.objectStore('wrongbook');
    const request = store.getAll();
    request.onsuccess = () => {
      let results = request.result;
      if (type && type !== 'all') {
        results = results.filter(r => r.type === type);
      }
      if (status && status !== 'all') {
        results = results.filter(r => r.status === status);
      }
      results.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateWrongBookItem(
  id: number,
  updates: Partial<WrongBookItem>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongbook', 'readwrite');
    const store = tx.objectStore('wrongbook');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) { reject(new Error('not found')); return; }
      Object.assign(item, updates);
      store.put(item);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteWrongBookItem(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongbook', 'readwrite');
    const store = tx.objectStore('wrongbook');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== 存储空间估算 =====

export async function getStorageEstimate(): Promise<{ usage: string; quota: string; percent: number }> {
  if (typeof navigator !== 'undefined' && 'storage' in navigator) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const fmt = (bytes: number) =>
      bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return {
      usage: fmt(usage),
      quota: fmt(quota),
      percent: quota > 0 ? Math.round((usage / quota) * 100) : 0,
    };
  }
  return { usage: '未知', quota: '未知', percent: 0 };
}
