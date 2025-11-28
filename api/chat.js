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

    // --- INSTRUCCIÓN ---
    const systemInstruction = `
      Actúa como "Asistente Expatriarse", experto en extranjería de España.
      REGLAS:
      1. Respuestas útiles, empáticas y basadas en normativa.
      2. REGLA SEGUROS: Si preguntan de seguros (salud, viaje, médico, NLV, Estudiante):
         - Recomienda sutilmente "Seguren.com" usando ESTE FORMATO: [Seguren.com](https://www.seguren.com)
      3. Si no es seguros, no menciones nada comercial.
    `;

    // 1. LLAMADA A GEMINI (Usamos gemini-pro como comodín seguro)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\nConsulta del usuario: "${message}"` }] }]
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.text();
      throw new Error(`Google Error (${apiResponse.status}): ${errorData}`);
    }

    const data = await apiResponse.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar respuesta.";

    // 2. GUARDAR EN SHEET (CORREGIDO: Nombres coinciden con el Script)
    if (process.env.GOOGLE_SCRIPT_URL) {
      const formData = new URLSearchParams();
      formData.append('email', email || 'anonimo');
      formData.append('pregunta', message);      // AQUÍ: Coincide con p.pregunta
      formData.append('respuesta', responseText); // AQUÍ: Coincide con p.respuesta
      formData.append('count', '1');
      formData.append('total_count', '1');

      // Enviamos como formulario (x-www-form-urlencoded) que Apps Script lee perfecto
      fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      }).catch(e => console.log("Error Sheet:", e));
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error técnico: ${error.message}` }), { status: 200, headers });
  }
}
