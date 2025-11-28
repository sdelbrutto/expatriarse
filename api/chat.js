// /api/chat.js
import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    // GET → modo prueba (solo para verificar la función)
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        method: "GET",
        message: "Función /api/chat funcionando correctamente (modo prueba GET)."
      });
    }

    // POST → la consulta real del asistente
    if (req.method === "POST") {
      const userQuery = req.body?.query;

      if (!userQuery) {
        return res.status(400).json({
          error: "Falta el parámetro 'query'."
        });
      }

      // Cliente OpenAI con la API KEY que cargaste en Vercel (ENV)
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Llamada al modelo
      const completion = await client.responses.create({
        model: "gpt-4o-mini",
        input: userQuery,
      });

      const aiText =
        completion.output_text ||
        completion.output?.[0]?.content?.[0]?.text ||
        "Lo siento, no pude generar una respuesta.";

      return res.status(200).json({
        text: aiText,
        sources: [] // dejé espacio para añadir RAG más adelante
      });
    }

    // Otros métodos no permitidos
    return res.status(405).json({ error: "Método no permitido." });

  } catch (error) {
    console.error("ERROR en /api/chat:", error);
    return res.status(500).json({
      error: "SERVER_ERROR",
      details: error.message
    });
  }
}
