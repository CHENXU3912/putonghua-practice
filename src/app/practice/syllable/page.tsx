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
  // 每个字的录音时长
  const durationsRef = useRef<number[]>([]);
  // 每个字的 STT 文本
  const transcriptsRef = useRef<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const stt = useSpeechRecognition();
  const sttAvailable = isSTTSupported();

  const item = items[currentIdx] ?? null;

  // 录音完成回调：存储时长，自动跳下一个
  const handleRecordDone = useCallback((_blob: Blob, duration: number) => {
    durationsRef.current[currentIdx] = duration;
    // 收集 STT 识别文本
    if (stt.transcript) {
      transcriptsRef.current[currentIdx] = cleanText(stt.transcript);
    }
    stt.reset();
    setIsRecording(false);

    if (currentIdx < items.length - 1) {
      setTimeout(() => setCurrentIdx(currentIdx + 1), 400);
    } else {
      // 全部完成
      setTimeout(() => {
        const newResults: UserResult[] = items.map((it, i) => ({
          itemId: it.id,
          audioDuration: durationsRef.current[i] || 1.5,
          selfRating: true, // 默认值，STT 覆盖
        }));
        const joinedTranscript = transcriptsRef.current.filter(Boolean).join('');
        // 用 STT 逐字比对
        const expected = items.map(i => i.char).join('');
        const cmp = compareCharByChar(expected, joinedTranscript);
        // 更新 selfRating 为 STT 结果
        cmp.details.forEach((d, i) => {
          if (newResults[i]) newResults[i].selfRating = d.ok;
        });

        const s = scoreSyllable(items, newResults, joinedTranscript || undefined);
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
      }, 300);
    }
  }, [currentIdx, items, stt.transcript, stt.reset]);

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
        {/* 逐字报告 */}
        <div className="bg-white rounded-xl p-4 shadow-sm text-sm">
          <h3 className="font-medium text-gray-700 mb-3">📋 逐字报告</h3>
          <div className="space-y-2">
            {items.map((it, i) => {
              const ok = scoreResult.wrongItems.findIndex(w => w.content === it.char) === -1;
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
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <p className="text-sm text-orange-700 mb-3">建议加入错音本反复练习</p>
            <Link href="/wrongbook" className="inline-block px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">前往错音本</Link>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setCurrentIdx(0); setShowResult(false); setScoreResult(null); durationsRef.current = []; transcriptsRef.current = []; }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">再来一组</button>
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

      {/* 录音 */}
      <div className="mt-8 mb-4">
        <Recorder
          onResult={handleRecordDone}
          onStart={() => { setIsRecording(true); stt.start(); }}
          onStop={() => stt.stop()}
          maxDuration={10}
        />
      </div>

      {/* STT 实时反馈 */}
      {sttAvailable && isRecording && (
        <div className="text-center text-xs text-blue-500 animate-pulse mb-4">🤖 AI 聆听中...</div>
      )}
      {!sttAvailable && (
        <p className="text-xs text-gray-400 text-center mb-4">读完点击停止 → 自动下一个</p>
      )}
    </div>
  );
}
