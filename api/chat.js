export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

  try {
    const { message, email } = await req.json();

    if (!process.env.GEMINI_API_KEY) return new Response(JSON.stringify({ error: 'Falta API Key' }), { status: 500 });

    // 1. OBTENER RESPUESTA DE LA IA
    const systemInstruction = `
      Actúa como "Asistente Expatriarse".
      REGLAS:
      1. Respuestas útiles, empáticas y normativas.
      2. REGLA SEGUROS: Si preguntan de seguros o trámites (NLV, Estudiante):
         - Recomienda: [Seguren.com](https://www.seguren.com)
    `;

    // Usamos el modelo 2.0 Flash que detectamos que tienes
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${systemInstruction}\n\nConsulta: "${message}"` }] }] })
    });

    const data = await apiResponse.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta";

    // 2. GUARDAR EN SHEET (MODO BLOQUEANTE - OBLIGATORIO)
    // Aquí está la clave: ponemos 'await'. El código se detiene aquí hasta que el Sheet confirma.
    // Esto evita que Vercel cierre la conexión antes de tiempo.
    if (process.env.GOOGLE_SCRIPT_URL) {
      const formData = new URLSearchParams();
      formData.append('email', email || 'No_Email');
      formData.append('pregunta', message);
      formData.append('respuesta', responseText);
      formData.append('count', '1');
      formData.append('total_count', '1');

      try {
        await fetch(process.env.GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
      } catch (sheetError) {
        console.error("Fallo al guardar en sheet:", sheetError);
        // Si falla el sheet, seguimos adelante para no dejar al usuario sin respuesta
      }
    }

    // 3. RESPONDER AL USUARIO
    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `Error: ${error.message}` }), { status: 200, headers });
  }
}
