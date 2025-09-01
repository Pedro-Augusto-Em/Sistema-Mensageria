"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roomService_1 = require("../services/roomService");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const roomService = new roomService_1.RoomService();
// Criar nova sala
router.post('/', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { name, type, members, isPrivate = false } = req.body;
    const currentUserId = req.user.id;
    if (!name || !type || !members || !Array.isArray(members)) {
        return res.status(400).json({
            error: 'Dados inválidos',
            message: 'Nome, tipo e membros são obrigatórios'
        });
    }
    // Adicionar o usuário atual aos membros se não estiver
    if (!members.includes(currentUserId)) {
        members.push(currentUserId);
    }
    try {
        const room = await roomService.createRoom({
            name,
            type,
            members,
            createdBy: currentUserId,
            admins: [currentUserId],
            isPrivate
        });
        res.status(201).json(room);
    }
    catch (error) {
        if (error.message.includes('já existe')) {
            return res.status(409).json({
                error: 'Conflito',
                message: error.message
            });
        }
        throw error;
    }
}));
// Listar salas do usuário
router.get('/', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const currentUserId = req.user.id;
    const rooms = await roomService.getRoomsByUser(currentUserId);
    // Para conversas diretas, buscar dados completos dos membros
    const roomsWithMembers = await Promise.all(rooms.map(async (room) => {
        if (room.type === 'direct') {
            // Para conversas diretas, buscar dados completos dos membros
            const roomWithMembers = await roomService.getRoomWithMembers(room.id);
            return roomWithMembers || room;
        }
        return room;
    }));
    // Buscar última mensagem e contador de mensagens não lidas para cada sala
    const roomsWithLastMessage = await Promise.all(roomsWithMembers.map(async (room) => {
        try {
            // Buscar última mensagem
            const messageService = new (await Promise.resolve().then(() => __importStar(require('../services/messageService')))).MessageService();
            const lastMessage = await messageService.getLastMessage(room.id);
            // Buscar contador de mensagens não lidas
            const unreadCount = await messageService.getUnreadMessageCount(room.id, new Date(0));
            return {
                ...room,
                lastMessage,
                unreadCount
            };
        }
        catch (error) {
            console.error(`Erro ao buscar dados da sala ${room.id}:`, error);
            return {
                ...room,
                lastMessage: null,
                unreadCount: 0
            };
        }
    }));
    // Formatar resposta para o frontend
    res.json({
        success: true,
        message: 'Salas carregadas com sucesso',
        data: roomsWithLastMessage
    });
}));
// Obter sala específica
router.get('/:id', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const room = await roomService.getRoomById(id);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'A sala especificada não existe'
        });
    }
    // Verificar se o usuário é membro da sala
    if (!room.members.includes(currentUserId)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não tem acesso a esta sala'
        });
    }
    res.json(room);
}));
// Atualizar sala
router.put('/:id', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const updateData = req.body;
    const room = await roomService.getRoomById(id);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'A sala especificada não existe'
        });
    }
    // Verificar se o usuário é admin da sala
    if (!room.admins.includes(currentUserId)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem modificar a sala'
        });
    }
    const updatedRoom = await roomService.updateRoom(id, updateData, currentUserId);
    res.json(updatedRoom);
}));
// Adicionar membro à sala
router.post('/:id/members', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    const currentUserId = req.user.id;
    const room = await roomService.getRoomById(id);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'A sala especificada não existe'
        });
    }
    // Verificar se o usuário é admin da sala
    if (!room.admins.includes(currentUserId)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem adicionar membros'
        });
    }
    const success = await roomService.addMember(id, userId, currentUserId);
    if (success) {
        // Buscar informações do usuário adicionado
        const userService = new (await Promise.resolve().then(() => __importStar(require('../services/userService')))).UserService();
        const addedUser = await userService.getUserById(userId);
        // Buscar informações do usuário que adicionou
        const adminUser = await userService.getUserById(currentUserId);
        // Buscar sala atualizada
        const updatedRoom = await roomService.getRoomById(id);
        // Emitir evento Socket.IO para notificar o usuário adicionado
        const io = req.app.get('io');
        if (io) {
            // Buscar socket do usuário adicionado
            const userSockets = req.app.get('userSockets') || new Map();
            const userSocketId = userSockets.get(userId);
            if (userSocketId) {
                io.to(userSocketId).emit('added_to_group', {
                    groupId: id,
                    groupName: room.name,
                    addedBy: adminUser?.nickname || adminUser?.username || 'Administrador',
                    room: updatedRoom
                });
            }
            // Emitir evento para atualizar a lista de conversas de todos os membros
            if (updatedRoom && updatedRoom.members) {
                updatedRoom.members.forEach(memberId => {
                    const memberSocketId = userSockets.get(memberId);
                    if (memberSocketId) {
                        io.to(memberSocketId).emit('conversation_updated', {
                            type: 'member_added',
                            roomId: id,
                            room: updatedRoom
                        });
                    }
                });
            }
        }
    }
    res.json({ message: 'Membro adicionado com sucesso' });
}));
// Remover membro da sala
router.delete('/:id/members/:userId', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id, userId } = req.params;
    const currentUserId = req.user.id;
    const room = await roomService.getRoomById(id);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'A sala especificada não existe'
        });
    }
    // Verificar se o usuário é admin da sala ou se está removendo a si mesmo
    if (!room.admins.includes(currentUserId) && currentUserId !== userId) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem remover outros membros'
        });
    }
    await roomService.removeMember(id, userId, currentUserId);
    res.json({ message: 'Membro removido com sucesso' });
}));
// Deletar sala
router.delete('/:id', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user.id;
    const room = await roomService.getRoomById(id);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'A sala especificada não existe'
        });
    }
    // Verificar permissões baseado no tipo de sala
    if (room.type === 'direct') {
        // Para conversas diretas, qualquer membro pode deletar
        if (!room.members.includes(currentUserId)) {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você não é membro desta conversa'
            });
        }
    }
    else {
        // Para grupos, apenas o criador pode deletar
        if (room.createdBy !== currentUserId) {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Apenas o criador pode deletar o grupo'
            });
        }
    }
    await roomService.deleteRoom(id, currentUserId);
    res.json({ message: 'Sala deletada com sucesso' });
}));
exports.default = router;
//# sourceMappingURL=rooms.js.map