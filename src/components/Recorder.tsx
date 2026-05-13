'use client';
import { useRecorder } from '@/hooks/useRecorder';
import { useEffect } from 'react';

interface Props {
  onResult?: (blob: Blob, duration: number) => void;
  maxDuration?: number;
  className?: string;
}

export default function Recorder({ onResult, maxDuration = 300, className = '' }: Props) {
  const { state, duration, blob, blobUrl, error, supported, start, stop, reset } = useRecorder();

  useEffect(() => {
    if (maxDuration > 0 && duration >= maxDuration && state === 'recording') {
      stop();
    }
  }, [duration, maxDuration, state, stop]);

  useEffect(() => {
    if (blob && state === 'completed' && onResult) {
      onResult(blob, duration);
    }
  }, [blob, state, duration, onResult]);

  if (!supported) {
    return (
      <div className={`text-center py-4 text-red-500 text-sm ${className}`}>
        <p>⚠️ 您的浏览器不支持录音功能</p>
        <p className="text-gray-400 mt-1">请使用 Chrome 或 Safari 打开</p>
      </div>
    );
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* 录音按钮 */}
      {state === 'idle' && (
        <button
          onClick={start}
          className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 transition flex items-center justify-center shadow-lg"
          aria-label="开始录音"
        >
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
      )}

      {/* 录音中 */}
      {state === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 w-20 h-20 rounded-full bg-red-500 animate-ping opacity-30" />
            <button
              onClick={stop}
              className="relative w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 transition flex items-center justify-center shadow-lg z-10"
              aria-label="停止录音"
            >
              <div className="w-6 h-6 bg-white rounded-sm" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-lg font-mono tabular-nums text-gray-700">{fmtTime(duration)}</span>
          </div>
        </div>
      )}

      {/* 录音完成 */}
      {state === 'completed' && blobUrl && (
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="text-sm text-gray-500">录音时长 {fmtTime(duration)}</div>
          <audio src={blobUrl} controls className="w-full max-w-xs h-10" />
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition"
            >
              重新录制
            </button>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {state === 'error' && error && (
        <div className="text-center">
          <p className="text-red-500 text-sm mb-2">{error}</p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
