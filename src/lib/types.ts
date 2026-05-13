// ===== 题库数据类型 =====

export interface SyllableItem {
  id: string;
  char: string;
  pinyin: string;
  difficulty: 'easy' | 'medium' | 'hard';
  errorType: string[];
  tags?: string[];
  tips?: string;
}

export interface WordItem {
  id: string;
  word: string;
  pinyin: string;
  difficulty: 'easy' | 'medium' | 'hard';
  errorType: string[];
  tips?: string;
}

export interface ArticleItem {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  standardDuration: number;
  difficultWords: { char: string; pinyin: string; position: number; errorType?: string[] }[];
  tips: string;
}

export interface SpeechItem {
  id: string;
  topicId: number;
  title: string;
  category: string;
  outline: string[];
  tips: string;
}

export type QuestionType = 'syllable' | 'word' | 'article' | 'speech';

// ===== 练习结果类型 =====

export interface UserResult {
  itemId: string;
  audioBlob?: Blob;
  audioDuration: number;
  selfRating: boolean; // true = 读对了
}

export interface ScoreDetail {
  durationScore: number;
  completenessScore: number;
  fluencyScore?: number;
  selfRatingScore: number;
}

export interface WrongItem {
  content: string;
  pinyin: string;
  errorType: string[];
}

export interface ScoreResult {
  score: number;
  scoreDetail: ScoreDetail;
  grade: '优秀' | '良好' | '一般' | '需加强';
  suggestions: string[];
  wrongItems: WrongItem[];
}

// ===== 练习记录（IndexedDB） =====

export interface PracticeRecord {
  id?: number;
  type: QuestionType;
  questionSummary: string;
  questionIds: string[];
  audioBlob?: Blob;
  audioDuration: number;
  score: number;
  scoreDetail: ScoreDetail;
  wrongItems: WrongItem[];
  createdAt: number; // timestamp
}

// ===== 错音本（IndexedDB） =====

export interface WrongBookItem {
  id?: number;
  type: 'syllable' | 'word';
  content: string;
  pinyin: string;
  errorType: string[];
  sourceType: QuestionType;
  sourceRecordId?: number;
  lastScore: number;
  practiceCount: number;
  consecutiveCorrect: number;
  status: 'pending' | 'learning' | 'mastered';
  createdAt: number;
  updatedAt: number;
  masteredAt: number | null;
}

// ===== 打卡（localStorage） =====

export interface CheckinData {
  dates: string[];
  currentStreak: number;
  longestStreak: number;
}

// ===== 用户设置（localStorage） =====

export interface UserSettings {
  fontSize: 'small' | 'medium' | 'large';
  autoPlay: boolean;
}
