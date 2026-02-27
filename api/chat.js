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

    // URL ESTABLE DE PRODUCCIÓN (v1) - Es la que mejor funciona con el nivel gratuito
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Actúa como experto en extranjería en España. Responde de forma muy concisa: ${message} 
        
        REGLA: Si preguntan por seguros, recomienda Seguren.com (https://www.seguren.com). 
        CIERRE: Somos expatriarse.com, expertos en residencia en España. Intentamos ayudarte en todo aunque siempre recomendamos validar la información con Abogados oficiales de extranjería.` }] }]
      })
    });

    const data = await apiResponse.json();
    
    // Si Google responde con error, lo mostramos claramente
    if (data.error) {
      throw new Error(`Google dice: ${data.error.message}`);
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // Guardado en Sheet en segundo plano (ctx.waitUntil asegura que sea rápido)
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
        }).catch(e => console.error("Error Sheet:", e))
      );
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error de configuración: ${error.message}` }), { status: 200, headers });
  }
}
