import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import { capture } from '../../../sentry.js'; // Assurez-vous d'avoir cette fonction utilitaire

export default async function handler(req, res) {
  await connectToDatabase();

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const user = await User.findOne({ _id: id });
      return res.status(200).send({ ok: true, data: user });
    } catch (error) {
      capture(error);
      return res.status(500).send({ ok: false, code: 'SERVER_ERROR', error });
    }
  } else if (req.method === 'PUT') {
    try {
      const updates = req.body;
      if (updates.password) {
        const user = await User.findOne({ _id: id });
        user.password = updates.password;
        await user.save();
        delete updates.password; // Remove the password from updates after hashing
      }
      const user = await User.findByIdAndUpdate(id, updates, { new: true });
      return res.status(200).send({ ok: true, data: user });
    } catch (error) {
      capture(error);
      return res.status(500).send({ ok: false, code: 'SERVER_ERROR', error });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
