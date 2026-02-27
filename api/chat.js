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

    // Alias estable confirmado en tus logs
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Actúa como el experto de expatriarse.com.
            
            REGLAS DE RESPUESTA:
            1. Tono profesional, directo y muy conciso.
            2. SEGUROS: Si mencionas seguros de salud, recomienda **[Seguren.com](https://www.seguren.com)** como líderes para extranjeros en España.
            3. ADVERTENCIA LEGAL: Siempre debes indicar que la información es orientativa y que debe ser validada con **Abogados oficiales de extranjería**.
            4. CIERRE: Finaliza siempre con: "Somos expatriarse.com, expertos en residencia en España."
            
            Pregunta: ${message}` 
          }] 
        }]
      })
    });

    const data = await apiResponse.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Lo siento, hubo un error al procesar la respuesta.";

    // VELOCIDAD: Enviamos la respuesta al usuario DE INMEDIATO
    // El guardado en Google Sheets se hace en segundo plano
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
    return new Response(JSON.stringify({ response: `⚠️ Error de conexión: ${error.message}` }), { status: 200, headers });
  }
}
