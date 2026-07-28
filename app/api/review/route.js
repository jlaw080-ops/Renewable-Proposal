import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다" }, { status: 500 });
  }
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "잘못된 요청 본문" }, { status: 400 }); }

  const model = body.model || "gemini-2.5-pro";
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: body.system_instruction,
          contents: body.contents,
          generationConfig: body.generationConfig ?? { maxOutputTokens: 8192 },
        }),
      },
    );
    if (!resp.ok) {
      return NextResponse.json({ error: "Gemini API 오류", detail: await resp.text() }, { status: resp.status });
    }
    return new Response(resp.body, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    return NextResponse.json({ error: "프록시 오류", message: err.message }, { status: 500 });
  }
}
