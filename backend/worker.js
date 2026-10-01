// Cloudflare Worker — proxy LLM vers Moonshot (Kimi K3).
// La clé API reste côté serveur (secret), jamais exposée dans le jeu statique.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405, headers: CORS });
    }
    try {
      const body = await request.json();
      const res = await fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + env.MOONSHOT_API_KEY,
        },
        body: JSON.stringify({
          model: env.MODEL || 'kimi-k3',
          messages: (body && body.messages) || [],
          temperature: (body && body.temperature != null) ? body.temperature : 0.85,
          // Kimi K3 attend max_completion_tokens (pas max_tokens)
          max_completion_tokens: (body && body.max_tokens) || 80,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  },
};
