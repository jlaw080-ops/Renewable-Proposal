// components/info/RequiredChecklist.jsx — 계산 필수 항목 충족 현황 (판정은 canCalculate 재사용)
"use client";
import Card from "@/components/ui/Card";
import { canCalculate, calc규모등급 } from "@/lib/calcModel";
import "./requiredChecklist.css";

const REQUIRED = ["사업형태", "사업연도", "대지위치", "용도별 연면적"];

export default function RequiredChecklist({ input1 }) {
  const { ok, missing } = canCalculate(input1 ?? {});
  const done = REQUIRED.length - missing.length;
  const 세대수미선택 = (input1?.용도별연면적목록 ?? []).some(r => r.용도 === "공동주택")
    && !calc규모등급(input1?.용도별연면적목록 ?? []);

  return (
    <Card inner className="rq">
      {ok ? (
        <p className="rq__done">✓ 필수 항목을 모두 입력했습니다 — ② 검토 계산에서 결과를 확인하세요.</p>
      ) : (
        <>
          <p className="rq__head">
            계산에 필수인 항목 <span className="mono">{done}/{REQUIRED.length} 입력됨</span>
          </p>
          <ul className="rq__list">
            {REQUIRED.map(label => {
              const filled = !missing.includes(label);
              return (
                <li key={label} className={filled ? "rq__item rq__item--done" : "rq__item"}>
                  <span aria-hidden="true">{filled ? "✓" : "○"}</span>
                  <span>{label}</span>
                  <span className="visually-hidden">{filled ? "입력됨" : "미입력"}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {세대수미선택 && (
        <p className="rq__note">공동주택 세대 수를 선택하면 규모등급이 판정됩니다.</p>
      )}
    </Card>
  );
}
