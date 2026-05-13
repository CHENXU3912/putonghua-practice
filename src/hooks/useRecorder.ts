'use client';
import { useState, useRef, useCallback } from 'react';

export type RecorderState = 'idle' | 'recording' | 'completed' | 'error';

interface RecorderResult {
  state: RecorderState;
  duration: number;
  blob: Blob | null;
  blobUrl: string | null;
  error: string | null;
  supported: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useRecorder(): RecorderResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(() =>
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!supported) { setError('您的浏览器不支持录音功能'); setState('error'); return; }
    try {
      setError(null);
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mimeType });
        setBlob(b);
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        setBlobUrl(URL.createObjectURL(b));
        setState('completed');
        cleanup();
      };
      recorder.onerror = () => { setError('录音出错，请重试'); setState('error'); cleanup(); };
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 100);
      recorder.start();
      setState('recording');
    } catch (e) {
      if ((e as DOMException).name === 'NotAllowedError') {
        setError('请在浏览器设置中允许麦克风权限后刷新页面');
      } else {
        setError('无法访问麦克风：' + (e as Error).message);
      }
      setState('error');
    }
  }, [supported, blobUrl, cleanup]);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    if (blobUrl) { URL.revokeObjectURL(blobUrl); }
    setBlob(null);
    setBlobUrl(null);
    setDuration(0);
    setError(null);
    setState('idle');
    startTimeRef.current = 0;
  }, [blobUrl]);

  return { state, duration, blob, blobUrl, error, supported, start, stop, reset };
}
