import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <Link href="/" className="text-gray-400 text-sm active:text-gray-600 mb-4 inline-block">‹ 返回首页</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-6">关于</h1>

      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4 text-sm leading-relaxed text-gray-700">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">🎙️</div>
          <h2 className="text-lg font-bold text-gray-900">普通话每日练</h2>
          <p className="text-gray-400 text-xs mt-1">版本 1.0.0 MVP</p>
        </div>

        <section>
          <h3 className="font-semibold text-gray-900 mb-1">这是什么？</h3>
          <p>一个面向普通话水平测试考生的轻量级练习工具，支持单音节字词、多音节词语、短文朗读、命题说话四大题型的分项练习。</p>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900 mb-1">主要功能</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>四大题型专项练习</li>
            <li>浏览器录音与回放</li>
            <li>基础评分与反馈</li>
            <li>错音本收集与复练</li>
            <li>每日打卡激励</li>
            <li>练习记录管理</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900 mb-1">技术特点</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>PWA 离线可用，可添加到手机桌面</li>
            <li>所有数据本地存储，不上传服务器</li>
            <li>无需注册登录，打开即用</li>
            <li>完全免费，无广告无付费</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-gray-900 mb-1">重要提示</h3>
          <p className="text-orange-600">本工具的评分和反馈仅供练习参考，不代表官方普通话水平测试成绩。</p>
        </section>
      </div>
    </div>
  );
}
