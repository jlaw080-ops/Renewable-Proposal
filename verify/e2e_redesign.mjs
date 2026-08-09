// verify/e2e_redesign.mjs — UI 개편 게이트: 오버플로·모달 포커스 트랩·스크린샷
// 실행: node verify/e2e_redesign.mjs <PREVIEW_URL> <OUT_DIR>
import { chromium } from "playwright";

const BASE = process.argv[2];
const OUT = process.argv[3] ?? "verify/e2e_out";
if (!BASE) { console.error("사용법: node verify/e2e_redesign.mjs <PREVIEW_URL> [OUT_DIR]"); process.exit(1); }

// Vercel Deployment Protection 우회 (프리뷰 SSO) — .env.local의 VERCEL_AUTOMATION_BYPASS_SECRET
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const ctxOpts = BYPASS ? { extraHTTPHeaders: { "x-vercel-protection-bypass": BYPASS } } : {};

const seed = [{
  id: "e2e-seed", name: "E2E검증-개편", createdAt: 1, updatedAt: 1,
  data: {
    input1: {
      사업형태: "공공기관", 사업연도: "2026", 대지위치: "서울특별시", 연면적: 50000,
      용도별연면적목록: [{ 용도: "업무시설", 연면적: 50000 }],
      대지면적: 10000, 건축면적: 5000, 건폐율: 50, 용적률: 500, 위치정보: null,
    },
    input2: { scenarios: [{ id: "ALT-1", systems: [{ 에너지원: "태양광", 형식: "고정식(수평)", 적용용량: 500, 단위에너지생산량: 1358, 원별보정계수: 1.56 }] }] },
  },
}];

const { mkdirSync } = await import("node:fs");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
let fails = 0;
const bad = m => { fails++; console.error("FAIL:", m); };

for (const vw of [320, 375, 768, 1440, 1920]) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, ...ctxOpts });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(s => localStorage.setItem("rp.projects.v1", JSON.stringify(s)), seed);
  for (const [name, path] of [["dash", "/"], ["info", "/project/e2e-seed/info"], ["calc", "/project/e2e-seed/calc"], ["optimize", "/project/e2e-seed/optimize"], ["report", "/project/e2e-seed/report"]]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (ov > 0) bad(`${name}@${vw}px 가로 오버플로 ${ov}px`);
    if (vw === 375 || vw === 1440) await page.screenshot({ path: `${OUT}/${name}-${vw}.png`, fullPage: true });
  }
  await ctx.close();
}

// 모달 포커스 트랩 (1440px)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...ctxOpts });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "새 프로젝트" });
  await trigger.click();
  await page.waitForTimeout(400);
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => document.querySelector(".modal")?.contains(document.activeElement));
    if (!inside) { bad(`모달 Tab ${i + 1}회째 포커스 이탈`); break; }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const restored = await page.evaluate(() => document.activeElement?.textContent?.includes("새 프로젝트"));
  if (!restored) bad("모달 닫힘 후 트리거 포커스 복귀 실패");
  await ctx.close();
}

await browser.close();
console.log(fails === 0 ? "PASS: 오버플로 0 · 모달 트랩 통과" : `FAIL ${fails}건`);
process.exit(fails === 0 ? 0 : 1);
