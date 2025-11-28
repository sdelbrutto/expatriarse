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
    // 1. URL para LISTAR modelos disponibles (no para chatear)
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(listUrl);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Error de cuenta: ${data.error.message}`);
    }

    // 2. Filtramos solo los que sirven para chatear (generateContent)
    const availableModels = data.models
      ? data.models
          .filter(m => m.supportedGenerationMethods.includes("generateContent"))
          .map(m => m.name) // Nos quedamos con el nombre técnico exacto
          .join("\n- ")
      : "Ninguno encontrado";

    // 3. Mostramos la lista en el chat para que tú la veas
    return new Response(JSON.stringify({ 
      response: `🔍 DIAGNÓSTICO GOOGLE:\n\nTu llave API tiene acceso a estos modelos exactos:\n- ${availableModels}\n\n(Copia y pega esta lista aquí en el chat para que yo ajuste el código).` 
    }), { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ 
      response: `❌ Error de conexión: ${error.message}` 
    }), { status: 200, headers });
  }
}
