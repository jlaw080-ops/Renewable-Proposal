"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getProject, updateProject } from "@/lib/projectStore";
import { useEngineReady } from "@/lib/useEngineReady";
import { useToast } from "@/components/ui/ToastProvider";
import { calc규모등급, canCalculate, buildEngineInput2 } from "@/lib/calcModel";
import { EMPTY_INPUT3, buildOptimizeCtx, withAreaDefaults, autoRequirements } from "@/lib/optimizeModel";
import { explainCard, openComboReport } from "@/lib/optimizeExtras";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import OptimizeForm from "@/components/optimize/OptimizeForm";
import OptimizeInputSettings from "@/components/optimize/OptimizeInputSettings";
import ComboCard from "@/components/optimize/ComboCard";
import ComboTable from "@/components/optimize/ComboTable";
import RecommendPanel from "@/components/optimize/RecommendPanel";
import ConstraintsModal, { constraintsSummary } from "@/components/optimize/ConstraintsModal";
import SettingsModal from "@/components/settings/SettingsModal";
import { buildCandidates, requestRecommend } from "@/lib/recommendClient";
import { SORT_KEYS, sortCombos, filterCombos, energySources } from "@/lib/comboView";
import "./optimize.css";

const MAX_SHOW = 20;

export default function OptimizePage() {
  const { id } = useParams();
  const { ready, error: engineError } = useEngineReady();
  const { push } = useToast();
  const [input1, setInput1] = useState(null);
  const [input2, setInput2] = useState(null);
  const [input3, setInput3] = useState(null);
  const [memos, setMemos] = useState({});
  const [explains, setExplains] = useState({});
  const [explainingRank, setExplainingRank] = useState(null);
  const [derived, setDerived] = useState({ 에너지소요량: null, 의무비율: null, 전력소비량: null });
  const [result, setResult] = useState(null);      // Optimizer.optimize() 반환
  const [runError, setRunError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState({ status: "idle", result: null, error: null });
  const [aiConstraints, setAiConstraints] = useState(null);
  const [constraintsModalOpen, setConstraintsModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState("table");          // "table" | "cards" — 저장 안 함(세션 상태)
  const [sort, setSort] = useState({ key: "score", dir: "desc" });
  const [의무충족만, set의무충족만] = useState(false);
  const [sources, setSources] = useState([]);
  const lastAutoKey = useRef("");                  // 요구도 자동 반영 중복 방지

  useEffect(() => {
    const p = getProject(id);
    if (!p) return;
    setInput1(p.data.input1 ?? null);
    setInput2(p.data.input2 ?? null);
    setInput3({ ...EMPTY_INPUT3, ...(p.data.input3 ?? {}), 면적비율: { ...EMPTY_INPUT3.면적비율, ...(p.data.input3?.면적비율 ?? {}) }, 요구도: { ...EMPTY_INPUT3.요구도, ...(p.data.input3?.요구도 ?? {}) } });
    setMemos(p.data.optMemos ?? {});
    setExplains(p.data.optExplains ?? {});
    setAi(a => (p.data.aiRecommend ? { status: "done", result: p.data.aiRecommend, error: null } : a));
    setAiConstraints(p.data.aiConstraints ?? null);
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

  function applyConstraints(c) {
    setAiConstraints(c);
    updateProject(id, { data: { aiConstraints: c } });
  }

  async function runRecommend() {
    if (!result) return;
    setAi({ status: "loading", result: null, error: null });
    try {
      const candidates = buildCandidates(result.r.ranked);
      const parsed = await requestRecommend({ ctx: result.ctx, candidates, constraints: aiConstraints });
      setAi({ status: "done", result: parsed, error: null });
      updateProject(id, { data: { aiRecommend: parsed } });
    } catch (e) {
      setAi({ status: "idle", result: null, error: e.message });
    }
  }

  async function runExplain(combo) {
    if (!result) return;
    setExplainingRank(combo.rank);
    try {
      const text = await explainCard(combo, result.ctx);
      const next = { ...explains, [combo.rank]: text };
      setExplains(next);
      updateProject(id, { data: { optExplains: next } });
    } catch (e) {
      push({ message: `AI 설명 실패: ${e.message}`, tone: "fail" });
    } finally { setExplainingRank(null); }
  }

  async function openReport() {
    if (!result) return;
    const memosCopy = { ...memos };
    const onFocus = () => {
      setMemos({ ...memosCopy });
      updateProject(id, { data: { optMemos: { ...memosCopy } } });
      window.removeEventListener("focus", onFocus);
    };
    window.addEventListener("focus", onFocus);
    try { await openComboReport(result.r, result.ctx, { ...explains }, memosCopy); }
    catch (e) { window.removeEventListener("focus", onFocus); push({ message: e.message, tone: "fail" }); }
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

  // 필터·정렬을 ranked 전체에 적용한 뒤 상위 MAX_SHOW — 필터 조건의 상위가 나와야 의미가 있다
  const allRanked = result?.r.ranked ?? [];
  const 에너지원목록 = energySources(allRanked);
  const filtered = filterCombos(allRanked, { 의무충족만, sources });
  const shown = sortCombos(filtered, sort.key, sort.dir).slice(0, MAX_SHOW);

  function toggleSort(key) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: SORT_KEYS.find(s => s.key === key)?.dir ?? "desc" });
  }

  function toggleSource(src) {
    setSources(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]);
  }

  function resetFilters() { set의무충족만(false); setSources([]); }

  function pickCombo(rank) {
    setView("cards");
    requestAnimationFrame(() => {
      document.getElementById(`combo-${rank}`)?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <div className="opt">
      <Card title="③ 최적화 입력" actions={
        <>
          <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}>설정</Button>
          <Button onClick={runOptimize} disabled={busy || !ready}>{busy ? "탐색 중…" : "최적 조합 탐색"}</Button>
        </>
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

      {!result && ai.result && (
        <Card title="AI 추천 (저장된 결과)" inner>
          <RecommendPanel status={ai.status} aiResult={ai.result} error={ai.error}
            onRun={runRecommend} onOpenConstraints={() => setConstraintsModalOpen(true)}
            constraintsLabel={constraintsSummary(aiConstraints)} disabled />
          <p className="opt__hint">[최적 조합 탐색]을 다시 실행하면 추천 조합에 ⭐ 배지와 근거가 표시됩니다.</p>
        </Card>
      )}

      {result && (
        <Card title="조합 순위" inner actions={result && shown.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={openReport}>조합 보고서</Button>
        ) : null}>
          <p className="opt__summary">
            실행가능 {result.r.실행가능건수}개 중 {shown.length}개 표시 (종합점수 상위 {MAX_SHOW}) · 평가 {result.r.평가건수}건
            {result.r.표시제외건수 > 0 ? ` · 적합도 미달 제외 ${result.r.표시제외건수}건` : ""}
          </p>
          <RecommendPanel status={ai.status} aiResult={ai.result} error={ai.error}
            onRun={runRecommend} onOpenConstraints={() => setConstraintsModalOpen(true)}
            constraintsLabel={constraintsSummary(aiConstraints)} disabled={!result || shown.length === 0} />

          <div className="opt__controls">
            <div className="opt__viewtoggle" role="group" aria-label="표시 방식">
              <Button size="sm" variant={view === "table" ? "primary" : "ghost"} onClick={() => setView("table")}>표</Button>
              <Button size="sm" variant={view === "cards" ? "primary" : "ghost"} onClick={() => setView("cards")}>카드</Button>
            </div>
            <label className="opt__filter">
              <input type="checkbox" checked={의무충족만} onChange={e => set의무충족만(e.target.checked)} />
              의무비율 충족만
            </label>
            {에너지원목록.length > 0 && (
              <span className="opt__sources">
                {에너지원목록.map(src => (
                  <label key={src} className="opt__filter">
                    <input type="checkbox" checked={sources.includes(src)} onChange={() => toggleSource(src)} />
                    {src}
                  </label>
                ))}
              </span>
            )}
            {(의무충족만 || sources.length > 0) && (
              <Button size="sm" variant="ghost" onClick={resetFilters}>필터 초기화</Button>
            )}
          </div>

          {shown.length === 0 && (
            <p className="opt__notice" role="status">
              {allRanked.length === 0
                ? "조건을 충족하는 조합이 없습니다. 면적·기준을 완화해 보세요."
                : "조건에 맞는 조합이 없습니다 — 필터를 완화하세요."}
            </p>
          )}

          {view === "table" ? (
            shown.length > 0 && (
              <ComboTable combos={shown} sortKey={sort.key} sortDir={sort.dir}
                onSort={toggleSort} onPick={pickCombo} aiBest={ai.result?.best_pick ?? null} />
            )
          ) : (
            <div className="opt__grid">
              {shown.map(combo => {
                const aiRank = ai.result?.ai_ranking?.find(r => r.id === combo.rank);
                return (
                  <div key={combo.rank} id={`combo-${combo.rank}`} className="opt__cardslot">
                    <ComboCard combo={combo} memo={memos[combo.rank]}
                      aiBadge={ai.result?.best_pick === combo.rank}
                      aiReason={aiRank?.reasoning ?? null}
                      onMemoChange={applyMemo}
                      explain={explains[combo.rank] ?? null}
                      explaining={explainingRank === combo.rank}
                      onExplain={runExplain} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <ConstraintsModal open={constraintsModalOpen} value={aiConstraints}
        energySources={window?.LIB_에너지원목록 ?? []}
        onClose={() => setConstraintsModalOpen(false)}
        onApply={applyConstraints} />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        {input3 && (
          <details className="sm__project" open>
            <summary>최적화 입력 — 이 프로젝트 (가용면적 · 사용자 요구도)</summary>
            <OptimizeInputSettings input3={input3} input1={input1} onChange={applyInput3} />
          </details>
        )}
      </SettingsModal>
    </div>
  );
}
