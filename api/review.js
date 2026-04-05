// api/review.js
// Vercel Serverless Function — Gemini API 프록시 (SSE 스트리밍)
// 환경변수 GEMINI_API_KEY 를 Vercel 프로젝트 Settings > Environment Variables 에 등록

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const model = body.model || 'gemini-2.5-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const geminiResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: body.system_instruction,
        contents: body.contents,
        generationConfig: body.generationConfig || { maxOutputTokens: 8192 },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      return new Response(errText, {
        status: geminiResp.status,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // SSE 스트림을 그대로 클라이언트에 전달
    return new Response(geminiResp.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
