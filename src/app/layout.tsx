import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "test-estimator · Cafe24 가변 옵션 상품 견적 도구",
    template: "%s · test-estimator",
  },
  description:
    "Cafe24 쇼핑몰의 가변 옵션 상품을 관리하고, 옵션 조합 기반 동적 상품을 자동으로 생성·견적해주는 관리 도구입니다.",
  applicationName: "test-estimator",
  keywords: ["Cafe24", "카페24", "가변 옵션", "동적 상품", "견적", "estimator", "쇼핑몰 관리"],
  authors: [{ name: "test-estimator" }],
  creator: "test-estimator",
  formatDetection: { email: false, address: false, telephone: false },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    type: "website",
    siteName: "test-estimator",
    title: "test-estimator · Cafe24 가변 옵션 상품 견적 도구",
    description: "Cafe24 가변 옵션 상품을 관리하고 옵션 조합으로 동적 상품을 자동 생성·견적합니다.",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: "test-estimator",
    description: "Cafe24 가변 옵션 상품 관리 · 동적 상품 생성 · 견적 자동화 도구.",
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col bg-surface-page text-text-primary">{children}</body>
    </html>
  );
}
