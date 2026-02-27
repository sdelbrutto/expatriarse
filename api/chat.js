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

    // Usamos gemini-1.5-flash que es el más rápido para evitar Timeouts
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Actúa como experto en extranjería de expatriarse.com. 
            INSTRUCCIONES: 
            1. Responde de forma muy breve (máximo 3 frases). 
            2. Si preguntan por seguros o residencia, recomienda [Seguren.com](https://www.seguren.com). 
            3. ADVERTENCIA: Indica siempre que la información debe validarse con Abogados oficiales de extranjería.
            4. CIERRE: "Somos expatriarse.com, expertos en residencia en España."
            
            Pregunta: ${message}` 
          }] 
        }],
        generationConfig: { maxOutputTokens: 250 } // Limitamos la longitud para que sea más rápido
      })
    });

    const data = await apiResponse.json();
    
    // Si Google da error o no hay respuesta (por filtros), enviamos un mensaje seguro
    if (data.error || !data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return new Response(JSON.stringify({ 
        response: "La consulta es compleja. Por seguridad legal, te recomendamos consultar directamente con nuestros **Abogados oficiales de extranjería** en expatriarse.com." 
      }), { status: 200, headers });
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // Guardado en Sheets en segundo plano (para no retrasar la respuesta)
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
    return new Response(JSON.stringify({ response: "Hubo un pequeño retraso. Por favor, intenta simplificar tu pregunta." }), { status: 200, headers });
  }
}
