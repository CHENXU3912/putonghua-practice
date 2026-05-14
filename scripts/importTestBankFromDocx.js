const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pinyin } = require('pinyin-pro');

const zh = {
  docx: '\u666e\u901a\u8bdd\u6c34\u5e73\u6d4b\u8bd5\u8bd5\u9898.docx',
  title: '\u56fd\u5bb6\u666e\u901a\u8bdd\u6c34\u5e73\u6d4b\u8bd5\u9898',
  one: '\u4e00\u3001\u8bfb\u5355\u97f3\u8282\u5b57\u8bcd',
  two: '\u4e8c\u3001\u8bfb\u591a\u97f3\u8282\u8bcd\u8bed',
  three: '\u4e09\u3001',
  four: '\u56db\u3001',
  work: '\u4f5c\u54c1',
  topic: '\u8bdd\u9898',
  common: '\u5e38\u7528\u5b57',
  retroflex: '\u7fd8\u820c\u97f3',
  flat: '\u5e73\u820c\u97f3',
  nasalN: '\u9f3b\u97f3(n)',
  lateralL: '\u8fb9\u97f3(l)',
  fh: 'f/h\u6df7\u6dc6',
  frontNasal: '\u524d\u9f3b\u97f3',
  backNasal: '\u540e\u9f3b\u97f3',
  er: '\u513f\u5316',
  tone1: '\u58f0\u8c03(\u4e00\u58f0)',
  tone2: '\u58f0\u8c03(\u4e8c\u58f0)',
  tone3: '\u58f0\u8c03(\u4e09\u58f0)',
  tone4: '\u58f0\u8c03(\u56db\u58f0)',
};

const DOCX_PATH = path.join('C:\\Users\\1\\Desktop', zh.docx);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const SYLLABLE_PATH = path.join(DATA_DIR, 'syllable.json');
const WORD_PATH = path.join(DATA_DIR, 'word.json');
const ARTICLE_PATH = path.join(DATA_DIR, 'article.json');
const SPEECH_PATH = path.join(DATA_DIR, 'speech.json');

function readDocxText(filePath) {
  const escapedPath = filePath.replace(/'/g, "''");
  const ps = [
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    `$zip=[System.IO.Compression.ZipFile]::OpenRead('${escapedPath}')`,
    "$entry=$zip.GetEntry('word/document.xml')",
    '$reader=New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)',
    '$xml=$reader.ReadToEnd(); $reader.Close(); $zip.Dispose()',
    '$nl=[Environment]::NewLine',
    `$text=$xml -replace '<w:tab[^>]*/>',' ' -replace '</w:p>',$nl -replace '<[^>]+>','' -replace '&lt;','<' -replace '&gt;','>' -replace '&amp;','&' -replace '&quot;','"'`,
    '[System.Net.WebUtility]::HtmlDecode($text)',
  ].join('; ');
  return execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
}

function cleanSpaces(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function stripSectionHeader(text) {
  return cleanSpaces(text.replace(/^[^\n]*\n/, ''));
}

function findStarts(text, needle) {
  const starts = [];
  let pos = 0;
  while ((pos = text.indexOf(needle, pos)) >= 0) {
    starts.push(pos);
    pos += needle.length;
  }
  return starts;
}

function extractDocItems(text) {
  const starts = findStarts(text, zh.title);
  const syllables = [];
  const words = [];
  const articles = [];
  const topics = [];
  const perSetCounts = [];

  for (let i = 0; i < starts.length; i++) {
    const block = text.slice(starts[i], starts[i + 1] || text.length);
    const oneIdx = block.indexOf(zh.one);
    const twoIdx = block.indexOf(zh.two);
    const threeIdx = block.indexOf(zh.three, twoIdx + 1);
    const fourIdx = block.indexOf(zh.four, threeIdx + 1);
    if (oneIdx < 0 || twoIdx < 0 || threeIdx < 0 || fourIdx < 0) continue;

    const syllableText = stripSectionHeader(block.slice(oneIdx + zh.one.length, twoIdx));
    const wordText = stripSectionHeader(block.slice(twoIdx + zh.two.length, threeIdx));
    const articleRaw = block.slice(threeIdx, fourIdx).trim();
    const speechRaw = block.slice(fourIdx, starts[i + 1] ? block.length : undefined).trim();

    const setSyllables = [...syllableText.matchAll(/[\u4e00-\u9fff]/g)].map(match => match[0]);
    const setWords = (wordText.match(/[\u4e00-\u9fff]+/g) || [])
      .filter(word => word.length > 1)
      .filter(word => !['\u4e2a\u97f3\u8282', '\u5171', '\u5206', '\u9650\u65f6', '\u5206\u949f'].includes(word));
    syllables.push(...setSyllables);
    words.push(...setWords);

    const article = parseArticle(articleRaw, i + 1);
    if (article) articles.push(article);
    topics.push(...parseTopics(speechRaw));

    perSetCounts.push({
      syllables: setSyllables.length,
      words: setWords.length,
      article: article ? 1 : 0,
      topics: parseTopics(speechRaw).length,
    });
  }

  return { syllables, words, articles, topics, perSetCounts, setCount: starts.length };
}

function parseArticle(raw, fallbackNumber) {
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const header = lines[0];
  const workMatch = header.match(/\u4f5c\u54c1\s*(\d+)\s*\u53f7/);
  const workNo = workMatch ? workMatch[1] : String(fallbackNumber);
  const content = lines.slice(1).join('\n')
    .replace(/[∥]/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (content.length < 80) return null;
  return {
    title: `${zh.work}${workNo}\u53f7`,
    content,
  };
}

function parseTopics(raw) {
  const matches = [...raw.matchAll(/\d+[\.．]\s*([^\d\n]+?)(?=\s+\d+[\.．]|\n|$)/g)];
  return matches
    .map(match => match[1].trim())
    .flatMap(item => item.split(/\s{2,}/).map(text => text.trim()))
    .map(item => item.replace(/^[:：]/, '').trim())
    .filter(Boolean)
    .map(item => item.replace(/[。；;]+$/, '').trim());
}

function getPinyinText(text) {
  return pinyin(text, {
    toneType: 'symbol',
    type: 'string',
    v: true,
    nonZh: 'consecutive',
  }).replace(/\s+/g, ' ').trim();
}

function getNumericPinyin(text) {
  return pinyin(text, {
    toneType: 'num',
    type: 'array',
    v: true,
    nonZh: 'consecutive',
  }).map(item => item.trim()).filter(Boolean);
}

function addToneTags(tags, numericPinyin) {
  const toneMap = { 1: zh.tone1, 2: zh.tone2, 3: zh.tone3, 4: zh.tone4 };
  for (const item of numericPinyin) {
    const match = item.match(/[1-4]/);
    if (match) tags.add(toneMap[match[0]]);
  }
}

function inferTags(text) {
  const tags = new Set();
  const numeric = getNumericPinyin(text);
  const plain = numeric.map(item => item.replace(/[1-5]/g, '').replace(/[üv]/g, 'v'));

  if (plain.some(py => /^(zh|ch|sh|r)/.test(py))) tags.add(zh.retroflex);
  if (plain.some(py => /^(z|c|s)(?!h)/.test(py))) tags.add(zh.flat);
  if (plain.some(py => /^n/.test(py))) tags.add(zh.nasalN);
  if (plain.some(py => /^l/.test(py))) tags.add(zh.lateralL);
  if (plain.some(py => /^[fh]/.test(py))) tags.add(zh.fh);
  if (plain.some(py => /[^g]n$/.test(py))) tags.add(zh.frontNasal);
  if (plain.some(py => /ng$/.test(py))) tags.add(zh.backNasal);
  if (text.includes('\u513f') && text.length > 1) tags.add(zh.er);
  addToneTags(tags, numeric);

  if (tags.size === 0) tags.add(zh.common);
  return [...tags];
}

function difficultyFromTags(tags) {
  return tags.length > 1 || !tags.includes(zh.common) ? 'medium' : 'easy';
}

function makeSyllableItems(chars) {
  return [...chars].map((char, index) => {
    const errorType = inferTags(char);
    return {
      id: `s${String(index + 1).padStart(3, '0')}`,
      char,
      pinyin: getPinyinText(char),
      difficulty: difficultyFromTags(errorType),
      errorType,
      tags: errorType,
    };
  });
}

function makeWordItems(words) {
  return [...words].map((word, index) => {
    const errorType = inferTags(word);
    return {
      id: `w${String(index + 1).padStart(3, '0')}`,
      word,
      pinyin: getPinyinText(word),
      difficulty: difficultyFromTags(errorType),
      errorType,
    };
  });
}

function articleDifficultWords(content) {
  const seen = new Set();
  const result = [];
  for (let i = 0; i < content.length && result.length < 12; i++) {
    const char = content[i];
    if (!/[\u4e00-\u9fff]/.test(char) || seen.has(char)) continue;
    const tags = inferTags(char).filter(tag => tag !== zh.common);
    if (tags.length === 0) continue;
    seen.add(char);
    result.push({
      char,
      pinyin: getPinyinText(char),
      position: i,
      errorType: tags.slice(0, 3),
    });
  }
  return result;
}

function makeArticleItems(articles) {
  return [...articles].map((article, index) => {
    const wordCount = [...article.content].filter(char => /[\u4e00-\u9fff]/.test(char)).length;
    return {
      id: `a${String(index + 1).padStart(3, '0')}`,
      title: article.title,
      content: article.content,
      wordCount,
      standardDuration: Math.max(80, Math.round(wordCount / 2.8)),
      difficultWords: articleDifficultWords(article.content),
      tips: '\u6309\u7167\u666e\u901a\u8bdd\u6c34\u5e73\u6d4b\u8bd5\u8282\u594f\u901a\u8bfb\uff0c\u6ce8\u610f\u505c\u8fde\u3001\u91cd\u97f3\u548c\u8bed\u901f\u7a33\u5b9a\u3002',
    };
  });
}

function speechCategory(title) {
  if (/[旅行|假日|童年|朋友|家乡|节日|季节|天气]/.test(title)) return '\u8bb0\u53d9';
  if (/[谈谈|认识|体会|科技|社会|道德|环保|修养|健康|美食]/.test(title)) return '\u8bae\u8bba';
  return '\u8bf4\u660e';
}

function makeSpeechItems(topics) {
  return [...topics].map((title, index) => ({
    id: `sp${String(index + 1).padStart(3, '0')}`,
    topicId: index + 1,
    title,
    category: speechCategory(title),
    outline: [
      `\u8fd9\u4e2a\u8bdd\u9898\u548c\u6211\u7684\u5173\u7cfb`,
      `\u53ef\u4ee5\u4e3e\u4e00\u4e2a\u5177\u4f53\u4f8b\u5b50`,
      `\u6211\u7684\u611f\u53d7\u6216\u770b\u6cd5`,
      `\u6700\u540e\u505a\u4e00\u4e2a\u7b80\u77ed\u603b\u7ed3`,
    ],
    tips: '\u56f4\u7ed5\u9898\u76ee\u8fde\u7eed\u8bf4\u6ee13\u5206\u949f\uff0c\u5c3d\u91cf\u4f7f\u7528\u5b8c\u6574\u53e5\uff0c\u907f\u514d\u957f\u65f6\u95f4\u505c\u987f\u3002',
  }));
}

function main() {
  const oldSyllables = JSON.parse(fs.readFileSync(SYLLABLE_PATH, 'utf8'));
  const oldWords = JSON.parse(fs.readFileSync(WORD_PATH, 'utf8'));
  const oldArticles = JSON.parse(fs.readFileSync(ARTICLE_PATH, 'utf8'));
  const oldSpeeches = JSON.parse(fs.readFileSync(SPEECH_PATH, 'utf8'));
  const extracted = extractDocItems(readDocxText(DOCX_PATH));

  const syllableSet = new Set(oldSyllables.map(item => item.char));
  const wordSet = new Set(oldWords.map(item => item.word));
  extracted.syllables.forEach(char => syllableSet.add(char));
  extracted.words.forEach(word => wordSet.add(word));

  const articleMap = new Map();
  oldArticles.forEach(item => articleMap.set(item.content.replace(/\s+/g, ''), {
    title: item.title,
    content: item.content.replace(/\s+/g, ''),
  }));
  extracted.articles.forEach(item => articleMap.set(item.content.replace(/\s+/g, ''), item));

  const topicSet = new Set(oldSpeeches.map(item => item.title.trim()));
  extracted.topics.forEach(topic => topicSet.add(topic));

  const syllableItems = makeSyllableItems(syllableSet);
  const wordItems = makeWordItems(wordSet);
  const articleItems = makeArticleItems(articleMap.values());
  const speechItems = makeSpeechItems(topicSet);

  fs.writeFileSync(SYLLABLE_PATH, `${JSON.stringify(syllableItems, null, 2)}\n`, 'utf8');
  fs.writeFileSync(WORD_PATH, `${JSON.stringify(wordItems, null, 2)}\n`, 'utf8');
  fs.writeFileSync(ARTICLE_PATH, `${JSON.stringify(articleItems, null, 2)}\n`, 'utf8');
  fs.writeFileSync(SPEECH_PATH, `${JSON.stringify(speechItems, null, 2)}\n`, 'utf8');

  console.log(`Parsed test sets: ${extracted.setCount}`);
  console.log(`Per-set sample counts: ${JSON.stringify(extracted.perSetCounts.slice(0, 5))}`);
  console.log(`Syllables: ${oldSyllables.length} -> ${syllableItems.length}`);
  console.log(`Words: ${oldWords.length} -> ${wordItems.length}`);
  console.log(`Articles: ${oldArticles.length} -> ${articleItems.length}`);
  console.log(`Speaking topics: ${oldSpeeches.length} -> ${speechItems.length}`);
}

main();
