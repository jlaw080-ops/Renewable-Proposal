/**
 * engine/output2Calculator.js
 * Output_2: 신재생에너지 설치비율 계산
 *
 * ※ file:// 직접 실행 환경에서는 index.html에 인라인으로 동일 로직이 내장되어 있습니다.
 */

import { get의무비율, get주거구분 } from './libraryLoader.js';

/**
 * 신재생에너지 설치비율을 계산합니다.
 * @param {object} input1      - 사업정보 Input (사업형태, 대지위치, 사업연도, 카테고리, 용도별연면적목록)
 * @param {object} input2      - 시나리오 Input { scenarios: [{ id, systems: [...] }] }
 * @param {object} output1결과 - calcOutput1() 반환값 (총예상에너지사용량 포함)
 * @param {string} 카테고리    - 가/나/다/라
 * @returns {Array} ALT별 결과 배열
 */
export function calcOutput2(input1, input2, output1결과, 카테고리) {
  // 복수 용도 중 하나라도 비주거 → 전체를 비주거로 판단
  const 주거구분 = input1.용도별연면적목록.some(x => get주거구분(x.용도) === '비주거')
    ? '비주거' : '주거';

  return input2.scenarios.map(scenario => {
    const systems = scenario.systems
      .filter(s => s.에너지원 && s.형식 && s.적용용량 > 0)
      .map(s => ({
        ...s,
        신재생에너지생산량: s.적용용량 * (s.단위에너지생산량 ?? 0) * (s.원별보정계수 ?? 0),
      }));

    const 생산량합계  = systems.reduce((sum, s) => sum + s.신재생에너지생산량, 0);
    const 총에너지사용량 = output1결과.총예상에너지사용량;
    const 비율        = 총에너지사용량 > 0
      ? (생산량합계 / 총에너지사용량) * 100
      : 0;

    const 의무비율값 = get의무비율(
      input1.사업형태, input1.대지위치, 주거구분, 카테고리, input1.사업연도
    );
    const 만족여부 = 의무비율값 !== null
      ? (비율 >= 의무비율값 ? 'Yes' : 'No')
      : '해당없음';

    const 시스템구성 = systems
      .map(s => `${s.에너지원} - ${s.형식} : ${s.적용용량.toLocaleString()}kW`)
      .join('\n');

    return {
      id: scenario.id,
      systems,
      생산량합계,
      총에너지사용량,
      비율,
      의무비율: 의무비율값,
      만족여부,
      시스템구성,
    };
  });
}
