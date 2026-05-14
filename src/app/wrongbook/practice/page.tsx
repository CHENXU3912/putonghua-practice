'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Recorder from '@/components/Recorder';
import TTSButton from '@/components/TTSButton';
import { getWrongBookItems, updateWrongBookItem } from '@/lib/db';
import type { WrongBookItem } from '@/lib/types';

export default function WrongBookPracticePage() {
  const [items, setItems] = useState<WrongBookItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ practiced: 0, improved: 0 });

  useEffect(() => {
    getWrongBookItems(undefined, undefined).then(all => {
      const toPractice = all.filter(i => i.status !== 'mastered');
      setItems(toPractice);
      setLoading(false);
    });
  }, []);

  const item = items[currentIdx] ?? null;

  const handleSelfRate = useCallback(async (isCorrect: boolean) => {
    if (!item || item.id === undefined) return;
    const newConsecutive = isCorrect ? item.consecutiveCorrect + 1 : 0;
    const newStatus = newConsecutive >= 3 ? 'mastered' : 'learning';

    await updateWrongBookItem(item.id, {
      practiceCount: item.practiceCount + 1,
      consecutiveCorrect: newConsecutive,
      status: newStatus,
      updatedAt: Date.now(),
      masteredAt: newStatus === 'mastered' ? Date.now() : item.masteredAt,
    });

    setStats(s => ({
      practiced: s.practiced + 1,
      improved: s.improved + (isCorrect ? 1 : 0),
    }));

    if (currentIdx < items.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setDone(true);
    }
  }, [currentIdx, items, item]);

  if (loading) {
    return <div className="px-4 py-10 text-center text-gray-400">加载中...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <p className="text-gray-500 font-medium">没有待复习的错音</p>
        <p className="text-gray-400 text-sm mt-1">所有错音都已掌握</p>
        <Link href="/wrongbook" className="inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded-lg text-sm">返回错音本</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="px-4 py-10 text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="text-lg font-bold text-gray-900">错音复练完成</h2>
        <div className="text-sm text-gray-500">
          <p>本次练习 {stats.practiced} 个错音</p>
          <p>读对 {stats.improved} 个</p>
        </div>
        <Link href="/wrongbook" className="inline-block px-5 py-3 bg-green-500 text-white rounded-xl font-medium">返回错音本</Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 flex flex-col items-center min-h-[80vh]">
      <div className="w-full flex items-center justify-between mb-8">
        <Link href="/wrongbook" className="text-gray-400 active:text-gray-600">‹ 返回</Link>
        <div className="text-sm text-gray-500">错音复练</div>
        <div className="text-sm text-gray-400">{currentIdx + 1}/{items.length}</div>
      </div>

      <div className="w-full h-1 bg-gray-200 rounded-full mb-8">
        <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${(currentIdx / items.length) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-5xl font-bold text-gray-900">{item!.content}</div>
          <TTSButton text={item!.content} size="sm" />
        </div>
        <div className="text-xl text-gray-500">{item!.pinyin}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {item!.errorType.map((t, i) => (
            <span key={i} className="px-2.5 py-1 bg-red-50 text-red-500 rounded-full text-xs font-medium">{t}</span>
          ))}
        </div>
        <div className="text-xs text-gray-400">
          已练习 {item!.practiceCount} 次 · 连续正确 {item!.consecutiveCorrect} 次
          {item!.consecutiveCorrect >= 2 && <span className="text-green-500 ml-1">（再正确1次即可掌握！）</span>}
        </div>
      </div>

      <div className="mt-8 mb-4">
        <Recorder maxDuration={30} />
      </div>

      <div className="flex gap-4 w-full max-w-xs mb-8">
        <button onClick={() => handleSelfRate(true)} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition text-sm">✓ 读对了</button>
        <button onClick={() => handleSelfRate(false)} className="flex-1 py-3 border border-red-300 text-red-500 rounded-xl font-medium active:bg-red-50 transition text-sm">✗ 不太对</button>
      </div>
    </div>
  );
}
