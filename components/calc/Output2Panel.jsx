"use client";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { fmtNum } from "@/lib/calcModel";
import "./results.css";

const SYS_COLS = [
  { key: "에너지원", header: "에너지원" },
  { key: "형식", header: "형식" },
  { key: "적용용량", header: "적용용량 (kW)", align: "right", mono: true, render: r => fmtNum(r.적용용량) },
  { key: "신재생에너지생산량", header: "생산량 (kWh/yr)", align: "right", mono: true, render: r => fmtNum(Math.round(r.신재생에너지생산량)) },
];

const 판정 = {
  Yes: { tone: "pass", label: "만족" },
  No: { tone: "fail", label: "불만족" },
  해당없음: { tone: "na", label: "해당없음" },
};

export default function Output2Panel({ alt }) {
  const j = 판정[alt.만족여부] ?? 판정.해당없음;
  return (
    <div className="res res__alt">
      <div className="res__kpis">
        <div className="res__kpi">
          <dt>신재생에너지 설치비율</dt>
          <dd className="mono">{alt.비율.toFixed(1)}%</dd>
          <p>생산량 {fmtNum(Math.round(alt.생산량합계))} kWh/yr</p>
        </div>
        <div className="res__kpi">
          <dt>의무설치비율</dt>
          <dd className="mono">{alt.의무비율 !== null ? `${alt.의무비율}%` : "-"}</dd>
          <p>총에너지 {fmtNum(alt.총에너지사용량)} kWh/yr</p>
        </div>
        <div className={`res__kpi res__kpi--${j.tone}`}>
          <dt>의무비율 만족여부</dt>
          <dd><Badge tone={j.tone}>{j.label}</Badge></dd>
          <p>{alt.id}</p>
        </div>
      </div>
      <Table columns={SYS_COLS} rows={alt.systems} rowKey={(r) => r.에너지원 + r.형식 + r.적용용량}
        empty="에너지원·형식·적용용량을 입력하면 생산량이 계산됩니다" />
    </div>
  );
}
