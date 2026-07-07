import connectToDatabase from "../../../lib/mongodb";
import Vente from "../../../models/ventes";

export default async function handler(req, res) {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error("DB connection failed:", err);
    return res.status(503).json({ success: false, message: "Database unavailable" });
  }

  switch (req.method) {
    case "GET":  return getAllVentes(req, res);
    case "POST": return addVente(req, res);
    default:
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function getAllVentes(req, res) {
  try {
    const { date, month, year } = req.query;
    let query = {};

    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 1);
      query = { "DATE DE VENTE": { $gte: start, $lt: end } };
    } else if (month !== undefined && year !== undefined) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (isNaN(m) || isNaN(y)) {
        return res.status(400).json({ success: false, message: "month et year doivent être des entiers" });
      }
      query = {
        "DATE DE VENTE": {
          $gte: new Date(Date.UTC(y, m, 1)),
          $lt:  new Date(Date.UTC(y, m + 1, 1)),
        },
      };
    }

    // pagination optionnelle : ?limit=100&page=1 (sans limit, comportement inchangé)
    const limit = Math.min(parseInt(req.query.limit, 10) || 0, 1000);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    let find = Vente.find(query).sort({ "DATE DE VENTE": -1 });
    if (limit > 0) find = find.skip((page - 1) * limit).limit(limit);

    const ventes = await find.lean().exec();
    const totalItems = limit > 0 ? await Vente.countDocuments(query) : ventes.length;

    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return res.status(200).json({ success: true, data: ventes, totalItems });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function addVente(req, res) {
  const { "NOM DU CLIENT": nom, "NUMERO BC": bc, "DATE DE VENTE": dateVente } = req.body;

  if (!nom?.trim()) {
    return res.status(400).json({ success: false, message: "NOM DU CLIENT est requis" });
  }
  if (!bc || !/^\d{1,6}$/.test(String(bc).trim())) {
    return res.status(400).json({ success: false, message: "NUMERO BC doit être numérique (1–6 chiffres)" });
  }
  if (!dateVente || isNaN(Date.parse(dateVente))) {
    return res.status(400).json({ success: false, message: "DATE DE VENTE doit être une date valide" });
  }

  try {
    const vente = new Vente(req.body);
    await vente.save();
    return res.status(201).json({ success: true, data: vente });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
