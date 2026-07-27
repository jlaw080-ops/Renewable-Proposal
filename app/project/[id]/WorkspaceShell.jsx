"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getProject } from "@/lib/projectStore";
import { STEPS } from "@/lib/workspaceSteps";
import Stepper from "@/components/ui/Stepper";
import Card from "@/components/ui/Card";
import "./workspace.css";

export default function WorkspaceShell({ projectId, children }) {
  const pathname = usePathname();
  const activeSegment = STEPS.find(s => pathname.endsWith(`/${s.segment}`))?.segment ?? "info";
  const [state, setState] = useState({ loading: true, project: null });

  useEffect(() => {
    setState({ loading: false, project: getProject(projectId) }); // localStorage는 클라이언트에서만
  }, [projectId]);

  if (!state.loading && !state.project) {
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
        <p className="ws__project">{state.project?.name ?? "…"}</p>
        <Stepper activeSegment={activeSegment}
          items={STEPS.map(s => ({ ...s, href: `/project/${projectId}/${s.segment}` }))} />
      </aside>
      <main className="ws__content">{children}</main>
    </div>
  );
}
