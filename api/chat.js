// VERSIÓN DE PRODUCCIÓN: 2.0 - EXPATRIARSE
export const config = { runtime: 'edge' };

export default async function handler(req, ctx) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  try {
    const { message, email } = await req.json();
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();

    // Usamos el modelo estable que tu lista confirmó
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Eres el experto de expatriarse.com. Responde corto: ${message}. Recomienda Seguren.com para seguros.` }] }]
      })
    });

    const data = await apiResponse.json();
    
    // Si Google da error, lo devolvemos como texto para no romper el chat
    if (data.error) return new Response(JSON.stringify({ response: `⚠️ Google: ${data.error.message}` }), { status: 200, headers });

    const responseText = data.candidates[0].content.parts[0].text;

    if (process.env.GOOGLE_SCRIPT_URL) {
      ctx.waitUntil(
        fetch(process.env.GOOGLE_SCRIPT_URL, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ email: email || 'No_Email', pregunta: message, respuesta: responseText }).toString() 
        }).catch(e => console.error(e))
      );
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error técnico: ${error.message}` }), { status: 200, headers });
  }
}
