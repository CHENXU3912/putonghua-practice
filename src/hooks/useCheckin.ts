'use client';
import { useState, useEffect, useCallback } from 'react';
import { getCheckinData, doCheckin, isCheckedInToday } from '@/lib/storage';

export function useCheckin() {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [checkedIn, setCheckedIn] = useState(false);
  const [dates, setDates] = useState<string[]>([]);

  const refresh = useCallback(() => {
    const data = getCheckinData();
    setDates(data.dates);
    setCurrentStreak(data.currentStreak);
    setLongestStreak(data.longestStreak);
    setTotalCheckins(data.dates.length);
    setCheckedIn(isCheckedInToday());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const checkin = useCallback(() => {
    const result = doCheckin();
    if (result.checkedIn) {
      refresh();
    }
    return result;
  }, [refresh]);

  return { checkedIn, currentStreak, longestStreak, totalCheckins, dates, checkin, refresh };
}
