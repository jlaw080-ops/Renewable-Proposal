// api/recommend.js — Vercel Serverless Function for AI recommendation
// Node.js runtime (60s timeout) + streaming

export const config = {
  maxDuration: 60,
  supportsResponseStreaming: true,
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'API key not configured' });
    return;
  }

  try {
    const body = req.body;
    const model = body.model || 'gemini-2.0-flash';
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':streamGenerateContent?alt=sse&key=' + encodeURIComponent(apiKey);

    const geminiResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: body.system_instruction,
        contents: body.contents,
        generationConfig: body.generationConfig || {
          maxOutputTokens: 4096,
          temperature: 0.7,
          responseMimeType: 'application/json'
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      res.status(geminiResp.status).send(errText);
      return;
    }

    // SSE 스트림 전달
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = geminiResp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
}
