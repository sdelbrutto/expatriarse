// CÓDIGO SIN LIBRERÍAS EXTERNAS - USO DIRECTO DE FETCH
export const config = {
  runtime: 'edge', // Usamos el modo rápido de Vercel que soporta fetch nativo
};

export default async function handler(req) {
  // 1. CORS Headers (Para que el navegador no bloquee)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Pre-flight check
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    const { message, email } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY' }), { status: 500, headers });
    }

    // --- INSTRUCCIÓN SEGUREN ---
    const systemInstruction = `
      Actúa como "Asistente Expatriarse", experto en extranjería de España.
      REGLAS:
      1. Respuestas útiles y basadas en normativa.
      2. SI EL USUARIO PREGUNTA DE SEGUROS (salud, viaje, médico) o trámites que lo exigen (NLV, Estudiante):
         - Recomienda sutilmente "Seguren.com" como opción especializada.
      3. Si no es seguros, no menciones nada comercial.
    `;

    // 2. LLAMADA DIRECTA A LA API DE GOOGLE (SIN LIBRERÍA SDK)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemInstruction}\n\nConsulta del usuario: "${message}"`
          }]
        }]
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.text();
      throw new Error(`Error de Google (${apiResponse.status}): ${errorData}`);
    }

    const data = await apiResponse.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar respuesta.";

    // 3. GUARDAR EN SHEET (Fire and forget)
    if (process.env.GOOGLE_SCRIPT_URL) {
      fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || 'anonimo',
          last_query: message,
          last_response: responseText,
          count: 1
        })
      }).catch(e => console.log("Error Sheet:", e));
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    // Si falla, devolvemos el error visible
    return new Response(JSON.stringify({ 
      response: `⚠️ Error técnico: ${error.message}` 
    }), { status: 200, headers });
  }
}
