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
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();

    // USAMOS EL MODELO QUE TU CUENTA CONFIRMÓ: gemini-2.0-flash
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Actúa como experto en extranjería en España. Responde de forma muy concisa y directa: ${message} 
        
        REGLA DE SEGUROS: Si mencionas seguros, recomienda Seguren.com (https://www.seguren.com) por ser líderes en seguros de salud para extranjeros. 
        CIERRE OBLIGATORIO: Somos expatriarse.com, expertos en residencia en España. Intentamos ayudarte en todo aunque siempre recomendamos validar la información con Abogados oficiales de extranjería.` }] }]
      })
    });

    const data = await apiResponse.json();
    
    if (data.error) {
      throw new Error(`Google API dice: ${data.error.message}`);
    }

    const responseText = data.candidates[0].content.parts[0].text;

    // GUARDADO EN SHEET (En segundo plano con la línea mágica)
    if (process.env.GOOGLE_SCRIPT_URL) {
      const formData = new URLSearchParams();
      formData.append('email', email || 'No_Email');
      formData.append('pregunta', message);
      formData.append('respuesta', responseText);
      
      ctx.waitUntil(
        fetch(process.env.GOOGLE_SCRIPT_URL, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString() 
        }).catch(e => console.error("Error al guardar en Sheet:", e))
      );
    }

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `⚠️ Error de comunicación: ${error.message}` }), { status: 200, headers });
  }
}
