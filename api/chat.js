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

    // Probamos con la URL v1 y el modelo flash sin sufijos
    const apiKey = process.env.GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Responde de forma concisa: ${message}` }] }]
      })
    });

    const data = await apiResponse.json();

    // Si esto falla, el error nos dirá si es la llave o el modelo
    if (data.error) {
      return new Response(JSON.stringify({ 
        response: `Dato recibido de Google: ${JSON.stringify(data.error)}` 
      }), { status: 200, headers });
    }

    const responseText = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ response: responseText }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ response: `Error total: ${error.message}` }), { status: 200, headers });
  }
}
