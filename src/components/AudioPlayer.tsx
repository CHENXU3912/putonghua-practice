'use client';
interface Props {
  blobUrl: string;
  label?: string;
  className?: string;
}

export default function AudioPlayer({ blobUrl, label, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {label && <span className="text-sm text-gray-500">{label}</span>}
      <audio src={blobUrl} controls className="w-full max-w-xs h-10" />
    </div>
  );
}
