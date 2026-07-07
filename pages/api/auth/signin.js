import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import jwt from 'jsonwebtoken';
import { setCookie } from 'cookies-next';
import config from '../../../config';

// maxAge du cookie en SECONDES (1 an), aligné sur l'expiration du JWT
const COOKIE_MAX_AGE = 31557600;
const JWT_MAX_AGE = "1y";

export default async function handler(req, res) {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error("DB connection failed:", err);
    return res.status(503).send({ ok: false, code: "DB_UNAVAILABLE" });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { password, email } = req.body;
  if (!email || !password) return res.status(400).send({ ok: false, code: "EMAIL_AND_PASSWORD_REQUIRED" });

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send({ ok: false, code: "USER_NOT_EXISTS" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).send({ ok: false, code: "EMAIL_OR_PASSWORD_INVALID" });
    }

    user.set({ last_login_at: Date.now() });
    await user.save();

    let cookieOptions = { maxAge: COOKIE_MAX_AGE, httpOnly: true };
    if (config.ENVIRONMENT === "development") {
      cookieOptions = { ...cookieOptions, secure: false, domain: "localhost", sameSite: "Lax" };
    } else {
      cookieOptions = { ...cookieOptions, secure: true, sameSite: "lax" };
    }

    const token = jwt.sign({ _id: user.id, role: user.role }, config.secret, { expiresIn: JWT_MAX_AGE }); // Inclure le rôle dans le token
    setCookie('jwt', token, { req, res, ...cookieOptions });

    return res.status(200).send({ ok: true, user: { email: user.email, name: user.name, language: user.language, role: user.role }, redirect: '/dashboard' }); // Inclure le rôle dans la réponse
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    return res.status(500).send({ ok: false, code: "SERVER_ERROR" });
  }
}
