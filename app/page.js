"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listProjects, createProject, updateProject, deleteProject } from "@/lib/projectStore";
import { readLegacyProjects, convertLegacyProject } from "@/lib/migrateLegacy";
import { useEngineReady } from "@/lib/useEngineReady";
import { stepStatuses } from "@/lib/stepStatus";
import { canCalculate, calc규모등급, buildEngineInput2 } from "@/lib/calcModel";
import { pickRepresentative, nextSegment, VERDICT_UI } from "@/lib/projectSummary";
import { STEPS } from "@/lib/workspaceSteps";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
import "./dashboard.css";

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function Dashboard() {
  const router = useRouter();
  const { push } = useToast();
  const [projects, setProjects] = useState(null);   // null = 로딩(SSR 하이드레이션 전)
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const { ready } = useEngineReady();
  const [verdicts, setVerdicts] = useState({});   // { [projectId]: 대표 ALT }

  useEffect(() => {
    if (!ready || !projects?.length) return;
    let alive = true;
    (async () => {
      const { runCalculation } = await import("@/engine/index.js");
      const out = {};
      for (const p of projects) {
        const input1 = p.data?.input1, input2 = p.data?.input2;
        if (!input1 || !input2?.scenarios?.length || !canCalculate(input1).ok) continue;
        const 카테고리 = calc규모등급(input1.용도별연면적목록 ?? []);
        if (!카테고리) continue;
        try {
          const r = runCalculation(input1, buildEngineInput2(input2.scenarios), 카테고리);
          const rep = pickRepresentative(r.output2);
          if (rep) out[p.id] = rep;
        } catch { /* 판정 계산 실패 시 해당 카드만 요약 생략 */ }
      }
      if (alive) setVerdicts(out);
    })();
    return () => { alive = false; };
  }, [ready, projects]);

  useEffect(() => {
    setProjects(listProjects());
    setLegacyCount(readLegacyProjects(localStorage.getItem("projects_v2")).length);
  }, []); // localStorage는 클라이언트에서만

  function handleCreate() {
    try {
      const p = createProject(name);
      push({ message: `"${p.name}" 프로젝트를 만들었습니다`, tone: "pass" });
      router.push(`/project/${p.id}/info`);
    } catch (e) {
      setNameError(e.message);
    }
  }

  function handleDelete() {
    deleteProject(deleteTarget.id);
    setProjects(listProjects());
    setDeleteTarget(null);
    push({ message: "프로젝트를 삭제했습니다" });
  }

  function importLegacy() {
    const items = readLegacyProjects(localStorage.getItem("projects_v2"));
    let ok = 0, fail = 0;
    for (const item of items) {
      const conv = convertLegacyProject(item);
      if (!conv) { fail++; continue; }
      const p = createProject(conv.name);
      updateProject(p.id, { data: conv.data });
      ok++;
    }
    setProjects(listProjects());
    push({ message: `구버전 프로젝트 ${ok}개 가져옴${fail ? ` (형식 불일치 ${fail}개 제외)` : ""}`, tone: "pass" });
    setLegacyCount(0);
  }

  return (
    <main className="dash">
      <header className="dash__head">
        <div>
          <h1 className="dash__title">신재생에너지 의무설치비율 검토</h1>
          <p className="dash__sub">프로젝트 단위로 검토 계산·최적화·보고서를 관리합니다</p>
        </div>
        <div className="dash__head-actions">
          <Button onClick={() => { setName(""); setNameError(null); setCreateOpen(true); }}>새 프로젝트</Button>
          {legacyCount > 0 && (
            <Button variant="ghost" onClick={importLegacy}>구버전 프로젝트 가져오기 ({legacyCount}개)</Button>
          )}
        </div>
      </header>

      {projects && projects.length === 0 && (
        <Card inner className="dash__empty">
          <p>아직 프로젝트가 없습니다. 첫 프로젝트를 만들어 검토를 시작하세요.</p>
          <Button onClick={() => setCreateOpen(true)}>첫 프로젝트 만들기</Button>
        </Card>
      )}

      <div className="dash__grid">
        {(projects ?? []).map(p => {
          const st = stepStatuses(p, null);
          const doneCount = ["info", "calc", "optimize", "report"].filter(s => st[s] === "done").length;
          const next = nextSegment(st);
          const nextStep = STEPS.find(s => s.segment === next);
          const rep = verdicts[p.id];
          const ui = rep ? (VERDICT_UI[rep.만족여부] ?? VERDICT_UI.해당없음) : null;
          return (
            <Card key={p.id} className="dash__item">
              <Link href={`/project/${p.id}/${next}`} className="dash__open">
                <span className="dash__name">{p.name}</span>
                <span className="dash__meta">
                  <span className="dash__dots" role="img" aria-label={`4단계 중 ${doneCount}단계 완료`}>
                    {["info", "calc", "optimize", "report"].map(s => (
                      <i key={s} className={`dash__dot ${st[s] === "done" ? "dash__dot--done" : ""}`} />
                    ))}
                  </span>
                  <span className="dash__date mono">수정 {formatDate(p.updatedAt)}</span>
                </span>
                {rep && ui && (
                  <span className="dash__verdict">
                    <Badge tone={ui.tone}>{ui.sym} {ui.label}</Badge>
                    <span className="mono">설치 {rep.비율.toFixed(1)}% / 의무 {rep.의무비율 !== null ? `${rep.의무비율}%` : "-"}</span>
                  </span>
                )}
                <span className="dash__continue">이어서: {nextStep.label} →</span>
              </Link>
              <div className="dash__row-actions">
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>삭제</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="새 프로젝트"
        footer={<>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>취소</Button>
          <Button onClick={handleCreate}>프로젝트 만들기</Button>
        </>}>
        <Field label="프로젝트 이름" placeholder="예: 판교 데이터센터 신축 검토" value={name}
          onChange={e => { setName(e.target.value); setNameError(null); }}
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
          error={nameError} autoFocus />
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="프로젝트 삭제"
        footer={<>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>취소</Button>
          <Button variant="danger" onClick={handleDelete}>삭제</Button>
        </>}>
        <p>"{deleteTarget?.name}" 프로젝트를 삭제합니다. 저장된 입력·결과가 함께 삭제되며 되돌릴 수 없습니다.</p>
      </Modal>
    </main>
  );
}
