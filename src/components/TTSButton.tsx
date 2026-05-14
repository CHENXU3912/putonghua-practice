'use client';
import { useState, useCallback } from 'react';

interface Props {
  text: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function TTSButton({ text, label, size = 'md', className = '' }: Props) {
  const [playing, setPlaying] = useState(false);

  const speak = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // 停止之前的朗读

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.75; // 稍慢，方便跟读
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);

    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }, [text]);

  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-lg';

  return (
    <button
      onClick={speak}
      className={`${sizeClass} rounded-full flex items-center justify-center transition active:scale-90 ${
        playing
          ? 'bg-green-500 text-white shadow-md'
          : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-600'
      } ${className}`}
      aria-label={label || `听${text}的标准发音`}
      title={label || `听${text}的标准发音`}
    >
      {playing ? '⏸' : '🔊'}
    </button>
  );
}
