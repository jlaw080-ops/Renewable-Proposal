"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

export const EMPTY_CONSTRAINTS = {
  solarNote: "", nearSubway: false, geothermalNote: "", fuelCellNote: "",
  budgetMin: "", budgetMax: "", excludeSources: [], customConstraints: "",
};

export function constraintsSummary(c) {
  if (!c) return "미설정";
  let n = 0;
  if (c.solarNote) n++;
  if (c.nearSubway) n++;
  if (c.geothermalNote) n++;
  if (c.fuelCellNote) n++;
  if (c.budgetMin !== "" && c.budgetMin != null) n++;
  if (c.budgetMax !== "" && c.budgetMax != null) n++;
  if (c.excludeSources?.length) n++;
  if (c.customConstraints) n++;
  return n === 0 ? "미설정" : `${n}개 조건`;
}

const Memo = ({ label, value, onChange, placeholder }) => (
  <label className="cm__memo">
    <span>{label}</span>
    <textarea rows={2} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
  </label>
);

export default function ConstraintsModal({ open, value, energySources, onClose, onApply }) {
  const [c, setC] = useState(EMPTY_CONSTRAINTS);
  useEffect(() => { if (open) setC({ ...EMPTY_CONSTRAINTS, ...(value ?? {}) }); }, [open, value]);
  const p = patch => setC(prev => ({ ...prev, ...patch }));

  return (
    <Modal open={open} onClose={onClose} title="AI 추천 제약조건">
      <div className="cm">
        <Memo label="태양광 조건" value={c.solarNote} onChange={v => p({ solarNote: v })} placeholder="예: 경사지붕, 주변 음영…" />
        <div className="cm__radio">
          <span>인근 지하철 노선</span>
          <label><input type="radio" name="cm-subway" checked={c.nearSubway === true} onChange={() => p({ nearSubway: true })} /> 있음</label>
          <label><input type="radio" name="cm-subway" checked={c.nearSubway === false} onChange={() => p({ nearSubway: false })} /> 없음</label>
        </div>
        <Memo label="지열 조건" value={c.geothermalNote} onChange={v => p({ geothermalNote: v })} placeholder="예: 암반, 지하수위…" />
        <Memo label="연료전지 조건" value={c.fuelCellNote} onChange={v => p({ fuelCellNote: v })} placeholder="예: 도시가스 인입, 공간 제한…" />
        <div className="cm__budget">
          <Field label="예산 최소 (만원)" type="number" mono value={c.budgetMin}
            onChange={e => p({ budgetMin: e.target.value === "" ? "" : Number(e.target.value) })} />
          <Field label="예산 최대 (만원)" type="number" mono value={c.budgetMax}
            onChange={e => p({ budgetMax: e.target.value === "" ? "" : Number(e.target.value) })} />
        </div>
        <div className="cm__exclude">
          <span>제외할 에너지원</span>
          <div className="cm__cbs">
            {energySources.map(src => (
              <label key={src}>
                <input type="checkbox" checked={c.excludeSources.includes(src)}
                  onChange={e => p({ excludeSources: e.target.checked
                    ? [...c.excludeSources, src]
                    : c.excludeSources.filter(s => s !== src) })} />
                {src}
              </label>
            ))}
          </div>
        </div>
        <Memo label="기타 제약" value={c.customConstraints} onChange={v => p({ customConstraints: v })} placeholder="예: 소음 규제, 문화재 보호구역…" />
        <div className="cm__actions">
          <Button size="sm" variant="ghost" onClick={() => setC({ ...EMPTY_CONSTRAINTS })}>초기화</Button>
          <Button size="sm" onClick={() => { onApply(c); onClose(); }}>적용</Button>
        </div>
      </div>
    </Modal>
  );
}
