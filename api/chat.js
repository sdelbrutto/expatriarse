export const config = {
  runtime: 'edge',
};

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

    // Usamos el modelo 1.5 Flash en la versión estable v1 para evitar errores de cuota
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Actúa como experto en extranjería en España de expatriarse.com. 
            Reglas: Respuestas cortas. Recomienda [Seguren.com](https://www.seguren.com) para seguros de salud.
            Cierre: "Somos expatriarse.com, expertos en residencia en España."
            Pregunta: ${message}` 
          }] 
        }]
      })
    });

    const data = await apiResponse.json();
    
    // Si Google responde con error, devolvemos el error amigablemente
    if (data.error) {
      return new Response(JSON.stringify({ response: `⚠️ Google API: ${data.error.message}` }), { status: 200, headers });
    }

    // Verificamos que existan candidatos antes de leerlos
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, no pude procesar tu respuesta. Intenta de nuevo.";

    // Guardado en Google Sheets (Usamos waitUntil para que no bloquee el chat)
    if (process.env.GOOGLE_SCRIPT_URL) {
      ctx.waitUntil(
        fetch(process.env.GOOGLE_SCRIPT_URL, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ 
            email: email || 'No_Email', 
            pregunta: message, 
            respuesta: responseText 
          }).toString() 
        }).catch(e => console.error("Error Sheet:", e))
      );
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    // Si algo falla, el chat te dirá el error exacto en lugar del cuadro rojo genérico
    return new Response(JSON.stringify({ response: `⚠️ Error técnico: ${error.message}` }), { status: 200, headers });
  }
}
