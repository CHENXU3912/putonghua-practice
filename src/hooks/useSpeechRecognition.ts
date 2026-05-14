'use client';
import { useState, useRef, useCallback } from 'react';

export type STTState = 'idle' | 'listening' | 'completed' | 'error';

interface STTResult {
  state: STTState;
  transcript: string;
  error: string | null;
  supported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

// 浏览器 API 类型声明
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// 浏览器前缀兼容
const SpeechRecognitionAPI: SpeechRecognitionConstructor | null =
  (typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
  null;

export function isSTTSupported(): boolean {
  return !!SpeechRecognitionAPI;
}

export function useSpeechRecognition(): STTResult {
  const [state, setState] = useState<STTState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const supported = !!SpeechRecognitionAPI;

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('您的浏览器不支持语音识别');
      setState('error');
      return;
    }
    try {
      setError(null);
      setTranscript('');
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        let final = '';
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        setTranscript(final || interim);
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'no-speech') {
          setError('未检测到语音，请再试一次');
        } else if (e.error === 'aborted') {
          // 正常停止，不报错
        } else {
          setError('语音识别出错：' + e.error);
        }
        setState('error');
      };

      recognition.onend = () => {
        if (state !== 'error') {
          setState('completed');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setState('listening');
    } catch (e) {
      setError('无法启动语音识别：' + (e as Error).message);
      setState('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      rec.stop();
      recognitionRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    setState('idle');
  }, []);

  return { state, transcript, error, supported, start, stop, reset };
}
