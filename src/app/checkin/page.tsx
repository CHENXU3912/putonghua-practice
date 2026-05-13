'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useCheckin } from '@/hooks/useCheckin';

export default function CheckinPage() {
  const { checkedIn, currentStreak, longestStreak, totalCheckins, dates, checkin } = useCheckin();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // Sunday=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dateSet = new Set(dates);
    const days: { day: number; checked: boolean; isToday: boolean }[] = [];

    for (let i = 0; i < firstDay; i++) days.push({ day: 0, checked: false, isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        checked: dateSet.has(dateStr),
        isToday: d === now.getDate(),
      });
    }
    return days;
  }, [dates, year, month, now]);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const handleCheckin = () => {
    const result = checkin();
    if (!result.checkedIn && !checkedIn) {
      // 如果今天还没打卡但是已经练习过了（通过自动打卡），手动打卡也去尝试
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="flex items-center mb-4">
        <Link href="/" className="text-gray-400 active:text-gray-600 mr-3">‹</Link>
        <h2 className="text-lg font-bold text-gray-900">打卡日历</h2>
      </div>

      {/* 统计 */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
        <div className="flex justify-around text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-3xl font-bold text-orange-500">{currentStreak}</div>
            <div className="text-xs text-gray-400 mt-1">连续打卡（天）</div>
          </div>
          <div className="w-px bg-gray-100" />
          <div>
            <div className="text-3xl font-bold text-gray-800">{longestStreak}</div>
            <div className="text-xs text-gray-400 mt-1">最长连续</div>
          </div>
          <div className="w-px bg-gray-100" />
          <div>
            <div className="text-3xl font-bold text-gray-800">{totalCheckins}</div>
            <div className="text-xs text-gray-400 mt-1">累计打卡</div>
          </div>
        </div>
      </div>

      {/* 打卡按钮 */}
      {!checkedIn ? (
        <button
          onClick={handleCheckin}
          className="w-full py-3.5 mb-5 bg-orange-500 text-white rounded-xl font-bold text-lg active:bg-orange-600 transition shadow-md"
        >
          🔥 今日打卡
        </button>
      ) : (
        <div className="w-full py-3.5 mb-5 bg-green-100 text-green-700 rounded-xl font-medium text-center">
          ✓ 今日已打卡
        </div>
      )}

      {/* 日历 */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="text-center font-semibold text-gray-700 mb-3">
          {year}年{month + 1}月
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(w => (
            <div key={w} className="text-center text-xs text-gray-400 py-1">{w}</div>
          ))}
          {calendarDays.map((d, i) => (
            <div key={i} className="aspect-square flex items-center justify-center">
              {d.day > 0 ? (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  d.checked
                    ? 'bg-green-500 text-white font-medium'
                    : d.isToday
                    ? 'border-2 border-green-500 text-gray-700 font-medium'
                    : 'text-gray-500'
                }`}>
                  {d.day}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* 图例 */}
      <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> 已打卡</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-green-500 inline-block" /> 今日</span>
      </div>
    </div>
  );
}
