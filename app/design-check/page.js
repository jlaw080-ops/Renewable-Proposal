"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import Stepper from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/ToastProvider";

export default function DesignCheck() {
  const [modalOpen, setModalOpen] = useState(false);
  const { push } = useToast();

  return (
    <main style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "var(--sp-8)", display: "grid", gap: "var(--sp-6)" }} data-testid="design-check">
      <h1 style={{ fontSize: "var(--fs-28)" }}>디자인 시스템 점검</h1>

      <Card title="Button" actions={<Badge tone="brand">1차</Badge>}>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Button>주요 동작</Button>
          <Button>브랜드 동작</Button>
          <Button variant="ghost">보조 동작</Button>
          <Button variant="danger">삭제</Button>
          <Button size="sm">작은 버튼</Button>
          <Button disabled>비활성</Button>
        </div>
      </Card>

      <Card title="Field · Select">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--sp-4)" }}>
          <Field label="사업명" placeholder="예: 판교 데이터센터" hint="보고서 표지에 사용됩니다" />
          <Field label="연면적 (㎡)" type="number" mono defaultValue={8969.43} />
          <Field label="오류 예시" error="필수 입력 항목입니다" defaultValue="" placeholder="값을 입력하세요" />
          <Select label="사업형태" placeholder="선택하세요" options={[
            { value: "공공", label: "공공기관" }, { value: "민간", label: "민간" }]} />
        </div>
      </Card>

      <Card title="Badge">
        <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
          <Badge tone="pass">의무비율 충족</Badge>
          <Badge tone="fail">미충족</Badge>
          <Badge tone="na">해당 없음</Badge>
          <Badge tone="brand">신재생</Badge>
          <Badge tone="brand">AI 추천</Badge>
          <Badge tone="warm">최적화</Badge>
        </div>
      </Card>

      <Card title="숫자 표기 (IBM Plex Mono)" inner>
        <p className="mono" style={{ fontSize: "var(--fs-22)" }}>5,492,250 kWh/년 · 14.27 %</p>
      </Card>

      <Card title="Table">
        <Table
          columns={[
            { key: "용도", header: "용도" },
            { key: "연면적", header: "연면적 (㎡)", align: "right", mono: true },
          ]}
          rows={[{ id: "1", 용도: "업무시설", 연면적: "8,969.43" }, { id: "2", 용도: "근린생활시설", 연면적: "592.93" }]}
          rowKey={r => r.id}
        />
      </Card>

      <Card title="Modal · Toast">
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
          <Button variant="ghost" onClick={() => push({ message: "저장했습니다", tone: "pass" })}>성공 토스트</Button>
          <Button variant="ghost" onClick={() => push({ message: "저장에 실패했습니다", tone: "fail" })}>실패 토스트</Button>
        </div>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="확인"
          footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>취소</Button><Button onClick={() => setModalOpen(false)}>확인</Button></>}>
          <p>모달 본문 예시입니다. ESC 또는 바깥 클릭으로 닫힙니다.</p>
        </Modal>
      </Card>

      <Card title="Stepper" inner>
        <div style={{ maxWidth: 280 }}>
          <Stepper statuses={{ info: "active", calc: "todo", optimize: "todo", report: "todo" }} items={[
            { segment: "info", label: "사업정보", desc: "사업형태·위치·연면적", href: "#" },
            { segment: "calc", label: "검토 계산", desc: "에너지사용량·설치비율", href: "#" },
            { segment: "optimize", label: "최적화·AI", desc: "설비조합·AI 추천", href: "#" },
            { segment: "report", label: "보고서", desc: "미리보기·다운로드", href: "#" },
          ]} />
        </div>
      </Card>
    </main>
  );
}
