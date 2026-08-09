"use client";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { EMPTY_SYSTEM, newScenario, nextAltNo, fmtNum } from "@/lib/calcModel";
import { requiredCapacity } from "@/lib/capacityHint";
import "./scenarioEditor.css";

const toOptions = arr => arr.map(v => ({ value: v, label: v }));

export default function ScenarioEditor({ scenarios, lib, target = null, onChange }) {
  function patchSystem(si, yi, patch) {
    onChange(scenarios.map((sc, i) => i !== si ? sc : {
      ...sc,
      systems: sc.systems.map((s, j) => (j === yi ? { ...s, ...patch } : s)),
    }));
  }

  function changeEnergy(si, yi, 에너지원) {
    patchSystem(si, yi, { 에너지원, 형식: "", 단위에너지생산량: 0, 원별보정계수: 0 });
  }

  function changeType(si, yi, 형식) {
    const sys = scenarios[si].systems[yi];
    const c = lib.계수(sys.에너지원, 형식);
    patchSystem(si, yi, {
      형식,
      단위에너지생산량: c?.단위에너지생산량 ?? 0,
      원별보정계수: c?.원별보정계수 ?? 0,
    });
  }

  return (
    <div className="se">
      {scenarios.map((sc, si) => (
        <Card key={sc.id} title={sc.id} inner actions={
          <div className="se__actions">
            <Button size="sm" variant="ghost"
              onClick={() => onChange(scenarios.map((s, i) => i !== si ? s : { ...s, systems: [...s.systems, { ...EMPTY_SYSTEM }] }))}>
              시스템 추가
            </Button>
            <Button size="sm" variant="danger" disabled={scenarios.length <= 1}
              onClick={() => onChange(scenarios.filter((_, i) => i !== si))}>
              ALT 삭제
            </Button>
          </div>
        }>
          <div className="se__systems">
            {sc.systems.map((sys, yi) => {
              const 생산량 = (Number(sys.적용용량) || 0) * sys.단위에너지생산량 * sys.원별보정계수;
              return (
                <div className="se__system" key={yi}>
                  <div className="se__row">
                    <Select label="에너지원" labelHidden={yi > 0} placeholder="선택" options={toOptions(lib.에너지원목록)}
                      value={sys.에너지원} onChange={e => changeEnergy(si, yi, e.target.value)} />
                    <Select label="형식" labelHidden={yi > 0} placeholder="선택"
                      options={toOptions(sys.에너지원 ? lib.형식목록(sys.에너지원) : [])}
                      value={sys.형식} onChange={e => changeType(si, yi, e.target.value)} />
                    <Field label="적용용량 (kW)" labelHidden={yi > 0} type="number" mono value={sys.적용용량}
                      onChange={e => patchSystem(si, yi, { 적용용량: e.target.value === "" ? "" : Number(e.target.value) })} />
                    <Button size="sm" variant="danger" disabled={sc.systems.length <= 1}
                      onClick={() => onChange(scenarios.map((s, i) => i !== si ? s : { ...s, systems: s.systems.filter((_, j) => j !== yi) }))}>
                      삭제
                    </Button>
                  </div>
                  <p className="se__meta mono">
                    단위에너지생산량 {fmtNum(sys.단위에너지생산량)} kWh/kW·yr · 원별보정계수 {sys.원별보정계수 || "-"} ·
                    생산량 {생산량 > 0 ? `${fmtNum(Math.round(생산량))} kWh/yr` : "-"}
                  </p>
                  {(() => {
                    const hint = requiredCapacity({
                      총에너지사용량: target?.총에너지사용량,
                      의무비율: target?.의무비율,
                      systems: sc.systems,
                      index: yi,
                    });
                    if (!hint) return null;
                    if (hint.충족) {
                      return <p className="se__hint se__hint--ok">✓ 의무비율 충족 — 이 시스템에 추가 용량 불필요</p>;
                    }
                    const 잔여모드 = hint.확보생산량 > 0;
                    return (
                      <p className="se__hint">
                        {잔여모드 ? "잔여 필요 용량 " : "의무비율 충족 필요 용량 "}
                        <b className="mono">{fmtNum(hint.필요용량)} kW</b>
                        {잔여모드 && <span className="se__hintsub"> (다른 시스템 기여 반영)</span>}
                      </p>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <Button variant="ghost" onClick={() => onChange([...scenarios, newScenario(nextAltNo(scenarios))])}>
        + ALT 추가
      </Button>
    </div>
  );
}
