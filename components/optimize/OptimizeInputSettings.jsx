"use client";
import Field from "@/components/ui/Field";
import { 요구도항목, LEVELS, getBaseAreas } from "@/lib/optimizeModel";
import { fmtNum } from "@/lib/calcModel";
import "./optimizeForm.css";

const pv = v => (v === "" ? "" : Number(v));

// 최적화 입력 중 프로젝트별 상세 설정(가용면적·사용자 요구도) — 설정 모달 안에서 렌더 (2026-07-29 보수: 본문 폼에서 이동)
export default function OptimizeInputSettings({ input3, input1, onChange }) {
  const base = getBaseAreas(input1 ?? {});

  function patch(p) { onChange({ ...input3, ...p }); }
  function patchArea(sp, p) {
    patch({ 면적비율: { ...input3.면적비율, [sp]: { ...input3.면적비율[sp], ...p } } });
  }

  const 면적행 = [
    { sp: "옥상", 기준: base.건축면적, 라벨: "건축", 설명: "수평 PV" },
    { sp: "외피", 기준: base.외피면적, 라벨: "외피", 설명: "수직 PV·BIPV" },
    { sp: "대지", 기준: base.대지면적, 라벨: "대지", 설명: "지열" },
  ];
  const 환산 = (b, p) => (b > 0 && p !== "" && p != null ? Math.round(b * Number(p) / 100) : null);

  return (
    <div className="of">
      <details className="of__fold" open>
        <summary>가용면적 (기준면적 대비 비율)</summary>
        <div className="of__areas">
          {면적행.map(r => (
            <div className="of__arearow" key={r.sp}>
              <span className="of__areaname">{r.sp} <em>{r.설명}</em><br /><small>{r.라벨} {r.기준 > 0 ? `${fmtNum(Math.round(r.기준))}㎡` : "—"}</small></span>
              <Field label="최소 %" type="number" mono value={input3.면적비율[r.sp].min}
                onChange={e => patchArea(r.sp, { min: pv(e.target.value) })} />
              <Field label="최대 %" type="number" mono value={input3.면적비율[r.sp].max}
                onChange={e => patchArea(r.sp, { max: pv(e.target.value) })} />
              <span className="of__calc mono">
                = {환산(r.기준, input3.면적비율[r.sp].min) != null ? `${fmtNum(환산(r.기준, input3.면적비율[r.sp].min))}㎡` : "—"}
                {" ~ "}{환산(r.기준, input3.면적비율[r.sp].max) != null ? `${fmtNum(환산(r.기준, input3.면적비율[r.sp].max))}㎡` : "—"}
              </span>
            </div>
          ))}
          <div className="of__arearow">
            <span className="of__areaname">기계실 <em>연료전지</em><br /><small>건축 {base.건축면적 > 0 ? `${fmtNum(Math.round(base.건축면적))}㎡` : "—"}</small></span>
            <Field label="비율 %" type="number" mono value={input3.면적비율.기계실.pct}
              onChange={e => patchArea("기계실", { pct: pv(e.target.value) })} />
            <span />
            <span className="of__calc mono">= {환산(base.건축면적, input3.면적비율.기계실.pct) != null ? `${fmtNum(환산(base.건축면적, input3.면적비율.기계실.pct))}㎡` : "—"}</span>
          </div>
          <p className="of__hint">
            {base.외피면적 > 0
              ? `외피 방위별 예상(각 면) — 동·서·남·북 각 ${fmtNum(Math.round(base.외피면적 / 4))}㎡`
              : "외피 방위별 예상: — (사업정보의 건축면적·연면적 필요)"}
          </p>
        </div>
      </details>

      <details className="of__fold">
        <summary>사용자 요구도 (8항목 × 5등급)</summary>
        <div className="of__pris">
          {요구도항목.map(it => (
            <div className="of__prirow" key={it.key}>
              <span className="of__priname">{it.label}</span>
              <span className="of__radios" role="radiogroup" aria-label={it.label}>
                {LEVELS.map(lv => (
                  <label key={lv}>
                    <input type="radio" name={`pri-${it.key}`} value={lv}
                      checked={input3.요구도[it.key] === lv}
                      onChange={() => patch({ 요구도: { ...input3.요구도, [it.key]: lv } })} />
                    {lv}
                  </label>
                ))}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
