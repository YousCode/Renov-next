import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';
import jwt from 'jsonwebtoken';

const config = {
  secret: 'YOUR_SECRET_KEY',
};

export default async function handler(req, res) {
  await connectToDatabase();

  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ ok: false, code: "NOT_AUTHENTICATED" });
  }

  try {
    const decoded = jwt.verify(token, config.secret);
    const user = await User.findById(decoded._id).select('-password');
    if (!user) {
      return res.status(401).json({ ok: false, code: "USER_NOT_FOUND" });
    }

    return res.status(200).json({ ok: true, user });
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).json({ ok: false, code: "INVALID_TOKEN" });
  }
}
