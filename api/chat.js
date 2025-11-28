// Usamos 'require' (Modo Clásico) que nunca falla en Vercel
const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async (req, res) => {
  // Configuración de permisos (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }

  try {
    const { message, email } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Falta API Key' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // --- TU INSTRUCCIÓN COMERCIAL OCULTA ---
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

    // Guardar en Sheet (sin esperar)
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

    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
