import type { SyllableItem, WordItem, ArticleItem, SpeechItem, UserResult, ScoreResult, WrongItem } from './types';
import { pinyin } from 'pinyin-pro';

// ===== 拼音同音字表 =====

const CHINESE_CHAR_RE = /[\u4e00-\u9fff]/;
const PINYIN_SYLLABLES = new Set([
  'a','ai','an','ang','ao','ba','bai','ban','bang','bao','bei','ben','beng','bi','bian','biao','bie','bin','bing','bo','bu',
  'ca','cai','can','cang','cao','ce','cen','ceng','cha','chai','chan','chang','chao','che','chen','cheng','chi','chong','chou','chu','chua','chuai','chuan','chuang','chui','chun','chuo','ci','cong','cou','cu','cuan','cui','cun','cuo',
  'da','dai','dan','dang','dao','de','dei','den','deng','di','dia','dian','diao','die','ding','diu','dong','dou','du','duan','dui','dun','duo',
  'e','ei','en','eng','er',
  'fa','fan','fang','fei','fen','feng','fo','fou','fu',
  'ga','gai','gan','gang','gao','ge','gei','gen','geng','gong','gou','gu','gua','guai','guan','guang','gui','gun','guo',
  'ha','hai','han','hang','hao','he','hei','hen','heng','hong','hou','hu','hua','huai','huan','huang','hui','hun','huo',
  'ji','jia','jian','jiang','jiao','jie','jin','jing','jiong','jiu','ju','juan','jue','jun',
  'ka','kai','kan','kang','kao','ke','kei','ken','keng','kong','kou','ku','kua','kuai','kuan','kuang','kui','kun','kuo',
  'la','lai','lan','lang','lao','le','lei','leng','li','lia','lian','liang','liao','lie','lin','ling','liu','lo','long','lou','lu','luan','lun','luo','lv','lve',
  'ma','mai','man','mang','mao','me','mei','men','meng','mi','mian','miao','mie','min','ming','miu','mo','mou','mu',
  'na','nai','nan','nang','nao','ne','nei','nen','neng','ni','nian','niang','niao','nie','nin','ning','niu','nong','nou','nu','nuan','nun','nuo','nv','nve',
  'o','ou',
  'pa','pai','pan','pang','pao','pei','pen','peng','pi','pian','piao','pie','pin','ping','po','pou','pu',
  'qi','qia','qian','qiang','qiao','qie','qin','qing','qiong','qiu','qu','quan','que','qun',
  'ran','rang','rao','re','ren','reng','ri','rong','rou','ru','rua','ruan','rui','run','ruo',
  'sa','sai','san','sang','sao','se','sen','seng','sha','shai','shan','shang','shao','she','shei','shen','sheng','shi','shou','shu','shua','shuai','shuan','shuang','shui','shun','shuo','si','song','sou','su','suan','sui','sun','suo',
  'ta','tai','tan','tang','tao','te','tei','teng','ti','tian','tiao','tie','ting','tong','tou','tu','tuan','tui','tun','tuo',
  'wa','wai','wan','wang','wei','wen','weng','wo','wu',
  'xi','xia','xian','xiang','xiao','xie','xin','xing','xiong','xiu','xu','xuan','xue','xun',
  'ya','yan','yang','yao','ye','yi','yin','ying','yo','yong','you','yu','yuan','yue','yun',
  'za','zai','zan','zang','zao','ze','zei','zen','zeng','zha','zhai','zhan','zhang','zhao','zhe','zhei','zhen','zheng','zhi','zhong','zhou','zhu','zhua','zhuai','zhuan','zhuang','zhui','zhun','zhuo','zi','zong','zou','zu','zuan','zui','zun','zuo',
]);

/** 去掉拼音声调，例如 sì → si, chuān → chuan */
export function stripTone(py: string): string {
  if (!py) return '';
  return py.toLowerCase().replace(/ü/g, 'v').replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, (c) => {
    const map: Record<string, string> = {
      'ā':'a','á':'a','ǎ':'a','à':'a',
      'ē':'e','é':'e','ě':'e','è':'e',
      'ī':'i','í':'i','ǐ':'i','ì':'i',
      'ō':'o','ó':'o','ǒ':'o','ò':'o',
      'ū':'u','ú':'u','ǔ':'u','ù':'u',
      'ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v',
    };
    return map[c] || c;
  }).replace(/[1-5]/g, '');
}

function normalizePinyinToken(py: string): string {
  return stripTone(py).replace(/[^a-zv]/g, '');
}

function splitPlainPinyin(text: string, expectedCount?: number): string[] {
  const normalized = normalizePinyinToken(text);
  if (!normalized) return [];

  const memo = new Map<number, string[][]>();
  const splitFrom = (start: number): string[][] => {
    if (start === normalized.length) return [[]];
    if (memo.has(start)) return memo.get(start)!;
    const result: string[][] = [];
    for (let end = Math.min(normalized.length, start + 6); end > start; end--) {
      const part = normalized.slice(start, end);
      if (!PINYIN_SYLLABLES.has(part)) continue;
      for (const rest of splitFrom(end)) result.push([part, ...rest]);
    }
    memo.set(start, result);
    return result;
  };

  const candidates = splitFrom(0);
  if (expectedCount) {
    const exact = candidates.find(c => c.length === expectedCount);
    if (exact) return exact;
  }
  return candidates[0] || [];
}

function chineseTextToPinyinSyllables(text: string): string[] {
  return [...cleanText(text)]
    .filter(char => CHINESE_CHAR_RE.test(char))
    .map(char => {
      const result = pinyin(char, { toneType: 'none', type: 'array' }) as string[];
      return normalizePinyinToken(result[0] || '');
    })
    .filter(Boolean);
}

function latinTextToPinyinSyllables(text: string, expectedCount?: number): string[] {
  const chunks = stripTone(text).match(/[a-zv]+/g) || [];
  if (chunks.length === 0) return [];

  const exactTokens = chunks
    .map(normalizePinyinToken)
    .filter(token => PINYIN_SYLLABLES.has(token));

  if (expectedCount && exactTokens.length === expectedCount) return exactTokens;

  const splitTokens = chunks.flatMap(chunk => {
    const token = normalizePinyinToken(chunk);
    if (!token) return [];
    if (PINYIN_SYLLABLES.has(token)) return [token];
    return splitPlainPinyin(token);
  });

  if (expectedCount) {
    const joinedSplit = splitPlainPinyin(chunks.join(''), expectedCount);
    if (joinedSplit.length === expectedCount) return joinedSplit;
  }

  return splitTokens;
}

function transcriptToPinyinSyllables(text: string, expectedCount?: number): string[] {
  const tokens = text.match(/[\u4e00-\u9fff]|[A-Za-züÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/g) || [];
  return tokens.flatMap(token => {
    if (CHINESE_CHAR_RE.test(token)) return chineseTextToPinyinSyllables(token);
    return latinTextToPinyinSyllables(token, expectedCount);
  });
}

export function isUnusableForeignTranscript(text: string, expectedCount = 1): boolean {
  const cleaned = cleanText(text);
  if (!cleaned) return false;
  const hasChinese = CHINESE_CHAR_RE.test(cleaned);
  const hasLatin = /[A-Za-z]/.test(cleaned);
  if (hasChinese || !hasLatin) return false;
  return transcriptToPinyinSyllables(cleaned, expectedCount).length === 0;
}

function targetToPinyinSyllables(targetText: string, targetPinyin?: string): string[] {
  const charCount = [...targetText].filter(char => CHINESE_CHAR_RE.test(char)).length;
  if (targetPinyin && !CHINESE_CHAR_RE.test(targetPinyin)) {
    const parsed = splitPlainPinyin(targetPinyin, charCount);
    if (parsed.length === charCount) return parsed;
  }
  return chineseTextToPinyinSyllables(targetText);
}

function sequenceIncludes(sequence: string[], target: string[]): boolean {
  if (target.length === 0 || sequence.length < target.length) return false;
  for (let i = 0; i <= sequence.length - target.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      if (sequence[i + j] !== target[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
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
  const targetSyllables = targetToPinyinSyllables(targetChar, targetPinyin);
  const key = targetSyllables[0] || normalizePinyinToken(targetPinyin);
  if (!key) return false;

  // 优先按识别文本逐字转拼音匹配，覆盖题库外同音字和常见多音字。
  if (transcriptToPinyinSyllables(transcript, 1).includes(key)) return true;

  // 兼容旧的题库同音字表。
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
  const targetSyllables = targetToPinyinSyllables(targetWord, targetPinyin);
  const transcriptSyllables = transcriptToPinyinSyllables(transcript, targetSyllables.length);
  if (sequenceIncludes(transcriptSyllables, targetSyllables)) return true;

  // 兼容旧同音字表：只在每个字都能按同音字找到时通过，避免“任意一个字同音”误判整词正确。
  const chars = [...targetWord].filter(c => CHINESE_CHAR_RE.test(c));
  if (chars.length === 0) return false;
  return chars.every((c, index) => {
    if (transcript.includes(c)) return true;
    const key = targetSyllables[index];
    const homophones = key ? pinyinMap.get(key) : undefined;
    return !!homophones && [...homophones].some(h => transcript.includes(h));
  });
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

/** 滑动窗口覆盖率：将原文切成窗口，统计有多少窗口在识别文本中找到 */
export function getCoverageRate(expected: string, recognized: string, windowSize = 3): number {
  const exp = cleanText(expected);
  const rec = cleanText(recognized);
  if (!exp || !rec) return 0;
  if (exp.length <= windowSize) {
    return rec.includes(exp) ? 100 : 0;
  }
  let covered = 0;
  const totalWindows = exp.length - windowSize + 1;
  for (let i = 0; i < totalWindows; i++) {
    const win = exp.slice(i, i + windowSize);
    if (rec.includes(win)) covered++;
  }
  const windowRate = Math.round((covered / totalWindows) * 100);
  return Math.max(windowRate, getOrderedMatchRate(exp, rec));
}

function getOrderedMatchRate(expected: string, recognized: string): number {
  const prev = new Array(recognized.length + 1).fill(0);
  const curr = new Array(recognized.length + 1).fill(0);
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= recognized.length; j++) {
      curr[j] = expected[i - 1] === recognized[j - 1]
        ? prev[j - 1] + 1
        : Math.max(prev[j], curr[j - 1]);
    }
    for (let j = 0; j <= recognized.length; j++) {
      prev[j] = curr[j];
      curr[j] = 0;
    }
  }
  return Math.round((prev[recognized.length] / expected.length) * 100);
}

export function getArticleReadingReport(expected: string, recognized: string): {
  total: number;
  matched: number;
  missed: number;
  accuracy: number;
  recognizedText: string;
  details: { char: string; status: 'match' | 'miss' | 'punct' }[];
  missedSamples: string[];
} {
  const exp = cleanText(expected);
  const rec = cleanText(recognized);
  const rows = Array.from({ length: exp.length + 1 }, () => new Array(rec.length + 1).fill(0));

  for (let i = 1; i <= exp.length; i++) {
    for (let j = 1; j <= rec.length; j++) {
      rows[i][j] = exp[i - 1] === rec[j - 1]
        ? rows[i - 1][j - 1] + 1
        : Math.max(rows[i - 1][j], rows[i][j - 1]);
    }
  }

  const matchedIndexes = new Set<number>();
  let i = exp.length;
  let j = rec.length;
  while (i > 0 && j > 0) {
    if (exp[i - 1] === rec[j - 1]) {
      matchedIndexes.add(i - 1);
      i--;
      j--;
    } else if (rows[i - 1][j] >= rows[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  let cleanIndex = 0;
  const details = [...expected].map(char => {
    if (!cleanText(char)) return { char, status: 'punct' as const };
    const status = matchedIndexes.has(cleanIndex) ? 'match' as const : 'miss' as const;
    cleanIndex++;
    return { char, status };
  });

  const matched = matchedIndexes.size;
  const missed = Math.max(0, exp.length - matched);
  const missedSamples = details
    .filter(item => item.status === 'miss')
    .map(item => item.char)
    .slice(0, 30);

  return {
    total: exp.length,
    matched,
    missed,
    accuracy: exp.length ? Math.round((matched / exp.length) * 100) : 0,
    recognizedText: rec,
    details,
    missedSamples,
  };
}

/** 模糊关键词匹配：每个关键词拆分后检查是否大部分字符出现 */
export function checkKeywordsFuzzy(transcript: string, keywords: string[]): { found: number; total: number; details: { kw: string; found: boolean; partial: boolean }[] } {
  const rec = cleanText(transcript);
  const details = keywords.map(kw => {
    const found = rec.includes(kw);
    if (found) return { kw, found: true, partial: false };
    // 模糊：至少一半的字出现
    const chars = [...kw];
    const matched = chars.filter(c => rec.includes(c)).length;
    return { kw, found: false, partial: matched >= Math.ceil(chars.length / 2) };
  });
  const found = details.filter(d => d.found || d.partial).length;
  return { found, total: keywords.length, details };
}

/** 检查识别文本中是否包含指定关键词 */
export function checkKeywords(transcript: string, keywords: string[]): { found: number; total: number; details: { kw: string; found: boolean }[] } {
  const details = keywords.map(kw => ({ kw, found: transcript.includes(kw) }));
  const found = details.filter(d => d.found).length;
  return { found, total: keywords.length, details };
}

export function getSpeechReview(
  speech: SpeechItem,
  transcript: string,
  audioDuration: number
): {
  recognizedChars: number;
  charsPerMinute: number;
  durationLabel: string;
  outline: { text: string; found: boolean; partial: boolean }[];
} {
  const rec = cleanText(transcript);
  const minutes = Math.max(audioDuration / 60, 0.1);
  const keywords = speech.outline.map(item => item.slice(0, 8));
  const result = checkKeywordsFuzzy(transcript, keywords);
  const durationLabel = audioDuration >= 150
    ? '时长充足'
    : audioDuration >= 120
      ? '接近要求'
      : '时长偏短';

  return {
    recognizedChars: rec.length,
    charsPerMinute: Math.round(rec.length / minutes),
    durationLabel,
    outline: result.details.map((item, index) => ({
      text: speech.outline[index],
      found: item.found,
      partial: item.partial,
    })),
  };
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
  const hasPerItemJudgment = userResults.length >= totalCount;

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
  const matchScore = hasPerItemJudgment
    ? Math.round((selfCorrectCount / totalCount) * 100)
    : hasSTT
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

  if (hasPerItemJudgment) {
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
  } else if (hasSTT && sttDetails.length > 0) {
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
  const hasPerItemJudgment = userResults.length >= totalCount;

  if (sttTranscript) {
    const expected = items.map(i => i.word).join('');
    const cmp = compareCharByChar(expected, sttTranscript);
    sttCorrectCount = cmp.correct;
    sttDetails = cmp.details;
  }

  const selfCorrectCount = userResults.filter(r => r.selfRating).length;
  const hasSTT = sttTranscript && sttTranscript.length > 0;
  const matchScore = hasPerItemJudgment
    ? Math.round((selfCorrectCount / totalCount) * 100)
    : hasSTT
    ? Math.round((sttCorrectCount / totalCount) * 100)
    : Math.round((selfCorrectCount / totalCount) * 100);

  const totalExpectedDuration = totalCount * 2.0;
  const totalActualDuration = userResults.reduce((s, r) => s + r.audioDuration, 0);
  const durationScore = calcDurationScore(totalActualDuration, totalExpectedDuration);

  const score = Math.round(durationScore * 0.3 + matchScore * 0.4 + matchScore * 0.3);
  const grade = toGrade(score);

  const wrongItems: WrongItem[] = [];
  const errorTypes: string[] = [];

  if (hasPerItemJudgment) {
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
  } else if (hasSTT && sttDetails.length > 0) {
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

  // STT 覆盖率（滑动窗口，不要求逐字对齐）
  let coverageScore = selfRating * 20;
  if (sttTranscript) {
    const rate = getCoverageRate(article.content, sttTranscript, 4);
    coverageScore = Math.max(coverageScore, rate);
  }

  const score = Math.round(speedScore * 0.3 + completenessScore * 0.3 + coverageScore * 0.4);
  const grade = toGrade(score);

  const suggestions: string[] = [];
  if (speedScore < 60) suggestions.push('朗读语速可以再自然一些，注意控制节奏');
  if (completenessScore < 80) suggestions.push('建议把全文读完整，不要跳读');
  if (sttTranscript && coverageScore < 40) suggestions.push('识别覆盖率偏低，建议放慢语速、逐句朗读');
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

  // STT 关键词模糊检测
  if (sttTranscript && speech.outline) {
    const kwResult = checkKeywordsFuzzy(sttTranscript, speech.outline.map(o => o.slice(0, 5)));
    outlineScore = Math.max(outlineScore, Math.round((kwResult.found / kwResult.total) * 100));
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
