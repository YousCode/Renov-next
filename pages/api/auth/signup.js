import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import jwt from 'jsonwebtoken';
import { setCookie } from 'cookies-next';
import { validatePassword } from '../../../utils/validatePassword'; // Assurez-vous d'avoir cette fonction utilitaire

const COOKIE_MAX_AGE = 31557600000;
const JWT_MAX_AGE = "1y";
const config = {
  secret: 'YOUR_SECRET_KEY',
  ENVIRONMENT: process.env.NODE_ENV
};

export default async function handler(req, res) {
  await connectToDatabase();

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { password, email, name, phone, workspace_id, workspace_name } = req.body;

    if (!workspace_id) return res.status(400).send({ ok: false, code: "WORKSPACE_ID_REQUIRED" });

    if (password && !validatePassword(password)) return res.status(400).send({ ok: false, code: "PASSWORD_NOT_VALIDATED" });

    let user = await User.findOne({ email });

    if (user && user.registered_at) return res.status(400).send({ ok: false, code: "USER_ALREADY_REGISTERED" });

    if (user) {
      user.set({ password, phone, registered_at: Date.now(), invitation_token: null, invitation_expires: null });
      await user.save();
    } else {
      user = await User.create({
        name,
        email,
        password,
        phone,
        workspace_id,
        workspace_name,
        registered_at: Date.now(),
        status: "ACCEPTED", // TEMP setting it here
      });
    }

    let token = null;
    if (workspace_id) {
      let cookieOptions = { maxAge: COOKIE_MAX_AGE, httpOnly: true };
      if (config.ENVIRONMENT === "development") {
        cookieOptions = { ...cookieOptions, secure: false, domain: "localhost", sameSite: "Lax" };
      } else {
        cookieOptions = { ...cookieOptions, secure: true, sameSite: "none" };
      }

      token = jwt.sign({ _id: user._id }, config.secret, { expiresIn: JWT_MAX_AGE });
      setCookie('jwt', token, { req, res, ...cookieOptions });
    }

    return res.status(200).send({ user, token, ok: true });
  } catch (error) {
    console.log("e", error);
    if (error.code === 11000) return res.status(409).send({ ok: false, code: "USER_ALREADY_REGISTERED" });
    return res.status(500).send({ ok: false, code: "SERVER_ERROR" });
  }
}
