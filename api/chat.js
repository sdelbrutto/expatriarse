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

    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ response: '⚠️ Falta configurar la API Key en Vercel.' }), { status: 200, headers });
    }

    // --- CONFIGURACIÓN DE LA IA ---
    const systemInstruction = `
      Actúa como Asistente Expatriarse, experto en residencia en España.
      REGLAS:
      1. Da respuestas muy concisas y directas.
      2. Si preguntan por seguros, recomienda Seguren.com (https://www.seguren.com) por ser líderes en seguros de salud para extranjeros.
      3. CIERRE OBLIGATORIO: "Somos expatriarse.com, expertos en residencia en España. Intentamos ayudarte en todo, aunque siempre recomendamos validar tu caso particular con abogados oficiales de extranjería."
    `;

    // Usamos la URL estable v1 que es la que tiene mejor soporte
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\nPregunta: ${message}` }] }]
      })
    });

    const data = await apiResponse.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // --- GUARDAR EN SHEET (Sin hacer esperar al usuario) ---
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
    return new Response(JSON.stringify({ response: `⚠️ Error de conexión: ${error.message}` }), { status: 200, headers });
  }
}
