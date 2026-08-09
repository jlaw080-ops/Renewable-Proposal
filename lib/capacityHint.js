// lib/capacityHint.js — 의무비율 충족 필요 용량 역산 (표시 전용 파생값, 저장하지 않음)
// 엔진 계약: 생산량 = 적용용량 × 단위에너지생산량 × 원별보정계수, 비율 = Σ생산량/총에너지사용량×100

const 계수곱 = s => (Number(s?.단위에너지생산량) || 0) * (Number(s?.원별보정계수) || 0);
const 용량 = s => Math.max(0, Number(s?.적용용량) || 0);   // 빈칸·문자열·음수 안전
const 생산량 = s => 용량(s) * 계수곱(s);

/**
 * 지정한 행이 의무비율을 채우기 위해 필요한 용량(kW)을 역산한다.
 * 자기 행의 현재 용량은 확보량에서 제외하므로, 첫 시스템이면 전체 필요 용량,
 * 다른 행이 일부를 채우고 있으면 잔여 필요 용량이 된다.
 * @returns {{목표생산량:number, 확보생산량:number, 잔여생산량:number, 필요용량:number, 충족:boolean, 전체충족:boolean}|null}
 */
export function requiredCapacity({ 총에너지사용량, 의무비율, systems, index } = {}) {
  const total = Number(총에너지사용량) || 0;
  if (total <= 0) return null;                          // 계산 전(① 미완성)
  if (의무비율 === null || 의무비율 === undefined) return null;   // 해당없음
  const ratio = Number(의무비율);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;

  const rows = Array.isArray(systems) ? systems : [];
  const self = rows[index];
  if (!self) return null;
  const per = 계수곱(self);
  if (per <= 0) return null;                            // 형식 미선택 등

  const 목표생산량 = total * ratio / 100;
  const 확보생산량 = rows.reduce((sum, s, i) => (i === index ? sum : sum + 생산량(s)), 0);
  const 자기행생산량 = 생산량(self);
  const 잔여생산량 = Math.max(0, 목표생산량 - 확보생산량);
  // 올림: 내림하면 그 값을 입력해도 비율 >= 의무비율을 만족하지 못한다
  const 필요용량 = Math.ceil(잔여생산량 / per);

  return { 목표생산량, 확보생산량, 잔여생산량, 필요용량, 충족: 잔여생산량 <= 0, 전체충족: (확보생산량 + 자기행생산량) >= 목표생산량 };
}
