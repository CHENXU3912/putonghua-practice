'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Recorder from '@/components/Recorder';
import TTSButton from '@/components/TTSButton';
import ScoreDisplay from '@/components/ScoreDisplay';
import { scoreSyllable, compareCharByChar, cleanText } from '@/lib/scorer';
import { saveRecord } from '@/lib/db';
import { doCheckin } from '@/lib/storage';
import { useSpeechRecognition, isSTTSupported } from '@/hooks/useSpeechRecognition';
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
  const [results, setResults] = useState<UserResult[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [showWrongAdd, setShowWrongAdd] = useState(false);
  const lastDurationRef = useRef(0);
  const stt = useSpeechRecognition();
  const sttTranscriptRef = useRef('');
  const sttAvailable = isSTTSupported();
  // 每个字的判定结果：'idle' | 'judging' | 'correct' | 'wrong'
  const [judgeState, setJudgeState] = useState<'idle' | 'judging' | 'correct' | 'wrong'>('idle');
  const currentTranscriptRef = useRef('');

  const item = items[currentIdx] ?? null;

  const handleRecord = useCallback((_blob: Blob, duration: number) => {
    lastDurationRef.current = duration;
  }, []);

  // 录音停止后，等待 STT 结果自动判定
  useEffect(() => {
    if (stt.state === 'completed' && stt.transcript && judgeState === 'idle') {
      currentTranscriptRef.current = stt.transcript;
      setJudgeState('judging');
    }
  }, [stt.state, stt.transcript, judgeState]);

  // 自动判定逻辑
  useEffect(() => {
    if (judgeState !== 'judging' || !item) return;

    const transcript = cleanText(currentTranscriptRef.current);
    const isCorrect = transcript.includes(item.char);
    const duration = lastDurationRef.current || 1.5;

    setJudgeState(isCorrect ? 'correct' : 'wrong');
    lastDurationRef.current = 0;

    // 记录结果
    const newResult: UserResult = { itemId: item.id, audioDuration: duration, selfRating: isCorrect };
    const newResults = [...results, newResult];
    sttTranscriptRef.current += currentTranscriptRef.current;

    // 延迟后自动跳转
    const timer = setTimeout(() => {
      setJudgeState('idle');
      stt.reset();
      currentTranscriptRef.current = '';

      if (currentIdx < items.length - 1) {
        setResults(newResults);
        setCurrentIdx(currentIdx + 1);
      } else {
        // 全部完成
        const allTranscript = sttTranscriptRef.current;
        const s = scoreSyllable(items, newResults, allTranscript || undefined);
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
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [judgeState, item, currentIdx, results, items, stt]); // eslint-disable-line

  // 手动判定（STT 不可用时降级）
  const handleManual = useCallback((isCorrect: boolean) => {
    const duration = lastDurationRef.current || 1.5;
    lastDurationRef.current = 0;
    const newResults = [...results, { itemId: item!.id, audioDuration: duration, selfRating: isCorrect }];
    setResults(newResults);
    stt.reset();

    if (currentIdx < items.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      const allTranscript = sttTranscriptRef.current;
      const s = scoreSyllable(items, newResults, allTranscript || undefined);
      setScoreResult(s);
      setShowResult(true);
      saveRecord({ type: 'syllable', questionSummary: `单音节字词练习（${items.length}字）`, questionIds: items.map(i => i.id), audioDuration: Math.round(newResults.reduce((sum, r) => sum + r.audioDuration, 0)), score: s.score, scoreDetail: s.scoreDetail, wrongItems: s.wrongItems, createdAt: Date.now() });
      doCheckin();
      if (s.wrongItems.length > 0) setShowWrongAdd(true);
    }
  }, [currentIdx, items, results, item, stt.reset]); // eslint-disable-line

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
        {/* 逐字比对 */}
        <div className="bg-white rounded-xl p-4 shadow-sm text-sm">
          <h3 className="font-medium text-gray-700 mb-3">📋 逐字报告</h3>
          <div className="space-y-2">
            {items.map((it, i) => {
              const res = results[i];
              const ok = res ? res.selfRating : false;
              return (
                <div key={it.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                    {ok ? '✓' : '✗'}
                  </span>
                  <span className="text-lg font-bold text-gray-800 w-10">{it.char}</span>
                  <span className="text-sm text-gray-400">{it.pinyin}</span>
                  <div className="flex flex-wrap gap-1">
                    {it.errorType.slice(0, 2).map((t, j) => (
                      <span key={j} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-2xs">{t}</span>
                    ))}
                  </div>
                  {!ok && <span className="ml-auto text-red-400 text-xs">需练习</span>}
                </div>
              );
            })}
          </div>
        </div>
        {scoreResult.wrongItems.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-2">可改进的字词（{scoreResult.wrongItems.length}个）</h3>
            <div className="flex flex-wrap gap-2">
              {scoreResult.wrongItems.map((w, i) => (
                <span key={i} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm">{w.content} <span className="text-red-400 text-xs">{w.pinyin}</span></span>
              ))}
            </div>
          </div>
        )}
        {showWrongAdd && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-sm text-orange-700 mb-3">建议加入错音本反复练习</p>
            <Link href="/wrongbook" className="inline-block px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">前往错音本</Link>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setCurrentIdx(0); setResults([]); setShowResult(false); setScoreResult(null); setShowWrongAdd(false); sttTranscriptRef.current = ''; setJudgeState('idle'); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">再来一组</button>
          <button onClick={() => router.push('/')} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-50 transition">返回首页</button>
        </div>
      </div>
    );
  }

  const judgingBlock = (
    <div className="text-center transition-all duration-300">
      {judgeState === 'judging' && (
        <div className="flex items-center justify-center gap-2 text-blue-500">
          <span className="animate-spin text-lg">⏳</span>
          <span className="text-sm">AI 判定中...</span>
        </div>
      )}
      {judgeState === 'correct' && (
        <div className="animate-bounce text-green-500 text-2xl font-bold">✓ 正确！</div>
      )}
      {judgeState === 'wrong' && (
        <div className="text-red-400 text-sm">
          <span className="text-lg font-bold">✗ 需要注意</span>
          <div className="text-xs text-gray-400 mt-1">AI 识别：{cleanText(currentTranscriptRef.current) || '未识别到'}</div>
        </div>
      )}
    </div>
  );

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

      {/* 判定结果 */}
      <div className="mt-2 mb-2 h-14 flex items-center justify-center">
        {judgingBlock}
      </div>

      {/* 录音 + STT */}
      {judgeState === 'idle' && (
        <div className="mt-4 mb-4">
          <Recorder onResult={handleRecord} onStart={() => stt.start()} onStop={() => stt.stop()} maxDuration={30} />
        </div>
      )}

      {/* 手动判定（STT 不可用时） */}
      {!sttAvailable && judgeState === 'idle' && (
        <div className="flex gap-4 w-full max-w-xs mb-8">
          <button onClick={() => handleManual(true)} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition text-sm">✓ 读对了</button>
          <button onClick={() => handleManual(false)} className="flex-1 py-3 border border-red-300 text-red-500 rounded-xl font-medium active:bg-red-50 transition text-sm">✗ 不太对</button>
        </div>
      )}
    </div>
  );
}
