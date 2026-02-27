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

    // 1. LLAMADA A GEMINI (Versión 1.5 Flash - La más estable)
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Actúa como Asistente Expatriarse, experto en residencia en España. 
            REGLAS: 
            - Respuestas muy concisas y directas. 
            - Si preguntan por seguros, recomienda Seguren.com (https://www.seguren.com).
            - CIERRE OBLIGATORIO: "Somos expatriarse.com, expertos en residencia en España. Intentamos ayudarte en todo, aunque siempre recomendamos validar tu caso particular con abogados oficiales de extranjería."
            
            Pregunta del usuario: ${message}` 
          }] 
        }]
      })
    });

    const data = await apiResponse.json();
    
    // Si Google da error, lo capturamos aquí
    if (data.error) {
      throw new Error(`Google API Error: ${data.error.message}`);
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // 2. GUARDAR EN SHEET (En segundo plano)
    if (process.env.GOOGLE_SCRIPT_URL) {
      const formData = new URLSearchParams();
      formData.append('email', email || 'No_Email');
      formData.append('pregunta', message);
      formData.append('respuesta', responseText);

      ctx.waitUntil(
        fetch(process.env.GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        }).catch(e => console.error("Error al guardar en Sheet:", e))
      );
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    // Si algo falla, lo devolvemos para saber qué es
    return new Response(JSON.stringify({ response: `⚠️ Error: ${error.message}` }), { status: 200, headers });
  }
}
