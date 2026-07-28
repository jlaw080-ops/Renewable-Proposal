// juso.go.kr·건축물대장 응답 파싱 (순수 함수 — 라우트 핸들러에서 사용)
const round2 = n => Math.round(n * 100) / 100;

export function pickJusoCandidate(jusoJson) {
  const results = jusoJson?.results;
  if (!results || results.common?.errorCode !== "0") return null;
  const j = Array.isArray(results.juso) ? results.juso[0] : null;
  if (!j) return null;
  return { admCd: j.admCd, bun: j.lnbrMnnm, ji: j.lnbrSlno, mtYn: j.mtYn, roadAddr: j.roadAddr, jibunAddr: j.jibunAddr };
}

export function bldrgstParams(cand) {
  return {
    sigunguCd: cand.admCd.slice(0, 5),
    bjdongCd: cand.admCd.slice(5, 10),
    bun: String(cand.bun ?? cand.lnbrMnnm ?? "0").padStart(4, "0"),
    ji: String(cand.ji ?? cand.lnbrSlno ?? "0").padStart(4, "0"),
    platGbCd: cand.mtYn === "1" ? "1" : "0",
  };
}

export function aggregateLandInfo(bldJson) {
  const resp = bldJson?.response;
  if (!resp || resp.header?.resultCode !== "00") return null;
  let items = resp.body?.items?.item;
  if (!items) return null;
  if (!Array.isArray(items)) items = [items];
  if (items.length === 0) return null;
  const num = v => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  return {
    연면적: round2(items.reduce((s, it) => s + num(it.totArea), 0)),
    건축면적: round2(items.reduce((s, it) => s + num(it.archArea), 0)),
    대지면적: round2(Math.max(...items.map(it => num(it.platArea)))),
    건폐율: round2(Math.max(...items.map(it => num(it.bcRat)))),
    용적률: round2(Math.max(...items.map(it => num(it.vlRat)))),
    동수: items.length,
  };
}
