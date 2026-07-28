"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProject, updateProject } from "@/lib/projectStore";
import { useEngineReady } from "@/lib/useEngineReady";
import { calc규모등급, canCalculate, buildEngineInput2, EMPTY_INPUT2 } from "@/lib/calcModel";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ScenarioEditor from "@/components/calc/ScenarioEditor";
import Output1Table from "@/components/calc/Output1Table";
import Output2Panel from "@/components/calc/Output2Panel";
import "./calc.css";

export default function CalcPage() {
  const { id } = useParams();
  const { ready, error: engineError } = useEngineReady();
  const [input1, setInput1] = useState(null);
  const [input2, setInput2] = useState(null);
  const [lib, setLib] = useState(null);          // { 에너지원목록, 형식목록, 계수 }
  const [result, setResult] = useState(null);    // { output1, output2 } | null
  const [calcError, setCalcError] = useState(null);

  useEffect(() => {
    const p = getProject(id);
    if (!p) return;
    setInput1(p.data.input1 ?? null);
    setInput2(p.data.input2 ?? structuredClone(EMPTY_INPUT2));
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    import("@/engine/libraryLoader.js").then(m => {
      if (!alive) return;
      setLib({ 에너지원목록: m.get에너지원목록(), 형식목록: m.get형식목록, 계수: m.get신재생에너지계수 });
    });
    return () => { alive = false; };
  }, [ready]);

  const check = canCalculate(input1 ?? {});
  const 카테고리 = calc규모등급(input1?.용도별연면적목록 ?? []);

  useEffect(() => {
    if (!ready || !input1 || !input2 || !check.ok) { setResult(null); return; }
    let alive = true;
    import("@/engine/index.js")
      .then(({ runCalculation }) => runCalculation(input1, buildEngineInput2(input2.scenarios), 카테고리))
      .then(r => { if (alive) { setResult(r); setCalcError(null); } })
      .catch(e => { if (alive) { setResult(null); setCalcError(e.message); } });
    return () => { alive = false; };
  }, [ready, input1, input2, 카테고리, check.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyInput2(nextScenarios) {
    const next = { scenarios: nextScenarios };
    setInput2(next);
    updateProject(id, { data: { input2: next } });
  }

  if (input1 === null && input2 === null) return null; // 프로젝트 로딩(가드는 WorkspaceShell 담당)

  return (
    <div className="calc">
      <Card title="② 검토 계산" actions={
        <span className="calc__cat" title="주거: 세대수 기준 / 비주거: 용도별 연면적 합계 기준으로 자동 결정됩니다">
          규모등급(카테고리) <Badge tone={카테고리 ? "brand" : "na"}>{카테고리 || "미판정"}</Badge>
        </span>
      }>
        {!check.ok && (
          <p className="calc__notice" role="status">
            사업정보가 부족합니다: {check.missing.join(", ")} — ① 사업정보에서 입력을 완료하세요.
          </p>
        )}
        {check.ok && !카테고리 && (
          <p className="calc__notice" role="status">공동주택 세대 수를 선택하면 규모등급이 판정됩니다 (① 사업정보).</p>
        )}
        {engineError && <p className="calc__notice" role="status">엔진 로드 실패: {engineError}</p>}
        {!ready && !engineError && <p className="calc__hint">계산 엔진 로딩 중…</p>}
        {calcError && <p className="calc__notice" role="status">계산 오류: {calcError}</p>}
      </Card>

      {result && (
        <Card title="예상에너지사용량 (Output 1)">
          <Output1Table output1={result.output1} />
        </Card>
      )}

      <Card title="시나리오 (ALT)">
        {lib && input2
          ? <ScenarioEditor scenarios={input2.scenarios} lib={lib} onChange={applyInput2} />
          : <p className="calc__hint">계산 엔진 로딩 중…</p>}
      </Card>

      {result && (
        <Card title="신재생에너지 설치비율 (Output 2)">
          {result.output2.map(alt => <Output2Panel key={alt.id} alt={alt} />)}
        </Card>
      )}
    </div>
  );
}
