import type { ScoreResult } from '@/lib/types';

const gradeColor: Record<string, string> = {
  '优秀': 'text-green-600',
  '良好': 'text-blue-600',
  '一般': 'text-orange-500',
  '需加强': 'text-red-500',
};

const gradeBg: Record<string, string> = {
  '优秀': 'bg-green-50',
  '良好': 'bg-blue-50',
  '一般': 'bg-orange-50',
  '需加强': 'bg-red-50',
};

const gradeStars: Record<string, string> = {
  '优秀': '⭐⭐⭐',
  '良好': '⭐⭐',
  '一般': '⭐',
  '需加强': '',
};

interface Props {
  result: ScoreResult;
  compact?: boolean;
}

export default function ScoreDisplay({ result, compact = false }: Props) {
  const { score, grade, scoreDetail, suggestions } = result;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 总分 */}
      <div className={`text-center ${compact ? '' : 'py-2'}`}>
        <div className={`${compact ? 'text-5xl' : 'text-6xl'} font-bold ${gradeColor[grade] || 'text-gray-700'}`}>
          {score}
        </div>
        <div className={`text-lg mt-1 font-medium ${gradeColor[grade] || 'text-gray-700'}`}>
          {gradeStars[grade] || ''} {grade}
        </div>
      </div>

      {/* 分项 */}
      {!compact && (
        <div className={`w-full rounded-xl p-4 ${gradeBg[grade] || 'bg-gray-50'}`}>
          <div className="space-y-2 text-sm">
            <ScoreBar label="时长得分" value={scoreDetail.durationScore} />
            <ScoreBar label="完整度" value={scoreDetail.completenessScore} />
            {scoreDetail.fluencyScore !== undefined && (
              <ScoreBar label="流畅度" value={scoreDetail.fluencyScore} />
            )}
            {scoreDetail.selfRatingScore !== undefined && (
              <ScoreBar label="自评得分" value={scoreDetail.selfRatingScore} />
            )}
          </div>
        </div>
      )}

      {/* 建议 */}
      {suggestions.length > 0 && (
        <div className="w-full text-sm space-y-1">
          <p className="text-gray-500 font-medium">💡 练习建议</p>
          {suggestions.map((s, i) => (
            <p key={i} className="text-gray-600">· {s}</p>
          ))}
        </div>
      )}

      {/* 标注 */}
      <p className="text-xs text-gray-400 mt-1">
        ⚠️ 评分仅供练习参考，不代表官方普通话水平测试成绩
      </p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-gray-500 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="w-10 text-right text-gray-600 tabular-nums">{value}</span>
    </div>
  );
}
