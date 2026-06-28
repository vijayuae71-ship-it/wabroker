import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface JWTPayload {
  agentId: string;
  agencyId: string;
  role: string;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
    (req as Request & { agentId: string; agencyId: string; role: string }).agentId = decoded.agentId;
    (req as Request & { agentId: string; agencyId: string; role: string }).agencyId = decoded.agencyId;
    (req as Request & { agentId: string; agencyId: string; role: string }).role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
