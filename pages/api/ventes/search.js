import connectToDatabase from "../../../lib/mongodb";
import Vente from "../../../models/ventes";

// GET /api/ventes/search?q=dupont
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ success: false, message: "Paramètre q requis" });

  await connectToDatabase();

  try {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const ventes = await Vente.find({
      $or: [
        { "NOM DU CLIENT": regex },
        { "VENDEUR": regex },
        { "TELEPHONE": regex },
        { "NUMERO BC": regex },
        { "ADRESSE DU CLIENT": regex },
        { "VILLE": regex },
        { "DESIGNATION": regex },
      ],
    })
      .sort({ "DATE DE VENTE": -1 })
      .limit(50)
      .lean()
      .exec();

    res.setHeader("Cache-Control", "private, max-age=10");
    return res.status(200).json({ success: true, data: ventes, totalItems: ventes.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
