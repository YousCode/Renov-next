import connectToDatabase from "../../../lib/mongodb";
import Vente from "../../../models/ventes";

export default async function handler(req, res) {
  await connectToDatabase();

  switch (req.method) {
    case "GET":    return getVenteById(req, res);
    case "PUT":    return updateVente(req, res);
    case "DELETE": return deleteVente(req, res);
    default:
      res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function getVenteById(req, res) {
  try {
    const vente = await Vente.findById(req.query.id).lean().exec();
    if (!vente) return res.status(404).json({ success: false, message: "Vente non trouvée" });
    res.setHeader("Cache-Control", "private, max-age=30");
    return res.status(200).json({ success: true, data: vente });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateVente(req, res) {
  try {
    const vente = await Vente.findByIdAndUpdate(
      req.query.id,
      { $set: req.body, updatedAt: new Date() },
      { new: true, runValidators: true, lean: true }
    ).exec();
    if (!vente) return res.status(404).json({ success: false, message: "Vente non trouvée" });
    return res.status(200).json({ success: true, data: vente });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function deleteVente(req, res) {
  try {
    const vente = await Vente.findByIdAndDelete(req.query.id).lean().exec();
    if (!vente) return res.status(404).json({ success: false, message: "Vente non trouvée" });
    return res.status(200).json({ success: true, message: "Vente supprimée" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
