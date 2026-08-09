"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getProject } from "@/lib/projectStore";
import { STEPS } from "@/lib/workspaceSteps";
import { stepStatuses } from "@/lib/stepStatus";
import Stepper from "@/components/ui/Stepper";
import Card from "@/components/ui/Card";
import "./workspace.css";

export default function WorkspaceShell({ projectId, children }) {
  const pathname = usePathname();
  const activeSegment = STEPS.find(s => pathname.endsWith(`/${s.segment}`))?.segment ?? "info";
  const [state, setState] = useState({ loading: true, project: null });

  useEffect(() => {
    setState({ loading: false, project: getProject(projectId) }); // localStorage는 클라이언트에서만
  }, [projectId, pathname]);

  if (state.loading) return null;

  if (!state.project) {
    return (
      <main className="ws ws--missing">
        <Card title="프로젝트를 찾을 수 없습니다">
          <p>삭제되었거나 다른 브라우저에서 만든 프로젝트입니다.</p>
          <p><Link href="/">대시보드로 돌아가기</Link></p>
        </Card>
      </main>
    );
  }

  return (
    <div className="ws">
      <aside className="ws__nav">
        <Link href="/" className="ws__back">← 대시보드</Link>
        <p className="ws__project">{state.project.name}</p>
        <Stepper statuses={stepStatuses(state.project, activeSegment)}
          items={STEPS.map(s => ({ ...s, href: `/project/${projectId}/${s.segment}` }))} />
      </aside>
      <main className="ws__content">
        {children}
        <div className="ws__next">
          {(() => {
            const idx = STEPS.findIndex(s => s.segment === activeSegment);
            const next = STEPS[idx + 1] ?? null;
            return next ? (
              <>
                <span className="ws__next-hint">다음 단계 — {next.desc}</span>
                <Link className="btn btn--primary btn--md" href={`/project/${projectId}/${next.segment}`}>
                  다음: {next.label} →
                </Link>
              </>
            ) : (
              <>
                <span className="ws__next-hint">검토 절차의 마지막 단계입니다</span>
                <Link className="btn btn--ghost btn--md" href="/">완료 — 대시보드로</Link>
              </>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
