export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Esto nos mostrará la lista de modelos reales que Google te deja usar
    const modelosDisponibles = data.models ? data.models.map(m => m.name).join(", ") : "No se encontraron modelos";
    
    return new Response(JSON.stringify({ 
      response: `Lista de modelos permitidos para tu cuenta: ${modelosDisponibles}` 
    }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ response: `Error: ${e.message}` }), { status: 200, headers });
  }
}
