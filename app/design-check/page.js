"use client";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";

export default function DesignCheck() {
  return (
    <main style={{ maxWidth: "var(--content-max)", margin: "0 auto", padding: "var(--sp-8)", display: "grid", gap: "var(--sp-6)" }} data-testid="design-check">
      <h1 style={{ fontSize: "var(--fs-28)" }}>디자인 시스템 점검</h1>

      <Card title="Button" actions={<Badge tone="brand">1차</Badge>}>
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
          <Button>주요 동작</Button>
          <Button variant="brand">브랜드 동작</Button>
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
          <Badge tone="action">AI 추천</Badge>
          <Badge tone="warm">최적화</Badge>
        </div>
      </Card>

      <Card title="숫자 표기 (IBM Plex Mono)" inner>
        <p className="mono" style={{ fontSize: "var(--fs-22)" }}>5,492,250 kWh/년 · 14.27 %</p>
      </Card>
    </main>
  );
}
