import type { SyllableItem, WordItem, ArticleItem, SpeechItem, UserResult, ScoreResult, WrongItem } from './types';

// ===== 拼音同音字表 =====

/** 去掉拼音声调，例如 sì → si, chuān → chuan */
export function stripTone(py: string): string {
  if (!py) return '';
  return py.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, (c) => {
    const map: Record<string, string> = {
      'ā':'a','á':'a','ǎ':'a','à':'a',
      'ē':'e','é':'e','ě':'e','è':'e',
      'ī':'i','í':'i','ǐ':'i','ì':'i',
      'ō':'o','ó':'o','ǒ':'o','ò':'o',
      'ū':'u','ú':'u','ǔ':'u','ù':'u',
      'ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v',
    };
    return map[c] || c;
  }).replace(/[1-4]$/, '');
}

/** 从题库构建拼音→同音字映射 */
export function buildPinyinMap(syllables: { char: string; pinyin: string }[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const s of syllables) {
    if (!s.pinyin) continue;
    const key = stripTone(s.pinyin);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(s.char);
  }
  return map;
}

/** 判断：transcript 中是否包含 targetChar 或其同音字（基于拼音） */
export function charOrHomophoneMatch(
  pinyinMap: Map<string, Set<string>>,
  targetChar: string,
  targetPinyin: string,
  transcript: string
): boolean {
  if (!transcript) return false;
  // 直接匹配
  if (transcript.includes(targetChar)) return true;
  // 同音字匹配
  if (!targetPinyin) return false;
  const key = stripTone(targetPinyin);
  const homophones = pinyinMap.get(key);
  if (homophones) {
    for (const c of homophones) {
      if (c !== targetChar && transcript.includes(c)) return true;
    }
  }
  return false;
}

/** 判断词是否匹配（每个字分别找同音字） */
export function wordOrHomophoneMatch(
  pinyinMap: Map<string, Set<string>>,
  targetWord: string,
  targetPinyin: string,
  transcript: string
): boolean {
  if (!transcript) return false;
  // 直接匹配
  if (transcript.includes(targetWord)) return true;
  // 如果没有拼音，降级为直接匹配
  if (!targetPinyin) return false;
  // 每个字分别匹配
  const chars = [...targetWord];
  const allFound = chars.every(c => {
    // 找这个字在题库中的拼音
    const py = ''; // 需要从词条中获取每个字的拼音，但词条拼音是整个词的
    // 简化：直接检查字符
    return transcript.includes(c);
  });
  if (allFound) return true;
  // 至少识别到部分同音字
  const anyHomophone = chars.some(c => {
    for (const [key, set] of pinyinMap) {
      if (set.has(c)) {
        for (const h of set) {
          if (h !== c && transcript.includes(h)) return true;
        }
      }
    }
    return false;
  });
  return anyHomophone;
}

// ===== 文本比对工具 =====

/** 清理文本：去掉标点、空格 */
export function cleanText(s: string): string {
  return s.replace(/[，。！？、；：""''《》（）—…\s\.\,\!\?\;\:\"'\(\)\[\]]/g, '');
}

/** 逐字比对识别文本和期望文本，返回每个位置是否正确 */
export function compareCharByChar(expected: string, recognized: string): { total: number; correct: number; details: { char: string; ok: boolean }[] } {
  const exp = cleanText(expected);
  const rec = cleanText(recognized);
  const maxLen = Math.max(exp.length, rec.length);
  const details: { char: string; ok: boolean }[] = [];
  let correct = 0;
  for (let i = 0; i < exp.length; i++) {
    const ok = i < rec.length && exp[i] === rec[i];
    if (ok) correct++;
    details.push({ char: exp[i], ok });
  }
  return { total: exp.length, correct, details };
}

/** 计算识别文本与期望文本的匹配率 */
export function getMatchRate(expected: string, recognized: string): number {
  const result = compareCharByChar(expected, recognized);
  if (result.total === 0) return 100;
  return Math.round((result.correct / result.total) * 100);
}

/** 检查识别文本中是否包含指定关键词 */
export function checkKeywords(transcript: string, keywords: string[]): { found: number; total: number; details: { kw: string; found: boolean }[] } {
  const details = keywords.map(kw => ({ kw, found: transcript.includes(kw) }));
  const found = details.filter(d => d.found).length;
  return { found, total: keywords.length, details };
}

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

// ===== 单音节评分（支持 STT 自动识别） =====

export function scoreSyllable(
  items: SyllableItem[],
  userResults: UserResult[],
  sttTranscript?: string
): ScoreResult {
  const totalCount = items.length;
  let sttCorrectCount = 0;
  let sttDetails: { char: string; ok: boolean }[] = [];

  if (sttTranscript) {
    // 拼接期望文本
    const expected = items.map(i => i.char).join('');
    const cmp = compareCharByChar(expected, sttTranscript);
    sttCorrectCount = cmp.correct;
    sttDetails = cmp.details;
  }

  // 自评（降级用）
  const selfCorrectCount = userResults.filter(r => r.selfRating).length;
  const hasSTT = sttTranscript && sttTranscript.length > 0;

  // STT 匹配率 或 自评准确率
  const matchScore = hasSTT
    ? Math.round((sttCorrectCount / totalCount) * 100)
    : Math.round((selfCorrectCount / totalCount) * 100);

  const totalExpectedDuration = totalCount * 1.5;
  const totalActualDuration = userResults.reduce((s, r) => s + r.audioDuration, 0);
  const durationScore = calcDurationScore(totalActualDuration, totalExpectedDuration);

  // STT 权重更高（40% vs 自评 30%）
  const score = Math.round(durationScore * 0.3 + matchScore * 0.4 + matchScore * 0.3);
  const grade = toGrade(score);

  const wrongItems: WrongItem[] = [];
  const errorTypes: string[] = [];

  if (hasSTT && sttDetails.length > 0) {
    sttDetails.forEach((d, i) => {
      if (!d.ok && items[i]) {
        wrongItems.push({
          content: items[i].char,
          pinyin: items[i].pinyin,
          errorType: items[i].errorType,
        });
        errorTypes.push(...items[i].errorType);
      }
    });
  } else {
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
  }

  return {
    score,
    scoreDetail: { durationScore, completenessScore: matchScore, selfRatingScore: matchScore },
    grade,
    suggestions: genSuggestions(errorTypes, grade),
    wrongItems,
  };
}

// ===== 多音节评分（支持 STT） =====

export function scoreWord(
  items: WordItem[],
  userResults: UserResult[],
  sttTranscript?: string
): ScoreResult {
  const totalCount = items.length;
  let sttCorrectCount = 0;
  let sttDetails: { char: string; ok: boolean }[] = [];

  if (sttTranscript) {
    const expected = items.map(i => i.word).join('');
    const cmp = compareCharByChar(expected, sttTranscript);
    sttCorrectCount = cmp.correct;
    sttDetails = cmp.details;
  }

  const selfCorrectCount = userResults.filter(r => r.selfRating).length;
  const hasSTT = sttTranscript && sttTranscript.length > 0;
  const matchScore = hasSTT
    ? Math.round((sttCorrectCount / totalCount) * 100)
    : Math.round((selfCorrectCount / totalCount) * 100);

  const totalExpectedDuration = totalCount * 2.0;
  const totalActualDuration = userResults.reduce((s, r) => s + r.audioDuration, 0);
  const durationScore = calcDurationScore(totalActualDuration, totalExpectedDuration);

  const score = Math.round(durationScore * 0.3 + matchScore * 0.4 + matchScore * 0.3);
  const grade = toGrade(score);

  const wrongItems: WrongItem[] = [];
  const errorTypes: string[] = [];

  if (hasSTT && sttDetails.length > 0) {
    sttDetails.forEach((d, i) => {
      if (!d.ok && items[i]) {
        wrongItems.push({
          content: items[i].word,
          pinyin: items[i].pinyin,
          errorType: items[i].errorType,
        });
        errorTypes.push(...items[i].errorType);
      }
    });
  } else {
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
  }

  return {
    score,
    scoreDetail: { durationScore, completenessScore: matchScore, selfRatingScore: matchScore },
    grade,
    suggestions: genSuggestions(errorTypes, grade),
    wrongItems,
  };
}

// ===== 短文朗读评分（支持 STT 覆盖率） =====

export function scoreArticle(
  article: ArticleItem,
  audioDuration: number,
  selfRating: 1 | 2 | 3 | 4 | 5,
  sttTranscript?: string
): ScoreResult {
  const speedScore = calcDurationScore(audioDuration, article.standardDuration);
  const completenessScore = audioDuration >= article.standardDuration * 0.8 ? 100 : Math.round((audioDuration / article.standardDuration) * 100);

  // STT 覆盖率
  let coverageScore = selfRating * 20;
  if (sttTranscript) {
    const rate = getMatchRate(article.content, sttTranscript);
    coverageScore = rate;
  }

  const score = Math.round(speedScore * 0.3 + completenessScore * 0.3 + coverageScore * 0.4);
  const grade = toGrade(score);

  const suggestions: string[] = [];
  if (speedScore < 60) suggestions.push('朗读语速可以再自然一些，注意控制节奏');
  if (completenessScore < 80) suggestions.push('建议把全文读完整，不要跳读');
  if (sttTranscript && coverageScore < 60) suggestions.push('识别率偏低，建议先听示范音，逐句跟读');
  if (suggestions.length === 0) suggestions.push('完成得不错，继续保持！');

  return {
    score,
    scoreDetail: { durationScore: speedScore, completenessScore, fluencyScore: coverageScore, selfRatingScore: selfRating * 20 },
    grade,
    suggestions,
    wrongItems: [],
  };
}

// ===== 命题说话评分（支持 STT 关键词检测） =====

export function scoreSpeech(
  speech: SpeechItem,
  audioDuration: number,
  selfRating: 1 | 2 | 3 | 4 | 5,
  outlineCoverage: 1 | 2 | 3 | 4 | 5,
  sttTranscript?: string
): ScoreResult {
  const targetDuration = 180;
  let durationScore: number;
  if (audioDuration >= targetDuration) durationScore = 100;
  else if (audioDuration >= 150) durationScore = 80;
  else if (audioDuration >= 120) durationScore = 60;
  else if (audioDuration >= 90) durationScore = 40;
  else durationScore = 20;

  const fluencyScore = (selfRating / 5) * 100;
  let outlineScore = (outlineCoverage / 5) * 100;

  // STT 关键词检测
  if (sttTranscript && speech.outline) {
    const kwResult = checkKeywords(sttTranscript, speech.outline.map(o => o.slice(0, 4)));
    outlineScore = Math.round((kwResult.found / kwResult.total) * 100);
  }

  const score = Math.round(durationScore * 0.5 + fluencyScore * 0.25 + outlineScore * 0.25);
  const grade = toGrade(score);

  const suggestions: string[] = [];
  if (audioDuration < 120) suggestions.push('建议说满3分钟，充分展开话题以锻炼表达能力');
  else if (audioDuration < 150) suggestions.push('可以再多说一会儿，尽量接近3分钟');
  if (outlineCoverage < 3 || outlineScore < 60) suggestions.push('建议围绕提纲展开，确保覆盖主要要点');
  if (suggestions.length === 0) suggestions.push('完成得不错，继续保持！');

  return {
    score,
    scoreDetail: { durationScore, completenessScore: durationScore, fluencyScore, selfRatingScore: outlineScore },
    grade,
    suggestions,
    wrongItems: [],
  };
}
