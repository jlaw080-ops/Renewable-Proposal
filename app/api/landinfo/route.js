import { NextResponse } from "next/server";
import { pickJusoCandidate, bldrgstParams, aggregateLandInfo } from "@/lib/landinfo";

export async function GET(request) {
  const jusoKey = process.env.JUSO_CONFIRM_KEY;
  const dataKey = process.env.DATA_GO_KR_KEY;
  if (!jusoKey || !dataKey) {
    return NextResponse.json({ error: "토지정보 API 키가 설정되지 않았습니다" }, { status: 500 });
  }
  const address = request.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address 파라미터가 필요합니다" }, { status: 400 });

  try {
    // 1) 도로명주소 API → 법정동코드·지번
    const jusoUrl = "https://business.juso.go.kr/addrlink/addrLinkApi.do?"
      + new URLSearchParams({ confmKey: jusoKey, currentPage: "1", countPerPage: "1", keyword: address, resultType: "json" });
    const jusoResp = await fetch(jusoUrl);
    if (!jusoResp.ok) {
      return NextResponse.json({ error: "도로명주소 API 오류", detail: await jusoResp.text() }, { status: jusoResp.status });
    }
    const jusoJson = await jusoResp.json();
    // 도로명주소 API는 키 오류·쿼터 초과도 HTTP 200 + errorCode로 반환한다 — 후보 없음과 구분해 노출
    const common = jusoJson?.results?.common ?? {};
    if (common.errorCode && common.errorCode !== "0") {
      return NextResponse.json(
        { error: `도로명주소 API 오류: ${common.errorMessage ?? "알 수 없는 오류"}`, code: common.errorCode },
        { status: 502 });
    }
    const cand = pickJusoCandidate(jusoJson);
    if (!cand) return NextResponse.json({ juso: null, land: null });

    // 2) 건축물대장 표제부 조회 (전 동, 최대 100)
    const p = bldrgstParams(cand);
    const bldUrl = "https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?"
      + new URLSearchParams({
        serviceKey: dataKey, sigunguCd: p.sigunguCd, bjdongCd: p.bjdongCd,
        platGbCd: p.platGbCd, bun: p.bun, ji: p.ji,
        numOfRows: "100", pageNo: "1", _type: "json",
      });
    const bldResp = await fetch(bldUrl);
    if (!bldResp.ok) {
      return NextResponse.json({ error: "건축물대장 API 오류", detail: await bldResp.text() }, { status: bldResp.status });
    }
    const land = aggregateLandInfo(await bldResp.json());
    return NextResponse.json({ juso: { roadAddr: cand.roadAddr, jibunAddr: cand.jibunAddr }, land });
  } catch (err) {
    return NextResponse.json({ error: "토지정보 조회 오류", message: err.message }, { status: 500 });
  }
}
