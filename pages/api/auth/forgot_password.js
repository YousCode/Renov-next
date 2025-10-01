import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import crypto from 'crypto';
import { capture } from '../../../sentry.js'; // Assurez-vous d'avoir cette fonction utilitaire
import { buildGenericTemplate } from '../../../emails.js'; // Assurez-vous d'avoir cette fonction utilitaire
import { transacEmailApi } from "../../../sendinblue.js";

export default async function handler(req, res) {
  await connectToDatabase();

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });

    if (!user) return res.status(401).send({ ok: false, code: 'EMAIL_OR_PASSWORD_INVALID' });

    const token = crypto.randomBytes(20).toString('hex');
    user.set({ forgot_password_reset_token: token, forgot_password_reset_expires: Date.now() + 7200000 }); // 2h
    await user.save();

    const template = buildGenericTemplate({
      title: 'Rest password link',
      cta_title: 'Reset',
      cta_link: `${config.APP_URL}/auth/reset?token=${token}`,
    });

    await sendEmail(template, {
      subject: 'Reset projectX password',
      sender: { email: 'contact@selego.co' },
      emailTo: [user.email],
    });

    res.status(200).send({ ok: true });
  } catch (error) {
    capture(error);
    return res.status(500).send({ ok: false, code: 'SERVER_ERROR' });
  }
}
