// api/chat.js
// Versión simple para comprobar que la Serverless Function funciona.

export default async function handler(req, res) {
  // Solo permitimos POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const { query } = req.body || {};

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Falta el campo 'query' en el body." });
      return;
    }

    // Respuesta de prueba: solo devolvemos lo que el usuario mandó
    const text = `Echo de prueba desde el servidor: ${query}`;

    res.status(200).json({
      text,
      sources: [] // por ahora sin fuentes
    });
  } catch (err) {
    console.error("Error en /api/chat:", err);
    res.status(500).json({ error: "Error interno en el servidor." });
  }
}
