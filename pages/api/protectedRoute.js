// pages/api/protectedRoute.js
import jwt from 'jsonwebtoken';
import config from '../../config';

export default function handler(req, res) {
  const token = req.cookies.jwt;

  if (!token || typeof token !== 'string') {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, config.secret);
  } catch (err) {
    return res.status(401).json({ message: 'Token verification failed' });
  }

  return res.status(200).json({ message: 'You have access to this protected route' });
}
