import { Router, Request, Response } from 'express';
import { UserService } from '../services/userService';
import { User } from '../models/User';
import { generateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const userService = new UserService();

// Registro de usuário
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { username, password, nickname, avatar } = req.body;

  // Validação básica
  if (!username || !password || !nickname) {
    return res.status(400).json({
      error: 'Dados incompletos',
      message: 'Todos os campos obrigatórios devem ser preenchidos'
    });
  }

  try {
    const user = await userService.createUser({
      username,
      password,
      nickname,
      avatar
    });

    // Criar instância da classe User para usar toPublic()
    const userInstance = new User(user);

    // Gerar token JWT
    const token = generateToken({
      id: user.id,
      username: user.username
    });

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: userInstance.toPublic(),
      token
    });
  } catch (error: any) {
    if (error.message.includes('já existe')) {
      return res.status(409).json({
        error: 'Conflito',
        message: error.message
      });
    }

    if (error.message.includes('Dados inválidos')) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: error.message
      });
    }

    throw error;
  }
}));

// Login de usuário
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Dados incompletos',
      message: 'Username e senha são obrigatórios'
    });
  }

  try {
    const user = await userService.authenticateUser(username, password);

    if (!user) {
      return res.status(401).json({
        error: 'Credenciais inválidas',
        message: 'Username ou senha incorretos'
      });
    }

    // Gerar token JWT
    const token = generateToken({
      id: user.id,
      username: user.username
    });

    res.json({
      message: 'Login realizado com sucesso',
      user: user.toPublic(),
      token
    });
  } catch (error) {
    throw error;
  }
}));

// Verificar token
router.get('/verify', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Token não fornecido',
      message: 'Token de autenticação é obrigatório'
    });
  }

  try {
    // Verificar se o token é válido
    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Token de autenticação é inválido'
      });
    }

    // Buscar usuário atualizado
    const user = await userService.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'Usuário não encontrado',
        message: 'Usuário associado ao token não existe mais'
      });
    }

    res.json({
      message: 'Token válido',
      user: user.toPublic(),
      token
    });
  } catch (error) {
    throw error;
  }
}));

// Refresh token (renovar token)
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Token não fornecido',
      message: 'Token de autenticação é obrigatório'
    });
  }

  try {
    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Token de autenticação é inválido'
      });
    }

    // Buscar usuário
    const user = await userService.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'Usuário não encontrado',
        message: 'Usuário associado ao token não existe mais'
      });
    }

    // Gerar novo token
    const newToken = generateToken({
      id: user.id,
      username: user.username
    });

    res.json({
      message: 'Token renovado com sucesso',
      user: user.toPublic(),
      token: newToken
    });
  } catch (error) {
    throw error;
  }
}));

// Logout (opcional - pode ser feito no cliente)
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    // Em um sistema mais robusto, você poderia invalidar o token
    // Por exemplo, adicionando-o a uma blacklist
    console.log('Usuário fez logout, token:', token.substring(0, 20) + '...');
  }

  res.json({
    message: 'Logout realizado com sucesso'
  });
}));

// Alterar senha
router.post('/change-password', asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Token não fornecido',
      message: 'Token de autenticação é obrigatório'
    });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: 'Dados incompletos',
      message: 'Senha atual e nova senha são obrigatórias'
    });
  }

  try {
    const { verifyToken } = require('../middleware/auth');
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Token de autenticação é inválido'
      });
    }

    await userService.changePassword(decoded.id, currentPassword, newPassword);

    res.json({
      message: 'Senha alterada com sucesso'
    });
  } catch (error: any) {
    if (error.message.includes('Senha atual incorreta')) {
      return res.status(400).json({
        error: 'Senha incorreta',
        message: error.message
      });
    }

    if (error.message.includes('deve ter pelo menos')) {
      return res.status(400).json({
        error: 'Senha inválida',
        message: error.message
      });
    }

    throw error;
  }
}));



export default router;
