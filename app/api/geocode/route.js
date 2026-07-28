import { NextResponse } from "next/server";

export async function GET(request) {
  const clientId = process.env.NCP_CLIENT_ID;
  const clientSecret = process.env.NCP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "네이버 지도 API 키가 설정되지 않았습니다" }, { status: 500 });
  }
  const query = request.nextUrl.searchParams.get("query");
  if (!query) return NextResponse.json({ error: "query 파라미터가 필요합니다" }, { status: 400 });

  try {
    const url = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=" + encodeURIComponent(query);
    const resp = await fetch(url, {
      headers: { "X-NCP-APIGW-API-KEY-ID": clientId, "X-NCP-APIGW-API-KEY": clientSecret },
    });
    if (!resp.ok) {
      return NextResponse.json({ error: "네이버 API 오류", detail: await resp.text() }, { status: resp.status });
    }
    return NextResponse.json(await resp.json());
  } catch (err) {
    return NextResponse.json({ error: "프록시 오류", message: err.message }, { status: 500 });
  }
}
