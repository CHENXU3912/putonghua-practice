'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Recorder from '@/components/Recorder';
import TTSButton from '@/components/TTSButton';
import ScoreDisplay from '@/components/ScoreDisplay';
import { scoreArticle, cleanText, getCoverageRate, getArticleReadingReport } from '@/lib/scorer';
import { saveRecord } from '@/lib/db';
import { doCheckin } from '@/lib/storage';
import { useSpeechRecognition, isSTTSupported } from '@/hooks/useSpeechRecognition';
import type { ArticleItem, ScoreResult } from '@/lib/types';
import articleData from '@/data/article.json';

const articles = articleData as ArticleItem[];

export default function ArticlePage() {
  const router = useRouter();
  const [article] = useState<ArticleItem>(() => articles[Math.floor(Math.random() * articles.length)]);
  const [showTips, setShowTips] = useState(true);
  const [audioDuration, setAudioDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [selfRating, setSelfRating] = useState(3);
  const stt = useSpeechRecognition();
  const sttAvailable = isSTTSupported();

  const handleRecord = useCallback((b: Blob, duration: number) => {
    setBlob(b);
    setAudioDuration(duration);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(URL.createObjectURL(b));
  }, [blobUrl]);

  const handleSubmit = useCallback(() => {
    const s = scoreArticle(article, audioDuration, selfRating as 1|2|3|4|5, stt.transcript || undefined);
    setScoreResult(s);
    setShowResult(true);

    saveRecord({
      type: 'article',
      questionSummary: `短文朗读：${article.title}`,
      questionIds: [article.id],
      audioBlob: blob || undefined,
      audioDuration,
      score: s.score,
      scoreDetail: s.scoreDetail,
      wrongItems: s.wrongItems,
      createdAt: Date.now(),
    });
    doCheckin();
  }, [article, audioDuration, selfRating, blob, stt.transcript]);

  if (showResult && scoreResult) {
    const readingReport = stt.transcript ? getArticleReadingReport(article.content, stt.transcript) : null;

    return (
      <div className="px-4 py-6 space-y-5">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">朗读完成</h2>
          <p className="text-sm text-gray-400">{article.title}</p>
        </div>
        <ScoreDisplay result={scoreResult} />
        {stt.transcript && (
          <div className="bg-white rounded-xl p-4 shadow-sm text-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-700">逐字朗读报告</h3>
              <span className="text-xs text-gray-400">覆盖率 {getCoverageRate(article.content, stt.transcript, 4)}%</span>
            </div>
            {readingReport && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-600">{readingReport.matched}</div>
                    <div className="text-xs text-gray-500">匹配字数</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-red-500">{readingReport.missed}</div>
                    <div className="text-xs text-gray-500">漏读/疑错</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-blue-600">{readingReport.accuracy}%</div>
                    <div className="text-xs text-gray-500">顺序匹配</div>
                  </div>
                </div>

                {readingReport.missedSamples.length > 0 && (
                  <div className="text-xs text-red-500">
                    疑似漏读：{readingReport.missedSamples.join('、')}
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100 p-3 leading-8 text-base">
                  {readingReport.details.map((item, i) => (
                    <span
                      key={`${item.char}-${i}`}
                      className={
                        item.status === 'match'
                          ? 'text-green-700 bg-green-50'
                          : item.status === 'miss'
                            ? 'text-red-600 bg-red-50 underline decoration-red-300'
                            : 'text-gray-400'
                      }
                    >
                      {item.char}
                    </span>
                  ))}
                </div>
              </>
            )}
            <p className="text-xs text-gray-500">AI识别：{cleanText(stt.transcript).slice(0, 140)}{cleanText(stt.transcript).length > 140 ? '...' : ''}</p>
          </div>
        )}
        {blobUrl && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">本次录音</p>
            <audio src={blobUrl} controls className="w-full h-10" />
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setShowResult(false); setScoreResult(null); setBlob(null); setBlobUrl(null); setAudioDuration(0); stt.reset(); }} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">重新朗读</button>
          <button onClick={() => router.push('/')} className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-50 transition">返回首页</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-gray-400 active:text-gray-600">‹ 返回</Link>
        <div className="text-sm text-gray-500">短文朗读</div>
        <div className="w-10" />
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-2">{article.title}</h2>
      <p className="text-xs text-gray-400 mb-4">{article.wordCount}字 · 标准时长约{article.standardDuration}秒</p>

      {showTips && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-blue-700 mb-1">📖 朗读提示</h4>
              <p className="text-xs text-blue-600">{article.tips}</p>
            </div>
            <button onClick={() => setShowTips(false)} className="text-blue-400 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      {article.difficultWords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          {article.difficultWords.map((dw, i) => (
            <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs">
              {dw.char} ({dw.pinyin})
              <TTSButton text={dw.char} size="sm" />
            </span>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl p-5 shadow-sm mb-6">
        <div className="text-base leading-8 text-gray-800 whitespace-pre-wrap">
          {article.content.split('').map((char, i) => {
            const dw = article.difficultWords.find(d => {
              const pos = article.content.indexOf(d.char, Math.max(0, i - 2));
              return pos === i;
            });
            return dw ? <span key={i} className="text-red-500 font-medium">{char}</span> : char;
          })}
        </div>
      </div>

      <div className="mb-6">
        <Recorder onResult={handleRecord} onStart={() => stt.start()} onStop={() => stt.stop()} maxDuration={article.standardDuration * 2} />
      </div>

      {sttAvailable && stt.state === 'listening' && (
        <div className="text-center text-xs text-blue-500 animate-pulse mb-2">🤖 AI 正在识别...</div>
      )}
      {sttAvailable && stt.transcript && (
        <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-gray-600">
          🤖 已识别：{cleanText(stt.transcript).slice(0, 50)}{cleanText(stt.transcript).length > 50 ? '...' : ''}
        </div>
      )}

      {blob && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 mb-3">自我评估（1-5星）</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setSelfRating(s)} className={`text-3xl transition ${s <= selfRating ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
              ))}
            </div>
          </div>
          <button onClick={handleSubmit} className="w-full py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition">提交评分</button>
        </div>
      )}
    </div>
  );
}
