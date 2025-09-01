import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email?: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-aqui';

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ 
      error: 'Token de acesso não fornecido',
      message: 'É necessário fornecer um token de autenticação válido'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      email: string;
      iat: number;
      exp: number;
    };

    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expirado',
        message: 'O token de autenticação expirou. Faça login novamente.'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Token inválido',
        message: 'O token de autenticação é inválido.'
      });
    } else {
      res.status(401).json({
        error: 'Erro de autenticação',
        message: 'Erro ao verificar o token de autenticação.'
      });
    }
  }
}

export function generateToken(user: { id: string; username: string; email?: string }): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expira em 7 dias
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware opcional para rotas que podem ou não ter autenticação
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        username: string;
        email: string;
        iat: number;
        exp: number;
      };

      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email
      };
    } catch (error) {
      // Token inválido, mas não falha a requisição
      console.warn('Token inválido fornecido para rota opcional:', error);
    }
  }

  next();
}
