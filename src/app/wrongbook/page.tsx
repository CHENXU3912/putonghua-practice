'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useWrongBook } from '@/hooks/useWrongBook';
import type { WrongBookItem } from '@/lib/types';

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'syllable', label: '单音节' },
  { key: 'word', label: '多音节' },
  { key: 'learning', label: '未掌握' },
  { key: 'mastered', label: '已掌握' },
];

const statusLabel: Record<string, string> = { pending: '待复习', learning: '学习中', mastered: '已掌握' };
const statusColor: Record<string, string> = { pending: 'bg-gray-100 text-gray-600', learning: 'bg-orange-100 text-orange-600', mastered: 'bg-green-100 text-green-600' };

export default function WrongBookPage() {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const type = filterType === 'learning' || filterType === 'mastered' ? 'all' : filterType;
  const status = filterType === 'learning' ? 'learning' : filterType === 'mastered' ? 'mastered' : filterStatus !== 'all' ? filterStatus : undefined;

  const { items, loading, stats, remove } = useWrongBook(type, status);

  const handleDelete = async (id: number, content: string) => {
    if (confirm(`确定删除"${content}"吗？`)) {
      await remove(id);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-gray-400 active:text-gray-600">‹ 首页</Link>
        <h2 className="text-lg font-bold text-gray-900">错音本</h2>
        <Link href="/wrongbook/practice" className="text-sm text-green-500 font-medium active:text-green-600">
          练习全部
        </Link>
      </div>

      {/* 统计 */}
      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex justify-around text-center">
          <StatBox value={stats.total} label="总计" />
          <StatBox value={stats.mastered} label="已掌握" color="text-green-600" />
          <StatBox value={stats.learning + stats.pending} label="待复习" color="text-orange-500" />
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setFilterType(t.key); setFilterStatus('all'); }}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
              filterType === t.key ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400 text-sm">错音本为空</p>
          <p className="text-gray-300 text-xs mt-1">练习时标记"不太对"的字词会自动加入</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded-lg text-sm">去练习</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl font-bold text-gray-900">{item.content}</span>
                  <span className="text-sm text-gray-400">{item.pinyin}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor[item.status]}`}>
                    {statusLabel[item.status]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {item.errorType.map((t, i) => (
                    <span key={i} className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-400">
                  练习 {item.practiceCount} 次 · 最近 {item.lastScore} 分
                </div>
              </div>
              <button
                onClick={() => handleDelete(item.id!, item.content)}
                className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 text-sm"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 练习全部按钮 */}
      {items.filter(i => i.status !== 'mastered').length > 0 && (
        <div className="mt-6">
          <Link
            href="/wrongbook/practice"
            className="block w-full py-3 bg-green-500 text-white rounded-xl font-medium text-center active:bg-green-600 transition"
          >
            练习全部未掌握（{items.filter(i => i.status !== 'mastered').length}个）
          </Link>
        </div>
      )}
    </div>
  );
}

function StatBox({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${color || 'text-gray-800'}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
