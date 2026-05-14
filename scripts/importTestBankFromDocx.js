const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pinyin } = require('pinyin-pro');

const DOCX_PATH = 'C:\\Users\\1\\Desktop\\普通话水平测试试题.docx';
const ROOT = path.resolve(__dirname, '..');
const SYLLABLE_PATH = path.join(ROOT, 'src', 'data', 'syllable.json');
const WORD_PATH = path.join(ROOT, 'src', 'data', 'word.json');

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

function stripSectionHeader(text) {
  return text.replace(/^[^\n]*\n/, '').replace(/\s+/g, ' ').trim();
}

function extractDocItems(text) {
  const title = '国家普通话水平测试题';
  const one = '一、读单音节字词';
  const two = '二、读多音节词语';
  const three = '三、';

  const starts = [];
  let pos = 0;
  while ((pos = text.indexOf(title, pos)) >= 0) {
    starts.push(pos);
    pos += title.length;
  }

  const syllables = [];
  const words = [];
  const perSetCounts = [];

  for (let i = 0; i < starts.length; i++) {
    const block = text.slice(starts[i], starts[i + 1] || text.length);
    const oneIdx = block.indexOf(one);
    const twoIdx = block.indexOf(two);
    const threeIdx = block.indexOf(three, twoIdx + 1);
    if (oneIdx < 0 || twoIdx < 0 || threeIdx < 0) continue;

    const syllableText = stripSectionHeader(block.slice(oneIdx + one.length, twoIdx));
    const wordText = stripSectionHeader(block.slice(twoIdx + two.length, threeIdx));
    const setSyllables = [...syllableText.matchAll(/[\u4e00-\u9fff]/g)].map(match => match[0]);
    const setWords = (wordText.match(/[\u4e00-\u9fff]+/g) || [])
      .filter(word => word.length > 1)
      .filter(word => !['个音节', '共', '分', '限时', '分钟'].includes(word));

    syllables.push(...setSyllables);
    words.push(...setWords);
    perSetCounts.push({ syllables: setSyllables.length, words: setWords.length });
  }

  return { syllables, words, perSetCounts, setCount: starts.length };
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
  const toneMap = {
    1: '声调(一声)',
    2: '声调(二声)',
    3: '声调(三声)',
    4: '声调(四声)',
  };
  for (const item of numericPinyin) {
    const match = item.match(/[1-4]/);
    if (match) tags.add(toneMap[match[0]]);
  }
}

function inferTags(text) {
  const tags = new Set();
  const numeric = getNumericPinyin(text);
  const plain = numeric.map(item => item.replace(/[1-5]/g, '').replace(/ü/g, 'v'));

  if (plain.some(py => /^(zh|ch|sh|r)/.test(py))) tags.add('翘舌音');
  if (plain.some(py => /^(z|c|s)(?!h)/.test(py))) tags.add('平舌音');
  if (plain.some(py => /^n/.test(py))) tags.add('鼻音(n)');
  if (plain.some(py => /^l/.test(py))) tags.add('边音(l)');
  if (plain.some(py => /^[fh]/.test(py))) tags.add('f/h混淆');
  if (plain.some(py => /[^g]n$/.test(py))) tags.add('前鼻音');
  if (plain.some(py => /ng$/.test(py))) tags.add('后鼻音');
  if (text.includes('儿') && text.length > 1) tags.add('儿化');
  addToneTags(tags, numeric);

  if (tags.size === 0) tags.add('常用字');
  return [...tags];
}

function difficultyFromTags(tags) {
  return tags.length > 1 || !tags.includes('常用字') ? 'medium' : 'easy';
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

function main() {
  const oldSyllables = JSON.parse(fs.readFileSync(SYLLABLE_PATH, 'utf8'));
  const oldWords = JSON.parse(fs.readFileSync(WORD_PATH, 'utf8'));
  const text = readDocxText(DOCX_PATH);
  const extracted = extractDocItems(text);

  const syllableSet = new Set(oldSyllables.map(item => item.char));
  const wordSet = new Set(oldWords.map(item => item.word));
  extracted.syllables.forEach(char => syllableSet.add(char));
  extracted.words.forEach(word => wordSet.add(word));

  const syllableItems = makeSyllableItems(syllableSet);
  const wordItems = makeWordItems(wordSet);

  fs.writeFileSync(SYLLABLE_PATH, `${JSON.stringify(syllableItems, null, 2)}\n`, 'utf8');
  fs.writeFileSync(WORD_PATH, `${JSON.stringify(wordItems, null, 2)}\n`, 'utf8');

  console.log(`Parsed test sets: ${extracted.setCount}`);
  console.log(`Per-set sample counts: ${JSON.stringify(extracted.perSetCounts.slice(0, 5))}`);
  console.log(`Syllables: ${oldSyllables.length} -> ${syllableItems.length}`);
  console.log(`Words: ${oldWords.length} -> ${wordItems.length}`);
}

main();
