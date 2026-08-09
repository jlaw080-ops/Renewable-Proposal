// tests/tokensContrast.test.mjs — 토큰 색 쌍 WCAG 대비 게이트 (텍스트 4.5:1 / 비텍스트 3.0:1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
const tok = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) tok[m[1]] = m[2];

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = h => {
  const x = h.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
function ratio(f, b) {
  assert.ok(tok[f], `토큰 없음: --${f}`);
  assert.ok(tok[b], `토큰 없음: --${b}`);
  const [a, c] = [lum(tok[f]), lum(tok[b])];
  const [hi, lo] = a > c ? [a, c] : [c, a];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS = [ // 전경, 배경 — 4.5:1 이상
  ["text-primary", "bg-card"], ["text-primary", "bg-page"],
  ["text-secondary", "bg-card"], ["text-secondary", "bg-page"], ["text-secondary", "bg-card-inner"],
  ["text-hint", "bg-card"], ["text-hint", "bg-page"], ["text-hint", "bg-card-inner"],
  ["text-invert", "accent-primary"], ["text-invert", "accent-primary-dim"],
  ["accent-action", "bg-card"],
  ["color-pass", "color-pass-bg"], ["color-pass", "bg-card"],
  ["color-fail", "color-fail-bg"], ["color-fail", "bg-card"],
  ["color-na", "color-na-bg"],
  ["accent-warm", "accent-warm-bg"], ["accent-warm-dim", "bg-card"],
  ["nav-text", "nav-bg"], ["nav-text-dim", "nav-bg"],
];
const NONTEXT_PAIRS = [ // 3.0:1 이상 (포커스 링·활성 표시·게이지)
  ["border-focus", "bg-card"], ["accent-graphic", "bg-card"], ["nav-active", "nav-bg"],
];

test("텍스트 색 쌍 대비 4.5:1 이상", () => {
  for (const [f, b] of TEXT_PAIRS)
    assert.ok(ratio(f, b) >= 4.5, `--${f} / --${b} = ${ratio(f, b).toFixed(2)}:1 (< 4.5)`);
});
test("비텍스트 색 쌍 대비 3.0:1 이상", () => {
  for (const [f, b] of NONTEXT_PAIRS)
    assert.ok(ratio(f, b) >= 3.0, `--${f} / --${b} = ${ratio(f, b).toFixed(2)}:1 (< 3.0)`);
});
