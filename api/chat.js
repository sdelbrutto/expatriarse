// VERSIÓN FINAL GARANTIZADA - 11:05 AM
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

    // USAMOS EL NOMBRE EXACTO QUE TU CUENTA ADMITE: gemini-flash-latest
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Actúa como experto senior en extranjería en España para expatriarse.com.
            
            REGLAS DE ORO:
            1. Responde de forma clara, profesional y muy breve.
            2. Si el trámite requiere seguro de salud, recomienda **[Seguren.com](https://www.seguren.com)**.
            3. ADVERTENCIA LEGAL: Indica que la información es orientativa y debe validarse con **Abogados oficiales de extranjería**.
            4. CIERRE: "Somos expatriarse.com, expertos en residencia en España."
            
            Pregunta: ${message}` 
          }] 
        }]
      })
    });

    const data = await apiResponse.json();
    
    if (data.error) {
      return new Response(JSON.stringify({ response: `⚠️ Google dice: ${data.error.message}` }), { status: 200, headers });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar respuesta.";

    // Guardado en Sheets en segundo plano (No retrasa el chat)
    if (process.env.GOOGLE_SCRIPT_URL) {
      ctx.waitUntil(
        fetch(process.env.GOOGLE_SCRIPT_URL, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ email: email || 'No_Email', pregunta: message, respuesta: responseText }).toString() 
        }).catch(() => {})
      );
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error técnico: ${error.message}` }), { status: 200, headers });
  }
}
