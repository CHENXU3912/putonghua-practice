import type { CheckinData, UserSettings } from './types';

// ===== 打卡数据 =====

const CHECKIN_KEY = 'putonghua_checkin';

export function getCheckinData(): CheckinData {
  if (typeof window === 'undefined') return { dates: [], currentStreak: 0, longestStreak: 0 };
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { dates: [], currentStreak: 0, longestStreak: 0 };
}

export function saveCheckinData(data: CheckinData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CHECKIN_KEY, JSON.stringify(data));
}

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getYesterdayStr(): string {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 执行打卡，返回更新后的打卡状态 */
export function doCheckin(): { checkedIn: boolean; currentStreak: number; longestStreak: number } {
  const data = getCheckinData();
  const today = getTodayStr();

  if (data.dates.includes(today)) {
    return { checkedIn: false, currentStreak: data.currentStreak, longestStreak: data.longestStreak };
  }

  data.dates.push(today);
  const yesterday = getYesterdayStr();

  if (data.dates.includes(yesterday) || data.currentStreak === 0) {
    data.currentStreak += 1;
  } else {
    data.currentStreak = 1;
  }

  if (data.currentStreak > data.longestStreak) {
    data.longestStreak = data.currentStreak;
  }

  saveCheckinData(data);
  return { checkedIn: true, currentStreak: data.currentStreak, longestStreak: data.longestStreak };
}

export function isCheckedInToday(): boolean {
  const data = getCheckinData();
  return data.dates.includes(getTodayStr());
}

// ===== 用户设置 =====

const SETTINGS_KEY = 'putonghua_settings';

export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return { fontSize: 'medium', autoPlay: false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { fontSize: 'medium', autoPlay: false };
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ===== 首次使用标记 =====

export function isFirstVisit(): boolean {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem('putonghua_visited');
}

export function markVisited(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('putonghua_visited', '1');
}
