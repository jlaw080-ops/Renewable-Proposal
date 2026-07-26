import "./globals.css";

export const metadata = {
  title: "신재생에너지 의무설치비율 검토",
  description: "건축물 신재생에너지 의무설치비율 계산·최적화·AI 검토",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
