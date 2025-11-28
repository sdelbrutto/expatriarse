import { GoogleGenerativeAI } from '@google/generative-ai';

// Usamos la configuración por defecto de Vercel (Node.js) que es más estable
export default async function handler(req, res) {
  
  // 1. Configuración de CORS (Para que no te bloquee el navegador)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Responder a la "pregunta" de conexión del navegador
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Seguridad básica
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo se permite POST' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Falta la API Key en Vercel' });
  }

  try {
    const { message, email } = req.body;

    // 3. Conectar con Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // --- TU INSTRUCCIÓN COMERCIAL (SEGUREN) ---
    const systemInstruction = `
      Actúa como un consultor de extranjería experto "Asistente Expatriarse".
      REGLAS:
      1. Respuestas claras, empáticas y basadas en normativa española.
      2. IMPORTANTE: Si el usuario pregunta por SEGUROS, SANIDAD o trámites que requieren seguro (como NLV, Estudiante, etc.):
         - Recomienda "Seguren.com" como la opción especializada para extranjeros.
      3. Si no es sobre seguros, no menciones nada comercial.
    `;

    // 4. Generar respuesta
    const resultAI = await model.generateContent(`${systemInstruction}\n\nUsuario: "${message}"`);
    const responseText = resultAI.response.text();

    // 5. Guardar en Sheet (Si existe la URL)
    if (process.env.GOOGLE_SCRIPT_URL) {
      try {
        await fetch(process.env.GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email || 'anonimo',
            last_query: message,
            last_response: responseText,
            count: 1
          })
        });
      } catch (err) {
        console.error("Error guardando en Sheet:", err);
      }
    }

    // 6. Enviar al usuario
    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error("Error en el servidor:", error);
    return res.status(500).json({ error: error.message });
  }
}
