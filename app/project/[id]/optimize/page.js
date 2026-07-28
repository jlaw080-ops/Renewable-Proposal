"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getProject, updateProject } from "@/lib/projectStore";
import { useEngineReady } from "@/lib/useEngineReady";
import { calc규모등급, canCalculate, buildEngineInput2 } from "@/lib/calcModel";
import { EMPTY_INPUT3, buildOptimizeCtx, withAreaDefaults, autoRequirements } from "@/lib/optimizeModel";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import OptimizeForm from "@/components/optimize/OptimizeForm";
import ComboCard from "@/components/optimize/ComboCard";
import RecommendPanel from "@/components/optimize/RecommendPanel";
import { buildCandidates, requestRecommend } from "@/lib/recommendClient";
import "./optimize.css";

const MAX_SHOW = 20;

export default function OptimizePage() {
  const { id } = useParams();
  const { ready, error: engineError } = useEngineReady();
  const [input1, setInput1] = useState(null);
  const [input2, setInput2] = useState(null);
  const [input3, setInput3] = useState(null);
  const [memos, setMemos] = useState({});
  const [derived, setDerived] = useState({ 에너지소요량: null, 의무비율: null, 전력소비량: null });
  const [result, setResult] = useState(null);      // Optimizer.optimize() 반환
  const [runError, setRunError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState({ status: "idle", result: null, error: null });
  const lastAutoKey = useRef("");                  // 요구도 자동 반영 중복 방지

  useEffect(() => {
    const p = getProject(id);
    if (!p) return;
    setInput1(p.data.input1 ?? null);
    setInput2(p.data.input2 ?? null);
    setInput3({ ...EMPTY_INPUT3, ...(p.data.input3 ?? {}), 면적비율: { ...EMPTY_INPUT3.면적비율, ...(p.data.input3?.면적비율 ?? {}) }, 요구도: { ...EMPTY_INPUT3.요구도, ...(p.data.input3?.요구도 ?? {}) } });
    setMemos(p.data.optMemos ?? {});
    setAi(a => (p.data.aiRecommend ? { status: "done", result: p.data.aiRecommend, error: null } : a));
  }, [id]);

  // 파생값: 검토 계산 재실행 (calc 페이지와 동일 체계)
  useEffect(() => {
    if (!ready || !input1) return;
    const check = canCalculate(input1);
    if (!check.ok || !input2) { setDerived(d => ({ ...d, 에너지소요량: null, 의무비율: null })); return; }
    let alive = true;
    const 카테고리 = calc규모등급(input1.용도별연면적목록 ?? []);
    import("@/engine/index.js")
      .then(({ runCalculation }) => runCalculation(input1, buildEngineInput2(input2.scenarios), 카테고리))
      .then(r => {
        if (!alive) return;
        setDerived(d => ({ ...d, 에너지소요량: r.output1.총예상에너지사용량, 의무비율: r.output2[0]?.의무비율 ?? null }));
      })
      .catch(() => alive && setDerived(d => ({ ...d, 에너지소요량: null, 의무비율: null })));
    return () => { alive = false; };
  }, [ready, input1, input2]);

  // 파생값: 전력소비량 (건물유형 + input1.연면적)
  useEffect(() => {
    if (!ready || !input3) return;
    const 연면적 = Number(input1?.연면적) || 0;
    if (input3.건물유형 && 연면적 > 0 && window.PowerEstimator) {
      const e = window.PowerEstimator.estimate([{ 건물유형: input3.건물유형, 연면적 }]);
      setDerived(d => ({ ...d, 전력소비량: e.연간예상전력소비량 }));
    } else {
      setDerived(d => ({ ...d, 전력소비량: null }));
    }
  }, [ready, input3?.건물유형, input1?.연면적]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyInput3(next) {
    // 건물유형 변경 시: 외피 기본값 갱신 + 표준 요구도 자동 반영 (legacy 동작)
    if (next.건물유형 !== input3.건물유형) {
      next = { ...next, 면적비율: withAreaDefaults({ ...next.면적비율, 외피: { min: "", max: "" } }, next.건물유형) };
      const autoKey = `${input1?.사업형태 ?? ""}|${next.건물유형}`;
      if (autoKey !== lastAutoKey.current && typeof window !== "undefined" && window.LIB_요구도) {
        const auto = autoRequirements(window.LIB_요구도, input1?.사업형태 ?? "", next.건물유형,
          window.OPT_CONFIG?.요구도점수);
        if (auto) next = { ...next, 요구도: { ...next.요구도, ...auto } };
        lastAutoKey.current = autoKey;
      }
    }
    setInput3(next);
    updateProject(id, { data: { input3: next } });
  }

  function applyMemo(rank, text) {
    const next = { ...memos, [rank]: text };
    setMemos(next);
    updateProject(id, { data: { optMemos: next } });
  }

  async function runRecommend() {
    if (!result) return;
    setAi({ status: "loading", result: null, error: null });
    try {
      const candidates = buildCandidates(result.r.ranked);
      const parsed = await requestRecommend({ ctx: result.ctx, candidates });
      setAi({ status: "done", result: parsed, error: null });
      updateProject(id, { data: { aiRecommend: parsed } });
    } catch (e) {
      setAi({ status: "idle", result: null, error: e.message });
    }
  }

  async function runOptimize() {
    setRunError(null);
    if (!derived.에너지소요량 || derived.에너지소요량 <= 0) {
      setRunError("연간 에너지소요량이 없습니다 — ①사업정보·②검토 계산을 먼저 완료하세요."); return;
    }
    if (derived.의무비율 == null) {
      setRunError("의무설치비율이 없습니다 — ②검토 계산에서 판정을 확인하세요."); return;
    }
    if (!window.Optimizer) { setRunError("최적화 엔진 미로드"); return; }
    setBusy(true); setResult(null);
    try {
      const { normalize대지위치 } = await import("@/engine/libraryLoader.js");
      const 면적비율 = withAreaDefaults(input3.면적비율, input3.건물유형);
      const ctx = buildOptimizeCtx({
        input1, input3: { ...input3, 면적비율 },
        총예상에너지사용량: derived.에너지소요량, 의무비율: derived.의무비율,
        연간예상전력소비량: derived.전력소비량 ?? 0,
        지자체: normalize대지위치(input1?.대지위치 ?? "") ?? "",
      });
      await new Promise(r => setTimeout(r, 30));    // 로딩 표시 페인트 (legacy 동일)
      const r = window.Optimizer.optimize(ctx);
      setResult({ r, ctx });
    } catch (e) {
      setRunError(`오류: ${e.message}`);
    } finally { setBusy(false); }
  }

  if (input3 === null) return null;   // 로딩 (가드는 WorkspaceShell)

  const shown = result ? result.r.ranked.slice(0, MAX_SHOW) : [];

  return (
    <div className="opt">
      <Card title="③ 최적화 입력" actions={
        <Button onClick={runOptimize} disabled={busy || !ready}>{busy ? "탐색 중…" : "최적 조합 탐색"}</Button>
      }>
        {engineError && <p className="opt__notice" role="status">엔진 로드 실패: {engineError}</p>}
        {!ready && !engineError && <p className="opt__hint">계산 엔진 로딩 중…</p>}
        {ready && (
          <OptimizeForm input3={input3} input1={input1} derived={derived}
            lib={{ 유형목록: window.PowerEstimator ? window.PowerEstimator.유형목록() : [] }}
            onChange={applyInput3} />
        )}
        {runError && <p className="opt__notice" role="status">{runError}</p>}
      </Card>

      {result && (
        <Card title="조합 순위" inner>
          <p className="opt__summary">
            실행가능 {result.r.실행가능건수}개 중 {shown.length}개 표시 (종합점수 상위 {MAX_SHOW}) · 평가 {result.r.평가건수}건
            {result.r.표시제외건수 > 0 ? ` · 적합도 미달 제외 ${result.r.표시제외건수}건` : ""}
          </p>
          <RecommendPanel status={ai.status} aiResult={ai.result} error={ai.error}
            onRun={runRecommend} disabled={!result || shown.length === 0} />
          {shown.length === 0 && <p className="opt__notice">조건을 충족하는 조합이 없습니다. 면적·기준을 완화해 보세요.</p>}
          <div className="opt__grid">
            {shown.map(combo => {
              const aiRank = ai.result?.ai_ranking?.find(r => r.id === combo.rank);
              return (
                <ComboCard key={combo.rank} combo={combo} memo={memos[combo.rank]}
                  aiBadge={ai.result?.best_pick === combo.rank}
                  aiReason={aiRank?.reasoning ?? null}
                  onMemoChange={applyMemo} />
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
