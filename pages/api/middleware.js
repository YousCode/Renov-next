// pages/api/middleware.js
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import config from '../../config';

export default function handler(req, res) {
  const token = req.cookies.jwt;

  if (token && typeof token === 'string') {
    try {
      const decoded = jwt.verify(token, config.secret);
      req.user = decoded;
    } catch (err) {
      console.error('Token verification failed:', err);
      // Token invalide ou expiré : on supprime le cookie et on renvoie 401
      res.setHeader('Set-Cookie', serialize('jwt', '', { maxAge: -1, path: '/' }));
      return res.status(401).json({ message: 'Token verification failed' });
    }
  } else {
    // Si aucun token n'est présent, redirigez vers la page de connexion
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Continuez la logique de votre application
  res.status(200).json({ message: 'Token verified' });
}
