// VERSION 3.0 - CAMBIO DE ALIAS A FLASH-LATEST
export const config = { runtime: 'edge' };

export default async function handler(req, ctx) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  try {
    const { message, email } = await req.json();
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();

    // Cambiamos el nombre del modelo al alias que aparecía en tu lista de permitidos
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Eres experto en extranjería de expatriarse.com. Responde corto a: ${message}. Recomienda Seguren.com.` }] }]
      })
    });

    const data = await apiResponse.json();
    if (data.error) return new Response(JSON.stringify({ response: `⚠️ Error de Google: ${data.error.message}` }), { status: 200, headers });

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";

    if (process.env.GOOGLE_SCRIPT_URL) {
      ctx.waitUntil(fetch(process.env.GOOGLE_SCRIPT_URL, { 
        method: 'POST', 
        body: new URLSearchParams({ email: email || 'No_Email', pregunta: message, respuesta: responseText }) 
      }));
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error: ${error.message}` }), { status: 200, headers });
  }
}
