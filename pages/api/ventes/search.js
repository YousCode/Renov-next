import connectToDatabase from '../../../lib/mongodb';
import Vente from '../../../models/ventes';

export default async function handler(req, res) {
  await connectToDatabase();

  if (req.method === 'GET') {
    await searchVentes(req, res);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const normalizePhoneNumber = (phoneNumber) => phoneNumber.replace(/\s+/g, "");

const searchVentes = async (req, res) => {
  const { searchTerm } = req.query;
  const normalizedSearchTerm = normalizePhoneNumber(searchTerm);

  try {
    const ventes = await Vente.find({
      $or: [
        { "NOM DU CLIENT": { $regex: searchTerm, $options: "i" } },
        { "TELEPHONE": { $regex: normalizedSearchTerm, $options: "i" } },
        { "NUMERO BC": searchTerm },
        { "ADRESSE DU CLIENT": { $regex: searchTerm, $options: "i" } },  // Recherche par adresse
        { "DESIGNATION": { $regex: searchTerm, $options: "i" } }         // Recherche par désignation
      ]
    });

    if (ventes.length === 0) {
      return res.status(404).json({ success: false, message: "Aucune vente correspondante trouvée" });
    }
    res.status(200).json({ success: true, data: ventes });
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur lors de la recherche des ventes", error: error.message });
  }
};
