import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET is missing. Set it in .env");
}

export const JWT_SECRET = SECRET;

export const signToken = (payload, options = { expiresIn: "7d" }) =>
  jwt.sign(payload, JWT_SECRET, options);

export const verifyToken = (token) => {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
};

const isProd = process.env.NODE_ENV === "production";

export const buildAuthCookie = (token) => {
  const parts = [
    `jwt=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 7}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
};

export const buildClearAuthCookie = () => {
  const parts = ["jwt=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
};

export const getUserFromReq = (req) => {
  const token = req?.cookies?.jwt;
  if (!token || typeof token !== "string") return null;
  return verifyToken(token);
};

export const requireAuth = (handler, { roles } = {}) =>
  async (req, res) => {
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (roles && !roles.includes(user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    req.user = user;
    return handler(req, res);
  };

// Sanitize a value before using it in a Mongo query — kills `$gt`/`$ne` injection.
export const asString = (v) => (typeof v === "string" ? v : "");
