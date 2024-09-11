// pages/api/protectedRoute.js
import middleware from './middleware';

export default function handler(req, res) {
  middleware(req, res);

  if (res.writableEnded) {
    // Si le middleware a terminé la réponse, ne pas continuer
    return;
  }

  // Logique de votre route protégée ici
  res.status(200).json({ message: 'You have access to this protected route' });
}
