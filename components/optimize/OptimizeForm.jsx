"use client";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { fmtNum } from "@/lib/calcModel";
import "./optimizeForm.css";

const toOptions = arr => arr.map(v => ({ value: v, label: v }));
const pv = v => (v === "" ? "" : Number(v));

// 가용면적·사용자 요구도는 설정 모달의 OptimizeInputSettings로 이동 (2026-07-29 보수)
export default function OptimizeForm({ input3, input1, derived, lib, onChange }) {
  function patch(p) { onChange({ ...input3, ...p }); }

  return (
    <div className="of">
      <div className="of__grid">
        <Select label="건물유형 (전력소비량·요구도 기준)" placeholder="선택 안함"
          options={toOptions(lib.유형목록)} value={input3.건물유형}
          onChange={e => patch({ 건물유형: e.target.value })} />
        <div className="of__derived">
          <p>연간 에너지소요량 <b className="mono">{derived.에너지소요량 != null ? `${fmtNum(derived.에너지소요량)} kWh/yr` : "— (② 검토 계산 필요)"}</b></p>
          <p>의무설치비율 <b className="mono">{derived.의무비율 != null ? `${derived.의무비율}%` : "—"}</b></p>
          <p>예상 전력소비량 <b className="mono">{derived.전력소비량 ? `${fmtNum(derived.전력소비량)} kWh/yr` : "—"}</b></p>
        </div>
        <Field label="지열 최소 의무비율 (%) — 선택" type="number" mono value={input3.지열의무비율}
          onChange={e => patch({ 지열의무비율: pv(e.target.value) })} />
        <Field label="전력생산비율 기준 (%) — 선택" type="number" mono value={input3.전력생산비율기준}
          onChange={e => patch({ 전력생산비율기준: pv(e.target.value) })} />
      </div>
      <p className="of__hint">가용면적·사용자 요구도는 우측 상단 [설정]에서 조정합니다 (건물유형 선택 시 표준값 자동 반영).</p>
    </div>
  );
}
