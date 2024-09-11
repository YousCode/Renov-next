import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import { capture } from '../../../sentry.js'; 
import { validatePassword } from '../../../utils/validatePassword'; 

export default async function handler(req, res) {
  await connectToDatabase();

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const user = await User.findOne({
      forgot_password_reset_token: req.body.token,
      forgot_password_reset_expires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).send({ ok: false, code: 'PASSWORD_TOKEN_EXPIRED_OR_INVALID' });
    if (!validatePassword(req.body.password)) return res.status(400).send({ ok: false, code: 'PASSWORD_NOT_VALIDATED' });

    user.password = req.body.password;
    user.forgot_password_reset_token = "";
    user.forgot_password_reset_expires = "";
    await user.save();
    return res.status(200).send({ ok: true });
  } catch (error) {
    capture(error);
    return res.status(500).send({ ok: false, code: 'SERVER_ERROR' });
  }
}
