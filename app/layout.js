import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
import ToastProvider from "@/components/ui/ToastProvider";
import "./globals.css";

const sans = localFont({
  src: [
    { path: "./fonts/NanumSquareNeoTTF-bRg.woff2", weight: "400" },
    { path: "./fonts/NanumSquareNeoTTF-cBd.woff2", weight: "700" },
    { path: "./fonts/NanumSquareNeoTTF-dEb.woff2", weight: "800" },
  ],
  variable: "--font-sans",
  display: "swap",
});
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
