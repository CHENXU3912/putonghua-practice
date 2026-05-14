'use client';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Recorder from '@/components/Recorder';
import TTSButton from '@/components/TTSButton';
import ScoreDisplay from '@/components/ScoreDisplay';
import { scoreSyllable, compareCharByChar, cleanText } from '@/lib/scorer';
import { saveRecord } from '@/lib/db';
import { doCheckin } from '@/lib/storage';
import type { SyllableItem, UserResult, ScoreResult } from '@/lib/types';
import syllableData from '@/data/syllable.json';

function pickRandom(arr: SyllableItem[], count: number): SyllableItem[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function SyllablePage() {
  const router = useRouter();
  const [items] = useState<SyllableItem[]>(() => pickRandom(syllableData as SyllableItem[], 10));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [showWrongAdd, setShowWrongAdd] = useState(false);
  // ref 存储，不受重渲染影响
  const resultsRef = useRef<UserResult[]>([]);
  // 防止重复触发
  const advancingRef = useRef(false);
  // 本次录音时长
  const lastDurationRef = useRef(0);

  const item = items[currentIdx] ?? null;

  // 录音完成 → 自动前进
  const handleRecordDone = useCallback((_blob: Blob, duration: number) => {
    if (advancingRef.current) return; // 防重复
    advancingRef.current = true;
    lastDurationRef.current = duration;

    // 存储结果
    resultsRef.current[currentIdx] = {
      itemId: items[currentIdx].id,
      audioDuration: duration,
      selfRating: true,
    };

    if (currentIdx < items.length - 1) {
      setTimeout(() => {
        setCurrentIdx(prev => prev + 1);
        advancingRef.current = false;
      }, 500);
    } else {
      setTimeout(() => {
        advancingRef.current = false;
        finishAll();
      }, 500);
    }
  }, [currentIdx, items]); // eslint-disable-line

  const finishAll = useCallback(() => {
    const newResults = [...resultsRef.current];
    const expected = items.map(i => i.char).join('');
    const cmp = compareCharByChar(expected, '');
    cmp.details.forEach((d, i) => {
      if (newResults[i]) newResults[i].selfRating = d.ok;
    });
    const s = scoreSyllable(items, newResults);
    setScoreResult(s);
    setShowResult(true);
    saveRecord({
      type: 'syllable',
      questionSummary: `单音节字词练习（${items.length}字）`,
      questionIds: items.map(i => i.id),
      audioDuration: Math.round(newResults.reduce((sum, r) => sum + r.audioDuration, 0)),
      score: s.score,
      scoreDetail: s.scoreDetail,
      wrongItems: s.wrongItems,
      createdAt: Date.now(),
    });
    doCheckin();
    if (s.wrongItems.length > 0) setShowWrongAdd(true);
  }, [items]);

  if (!item) {
    return (<div className="px-4 py-10 text-center text-gray-400">题库加载中...<div className="mt-4"><Link href="/" className="text-green-500">返回首页</Link></div></div>);
  }

  if (showResult && scoreResult) {
    return (
      <div className="px-4 py-6 space-y-5">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">练习完成</h2>
          <p className="text-sm text-gray-400">单音节字词 · {items.length}字</p>
        </div>
        <ScoreDisplay result={scoreResult} />
        <div className="bg-white rounded-xl p-4 shadow-sm text-sm">
          <h3 className="font-medium text-gray-700 mb-3">📋 逐字报告</h3>
          <div className="space-y-2">
            {items.map((it, i) => {
              const res = resultsRef.current[i];
              const percent = res ? Math.min(100, Math.round((res.audioDuration / 1.5) * 50 + 50)) : 0;
              return (
                <div key={it.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-lg font-bold text-gray-800 w-10">{it.char}</span>
                  <span className="text-sm text-gray-400">{it.pinyin}</span>
                  <span className="text-xs text-gray-300">{res?.audioDuration ? `${res.audioDuration.toFixed(1)}秒` : '未录音'}</span>
                </div>
              );
            })}
          </div>
        </div>
        {scoreResult.wrongItems.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-sm text-orange-700 mb-3">建议加入错音本反复练习</p>
            <Link href="/wrongbook" className="inline-block px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">前往错音本</Link>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setCurrentIdx(0); setShowResult(false); setScoreResult(null); setShowWrongAdd(false); resultsRef.current = []; advancingRef.current = false; }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">再来一组</button>
          <button onClick={() => router.push('/')} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-50 transition">返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 flex flex-col items-center min-h-[80vh]">
      <div className="w-full flex items-center justify-between mb-8">
        <Link href="/" className="text-gray-400 active:text-gray-600">‹ 退出</Link>
        <div className="text-sm text-gray-500">单音节字词</div>
        <div className="text-sm text-gray-400">{currentIdx + 1}/{items.length}</div>
      </div>
      <div className="w-full h-1 bg-gray-200 rounded-full mb-8">
        <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${(currentIdx / items.length) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-7xl font-bold text-gray-900">{item.char}</div>
          <TTSButton text={item.char} size="sm" />
        </div>
        <div className="text-2xl text-gray-500">{item.pinyin}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {item.errorType.map((t, i) => (
            <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              t.includes('平舌') || t.includes('翘舌') ? 'bg-purple-100 text-purple-700' :
              t.includes('前鼻') || t.includes('后鼻') ? 'bg-blue-100 text-blue-700' :
              t.includes('边音') || t.includes('鼻音') ? 'bg-orange-100 text-orange-700' :
              t.includes('送气') || t.includes('不送气') ? 'bg-cyan-100 text-cyan-700' :
              t.includes('f/h') ? 'bg-pink-100 text-pink-700' :
              'bg-gray-100 text-gray-600'
            }`}>{t}</span>
          ))}
        </div>
        {item.tips && <p className="text-xs text-gray-400 mt-2">{item.tips}</p>}
      </div>

      {/* 录音 —— 用 key 强制每个字一个独立 Recorder */}
      <div className="mt-8 mb-4">
        <Recorder key={currentIdx} onResult={handleRecordDone} maxDuration={10} />
      </div>
      <p className="text-xs text-gray-400 text-center">先听 🔊 示范 → 点 🎤 录音 → 读完点停止 → 自动下一个</p>

      {currentIdx === items.length - 1 && (
        <button onClick={finishAll} className="mt-3 px-6 py-2 bg-green-500 text-white rounded-lg text-sm">提前结束，查看成绩</button>
      )}
    </div>
  );
}
