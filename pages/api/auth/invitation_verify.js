import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import { capture } from '../../../sentry.js'; // Assurez-vous d'avoir cette fonction utilitaire

export default async function handler(req, res) {
  await connectToDatabase();

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { token } = req.body;
    const user = await User.findOne({ invitation_token: token }).select('+invitation_expires');

    if (!user) return res.status(400).send({ ok: false, code: 'INVITATION_TOKEN_EXPIRED_OR_INVALID' });
    if (user.registered_at) return res.status(400).send({ ok: false, code: 'INVITATION_DONE' });
    if (Date.now() > user.invitation_expires) return res.status(400).send({ ok: false, code: 'INVITATION_TOKEN_EXPIRED_OR_INVALID' });

    const { email, name, workspace_id, workspace_name } = user;
    return res.status(200).send({ ok: true, user: { email, name, workspace_id, workspace_name } });
  } catch (error) {
    capture(error);
    return res.status(500).send({ ok: false, code: 'SERVER_ERROR' });
  }
}
