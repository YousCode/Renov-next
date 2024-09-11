// pages/api/middleware.js
import jwt from 'jsonwebtoken';

const secret = 'YOUR_SECRET_KEY'; // Utilisez une clé secrète sécurisée

export default function handler(req, res) {
  const token = req.cookies.jwt;

  if (token && typeof token === 'string') {
    try {
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
    } catch (err) {
      console.error('Token verification failed:', err);
      // Si le token n'est pas valide, supprimez le cookie
      res.clearCookie('jwt');
      return res.status(401).json({ message: 'Token verification failed' });
    }
  } else {
    // Si aucun token n'est présent, redirigez vers la page de connexion
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Continuez la logique de votre application
  res.status(200).json({ message: 'Token verified' });
}
