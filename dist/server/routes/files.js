"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// Configurar multer para upload de arquivos
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(process.cwd(), 'uploads');
        // Criar diretório se não existir
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${(0, uuid_1.v4)()}-${Date.now()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
    fileFilter: (req, file, cb) => {
        // Aceitar imagens, documentos, PDFs, áudios e vídeos
        const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
        const allowedDocumentTypes = /pdf|doc|docx|txt|rtf|xls|xlsx|ppt|pptx/;
        const allowedAudioTypes = /mp3|wav|ogg|m4a/;
        const allowedVideoTypes = /mp4|avi|mov|mkv/;
        const extname = path_1.default.extname(file.originalname).toLowerCase();
        const isImage = allowedImageTypes.test(extname);
        const isDocument = allowedDocumentTypes.test(extname);
        const isAudio = allowedAudioTypes.test(extname);
        const isVideo = allowedVideoTypes.test(extname);
        if (isImage || isDocument || isAudio || isVideo) {
            return cb(null, true);
        }
        else {
            cb(new Error('Tipo de arquivo não suportado. Aceitos: imagens, documentos, PDFs, áudios e vídeos'));
        }
    }
});
// Upload de arquivo para uma sala
router.post('/upload', auth_1.authenticateToken, upload.single('file'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { roomId } = req.body;
    const currentUserId = req.user.id;
    if (!req.file) {
        return res.status(400).json({
            error: 'Arquivo não fornecido',
            message: 'Nenhum arquivo foi enviado'
        });
    }
    if (!roomId) {
        return res.status(400).json({
            error: 'Sala não especificada',
            message: 'ID da sala é obrigatório'
        });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
        success: true,
        message: 'Arquivo enviado com sucesso',
        data: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            url: fileUrl,
            size: req.file.size,
            roomId
        }
    });
}));
// Upload de foto de perfil
router.post('/profile-picture', auth_1.authenticateToken, upload.single('profilePicture'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const currentUserId = req.user.id;
    if (!req.file) {
        return res.status(400).json({
            error: 'Arquivo não fornecido',
            message: 'Nenhuma imagem foi enviada'
        });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    // Atualizar foto do usuário no banco
    const { UserService } = require('../services/userService');
    const userService = new UserService();
    await userService.updateUser(currentUserId, { avatar: fileUrl });
    res.json({
        success: true,
        message: 'Foto de perfil atualizada com sucesso',
        data: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            url: fileUrl,
            size: req.file.size
        }
    });
}));
// Upload de foto de grupo
router.post('/group-photo', auth_1.authenticateToken, upload.single('groupPhoto'), (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { roomId } = req.body;
    const currentUserId = req.user.id;
    if (!req.file) {
        return res.status(400).json({
            error: 'Arquivo não fornecido',
            message: 'Nenhuma imagem foi enviada'
        });
    }
    if (!roomId) {
        return res.status(400).json({
            error: 'Sala não especificada',
            message: 'ID da sala é obrigatório'
        });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    // Atualizar foto do grupo no banco
    const { RoomService } = require('../services/roomService');
    const roomService = new RoomService();
    // Verificar se o usuário é admin da sala
    const room = await roomService.getRoomById(roomId);
    if (!room || !room.admins.includes(currentUserId)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem alterar a foto do grupo'
        });
    }
    await roomService.updateRoom(roomId, { avatar: fileUrl }, currentUserId);
    res.json({
        success: true,
        message: 'Foto do grupo atualizada com sucesso',
        data: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            url: fileUrl,
            size: req.file.size,
            roomId
        }
    });
}));
// Servir arquivos estáticos
router.get('/uploads/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path_1.default.join(process.cwd(), 'uploads', filename);
    if (fs_1.default.existsSync(filePath)) {
        res.sendFile(filePath);
    }
    else {
        res.status(404).json({
            error: 'Arquivo não encontrado',
            message: 'O arquivo solicitado não existe'
        });
    }
});
exports.default = router;
//# sourceMappingURL=files.js.map