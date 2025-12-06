import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 左下に表示される開発者ツール（雷マークなど）を非表示にする設定
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
};

export default nextConfig;