// api/chat.js
// Prueba mínima: solo devuelve un JSON fijo.

module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    method: req.method,
    message: "Función /api/chat funcionando en modo prueba."
  });
};
