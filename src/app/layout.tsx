import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "普通话每日练",
  description: "普通话水平测试练习工具——单音节字词、多音节词语、短文朗读、命题说话四大题型专项练习",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "普通话练习",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#07C160",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full bg-[#F6F6F6] text-[#1A1A1A] flex flex-col">
        <main className="flex-1 w-full max-w-lg mx-auto pb-16">{children}</main>
      </body>
    </html>
  );
}
