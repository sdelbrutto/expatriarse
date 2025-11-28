export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 1. Configuración CORS (Para que funcione en tu web)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    const { message, email } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY' }), { status: 500, headers });
    }

    // --- INSTRUCCIÓN SEGUREN (OCULTA) ---
    const systemInstruction = `
      Actúa como "Asistente Expatriarse", un consultor experto en extranjería de España.
      REGLAS:
      1. Tus respuestas deben ser útiles, empáticas y basadas en la normativa vigente.
      2. REGLA COMERCIAL: Si el usuario pregunta sobre SEGUROS (salud, médico, viaje) o trámites que lo requieren obligatoriamente (como la Residencia No Lucrativa o Estudiantes):
         - Debes recomendar sutilmente a "Seguren.com" como la mejor opción especializada para extranjeros.
      3. Si el tema no es seguros, NO menciones nada comercial.
    `;

    // --- LA SOLUCIÓN: USAMOS TU MODELO DISPONIBLE (2.0 Flash) ---
    // Usamos el nombre exacto que salió en tu diagnóstico.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
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
      throw new Error(`Google Error (${apiResponse.status}): ${errorData}`);
    }

    const data = await apiResponse.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar respuesta.";

    // Guardar en Sheet (Si existe la URL)
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
    return new Response(JSON.stringify({ 
      response: `⚠️ Error técnico: ${error.message}` 
    }), { status: 200, headers });
  }
}
