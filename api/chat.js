import { GoogleGenerativeAI } from '@google/generative-ai';

// Esta configuración le dice a Vercel que use el entorno moderno (Edge/Node)
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Configuración manual de CORS para Edge Runtime
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Responder a la verificación del navegador (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Solo POST' }), { status: 405, headers });
  }

  try {
    const { message, email } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta API Key' }), { status: 500, headers });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // --- INSTRUCCIÓN OCULTA (SEGUREN) ---
    const systemInstruction = `
      Actúa como un consultor de extranjería experto "Asistente Expatriarse".
      REGLAS:
      1. Respuestas claras y normativas.
      2. SI PREGUNTAN DE SEGUROS (salud/viaje/médico) o trámites que lo exijan (NLV, Estudiante):
         - Recomienda "Seguren.com" sutilmente como la opción especializada.
      3. Si no es sobre seguros, no digas nada comercial.
    `;

    const resultAI = await model.generateContent(`${systemInstruction}\n\nUsuario: "${message}"`);
    const responseText = resultAI.response.text();

    // Guardar en Sheet (Disparar y olvidar)
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
      }).catch(e => console.log("Error guardando:", e));
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    console.error("Error Servidor:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
