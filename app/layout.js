import { Noto_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import ToastProvider from "@/components/ui/ToastProvider";
import "./globals.css";

const sans = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-plex-mono" });

export const metadata = {
  title: "신재생에너지 의무설치비율 검토",
  description: "건축물 신재생에너지 의무설치비율 계산·최적화·AI 검토",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${sans.variable} ${mono.variable}`}>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
