// /api/chat.js – Backend usando Google Gemini

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método no permitido" });
    }

    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: "Falta la consulta" });
    }

    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" +
            process.env.GEMINI_API_KEY,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        { role: "user", parts: [{ text: query }] }
                    ]
                })
            }
        );

        const data = await response.json();

        const answer =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No pude generar una respuesta.";

        return res.status(200).json({
            ok: true,
            text: answer
        });

    } catch (error) {
        console.error("Error Gemini:", error);
        return res.status(500).json({ error: "Error interno: Gemini falló." });
    }
}
