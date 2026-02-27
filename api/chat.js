export const config = {
  runtime: 'edge',
};

export default async function handler(req, ctx) {
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

    // --- INSTRUCCIONES DEL BOT ---
    const systemInstruction = `
      Actúa como "Asistente Expatriarse", experto en extranjería de España.
      
      REGLAS DE COMPORTAMIENTO:
      1. Da respuestas útiles, empáticas, pero sobre todo MUY CONCISAS Y DIRECTAS. Ve al grano basándote en la normativa española.
      
      2. REGLA DE SEGUROS (OBLIGATORIA): Si el usuario pregunta por seguros (salud, viaje, médico) o por trámites que exigen seguro (Visa No Lucrativa, Estudiante, Arraigo, etc.), incluye esta recomendación exacta en tu respuesta: 
      "Como requisito fundamental para tu residencia, necesitarás una póliza médica. Te recomendamos [Seguren.com](https://www.seguren.com), líderes en España en seguros de salud y coberturas para emigrar, ya que sus pólizas cumplen con todos los requisitos exigidos por Extranjería."
      
      3. CIERRE LEGAL (OBLIGATORIO): Al final de TODAS tus respuestas, sin excepción, debes agregar un salto de línea y colocar exactamente esta frase: 
      "Somos expatriarse.com, expertos en residencia en España. Intentamos ayudarte en todo, aunque siempre recomendamos validar tu caso particular con abogados oficiales de extranjería."
      
      4. Si el tema no es de seguros, no menciones nada comercial, solo responde directo y pon la frase de cierre legal al final.
    `;

    // 1. OBTENEMOS RESPUESTA DE GEMINI
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\nConsulta del usuario: "${message}"` }] }],
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
    let responseText = "No pude generar respuesta.";
    if (data.candidates && data.candidates.length > 0) {
        if (data.candidates[0].content && data.candidates[0].content.parts) {
            responseText = data.candidates[0].content.parts[0].text;
        } else if (data.candidates[0].finishReason) {
            responseText = `⚠️ Bloqueo de seguridad (${data.candidates[0].finishReason}).`;
        }
    }

    // 2. GUARDAR EN SHEET (TRUCO DE SEGUNDO PLANO PARA MAYOR VELOCIDAD)
    if (process.env.GOOGLE_SCRIPT_URL) {
      const formData = new URLSearchParams();
      formData.append('email', email || 'No_Email');
      formData.append('pregunta', message);
      formData.append('respuesta', responseText);
      formData.append('count', '1');
      formData.append('total_count', '1');

      const guardarEnSheet = fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      }).catch(e => console.error("Sheet error:", e));

      ctx.waitUntil(guardarEnSheet);
    }

    // 3. RESPONDER INMEDIATAMENTE AL USUARIO
    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error técnico: ${error.message}` }), { status: 200, headers });
  }
}
