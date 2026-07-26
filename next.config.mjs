/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // WORKAROUND: Turbopack (Next.js 16+) UTF-8 한국어 경로명 버그
    // 증상: TurbopackInternalError - "start byte index 90 is not a char boundary; it is inside '신'"
    // 원인: Turbopack이 workspace root를 잘못 추론하면서 한국어 경로명의 UTF-8 바이트 경계 오류
    // 해결: turbopack.root를 명시적으로 설정하여 프로젝트 루트 지정
    // 제거 조건: Turbopack 버그 수정 시 (upstream issue 해결), 이 줄 제거 후 npm run build 재확인
    root: process.cwd(),
  },
};
export default nextConfig;
