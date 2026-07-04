export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const userId = token.replace('mock-jwt-token-', '');
  req.userId = parseInt(userId, 10);
  if (isNaN(req.userId)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  next();
};
