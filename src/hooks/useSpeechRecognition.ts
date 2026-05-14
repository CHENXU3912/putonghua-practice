'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

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
  const finalTranscriptRef = useRef('');
  const shouldListenRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<STTState>('idle');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const publishTranscript = useCallback((interim = '') => {
    setTranscript(`${finalTranscriptRef.current} ${interim}`.trim());
  }, []);

  const pickBestTranscript = useCallback((result: SpeechRecognitionResult): string => {
    for (let i = 0; i < result.length; i++) {
      const candidate = result[i]?.transcript || '';
      if (/[\u4e00-\u9fff]/.test(candidate)) return candidate;
    }
    return result[0]?.transcript || '';
  }, []);

  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('您的浏览器不支持语音识别');
      setState('error');
      return;
    }
    if (!shouldListenRef.current) return;

    try {
      setError(null);
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 3;

      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const interimParts: string[] = [];
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const text = pickBestTranscript(result).trim();
          if (!text) continue;
          if (result.isFinal) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${text}`.trim();
          } else {
            interimParts.push(text);
          }
        }
        publishTranscript(interimParts.join(' '));
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'aborted') return;
        if ((e.error === 'no-speech' || e.error === 'network') && shouldListenRef.current) {
          return;
        }
        shouldListenRef.current = false;
        setError(e.error === 'not-allowed'
          ? '请在浏览器设置中允许麦克风和语音识别权限'
          : '语音识别出错：' + e.error);
        setState('error');
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        if (shouldListenRef.current && !stopRequestedRef.current) {
          restartTimerRef.current = setTimeout(startRecognition, 300);
          return;
        }
        if (stateRef.current !== 'error') {
          publishTranscript();
          setState('completed');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setState('listening');
    } catch (e) {
      if (shouldListenRef.current && !stopRequestedRef.current) {
        restartTimerRef.current = setTimeout(startRecognition, 600);
        return;
      }
      setError('无法启动语音识别：' + (e as Error).message);
      setState('error');
    }
  }, [pickBestTranscript, publishTranscript]);

  const start = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    finalTranscriptRef.current = '';
    shouldListenRef.current = true;
    stopRequestedRef.current = false;
    setTranscript('');
    setError(null);
    startRecognition();
  }, [startRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    stopRequestedRef.current = true;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
    } else if (stateRef.current !== 'error') {
      publishTranscript();
      setState('completed');
    }
  }, [publishTranscript]);

  const reset = useCallback(() => {
    shouldListenRef.current = false;
    stopRequestedRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    finalTranscriptRef.current = '';
    setTranscript('');
    setError(null);
    setState('idle');
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  return { state, transcript, error, supported, start, stop, reset };
}
