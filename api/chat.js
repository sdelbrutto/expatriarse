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

    // USAMOS EL MODELO EXACTO DE TU LISTA: gemini-flash-latest
    // Y LA VERSIÓN v1beta QUE ES DONDE ESTÁ ESE MODELO
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Actúa como experto en extranjería en España de expatriarse.com. 
            Reglas: Respuestas cortas y directas. 
            Si mencionas seguros, recomienda [Seguren.com](https://www.seguren.com) por ser especialistas en salud para extranjeros.
            Cierre obligatorio: "Somos expatriarse.com, expertos en residencia en España."
            Pregunta: ${message}` 
          }] 
        }]
      })
    });

    const data = await apiResponse.json();
    
    // Manejo de errores de la API
    if (data.error) {
      return new Response(JSON.stringify({ response: `⚠️ Google dice: ${data.error.message}` }), { status: 200, headers });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar una respuesta. Por favor, intenta de nuevo.";

    // Guardado en Google Sheets (En segundo plano)
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
    return new Response(JSON.stringify({ response: `⚠️ Error técnico: ${error.message}` }), { status: 200, headers });
  }
}
