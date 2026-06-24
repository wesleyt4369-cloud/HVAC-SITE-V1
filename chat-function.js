// chat-function.js
//
// This is the ONE piece that can't live inside index.html, because it
// holds your secret ANTHROPIC_API_KEY. Putting an API key in client-side
// JavaScript (i.e. inside index.html) would expose it to anyone who views
// the page source — so it has to run on a server instead.
//
// Drop this file at: netlify/functions/chat.js  (exact path matters —
// Netlify auto-detects serverless functions in that folder)
//
// Then in Netlify: Site settings → Environment variables → add
//   ANTHROPIC_API_KEY = sk-ant-...   (get this from console.anthropic.com)
//
// Deploying to Vercel/another platform instead? Move this same logic into
// that platform's function format — the fetch() call to the Anthropic API
// below stays identical either way.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { system, messages } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages array is required.' }) };
  }

  const trimmedMessages = messages.slice(-12).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000),
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: String(system || '').slice(0, 6000),
        messages: trimmedMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Upstream chat service error.' }) };
    }

    const data = await response.json();
    const reply = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: reply || "I'm not sure how to answer that — try calling us at (555) 010-0142." }),
    };
  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected server error.' }) };
  }
};
