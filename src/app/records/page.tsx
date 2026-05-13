'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRecords } from '@/hooks/useRecords';
import type { PracticeRecord } from '@/lib/types';

const typeFilters = [
  { key: 'all', label: '全部' },
  { key: 'syllable', label: '单音节' },
  { key: 'word', label: '多音节' },
  { key: 'article', label: '短文' },
  { key: 'speech', label: '命题说话' },
];

const typeLabel: Record<string, string> = {
  syllable: '单音节字词', word: '多音节词语', article: '短文朗读', speech: '命题说话',
};
const typeIcon: Record<string, string> = {
  syllable: '📝', word: '📚', article: '📖', speech: '🎙️',
};

function groupByDate(records: PracticeRecord[]): Map<string, PracticeRecord[]> {
  const map = new Map<string, PracticeRecord[]>();
  for (const r of records) {
    const dateStr = new Date(r.createdAt).toLocaleDateString('zh-CN');
    const arr = map.get(dateStr) || [];
    arr.push(r);
    map.set(dateStr, arr);
  }
  return map;
}

export default function RecordsPage() {
  const [filter, setFilter] = useState('all');
  const { records, loading, remove } = useRecords(filter === 'all' ? undefined : filter);

  const grouped = groupByDate(records);

  const handleDelete = useCallback(async (id: number) => {
    if (confirm('确定删除这条练习记录吗？录音也将被删除，不可恢复。')) {
      await remove(id);
    }
  }, [remove]);

  return (
    <div className="px-4 py-6">
      <div className="flex items-center mb-4">
        <Link href="/" className="text-gray-400 active:text-gray-600 mr-3">‹</Link>
        <h2 className="text-lg font-bold text-gray-900">练习记录</h2>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {typeFilters.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
              filter === t.key ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">加载中...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-400 text-sm">暂无练习记录</p>
          <Link href="/" className="inline-block mt-4 px-4 py-2 bg-green-500 text-white rounded-lg text-sm">去练习</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([date, items]) => (
            <div key={date}>
              <div className="text-sm text-gray-400 mb-2 ml-1">{date}</div>
              <div className="space-y-2">
                {items.map(r => (
                  <div key={r.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 group">
                    <span className="text-xl">{typeIcon[r.type] || '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{r.questionSummary}</div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>{typeLabel[r.type]}</span>
                        {r.audioDuration > 0 && <span>{Math.floor(r.audioDuration / 60)}分{r.audioDuration % 60}秒</span>}
                        {r.score > 0 && (
                          <span className={`font-medium ${
                            r.score >= 90 ? 'text-green-500' : r.score >= 75 ? 'text-blue-500' : r.score >= 60 ? 'text-orange-500' : 'text-red-500'
                          }`}>{r.score}分</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(r.id!)}
                      className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 text-xs"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
