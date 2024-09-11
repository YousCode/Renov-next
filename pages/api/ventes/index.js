// pages/api/ventes.js
import connectToDatabase from '../../../lib/mongodb';
import Vente from '../../../models/ventes';
import { body, validationResult } from 'express-validator';

export default async function handler(req, res) {
  await connectToDatabase();

  if (req.method === 'POST') {
    await addVente(req, res);
  } else if (req.method === 'GET') {
    await getAllVentes(req, res);
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const addVente = async (req, res) => {
  await body('NOM DU CLIENT').not().isEmpty().trim().escape().run(req);
  await body('NUMERO BC').isNumeric().isLength({ min: 1, max: 6 }).run(req);
  await body('DATE DE VENTE').isISO8601().toDate().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const nouvelleVente = new Vente(req.body);
    await nouvelleVente.save();
    res.status(201).json({ success: true, message: 'Vente créée avec succès', data: nouvelleVente });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllVentes = async (req, res) => {
  try {
    const { date } = req.query;
    let query = {};

    if (date) {
      const startDate = new Date(date);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 1);

      query = {
        "DATE DE VENTE": {
          $gte: startDate,
          $lt: endDate
        }
      };
    }

    const ventes = await Vente.find(query).exec();
    const count = await Vente.countDocuments(query);
    res.status(200).json({ success: true, data: ventes, totalItems: count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des ventes', error: error.message });
  }
};
