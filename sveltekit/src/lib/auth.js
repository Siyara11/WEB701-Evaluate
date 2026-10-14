import jwt from 'jsonwebtoken';

export const SECRET = 'supersecretkey12345';
export const users = [];

export function createToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '1h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}