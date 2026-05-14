'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Recorder from '@/components/Recorder';
import ScoreDisplay from '@/components/ScoreDisplay';
import { scoreSpeech, cleanText, checkKeywordsFuzzy } from '@/lib/scorer';
import { saveRecord } from '@/lib/db';
import { doCheckin } from '@/lib/storage';
import { useSpeechRecognition, isSTTSupported } from '@/hooks/useSpeechRecognition';
import type { SpeechItem, ScoreResult } from '@/lib/types';
import speechData from '@/data/speech.json';

const speeches = speechData as SpeechItem[];

export default function SpeakingPage() {
  const router = useRouter();
  const [speech] = useState<SpeechItem>(() => speeches[Math.floor(Math.random() * speeches.length)]);
  const [showOutline, setShowOutline] = useState(true);
  const [audioDuration, setAudioDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [selfRating, setSelfRating] = useState(3);
  const [outlineCoverage, setOutlineCoverage] = useState(3);
  const stt = useSpeechRecognition();
  const sttAvailable = isSTTSupported();

  const handleRecord = useCallback((b: Blob, duration: number) => {
    setBlob(b);
    setAudioDuration(duration);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(URL.createObjectURL(b));
  }, [blobUrl]);

  const handleSubmit = useCallback(() => {
    const s = scoreSpeech(speech, audioDuration, selfRating as 1|2|3|4|5, outlineCoverage as 1|2|3|4|5, stt.transcript || undefined);
    setScoreResult(s);
    setShowResult(true);

    saveRecord({
      type: 'speech',
      questionSummary: `命题说话：${speech.title}`,
      questionIds: [speech.id],
      audioBlob: blob || undefined,
      audioDuration,
      score: s.score,
      scoreDetail: s.scoreDetail,
      wrongItems: s.wrongItems,
      createdAt: Date.now(),
    });
    doCheckin();
  }, [speech, audioDuration, selfRating, outlineCoverage, blob, stt.transcript]);

  if (showResult && scoreResult) {
    const kwResult = stt.transcript ? checkKeywordsFuzzy(stt.transcript, speech.outline.map(o => o.slice(0, 5))) : null;

    return (
      <div className="px-4 py-6 space-y-5">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">说话完成</h2>
          <p className="text-sm text-gray-400">{speech.title}</p>
        </div>
        <ScoreDisplay result={scoreResult} />

        {stt.transcript && (
          <div className="bg-white rounded-xl p-4 shadow-sm text-sm space-y-2">
            <h3 className="font-medium text-gray-700">🤖 AI 内容检测</h3>
            <p className="text-xs text-gray-500">识别文本：{cleanText(stt.transcript).slice(0, 80)}{cleanText(stt.transcript).length > 80 ? '...' : ''}</p>
            {kwResult && (
              <div className="flex flex-wrap gap-2">
                {kwResult.details.map(d => (
                  <span key={d.kw} className={`px-2 py-1 rounded-full text-xs ${d.found ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {d.found ? '✓' : '?'} {d.kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {audioDuration < 120 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center text-sm text-orange-700">
            💡 建议说满3分钟，充分展开话题以锻炼表达能力
          </div>
        )}
        {blobUrl && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">本次录音 ({Math.floor(audioDuration / 60)}分{audioDuration % 60}秒)</p>
            <audio src={blobUrl} controls className="w-full h-10" />
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setShowResult(false); setScoreResult(null); setBlob(null); setBlobUrl(null); setAudioDuration(0); stt.reset(); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">重新练习</button>
          <button onClick={() => router.push('/')} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-50 transition">返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-gray-400 active:text-gray-600">‹ 返回</Link>
        <div className="text-sm text-gray-500">命题说话</div>
        <div className="w-10" />
      </div>

      <div className="text-center mb-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{speech.category}</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">{speech.title}</h2>
      <p className="text-xs text-gray-400 text-center mb-6">目标时长：3分钟</p>

      {showOutline && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-medium text-blue-700">📋 说话提纲</h4>
            <button onClick={() => setShowOutline(false)} className="text-blue-400 text-lg leading-none">×</button>
          </div>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            {speech.outline.map((o, i) => <li key={i}>{o}</li>)}
          </ol>
          <p className="text-xs text-blue-500 mt-2">{speech.tips}</p>
        </div>
      )}

      <div className="mb-6">
        <Recorder onResult={handleRecord} onStart={() => stt.start()} onStop={() => stt.stop()} maxDuration={180} />
        {audioDuration > 0 && (
          <p className="text-center text-sm text-gray-400 mt-2">
            已录制 {Math.floor(audioDuration / 60)}分{audioDuration % 60}秒
            {audioDuration >= 180 ? ' ✓ 已达标' : audioDuration < 120 ? ' ⚠️ 建议说满3分钟' : ''}
          </p>
        )}
      </div>

      {sttAvailable && stt.state === 'listening' && (
        <div className="text-center text-xs text-blue-500 animate-pulse mb-2">🤖 AI 正在识别...</div>
      )}
      {sttAvailable && stt.transcript && (
        <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-gray-600">
          🤖 已识别：{cleanText(stt.transcript).slice(0, 80)}{cleanText(stt.transcript).length > 80 ? '...' : ''}
        </div>
      )}

      {blob && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">流畅度自评</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setSelfRating(s)} className={`text-3xl transition ${s <= selfRating ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">提纲覆盖程度</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setOutlineCoverage(s)} className={`text-3xl transition ${s <= outlineCoverage ? 'text-blue-400' : 'text-gray-200'}`}>◆</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={handleSubmit} className="w-full py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">提交评分</button>
        </div>
      )}
    </div>
  );
}
