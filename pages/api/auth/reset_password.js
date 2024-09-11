import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import passport from '../../../lib/passport';
import { capture } from '../../../sentry.js'; // Assurez-vous d'avoir cette fonction utilitaire
import { validatePassword } from '../../../utils/validatePassword'; // Assurez-vous d'avoir cette fonction utilitaire

export default async function handler(req, res) {
  await connectToDatabase();

  passport.authenticate('user', { session: false }, async (err, user, info) => {
    if (err) return res.status(500).send({ ok: false, error: 'Authentication error' });
    if (!user) return res.status(401).send({ ok: false, message: 'Unauthorized' });

    try {
      const match = await user.comparePassword(req.body.password);
      if (!match) return res.status(401).send({ ok: false, code: 'PASSWORD_INVALID' });
      if (req.body.newPassword !== req.body.verifyPassword) return res.status(422).send({ ok: false, code: 'PASSWORDS_NOT_MATCH' });
      if (!validatePassword(req.body.newPassword)) return res.status(400).send({ ok: false, code: 'PASSWORD_NOT_VALIDATED' });

      user.password = req.body.newPassword;
      await user.save();
      return res.status(200).send({ ok: true, user });
    } catch (error) {
      capture(error);
      return res.status(500).send({ ok: false, code: 'SERVER_ERROR' });
    }
  })(req, res);
}
