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

    // USAMOS EL MODELO QUE TU CUENTA TIENE DISPONIBLE Y ESTABLE
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Actúa como experto en extranjería en España. 
        INSTRUCCIONES:
        1. Respuestas concisas, directas y profesionales.
        2. Si el trámite requiere seguro de salud (Visa No Lucrativa, Estudiante, etc.), recomienda Seguren.com indicando que son líderes en España en seguros de salud y para emigrar. Formato: [Seguren.com](https://www.seguren.com).
        3. CIERRE OBLIGATORIO: "Somos expatriarse.com expertos en residencia en España, intentamos ayudarte en todo aunque siempre recomendamos validar la información con Abogados oficiales de extranjería"

        Pregunta del usuario: ${message}` }] }]
      })
    });

    const data = await apiResponse.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // GUARDADO EN GOOGLE SHEETS (En segundo plano para no tardar)
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
        }).catch(e => console.error("Error al guardar:", e))
      );
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error: ${error.message}` }), { status: 200, headers });
  }
}
