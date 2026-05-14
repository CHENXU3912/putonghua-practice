'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Recorder from '@/components/Recorder';
import TTSButton from '@/components/TTSButton';
import ScoreDisplay from '@/components/ScoreDisplay';
import { scoreWord, cleanText, wordOrHomophoneMatch, buildPinyinMap, isUnusableForeignTranscript } from '@/lib/scorer';
import { saveRecord, addWrongBookItem } from '@/lib/db';
import { doCheckin } from '@/lib/storage';
import { useSpeechRecognition, isSTTSupported } from '@/hooks/useSpeechRecognition';
import type { WordItem, UserResult, ScoreResult } from '@/lib/types';
import wordData from '@/data/word.json';
import syllableData from '@/data/syllable.json';
import type { SyllableItem } from '@/lib/types';

const pinyinMap = buildPinyinMap(syllableData as SyllableItem[]);
type Judgment = { correct: boolean | null; transcript: string; reason?: 'foreign' | 'unsupported' };

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
  const [wrongItemIds, setWrongItemIds] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<'recording' | 'judging' | 'judged'>('recording');
  const [judgment, setJudgment] = useState<Judgment | null>(null);
  const stt = useSpeechRecognition();
  const sttAvailable = isSTTSupported();
  const resultsRef = useRef<UserResult[]>([]);
  const transcriptsRef = useRef<string[]>([]);
  const durationsRef = useRef<number[]>([]);

  const item = items[currentIdx] ?? null;

  const handleRecordDone = useCallback((_blob: Blob, duration: number) => {
    durationsRef.current[currentIdx] = duration;
    if (sttAvailable) {
      setPhase('judging');
    } else {
      setPhase('judged');
      setJudgment({ correct: null, transcript: '', reason: 'unsupported' });
    }
  }, [currentIdx, sttAvailable]);

  useEffect(() => {
    if (phase !== 'judging' || !sttAvailable) return;
    if (stt.state === 'completed') {
      const transcript = cleanText(stt.transcript || '');
      transcriptsRef.current[currentIdx] = transcript;
      if (isUnusableForeignTranscript(transcript, [...item!.word].length)) {
        setJudgment({ correct: null, transcript, reason: 'foreign' });
        setPhase('judged');
        return;
      }
      const correct = wordOrHomophoneMatch(pinyinMap, item!.word, item!.pinyin, transcript);
      setJudgment({ correct, transcript });
      setPhase('judged');
    }
  }, [phase, stt.state, stt.transcript, sttAvailable, currentIdx, item]);

  useEffect(() => {
    if (phase !== 'judging') return;
    const timer = setTimeout(() => {
      setJudgment({ correct: false, transcript: '' });
      setPhase('judged');
    }, 3000);
    return () => clearTimeout(timer);
  }, [phase, currentIdx]);

  const handleNext = useCallback(async () => {
    if (judgment?.correct === null) return;
    const isCorrect = judgment?.correct ?? false;
    resultsRef.current[currentIdx] = {
      itemId: item!.id,
      audioDuration: durationsRef.current[currentIdx] || 2.0,
      selfRating: isCorrect,
    };
    stt.reset();
    setJudgment(null);
    setPhase('recording');

    if (currentIdx < items.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      const newResults = [...resultsRef.current];
      const joinedTranscript = transcriptsRef.current.filter(Boolean).join('');
      const s = scoreWord(items, newResults, joinedTranscript || undefined);
      setScoreResult(s);
      const wrongSet = new Set<number>();
      s.wrongItems.forEach(w => {
        const idx = items.findIndex(it => it.word === w.content);
        if (idx >= 0) wrongSet.add(idx);
      });
      setWrongItemIds(wrongSet);
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
    }
  }, [currentIdx, items, item, judgment, stt]);

  const handleAddWrong = useCallback(async (idx: number) => {
    const it = items[idx];
    await addWrongBookItem({
      type: 'word',
      content: it.word,
      pinyin: it.pinyin,
      errorType: it.errorType,
      sourceType: 'word',
      lastScore: scoreResult?.score || 0,
      practiceCount: 0,
      consecutiveCorrect: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      masteredAt: null,
    });
    setWrongItemIds(prev => { const n = new Set(prev); n.delete(idx); return n; });
  }, [items, scoreResult]);

  const errorReason = item ? (
    item.errorType.includes('轻声') ? '轻声读法不正确' :
    item.errorType.includes('儿化') ? '儿化音读法不正确' :
    item.errorType.includes('变调') ? '变调不正确' :
    item.errorType.includes('平舌音') || item.errorType.includes('翘舌音') ? '平翘舌混淆' :
    item.errorType.includes('前鼻音') || item.errorType.includes('后鼻音') ? '前后鼻音混淆' :
    item.errorType.includes('边音(l)') || item.errorType.includes('鼻音(n)') ? 'n/l混淆' :
    item.errorType[0] || '发音需练习'
  ) : '';

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
                <div key={it.id} className={`flex items-center gap-3 py-2 px-2 rounded-lg ${ok ? '' : 'bg-red-50'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${ok ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>{ok ? '✓' : '✗'}</span>
                  <span className="text-base font-bold text-gray-800">{it.word}</span>
                  <span className="text-sm text-gray-400">{it.pinyin}</span>
                  <div className="flex-1 flex flex-wrap gap-1">
                    {it.errorType.map((t, j) => (<span key={j} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-2xs">{t}</span>))}
                  </div>
                  {!ok && (
                    <span className="text-xs text-red-500 whitespace-nowrap">
                      {it.errorType.includes('轻声') ? '轻声读法' :
                       it.errorType.includes('儿化') ? '儿化音' :
                       it.errorType.includes('变调') ? '变调' :
                       it.errorType[0] || '发音'}
                    </span>
                  )}
                  {!ok && wrongItemIds.has(i) && (
                    <button onClick={() => handleAddWrong(i)} className="ml-1 px-2 py-1 bg-orange-100 text-orange-600 rounded text-xs whitespace-nowrap active:bg-orange-200">+错音本</button>
                  )}
                  {!ok && !wrongItemIds.has(i) && <span className="text-xs text-green-500 ml-1">已添加</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setCurrentIdx(0); setShowResult(false); setScoreResult(null); resultsRef.current = []; transcriptsRef.current = []; durationsRef.current = []; setWrongItemIds(new Set()); setPhase('recording'); setJudgment(null); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">再来一组</button>
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

      <div className="mt-8 mb-4 w-full max-w-xs">
        {phase === 'recording' && (
          <Recorder key={currentIdx} onResult={handleRecordDone} onStart={() => stt.start()} onStop={() => stt.stop()} maxDuration={10} />
        )}

        {phase === 'judging' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="animate-spin text-2xl">⏳</span>
            <span className="text-sm text-blue-500">AI 判定中...</span>
          </div>
        )}

        {phase === 'judged' && (
          <div className="flex flex-col items-center gap-4 py-4">
            {judgment?.correct === true ? (
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <div className="text-xl font-bold text-green-600">正确</div>
                {judgment.transcript && <div className="text-xs text-gray-400 mt-1">AI 识别：{judgment.transcript}</div>}
              </div>
            ) : judgment?.correct === false ? (
              <div className="text-center">
                <div className="text-4xl mb-2">❌</div>
                <div className="text-xl font-bold text-red-500">需注意</div>
                {judgment.transcript ? (
                  <div className="text-xs text-gray-500 mt-1">AI 识别：{judgment.transcript}</div>
                ) : (
                  <div className="text-xs text-gray-400 mt-1">未识别到有效读音</div>
                )}
                <div className="mt-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm">
                  错误原因：{errorReason}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-4xl mb-2">🤔</div>
                <div className="text-lg font-bold text-gray-600">请手动确认</div>
                {judgment?.reason === 'foreign' ? (
                  <div className="text-xs text-gray-500 mt-1">AI 识别成英文：{judgment.transcript}</div>
                ) : (
                  <div className="text-xs text-gray-400 mt-1">AI 无法可靠判定本题</div>
                )}
                <div className="flex gap-3 mt-3">
                  <button onClick={() => { setJudgment({ correct: true, transcript: '' }); }} className="px-6 py-2 bg-green-500 text-white rounded-lg font-bold active:bg-green-600">✓ 正确</button>
                  <button onClick={() => { setJudgment({ correct: false, transcript: '' }); }} className="px-6 py-2 border-2 border-red-300 text-red-500 rounded-lg font-bold active:bg-red-50">✗ 错误</button>
                </div>
              </div>
            )}

            <button disabled={judgment?.correct === null} onClick={handleNext} className="mt-2 px-10 py-3 bg-green-500 text-white rounded-xl font-bold text-lg active:bg-green-600 transition shadow-md disabled:bg-gray-300 disabled:shadow-none">
              {currentIdx < items.length - 1 ? '下一题 →' : '完成，查看成绩'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
