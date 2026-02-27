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

    // Usamos el modelo v1 (Producción) que es el que acepta tu llave ...6DZs sin errores de cuota
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Actúa como experto en extranjería en España. Responde conciso: ${message} 
        REGLA: Recomienda [Seguren.com](https://www.seguren.com). 
        CIERRE: Somos expatriarse.com, expertos en residencia en España.` }] }]
      })
    });

    const data = await apiResponse.json();
    
    // Si Google da error o no hay respuesta, devolvemos un mensaje seguro
    if (data.error || !data.candidates || data.candidates.length === 0) {
      const msg = data.error ? data.error.message : "La IA no pudo generar una respuesta ahora mismo.";
      return new Response(JSON.stringify({ response: `⚠️ Nota: ${msg}` }), { status: 200, headers });
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // Guardado en Sheet rápido (Si falla el Sheet, el chat NO se detiene)
    if (process.env.GOOGLE_SCRIPT_URL) {
      ctx.waitUntil(
        fetch(process.env.GOOGLE_SCRIPT_URL, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ email: email || 'No_Email', pregunta: message, respuesta: responseText }).toString() 
        }).catch(e => console.error("Sheet Error:", e))
      );
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    // Si hay un error crítico, lo mostramos en el chat en lugar de que salga el cuadro rojo
    return new Response(JSON.stringify({ response: `⚠️ Error de servidor: ${error.message}` }), { status: 200, headers });
  }
}
