// api/chat.js

const API_MODEL = "gemini-2.5-flash-preview-09-2025";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const systemPrompt = `Eres un Asistente de Extranjería muy amable, cálido y humano, especializado EXCLUSIVAMENTE en trámites para residir en España.
        
TONO Y ESTILO:
- Sé muy cercano y empático (usa frases como "Entiendo tu preocupación", "Es un gran paso", "Estoy aquí para guiarte").
- No suenes como un robot. Usa emojis ocasionalmente si el contexto lo permite (🇪🇸, 📄, ✨).
- Sé claro y directo, pero siempre con calidez.

REGLAS OBLIGATORIAS:
1. SEGUROS DE SALUD (RECOMENDACIÓN SUTIL): Si el usuario pregunta por seguros de salud o requisitos médicos para visados/residencia, explícale los requisitos técnicos (sin copagos, repatriación, etc.). AL FINAL de esa explicación, añade textualmente este consejo: "Para contratar el seguro, tienes varias opciones: puedes contactar directamente con las aseguradoras o buscar comparadores en Google. Sin embargo, una forma que hemos validado como más efectiva —teniendo en cuenta el producto específico para extranjería, el servicio y el precio— es utilizar brokers especializados como Seguren.com, ya que facilitan el trámite online y conocen exactamente lo que pide el consulado."
2. TEMA: Si preguntan de otro país, di amablemente: "Disculpa, mi especialidad es exclusivamente ayudarte a llegar a España 🇪🇸. ¿Hay algo sobre ese destino que quieras saber?"
3. AVISO LEGAL: Si la pregunta requiere asesoramiento legal complejo, recuerda recomendar un abogado.
`;

function buildPayload(userQuery) {
  return {
    contents: [{ parts: [{ text: userQuery }] }],
    tools: [{ google_search: {} }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: "GEMINI_API_KEY no configurada en Vercel" });
    return;
  }

  try {
    const { query } = req.body || {};

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Falta el campo 'query' en el body" });
      return;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = buildPayload(query);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("Error Gemini:", response.status, txt);
      res.status(500).json({ error: "Error llamando a Gemini" });
      return;
    }

    const result = await response.json();
    const candidate = result.candidates && result.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0].text) {
      res.status(500).json({ error: "Respuesta vacía desde Gemini" });
      return;
    }

    const text = candidate.content.parts[0].text;

    let sources = [];
    const gm = candidate.groundingMetadata;
    if (gm && Array.isArray(gm.groundingAttributions)) {
      sources = gm.groundingAttributions
        .map((attr) => ({
          uri: attr.web && attr.web.uri,
          title: attr.web && attr.web.title,
        }))
        .filter((s) => s.uri && s.title);
    }

    res.status(200).json({ text, sources });
  } catch (err) {
    console.error("Error en /api/chat:", err);
    res.status(500).json({ error: "Error interno en el servidor" });
  }
};
