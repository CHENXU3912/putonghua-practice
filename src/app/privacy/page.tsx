import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="px-4 py-8 max-w-lg mx-auto">
      <Link href="/" className="text-gray-400 text-sm active:text-gray-600 mb-4 inline-block">‹ 返回首页</Link>
      <h1 className="text-xl font-bold text-gray-900 mb-6">隐私说明</h1>

      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="font-semibold text-gray-900 mb-2">数据存储位置</h2>
          <p>本工具的所有数据均存储在<strong>您的设备本地浏览器中</strong>，包括：</p>
          <ul className="list-disc list-inside mt-1 space-y-1 text-gray-600">
            <li>练习录音文件（存储在浏览器 IndexedDB 中）</li>
            <li>练习记录、错音本数据（存储在浏览器 IndexedDB 中）</li>
            <li>打卡记录、用户设置（存储在浏览器 localStorage 中）</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">数据上传说明</h2>
          <p><strong className="text-green-600">我们不会将您的任何数据上传到服务器。</strong></p>
          <p className="text-gray-600 mt-1">录音、练习记录、错音本、打卡数据全部保存在您的设备本地，我们无法访问这些数据。</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">麦克风权限</h2>
          <p>录音功能需要访问您的麦克风。浏览器会在您首次录音时弹窗询问是否允许。麦克风权限仅用于录音功能，录音数据不会离开您的设备。</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">数据删除</h2>
          <p>您可以在"练习记录"页面中逐条删除练习记录及其关联的录音文件。清除浏览器数据会同时清除本工具的所有数据。</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">第三方服务</h2>
          <p>本工具目前不接入任何第三方服务，不包含任何追踪器或分析工具。</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">免责声明</h2>
          <p className="text-gray-600">本工具是普通话练习辅助工具，所有评分和反馈仅供练习参考，不代表官方普通话水平测试成绩。</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-2">联系我们</h2>
          <p className="text-gray-600">如有隐私相关问题，可通过 GitHub Issues 联系我们。</p>
        </section>
      </div>
    </div>
  );
}
