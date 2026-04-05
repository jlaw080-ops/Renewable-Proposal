/**
 * review/reviewGenerator.js
 * Claude API SSE 스트리밍 검토결과 생성
 *
 * ※ file:// 직접 실행 환경에서는 index.html에 인라인으로 동일 로직이 내장되어 있습니다.
 *   이 파일은 로컬 서버(예: VS Code Live Server) 환경에서 ES 모듈로 import하여 사용합니다.
 *
 * 사용 예:
 *   import { generateReview, buildUserMessage } from './review/reviewGenerator.js';
 *   await generateReview(promptText, calcData, apiKey, {
 *     onToken: (text) => outputEl.innerHTML += text.replace(/\n/g, '<br>'),
 *     onDone:  ()     => console.log('완료'),
 *     onError: (err)  => console.error(err),
 *   });
 */

const MODEL   = 'gemini-2.5-pro';

/**
 * 계산 데이터를 Claude에게 전달할 사용자 메시지로 변환합니다.
 * @param {{ input1: object, output1: object, output2: Array }} calcData
 * @returns {string}
 */
export function buildUserMessage(calcData) {
  var input1  = calcData.input1;
  var output1 = calcData.output1;
  var output2 = calcData.output2;

  function fmt(n) {
    return typeof n === 'number' ? n.toLocaleString() : (n ?? '-');
  }

  var lines = [
    '## 사업 개요',
    '- 사업형태: '    + (input1.사업형태 || '미입력'),
    '- 사업연도: '    + (input1.사업연도 || '미입력'),
    '- 대지위치: '    + (input1.대지위치 || '미입력'),
    '- 연면적: '      + fmt(input1.연면적)       + ' ㎡',
    '- 적용연면적: '  + fmt(input1.적용연면적)   + ' ㎡',
    '- 용도별 연면적:'
  ];

  input1.용도별연면적목록.forEach(function(x) {
    lines.push('  - ' + x.용도 + ': ' + fmt(x.연면적) + ' ㎡');
  });

  lines.push('', '## 예상에너지사용량 (Output_1)');
  lines.push('- 총예상에너지사용량: ' + fmt(Math.round(output1.총예상에너지사용량)) + ' kWh/yr');
  lines.push('- 용도별 상세:');
  output1.용도별결과.forEach(function(x) {
    lines.push(
      '  - ' + x.용도 + ': ' +
      fmt(x.연면적) + '㎡ × ' + x.지역계수 + ' × ' + x.단위에너지사용량 +
      ' = ' + fmt(Math.round(x.예상에너지사용량)) + ' kWh/yr'
    );
  });

  lines.push('', '## 신재생에너지 시나리오 (Output_2)');
  output2.forEach(function(alt) {
    lines.push('### ' + alt.id);
    alt.systems.forEach(function(s) {
      lines.push(
        '  - ' + s.에너지원 + ' (' + s.형식 + '): ' +
        fmt(s.적용용량) + ' kW → ' + fmt(Math.round(s.신재생에너지생산량)) + ' kWh/yr'
      );
    });
    lines.push('- 생산량 합계: '      + fmt(Math.round(alt.생산량합계))     + ' kWh/yr');
    lines.push('- 총에너지사용량: '   + fmt(Math.round(alt.총에너지사용량)) + ' kWh/yr');
    lines.push('- 신재생에너지 비율: ' + alt.비율.toFixed(1) + '%');
    lines.push('- 의무비율: '         + (alt.의무비율 !== null ? alt.의무비율 + '%' : '해당없음'));
    lines.push('- 만족 여부: '        + alt.만족여부);
  });

  return lines.join('\n');
}

/**
 * Claude API SSE 스트리밍으로 검토결과를 생성합니다.
 *
 * @param {string} systemPrompt  - 시스템 프롬프트 (프롬프트 관리에서 선택)
 * @param {{ input1, output1, output2 }} calcData  - 계산 결과
 * @param {{ onToken?: Function, onDone?: Function, onError?: Function }} callbacks
 *   - onToken(text: string): 토큰 수신 시마다 호출
 *   - onDone():              스트림 완료 시 호출
 *   - onError(err: Error):   오류 시 호출
 */
export async function generateReview(systemPrompt, calcData, callbacks) {
  var onToken = (callbacks && callbacks.onToken) || function() {};
  var onDone  = (callbacks && callbacks.onDone)  || function() {};
  var onError = (callbacks && callbacks.onError) || function(e) { console.error(e); };

  try {
    var url = '/api/review';

    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: buildUserMessage(calcData) }] }],
        generationConfig: { maxOutputTokens: 8192 }
      })
    });

    if (!resp.ok) {
      var errText = await resp.text();
      try { var errJson = JSON.parse(errText); errText = (errJson.error && errJson.error.message) || errText; } catch (e) {}
      throw new Error('API 오류 ' + resp.status + ': ' + errText);
    }

    var reader  = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer  = '';

    while (true) {
      var result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop(); // 마지막 불완전한 라인은 버퍼에 보존

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line.startsWith('data: ')) continue;
        var raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;

        try {
          var data = JSON.parse(raw);
          var text = data.candidates &&
                     data.candidates[0] &&
                     data.candidates[0].content &&
                     data.candidates[0].content.parts &&
                     data.candidates[0].content.parts[0] &&
                     data.candidates[0].content.parts[0].text;
          if (text) onToken(text);
        } catch (e) {
          // 불완전한 JSON 청크 무시
        }
      }
    }

    onDone();
  } catch (err) {
    onError(err);
  }
}
