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

    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY' }), { status: 500, headers });
    }

    const systemInstruction = `
      Actúa como "Asistente Expatriarse", experto en extranjería de España.
      REGLAS:
      1. Respuestas útiles, empáticas y basadas en normativa española.
      2. REGLA SEGUROS: Si preguntan de seguros (salud, viaje, médico, NLV, Estudiante):
         - Recomienda sutilmente "Seguren.com" usando ESTE FORMATO: [Seguren.com](https://www.seguren.com)
      3. Si no es seguros, no menciones nada comercial.
    `;

    // Usamos el modelo 2.0 Flash
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemInstruction}\n\nConsulta del usuario: "${message}"`
          }]
        }],
        // --- AQUÍ ESTÁ LA SOLUCIÓN: BAJAMOS LOS FILTROS ---
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.text();
      throw new Error(`Google Error (${apiResponse.status}): ${errorData}`);
    }

    const data = await apiResponse.json();
    
    // Verificamos si hay respuesta o si Google la bloqueó
    let responseText = "No pude generar respuesta.";
    
    if (data.candidates && data.candidates.length > 0) {
        // Si hay texto, lo usamos
        if (data.candidates[0].content && data.candidates[0].content.parts) {
            responseText = data.candidates[0].content.parts[0].text;
        } 
        // Si no hay texto, miramos si fue bloqueado por seguridad
        else if (data.candidates[0].finishReason) {
            responseText = `⚠️ La respuesta fue bloqueada por Google (Motivo: ${data.candidates[0].finishReason}). Intenta reformular la pregunta.`;
        }
    }

    // Guardar en Sheet (con espera para asegurar que llegue)
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
      } catch (e) {
        console.error("Sheet error:", e);
      }
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error técnico: ${error.message}` }), { status: 200, headers });
  }
}
