<<<<<<< HEAD
// middleware/auth.js
// ---------------------------------------------------------------------------
// [R1][R2] JWT authentication middleware.
// The client sends the token it received at login in the HTTP header
//     Authorization: Bearer <token>
// Because the token is signed with JWT_SECRET, the server can trust the
// user id and role inside it without storing a session - this is how JWT
// "transfers state" between the browser and a stateless REST API.
// ---------------------------------------------------------------------------
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // 1. Read the header and remove the "Bearer " prefix
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  // 2. No token -> 401 Unauthorized (the user must log in first)
  if (!token) return res.status(401).json({ error: 'Access denied: no token provided' });

  try {
    // 3. jwt.verify checks the signature and the expiry time ("exp" claim).
    //    If valid, the decoded payload { id, role } is attached to req.user
    //    so later route handlers know who is making the request.
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    // Tampered or expired token -> 401
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Role-based access control: e.g. requireRole('member') only lets members through.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Only ${roles.join(' or ')} accounts can do this` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
=======
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(400).json({ error: 'Invalid token' });
  }
};
>>>>>>> 950f40d446fc85be0e9130335ca71f3868483d19
