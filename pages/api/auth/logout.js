// pages/api/auth/logout.js

import { serialize } from 'cookie';

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', serialize('jwt', '', {
    maxAge: -1,
    path: '/',
  }));
  res.status(200).json({ ok: true, message: "Logout successful" });
}
