'use client';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Recorder from '@/components/Recorder';
import TTSButton from '@/components/TTSButton';
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
  const [showResult, setShowResult] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [showWrongAdd, setShowWrongAdd] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [lastDuration, setLastDuration] = useState(0);
  const resultsRef = useRef<UserResult[]>([]);

  const item = items[currentIdx] ?? null;

  const handleRecordDone = useCallback((_blob: Blob, duration: number) => {
    setLastDuration(duration);
    setRecorded(true);
  }, []);

  const handleJudge = useCallback((isCorrect: boolean) => {
    resultsRef.current[currentIdx] = {
      itemId: item!.id,
      audioDuration: lastDuration,
      selfRating: isCorrect,
    };
    setRecorded(false);
    setLastDuration(0);

    if (currentIdx < items.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      const newResults = [...resultsRef.current];
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
  }, [currentIdx, items, item, lastDuration]);

  if (!item) return (<div className="px-4 py-10 text-center text-gray-400">题库加载中...<div className="mt-4"><Link href="/" className="text-green-500">返回首页</Link></div></div>);

  if (showResult && scoreResult) {
    return (
      <div className="px-4 py-6 space-y-5">
        <div className="text-center"><h2 className="text-lg font-bold text-gray-900">练习完成</h2><p className="text-sm text-gray-400">多音节词语 · {items.length}词</p></div>
        <ScoreDisplay result={scoreResult} />
        <div className="bg-white rounded-xl p-4 shadow-sm text-sm">
          <h3 className="font-medium text-gray-700 mb-3">📋 逐词报告</h3>
          <div className="space-y-2">
            {items.map((it, i) => {
              const res = resultsRef.current[i];
              const ok = res?.selfRating ?? false;
              return (
                <div key={it.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>{ok ? '✓' : '✗'}</span>
                  <span className="text-base font-bold text-gray-800">{it.word}</span>
                  <span className="text-sm text-gray-400">{it.pinyin}</span>
                  <div className="flex flex-wrap gap-1">
                    {it.errorType.slice(0, 2).map((t, j) => (<span key={j} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-2xs">{t}</span>))}
                  </div>
                  {!ok && <span className="ml-auto text-red-400 text-xs">需练习</span>}
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
          <button onClick={() => { setCurrentIdx(0); setShowResult(false); setScoreResult(null); setShowWrongAdd(false); resultsRef.current = []; setRecorded(false); setLastDuration(0); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">再来一组</button>
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
        <div className="flex items-center gap-3">
          <div className="text-5xl font-bold text-gray-900 text-center">{item.word}</div>
          <TTSButton text={item.word} size="md" />
        </div>
        <div className="text-xl text-gray-500">{item.pinyin}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {item.errorType.map((t, i) => (
            <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-medium ${t === '轻声' ? 'bg-gray-200 text-gray-600' : t === '儿化' ? 'bg-blue-100 text-blue-700' : t === '变调' ? 'bg-orange-100 text-orange-700' : t.includes('平舌') || t.includes('翘舌') ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{t}</span>
          ))}
        </div>
        {item.tips && <p className="text-xs text-gray-400 mt-1">{item.tips}</p>}
      </div>

      <div className="mt-8 mb-4">
        {!recorded ? (
          <Recorder key={currentIdx} onResult={handleRecordDone} maxDuration={10} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-sm text-gray-500">录音 {lastDuration.toFixed(1)} 秒</div>
            <div className="flex gap-4">
              <button onClick={() => handleJudge(true)} className="px-8 py-4 bg-green-500 text-white rounded-xl font-bold text-lg active:bg-green-600 transition shadow-md">
                ✓ 读对了
              </button>
              <button onClick={() => handleJudge(false)} className="px-8 py-4 border-2 border-red-300 text-red-500 rounded-xl font-bold text-lg active:bg-red-50 transition">
                ✗ 不太对
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
