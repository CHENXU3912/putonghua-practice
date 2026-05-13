import type { SyllableItem, WordItem, ArticleItem, SpeechItem, UserResult, ScoreResult, WrongItem } from './types';

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function calcDurationScore(actual: number, expected: number): number {
  if (expected <= 0 || actual <= 0) return 50;
  const ratio = actual / expected;
  if (ratio >= 0.7 && ratio <= 1.3) return 100;
  if (ratio >= 0.5 && ratio <= 1.5) return 80;
  if (ratio >= 0.3 && ratio <= 2.0) return 60;
  return 40;
}

function toGrade(score: number): ScoreResult['grade'] {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '一般';
  return '需加强';
}

function genSuggestions(errorTypes: string[], grade: string): string[] {
  const s: string[] = [];
  const set = new Set(errorTypes);
  if (set.has('平舌音') || set.has('翘舌音')) {
    s.push('平翘舌音需要多加练习，注意舌尖位置的区别');
  }
  if (set.has('前鼻音') || set.has('后鼻音')) {
    s.push('前后鼻音的区分需要多听多练，注意鼻腔共鸣的感觉');
  }
  if ((set.has('边音(l)') || set.has('鼻音(n)')) && !s.some(t => t.includes('n和l'))) {
    s.push('n和l的发音需要区分：n是鼻音（气流从鼻子出），l是边音（气流从舌头两边出）');
  }
  if (set.has('轻声')) s.push('轻声要读得又轻又短，注意不要读成原调');
  if (set.has('儿化')) s.push('儿化音要注意卷舌动作，发音要自然');
  if (set.has('变调')) s.push('注意上声变调和"一""不"的变调规则');
  if (set.has('f/h混淆')) s.push('f和h要区分：f是唇齿音（上齿接触下唇），h是舌根音');
  if (s.length === 0) {
    if (grade === '优秀' || grade === '良好') s.push('完成得不错，继续保持！');
    else s.push('建议多加练习，注意发音细节');
  }
  return s;
}

// ===== 单音节评分 =====

export function scoreSyllable(
  items: SyllableItem[],
  userResults: UserResult[]
): ScoreResult {
  const totalCount = items.length;
  const correctCount = userResults.filter(r => r.selfRating).length;
  const completenessScore = Math.round((correctCount / totalCount) * 100);

  const totalExpectedDuration = totalCount * 1.5;
  const totalActualDuration = userResults.reduce((s, r) => s + r.audioDuration, 0);
  const durationScore = calcDurationScore(totalActualDuration, totalExpectedDuration);

  const score = Math.round(durationScore * 0.3 + completenessScore * 0.4 + completenessScore * 0.3);
  const grade = toGrade(score);

  const wrongItems: WrongItem[] = [];
  const errorTypes: string[] = [];
  userResults.forEach((r, i) => {
    if (!r.selfRating && items[i]) {
      wrongItems.push({
        content: items[i].char,
        pinyin: items[i].pinyin,
        errorType: items[i].errorType,
      });
      errorTypes.push(...items[i].errorType);
    }
  });

  return {
    score,
    scoreDetail: { durationScore, completenessScore, selfRatingScore: completenessScore },
    grade,
    suggestions: genSuggestions(errorTypes, grade),
    wrongItems,
  };
}

// ===== 多音节评分 =====

export function scoreWord(
  items: WordItem[],
  userResults: UserResult[]
): ScoreResult {
  const totalCount = items.length;
  const correctCount = userResults.filter(r => r.selfRating).length;
  const completenessScore = Math.round((correctCount / totalCount) * 100);

  const totalExpectedDuration = totalCount * 2.0;
  const totalActualDuration = userResults.reduce((s, r) => s + r.audioDuration, 0);
  const durationScore = calcDurationScore(totalActualDuration, totalExpectedDuration);

  const score = Math.round(durationScore * 0.3 + completenessScore * 0.4 + completenessScore * 0.3);
  const grade = toGrade(score);

  const wrongItems: WrongItem[] = [];
  const errorTypes: string[] = [];
  userResults.forEach((r, i) => {
    if (!r.selfRating && items[i]) {
      wrongItems.push({
        content: items[i].word,
        pinyin: items[i].pinyin,
        errorType: items[i].errorType,
      });
      errorTypes.push(...items[i].errorType);
    }
  });

  return {
    score,
    scoreDetail: { durationScore, completenessScore, selfRatingScore: completenessScore },
    grade,
    suggestions: genSuggestions(errorTypes, grade),
    wrongItems,
  };
}

// ===== 短文朗读评分 =====

export function scoreArticle(
  article: ArticleItem,
  audioDuration: number,
  selfRating: 1 | 2 | 3 | 4 | 5
): ScoreResult {
  const speedScore = calcDurationScore(audioDuration, article.standardDuration);
  const completenessScore = audioDuration >= article.standardDuration * 0.8 ? 100 : Math.round((audioDuration / article.standardDuration) * 100);
  const selfScore = (selfRating / 5) * 100;

  const score = Math.round(speedScore * 0.3 + completenessScore * 0.4 + selfScore * 0.3);
  const grade = toGrade(score);

  const errorTypes: string[] = [];
  const suggestions: string[] = [];
  if (speedScore < 60) suggestions.push('朗读语速可以再自然一些，注意控制节奏');
  if (completenessScore < 80) suggestions.push('建议把全文读完整，不要跳读');
  if (suggestions.length === 0) suggestions.push('完成得不错，继续保持！');

  return {
    score,
    scoreDetail: { durationScore: speedScore, completenessScore, selfRatingScore: selfScore },
    grade,
    suggestions,
    wrongItems: [],
  };
}

// ===== 命题说话评分 =====

export function scoreSpeech(
  _speech: SpeechItem,
  audioDuration: number,
  selfRating: 1 | 2 | 3 | 4 | 5,
  outlineCoverage: 1 | 2 | 3 | 4 | 5
): ScoreResult {
  const targetDuration = 180;
  let durationScore: number;
  if (audioDuration >= targetDuration) durationScore = 100;
  else if (audioDuration >= 150) durationScore = 80;
  else if (audioDuration >= 120) durationScore = 60;
  else if (audioDuration >= 90) durationScore = 40;
  else durationScore = 20;

  const fluencyScore = (selfRating / 5) * 100;
  const outlineScore = (outlineCoverage / 5) * 100;

  const score = Math.round(durationScore * 0.5 + fluencyScore * 0.25 + outlineScore * 0.25);
  const grade = toGrade(score);

  const suggestions: string[] = [];
  if (audioDuration < 120) suggestions.push('建议说满3分钟，充分展开话题以锻炼表达能力');
  else if (audioDuration < 150) suggestions.push('可以再多说一会儿，尽量接近3分钟');
  if (outlineCoverage < 3) suggestions.push('建议围绕提纲展开，确保覆盖主要要点');
  if (suggestions.length === 0) suggestions.push('完成得不错，继续保持！');

  return {
    score,
    scoreDetail: { durationScore, completenessScore: durationScore, fluencyScore, selfRatingScore: outlineScore },
    grade,
    suggestions,
    wrongItems: [],
  };
}
