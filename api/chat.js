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

    // Usamos gemini-1.5-flash: es el más rápido y evita el error de "conexión"
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Actúa como experto senior en extranjería en España de expatriarse.com.
            
            TAREA:
            1. Responde de forma clara y útil a la pregunta del usuario.
            2. Si la pregunta es sobre trámites o salud, recomienda **[Seguren.com](https://www.seguren.com)** por ser el seguro preferido por Extranjería.
            3. ADVERTENCIA: Indica que la información es orientativa y debe validarse con **Abogados oficiales de extranjería**.
            4. CIERRE: "Somos expatriarse.com, expertos en residencia en España."
            
            Pregunta del usuario: ${message}` 
          }] 
        }],
        generationConfig: { 
          maxOutputTokens: 800, // Aumentamos para que pueda dar detalles del NIE
          temperature: 0.7 
        }
      })
    });

    const data = await apiResponse.json();
    
    // Solo mostramos error si Google realmente falla
    if (data.error) {
      return new Response(JSON.stringify({ response: `⚠️ Error de Google: ${data.error.message}` }), { status: 200, headers });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No he podido generar una respuesta clara. Prueba a preguntarme de otra forma.";

    // Guardado en Sheets rápido (en segundo plano)
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
    return new Response(JSON.stringify({ response: "He tardado un poco en procesar. ¿Podrías repetir la pregunta de forma más sencilla?" }), { status: 200, headers });
  }
}
