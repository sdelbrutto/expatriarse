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

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    const { message, email } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY' }), { status: 500, headers });
    }

    // --- 1. INSTRUCCIÓN CON LINK DIRECTO ---
    const systemInstruction = `
      Actúa como "Asistente Expatriarse", experto en extranjería de España.
      REGLAS:
      1. Respuestas útiles, empáticas y basadas en normativa española.
      2. REGLA DE SEGUROS: SI EL USUARIO PREGUNTA DE SEGUROS (salud, viaje, médico) o trámites que lo exigen (NLV, Estudiante):
         - Debes recomendar sutilmente a Seguren usando ESTE FORMATO DE ENLACE EXACTO: [Seguren.com](https://www.seguren.com).
         - Ejemplo: "Te recomiendo consultar en [Seguren.com](https://www.seguren.com) ya que son especialistas..."
      3. Si no es seguros, no menciones nada comercial.
    `;

    // Llamada a Gemini (Modelo Flash 2.0)
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

    // --- 2. GUARDAR EN SHEET (MÉTODO ROBUSTO) ---
    if (process.env.GOOGLE_SCRIPT_URL) {
      // Usamos URLSearchParams en el 'body' en lugar de la URL.
      // Esto asegura que Google Apps Script reciba los textos largos correctamente.
      const sheetData = new URLSearchParams({
        email: email || 'anonimo',
        last_query: message,
        last_response: responseText,
        count: '1'
      });

      fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded' 
        },
        body: sheetData.toString()
      }).catch(e => console.log("Error Sheet:", e));
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ 
      response: `⚠️ Error técnico: ${error.message}` 
    }), { status: 200, headers });
  }
}
