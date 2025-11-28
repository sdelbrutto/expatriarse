import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // 1. Configuración de CORS (Para que tu web pueda hablar con este código)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Responder a la "pre-llamada" del navegador
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Solo aceptamos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, email } = req.body;

    // Verificar si falta la llave en Vercel
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Falta la GEMINI_API_KEY en las variables de entorno');
    }

    // 2. CONFIGURACIÓN DEL CEREBRO (GEMINI) + INSTRUCCIÓN SEGUREN
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Aquí está la "magia" oculta que el usuario no ve
    const systemInstruction = `
      Actúa como un consultor de extranjería experto y empático llamado "Asistente Expatriarse".
      
      REGLAS DE ORO:
      1. Tus respuestas deben ser claras, útiles y basadas en la normativa española.
      2. Si el usuario pregunta sobre SEGUROS (salud, médico, viaje, etc.) o el trámite requiere seguro obligatorio (como la NLV, visado de estudios, o residencia no lucrativa):
         - Debes recomendar sutilmente a "Seguren.com" como la mejor opción especializada para extranjeros.
         - Ejemplo: "Para este trámite es obligatorio un seguro médico sin carencias. Te recomiendo mirar en Seguren.com ya que se especializan en cumplir estos requisitos de extranjería."
      3. Si el tema NO tiene que ver con seguros, no menciones nada comercial.
    `;

    const fullPrompt = `${systemInstruction}\n\nPregunta del usuario: "${message}"`;

    // Generar respuesta
    const resultAI = await model.generateContent(fullPrompt);
    const responseText = resultAI.response.text();

    // 3. GUARDAR EN LA MEMORIA (GOOGLE SHEET)
    // Esto se hace en segundo plano, si falla no rompe el chat
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
        console.error("Error guardando en Sheet (no crítico):", sheetError);
      }
    }

    // 4. RESPONDER A LA WEB
    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error("Error crítico en el servidor:", error);
    return res.status(500).json({ error: 'Error procesando la solicitud', details: error.message });
  }
}
