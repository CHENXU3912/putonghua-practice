'use client';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Recorder from '@/components/Recorder';
import ScoreDisplay from '@/components/ScoreDisplay';
import { scoreWord } from '@/lib/scorer';
import { saveRecord } from '@/lib/db';
import { doCheckin } from '@/lib/storage';
import type { WordItem, UserResult, ScoreResult } from '@/lib/types';
import wordData from '@/data/word.json';

function pickRandom(arr: WordItem[], count: number): WordItem[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function WordPage() {
  const router = useRouter();
  const [items] = useState<WordItem[]>(() => pickRandom(wordData as WordItem[], 10));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<UserResult[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [showWrongAdd, setShowWrongAdd] = useState(false);
  const lastDurationRef = useRef(0);

  const item = items[currentIdx] ?? null;

  const handleRecord = useCallback((_blob: Blob, duration: number) => {
    lastDurationRef.current = duration;
  }, []);

  const handleSelfRate = useCallback((isCorrect: boolean) => {
    const duration = lastDurationRef.current || 2.0;
    lastDurationRef.current = 0;
    const newResults = [...results, { itemId: item!.id, audioDuration: duration, selfRating: isCorrect }];
    setResults(newResults);

    if (currentIdx < items.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      const s = scoreWord(items, newResults);
      setScoreResult(s);
      setShowResult(true);

      saveRecord({
        type: 'word',
        questionSummary: `多音节词语练习（${items.length}词）`,
        questionIds: items.map(i => i.id),
        audioDuration: Math.round(newResults.reduce((sum, r) => sum + r.audioDuration, 0)),
        score: s.score,
        scoreDetail: s.scoreDetail,
        wrongItems: s.wrongItems,
        createdAt: Date.now(),
      });
      doCheckin();
      if (s.wrongItems.length > 0) setShowWrongAdd(true);
    }
  }, [currentIdx, items, results, item]);

  if (!item) {
    return (
      <div className="px-4 py-10 text-center text-gray-400">
        题库加载中...
        <div className="mt-4"><Link href="/" className="text-green-500">返回首页</Link></div>
      </div>
    );
  }

  if (showResult && scoreResult) {
    return (
      <div className="px-4 py-6 space-y-5">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">练习完成</h2>
          <p className="text-sm text-gray-400">多音节词语 · {items.length}词</p>
        </div>
        <ScoreDisplay result={scoreResult} />
        {scoreResult.wrongItems.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-2">本次可改进的词语（{scoreResult.wrongItems.length}个）</h3>
            <div className="flex flex-wrap gap-2">
              {scoreResult.wrongItems.map((w, i) => (
                <span key={i} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm">
                  {w.content} <span className="text-red-400 text-xs">{w.pinyin}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {showWrongAdd && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-sm text-orange-700 mb-3">建议将以上词语加入错音本</p>
            <Link href="/wrongbook" className="inline-block px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">前往错音本</Link>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setCurrentIdx(0); setResults([]); setShowResult(false); setScoreResult(null); setShowWrongAdd(false); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">再来一组</button>
          <button onClick={() => router.push('/')} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-50 transition">返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 flex flex-col items-center min-h-[80vh]">
      <div className="w-full flex items-center justify-between mb-8">
        <Link href="/" className="text-gray-400 active:text-gray-600">‹ 退出</Link>
        <div className="text-sm text-gray-500">多音节词语</div>
        <div className="text-sm text-gray-400">{currentIdx + 1}/{items.length}</div>
      </div>
      <div className="w-full h-1 bg-gray-200 rounded-full mb-8">
        <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${(currentIdx / items.length) * 100}%` }} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="text-5xl font-bold text-gray-900 text-center">{item.word}</div>
        <div className="text-xl text-gray-500">{item.pinyin}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {item.errorType.map((t, i) => (
            <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              t === '轻声' ? 'bg-gray-200 text-gray-600' :
              t === '儿化' ? 'bg-blue-100 text-blue-700' :
              t === '变调' ? 'bg-orange-100 text-orange-700' :
              t.includes('平舌') || t.includes('翘舌') ? 'bg-purple-100 text-purple-700' :
              'bg-green-100 text-green-700'
            }`}>{t}</span>
          ))}
        </div>
        {item.tips && <p className="text-xs text-gray-400 mt-2">{item.tips}</p>}
      </div>
      <div className="mt-8 mb-4">
        <Recorder maxDuration={15} onResult={handleRecord} />
      </div>
      <div className="flex gap-4 w-full max-w-xs mb-8">
        <button onClick={() => handleSelfRate(true)} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition text-sm">✓ 读对了</button>
        <button onClick={() => handleSelfRate(false)} className="flex-1 py-3 border border-red-300 text-red-500 rounded-xl font-medium active:bg-red-50 transition text-sm">✗ 不太对</button>
      </div>
    </div>
  );
}
