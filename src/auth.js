const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "mahalaundry_pos_super_secret_jwt_key_2026_production_secure_token";

function signToken(user) {
  if (!SECRET || SECRET.length < 32) throw new Error("JWT_SECRET belum diatur atau terlalu pendek.");
  return jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, SECRET, { expiresIn: "8h" });
}

function requireAuth(req, res, next) {
  if (!SECRET || SECRET.length < 32) {
    return res.status(500).json({ message: "Konfigurasi JWT_SECRET belum valid. Periksa file .env." });
  }
  const token = req.cookies?.laundry_token;
  if (!token) return res.status(401).json({ message: "Silakan login terlebih dahulu." });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.clearCookie("laundry_token");
    return res.status(401).json({ message: "Sesi berakhir. Silakan login kembali." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Akses khusus admin." });
  next();
}

module.exports = { signToken, requireAuth, requireAdmin };
