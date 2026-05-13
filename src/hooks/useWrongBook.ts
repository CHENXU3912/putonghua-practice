'use client';
import { useState, useEffect, useCallback } from 'react';
import type { WrongBookItem } from '@/lib/types';
import {
  getWrongBookItems, addWrongBookItem, deleteWrongBookItem, updateWrongBookItem,
} from '@/lib/db';

export function useWrongBook(type?: string, status?: string) {
  const [items, setItems] = useState<WrongBookItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getWrongBookItems(type, status));
    } catch { /* ignore */ }
    setLoading(false);
  }, [type, status]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (item: WrongBookItem) => {
    const result = await addWrongBookItem(item);
    await refresh();
    return result;
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await deleteWrongBookItem(id);
    await refresh();
  }, [refresh]);

  const update = useCallback(async (id: number, updates: Partial<WrongBookItem>) => {
    await updateWrongBookItem(id, updates);
    await refresh();
  }, [refresh]);

  const stats = {
    total: items.length,
    mastered: items.filter(i => i.status === 'mastered').length,
    learning: items.filter(i => i.status === 'learning').length,
    pending: items.filter(i => i.status === 'pending').length,
  };

  return { items, loading, stats, add, remove, update, refresh };
}
