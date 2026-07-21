import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import jwt from 'jsonwebtoken';
import config from '../../../config';

export default async function handler(req, res) {
  // Vérifier le token AVANT d'ouvrir une connexion DB : les requêtes anonymes
  // (chaque chargement de page non connecté) ne doivent pas coûter un aller-retour Mongo
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ ok: false, code: "NOT_AUTHENTICATED" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.secret);
  } catch (error) {
    return res.status(401).json({ ok: false, code: "INVALID_TOKEN" });
  }

  try {
    await connectToDatabase();
  } catch (err) {
    console.error("DB connection failed:", err);
    return res.status(503).json({ ok: false, code: "DB_UNAVAILABLE" });
  }

  try {
    const user = await User.findById(decoded._id).select('-password');
    if (!user) {
      return res.status(401).json({ ok: false, code: "USER_NOT_FOUND" });
    }

    return res.status(200).json({ ok: true, user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ ok: false, code: "SERVER_ERROR" });
  }
}
