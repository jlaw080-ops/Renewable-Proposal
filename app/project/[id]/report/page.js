"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProject, updateProject } from "@/lib/projectStore";
import { useEngineReady } from "@/lib/useEngineReady";
import { calc규모등급, canCalculate, buildEngineInput2 } from "@/lib/calcModel";
import { buildReportData } from "@/lib/reportAssets";
import Card from "@/components/ui/Card";
import ReviewSection from "@/components/report/ReviewSection";
import ReportActions from "@/components/report/ReportActions";
import "./reportPage.css";

export default function ReportPage() {
  const { id } = useParams();
  const { ready, error: engineError } = useEngineReady();
  const [project, setProject] = useState(null);
  const [calc, setCalc] = useState(null); // { output1, output2 } | null

  useEffect(() => { setProject(getProject(id)); }, [id]);

  const input1 = project?.data.input1 ?? null;
  const input2 = project?.data.input2 ?? null;
  const check = canCalculate(input1 ?? {});
  const 카테고리 = calc규모등급(input1?.용도별연면적목록 ?? []);

  useEffect(() => {
    if (!ready || !input1 || !input2 || !check.ok) { setCalc(null); return; }
    let alive = true;
    import("@/engine/index.js")
      .then(({ runCalculation }) => runCalculation(input1, buildEngineInput2(input2.scenarios), 카테고리))
      .then(r => alive && setCalc(r))
      .catch(() => alive && setCalc(null));
    return () => { alive = false; };
  }, [ready, input1, input2, 카테고리, check.ok]); // eslint-disable-line react-hooks/exhaustive-deps

  function save(patch) {
    const next = updateProject(id, { data: patch });
    setProject(next);
  }

  if (!project) return null;

  const calcData = calc ? { input1, output1: calc.output1, output2: calc.output2 } : null;

  return (
    <div className="rp-page">
      <Card title="④ 보고서 — AI 검토의견">
        {engineError && <p className="rv__error" role="status">엔진 로드 실패: {engineError}</p>}
        {!ready && !engineError && <p className="rv__hint">계산 엔진 로딩 중…</p>}
        <ReviewSection calcData={calcData} review={project.data.review}
          onSave={text => save({ review: { text, at: Date.now() } })} />
      </Card>
      <Card title="보고서 출력">
        <ReportActions coverImage={project.data.coverImage ?? null} calcReady={!!calc}
          onCoverChange={img => save({ coverImage: img })}
          getReportData={() => buildReportData({ project, output1: calc.output1, output2: calc.output2, 카테고리 })} />
      </Card>
    </div>
  );
}
