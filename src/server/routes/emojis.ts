import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { EmojiService } from '../services/emojiService';

const router = Router();
const emojiService = new EmojiService();

// Configuração do multer para upload de emojis
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads/emojis'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos'));
    }
  }
});

// Listar todos os emojis customizados
router.get('/', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const emojis = await emojiService.getAllEmojis();
  
  res.json({
    success: true,
    message: 'Emojis carregados com sucesso',
    data: emojis
  });
}));

// Buscar emojis por nome
router.get('/search', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      error: 'Parâmetro de busca inválido',
      message: 'O parâmetro "q" é obrigatório'
    });
  }
  
  const emojis = await emojiService.searchEmojis(q);
  
  res.json({
    success: true,
    message: 'Busca realizada com sucesso',
    data: emojis
  });
}));

// Obter emoji específico
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const emoji = await emojiService.getEmojiById(id);
  
  if (!emoji) {
    return res.status(404).json({
      error: 'Emoji não encontrado',
      message: 'Emoji não foi encontrado'
    });
  }
  
  res.json({
    success: true,
    message: 'Emoji obtido com sucesso',
    data: emoji
  });
}));

// Upload de novo emoji
router.post('/upload', authenticateToken, upload.single('emoji'), asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação é obrigatório'
    });
  }

  const { name } = req.body;
  const file = req.file;

  if (!name || !file) {
    return res.status(400).json({
      error: 'Dados incompletos',
      message: 'Nome do emoji e arquivo são obrigatórios'
    });
  }

  // Criar URL do emoji
  const emojiUrl = `/uploads/emojis/${file.filename}`;

  try {
    const emoji = await emojiService.createEmoji(name, emojiUrl, req.user.id);
    
    res.status(201).json({
      success: true,
      message: 'Emoji criado com sucesso',
      data: emoji
    });
  } catch (error: any) {
    // Se houver erro, remover o arquivo enviado
    if (file) {
      const fs = require('fs');
      const filePath = path.join(__dirname, '../../public/uploads/emojis', file.filename);
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        console.error('Erro ao remover arquivo:', unlinkError);
      }
    }
    
    throw error;
  }
}));

// Atualizar emoji
router.put('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação é obrigatório'
    });
  }

  const { id } = req.params;
  const { name, url } = req.body;

  try {
    const emoji = await emojiService.updateEmoji(id, name, url);
    
    if (!emoji) {
      return res.status(404).json({
        error: 'Emoji não encontrado',
        message: 'Emoji não foi encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Emoji atualizado com sucesso',
      data: emoji
    });
  } catch (error: any) {
    if (error.message.includes('Já existe um emoji com este nome')) {
      return res.status(400).json({
        error: 'Nome duplicado',
        message: error.message
      });
    }
    throw error;
  }
}));

// Excluir emoji
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Não autorizado',
      message: 'Token de autenticação é obrigatório'
    });
  }

  const { id } = req.params;
  
  // Verificar se o emoji existe antes de tentar excluir
  const emoji = await emojiService.getEmojiById(id);
  if (!emoji) {
    return res.status(404).json({
      error: 'Emoji não encontrado',
      message: 'Emoji não foi encontrado'
    });
  }

  const deleted = await emojiService.deleteEmoji(id);
  
  if (deleted) {
    // Remover arquivo físico
    const fs = require('fs');
    const filePath = path.join(__dirname, '../../public', emoji.url);
    try {
      fs.unlinkSync(filePath);
    } catch (unlinkError) {
      console.error('Erro ao remover arquivo:', unlinkError);
    }
    
    res.json({
      success: true,
      message: 'Emoji excluído com sucesso'
    });
  } else {
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível excluir o emoji'
    });
  }
}));

// Parsear texto com emojis customizados
router.post('/parse', authenticateToken, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  
  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Texto inválido',
      message: 'O campo "text" é obrigatório'
    });
  }
  
  const parsedText = await emojiService.parseEmojis(text);
  
  res.json({
    success: true,
    message: 'Texto parseado com sucesso',
    data: {
      original: text,
      parsed: parsedText
    }
  });
}));

export default router;
