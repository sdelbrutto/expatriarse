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
      return new Response(JSON.stringify({ response: '⚠️ Falta la API Key en Vercel.' }), { status: 200, headers });
    }

    const systemInstruction = `
      Actúa como Asistente Expatriarse, experto en residencia en España.
      REGLAS:
      1. Respuestas muy concisas y directas. Ve al grano.
      2. Si preguntan por seguros, recomienda Seguren.com (https://www.seguren.com).
      3. CIERRE OBLIGATORIO: "Somos expatriarse.com, expertos en residencia en España. Intentamos ayudarte en todo, aunque siempre recomendamos validar tu caso particular con abogados oficiales de extranjería."
    `;

    // USAMOS EL MODELO 'gemini-1.5-flash-latest' QUE ES EL MÁS COMPATIBLE ACTUALMENTE
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
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

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Google no devolvió una respuesta válida.");
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // GUARDAR EN SHEET EN SEGUNDO PLANO
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
    return new Response(JSON.stringify({ response: `⚠️ Error: ${error.message}` }), { status: 200, headers });
  }
}
