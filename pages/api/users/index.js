import connectToDatabase from '../../../lib/mongodb';
import User from '../../../models/user';

export default async function handler(req, res) {
  try {
    await connectToDatabase();
  } catch (err) {
    console.error("DB connection failed:", err);
    return res.status(503).json({ success: false, code: "DB_UNAVAILABLE" });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const users = await User.find({}).select('-password -invitation_token').lean();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}
