import connectToDatabase from '../../../lib/mongodb';
import Vente from '../../../models/ventes';
import passport from 'passport';

export default async function handler(req, res) {
  await connectToDatabase();

  if (req.method === 'GET') {
    await getVenteById(req, res);
  } else if (req.method === 'PUT') {
    await updateVente(req, res);
  } else if (req.method === 'DELETE') {
    await deleteVente(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const getVenteById = async (req, res) => {
  try {
    const vente = await Vente.findById(req.query.id);
    if (!vente) {
      return res.status(404).json({ success: false, message: 'Vente non trouvée' });
    }
    res.status(200).json({ success: true, data: vente });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateVente = async (req, res) => {
  try {
    const vente = await Vente.findByIdAndUpdate(req.query.id, req.body, { new: true });
    if (!vente) {
      return res.status(404).json({ success: false, message: 'Vente non trouvée' });
    }
    res.status(200).json({ success: true, message: 'Vente mise à jour avec succès', data: vente });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteVente = async (req, res) => {
  try {
    const vente = await Vente.findByIdAndDelete(req.query.id);
    if (!vente) {
      return res.status(404).json({ success: false, message: 'Vente non trouvée' });
    }
    res.status(200).json({ success: true, message: 'Vente supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
