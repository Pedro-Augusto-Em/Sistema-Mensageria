"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const emojiService_1 = require("../services/emojiService");
const router = (0, express_1.Router)();
const emojiService = new emojiService_1.EmojiService();
// Configuração do multer para upload de emojis
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path_1.default.join(__dirname, '../../public/uploads/emojis'));
    },
    filename: (req, file, cb) => {
        const uniqueName = `${(0, uuid_1.v4)()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
    },
    fileFilter: (req, file, cb) => {
        // Aceitar apenas imagens
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Apenas arquivos de imagem são permitidos'));
        }
    }
});
// Listar todos os emojis customizados
router.get('/', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const emojis = await emojiService.getAllEmojis();
    res.json({
        success: true,
        message: 'Emojis carregados com sucesso',
        data: emojis
    });
}));
// Buscar emojis por nome
router.get('/search', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
router.get('/:id', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
router.post('/upload', auth_1.authenticateToken, upload.single('emoji'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
    }
    catch (error) {
        // Se houver erro, remover o arquivo enviado
        if (file) {
            const fs = require('fs');
            const filePath = path_1.default.join(__dirname, '../../public/uploads/emojis', file.filename);
            try {
                fs.unlinkSync(filePath);
            }
            catch (unlinkError) {
                console.error('Erro ao remover arquivo:', unlinkError);
            }
        }
        throw error;
    }
}));
// Atualizar emoji
router.put('/:id', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
    }
    catch (error) {
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
router.delete('/:id', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
        const filePath = path_1.default.join(__dirname, '../../public', emoji.url);
        try {
            fs.unlinkSync(filePath);
        }
        catch (unlinkError) {
            console.error('Erro ao remover arquivo:', unlinkError);
        }
        res.json({
            success: true,
            message: 'Emoji excluído com sucesso'
        });
    }
    else {
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível excluir o emoji'
        });
    }
}));
// Parsear texto com emojis customizados
router.post('/parse', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
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
exports.default = router;
//# sourceMappingURL=emojis.js.map