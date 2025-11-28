import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Configurar cabeceras para evitar bloqueos
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Verificar si Vercel tiene la API Key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("ERROR FATAL: No se encuentra la variable GEMINI_API_KEY en Vercel.");
    }

    const { message } = req.body;
    
    // 2. Intentar conectar con Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `Actúa como asistente. Usuario dice: "${message}"`;
    const resultAI = await model.generateContent(prompt);
    const text = resultAI.response.text();

    // 3. Responder con éxito
    return res.status(200).json({ response: text });

  } catch (error) {
    // AQUÍ ESTÁ EL TRUCO: En lugar de dar Error 500, devolvemos el error como texto
    console.error("Error capturado:", error);
    return res.status(200).json({ 
      response: `⚠️ DIAGNÓSTICO: ${error.message}. (Muestra esto a tu técnico)` 
    });
  }
}
