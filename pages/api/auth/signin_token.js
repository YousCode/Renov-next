import connectToDatabase from '../../../lib/mongodb';
import passport from '../../../lib/passport';
import { capture } from '../../../sentry.js'; // Assurez-vous d'avoir cette fonction utilitaire

export default async function handler(req, res) {
  await connectToDatabase();

  passport.authenticate('user', { session: false }, async (err, user, info) => {
    if (err) return res.status(500).send({ ok: false, error: 'Authentication error' });
    if (!user) return res.status(401).send({ ok: false, message: 'Unauthorized' });

    try {
      user.set({ last_login_at: Date.now() });
      const updatedUser = await user.save();
      return res.status(200).send({ user: updatedUser, token: req.cookies.jwt, ok: true });
    } catch (error) {
      capture(error);
      return res.status(500).send({ ok: false, code: 'SERVER_ERROR' });
    }
  })(req, res);
}
