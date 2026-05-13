'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCheckin } from '@/hooks/useCheckin';
import { useWrongBook } from '@/hooks/useWrongBook';
import { useRecords } from '@/hooks/useRecords';
import { isFirstVisit, markVisited } from '@/lib/storage';

const modules = [
  { key: 'syllable', label: '单音节字词', icon: '📝', desc: '汉字·拼音·发音难点', href: '/practice/syllable' },
  { key: 'word', label: '多音节词语', icon: '📚', desc: '轻声·儿化·变调', href: '/practice/word' },
  { key: 'article', label: '短文朗读', icon: '📖', desc: '语速·完整度·流畅度', href: '/practice/article' },
  { key: 'speaking', label: '命题说话', icon: '🎙️', desc: '话题·提纲·计时', href: '/practice/speaking' },
];

export default function HomePage() {
  const { checkedIn, currentStreak, longestStreak, totalCheckins } = useCheckin();
  const { stats: wrongStats } = useWrongBook();
  const { records } = useRecords();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (isFirstVisit()) {
      setShowGuide(true);
      markVisited();
    }
  }, []);

  const totalPractice = records.length;
  const pendingWrong = wrongStats.learning + wrongStats.pending;

  return (
    <div className="px-4 py-6 space-y-5">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">普通话每日练</h1>
          <p className="text-sm text-gray-400 mt-0.5">坚持练习，每天进步</p>
        </div>
        <div className="flex items-center gap-2">
          {checkedIn ? (
            <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              ✓ 今日已打卡
            </span>
          ) : (
            <span className="text-sm bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-medium">
              今日待打卡
            </span>
          )}
        </div>
      </div>

      {/* 打卡统计 */}
      <div className="bg-white rounded-xl p-4 flex items-center justify-around shadow-sm">
        <StatItem value={currentStreak} label="连续打卡" suffix="天" highlight />
        <div className="w-px h-8 bg-gray-100" />
        <StatItem value={longestStreak} label="最长连续" suffix="天" />
        <div className="w-px h-8 bg-gray-100" />
        <StatItem value={totalPractice} label="累计练习" suffix="次" />
      </div>

      {/* 今日推荐 */}
      <Link href="/practice/syllable" className="block">
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-5 text-white shadow-md active:scale-[0.98] transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">今日推荐练习</p>
              <p className="text-lg font-bold mt-1">单音节字词 · 平翘舌专项</p>
              <p className="text-white/70 text-sm mt-1">预计 5 分钟</p>
            </div>
            <div className="text-3xl">→</div>
          </div>
        </div>
      </Link>

      {/* 四大练习模块 */}
      <div className="grid grid-cols-2 gap-3">
        {modules.map((m) => (
          <Link key={m.key} href={m.href} className="block">
            <div className="bg-white rounded-xl p-4 shadow-sm active:scale-[0.97] transition hover:shadow-md">
              <div className="text-2xl mb-2">{m.icon}</div>
              <div className="font-semibold text-gray-900 text-sm">{m.label}</div>
              <div className="text-xs text-gray-400 mt-1">{m.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 快捷入口 */}
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
        <LinkItem
          href="/wrongbook"
          icon="📋"
          title="错音本"
          subtitle={wrongStats.total > 0 ? `${pendingWrong} 个待复习，${wrongStats.mastered} 个已掌握` : '暂无错音'}
          badge={pendingWrong > 0 ? pendingWrong : undefined}
        />
        <LinkItem
          href="/records"
          icon="📊"
          title="练习记录"
          subtitle={totalPractice > 0 ? `共 ${totalPractice} 次练习` : '暂无记录'}
        />
        <LinkItem
          href="/checkin"
          icon="📅"
          title="打卡日历"
          subtitle={`累计打卡 ${totalCheckins} 天`}
        />
      </div>

      {/* 底部链接 */}
      <div className="flex justify-center gap-4 text-xs text-gray-400 pb-4">
        <Link href="/privacy" className="hover:text-gray-600">隐私说明</Link>
        <Link href="/about" className="hover:text-gray-600">关于</Link>
      </div>

      {/* 首次引导弹窗 */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">欢迎使用普通话每日练</h3>
            <div className="text-sm text-gray-600 space-y-2 mb-5">
              <p>· 选择练习模块开始练习</p>
              <p>· 点击麦克风录音，读完后停止</p>
              <p>· 回放录音，自我评估发音</p>
              <p className="text-green-600 font-medium mt-3">🔒 隐私承诺：</p>
              <p className="text-green-600 font-medium">所有录音数据仅存储在您的设备本地</p>
              <p className="text-green-600 font-medium">不会上传到任何服务器</p>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-3 bg-green-500 text-white rounded-xl font-medium active:bg-green-600 transition"
            >
              开始练习
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ value, label, suffix, highlight }: {
  value: number; label: string; suffix: string; highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold tabular-nums ${highlight ? 'text-orange-500' : 'text-gray-800'}`}>
        {value}<span className="text-sm font-normal text-gray-400 ml-0.5">{suffix}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function LinkItem({ href, icon, title, subtitle, badge }: {
  href: string; icon: string; title: string; subtitle: string; badge?: number;
}) {
  return (
    <Link href={href} className="flex items-center px-4 py-3.5 hover:bg-gray-50 transition active:bg-gray-100">
      <span className="text-xl mr-3">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-400">{subtitle}</div>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
          {badge}
        </span>
      )}
      <span className="ml-2 text-gray-300">›</span>
    </Link>
  );
}
