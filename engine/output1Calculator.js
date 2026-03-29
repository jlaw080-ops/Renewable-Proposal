/**
 * engine/output1Calculator.js
 * Output_1: 예상에너지사용량 계산
 *
 * ※ file:// 직접 실행 환경에서는 index.html에 인라인으로 동일 로직이 내장되어 있습니다.
 *   이 파일은 로컬 서버(예: VS Code Live Server) 환경에서 ES 모듈로 import하여 사용합니다.
 */

import { get지역계수, get단위에너지사용량 } from './libraryLoader.js';

/**
 * 예상에너지사용량을 계산합니다.
 * @param {object} input1 - 사업정보 Input
 * @param {string} input1.대지위치
 * @param {Array}  input1.용도별연면적목록  - [{ 용도: string, 연면적: number }, ...]
 * @returns {{ 용도별결과: Array, 총연면적: number, 총예상에너지사용량: number }}
 */
export function calcOutput1(input1) {
  const 지역계수 = get지역계수(input1.대지위치);

  const 용도별결과 = input1.용도별연면적목록.map(item => {
    const 단위에너지사용량 = get단위에너지사용량(item.용도) ?? 0;
    const 예상에너지사용량 = item.연면적 * 지역계수 * 단위에너지사용량;
    return {
      용도: item.용도,
      연면적: item.연면적,
      지역계수,
      단위에너지사용량,
      예상에너지사용량,
    };
  });

  const 총연면적           = 용도별결과.reduce((s, x) => s + x.연면적,           0);
  const 총예상에너지사용량 = 용도별결과.reduce((s, x) => s + x.예상에너지사용량, 0);

  return { 용도별결과, 총연면적, 총예상에너지사용량 };
}
