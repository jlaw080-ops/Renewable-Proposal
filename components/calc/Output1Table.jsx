"use client";
import Table from "@/components/ui/Table";
import { fmtNum } from "@/lib/calcModel";
import "./results.css";

const COLS = [
  { key: "용도", header: "용도" },
  { key: "연면적", header: "연면적 (㎡)", align: "right", mono: true, render: r => fmtNum(r.연면적) },
  { key: "지역계수", header: "지역계수", align: "right", mono: true },
  { key: "단위에너지사용량", header: "단위에너지 (kWh/㎡·yr)", align: "right", mono: true, render: r => fmtNum(r.단위에너지사용량) },
  { key: "예상에너지사용량", header: "예상에너지사용량 (kWh/yr)", align: "right", mono: true, render: r => fmtNum(r.예상에너지사용량) },
];

export default function Output1Table({ output1 }) {
  return (
    <div className="res">
      <Table columns={COLS} rows={output1.용도별결과} rowKey={(r) => r.용도 + r.연면적} />
      <p className="res__total mono">
        합계 — 연면적 {fmtNum(output1.총연면적)} ㎡ · 총예상에너지사용량 {fmtNum(output1.총예상에너지사용량)} kWh/yr
      </p>
    </div>
  );
}
