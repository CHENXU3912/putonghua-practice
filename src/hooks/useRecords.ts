'use client';
import { useState, useEffect, useCallback } from 'react';
import type { PracticeRecord } from '@/lib/types';
import { getRecords, getRecordById, deleteRecord } from '@/lib/db';

export function useRecords(type?: string) {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setRecords(await getRecords(type)); } catch { /* ignore */ }
    setLoading(false);
  }, [type]);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (id: number) => {
    await deleteRecord(id);
    await refresh();
  }, [refresh]);

  return { records, loading, refresh, remove };
}

export async function fetchRecordById(id: number): Promise<PracticeRecord | undefined> {
  return getRecordById(id);
}
