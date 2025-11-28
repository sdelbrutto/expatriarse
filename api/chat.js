import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Configuración de CORS para permitir llamadas desde tu web
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Manejar preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, email } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Falta la GEMINI_API_KEY en Vercel');
    }

    // 1. CONSULTAR A GEMINI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `Actúa como un consultor de extranjería experto. El usuario pregunta: "${message}". Responde de forma útil, clara y empática.`;
    const resultAI = await model.generateContent(prompt);
    const responseText = resultAI.response.text();

    // 2. GUARDAR EN GOOGLE SHEET (La memoria)
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
      } catch (sheetError) {
        console.error("Error guardando en Sheet:", sheetError);
        // No detenemos el chat si falla el sheet, solo lo logueamos
      }
    }

    // 3. RESPONDER AL FRONTEND
    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error("Error general:", error);
    return res.status(500).json({ error: 'Error procesando la solicitud', details: error.message });
  }
}
