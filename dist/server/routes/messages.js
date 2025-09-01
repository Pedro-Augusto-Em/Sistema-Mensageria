"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messageService_1 = require("../services/messageService");
const roomService_1 = require("../services/roomService");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const messageService = new messageService_1.MessageService();
const roomService = new roomService_1.RoomService();
// Enviar mensagem
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { content, roomId, type = 'text', replyToId } = req.body;
    if (!content || !roomId) {
        return res.status(400).json({
            error: 'Dados incompletos',
            message: 'Conteúdo e ID da sala são obrigatórios'
        });
    }
    // Verificar se o usuário é membro da sala
    const room = await roomService.getRoomById(roomId);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'Sala não foi encontrada'
        });
    }
    if (!room.isMember(req.user.id)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não é membro desta sala'
        });
    }
    // Verificar se a mensagem de resposta existe (se fornecida)
    if (replyToId) {
        const replyMessage = await messageService.getMessageById(replyToId);
        if (!replyMessage || replyMessage.roomId !== roomId) {
            return res.status(400).json({
                error: 'Mensagem de resposta inválida',
                message: 'Mensagem de resposta não encontrada ou não pertence a esta sala'
            });
        }
    }
    try {
        const message = await messageService.createMessage({
            content,
            roomId,
            senderId: req.user.id,
            type,
            replyToId
        });
        // Buscar mensagem completa com informações do remetente
        const messageWithSender = await messageService.getMessageWithSender(message.id);
        res.status(201).json({
            message: 'Mensagem enviada com sucesso',
            data: messageWithSender
        });
    }
    catch (error) {
        if (error.message.includes('Dados inválidos')) {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: error.message
            });
        }
        throw error;
    }
}));
// Obter mensagens de uma sala
router.get('/room/:roomId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    // Verificar se o usuário é membro da sala
    const room = await roomService.getRoomById(roomId);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'Sala não foi encontrada'
        });
    }
    if (!room.isMember(req.user.id)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não é membro desta sala'
        });
    }
    const limitNum = parseInt(limit) || 50;
    const offsetNum = parseInt(offset) || 0;
    if (limitNum < 1 || limitNum > 100 || offsetNum < 0) {
        return res.status(400).json({
            error: 'Parâmetros inválidos',
            message: 'Limite deve ser entre 1 e 100, offset deve ser >= 0'
        });
    }
    const messages = await messageService.getMessagesByRoom(roomId, limitNum, offsetNum);
    const totalMessages = await messageService.getMessageCount(roomId);
    res.json({
        message: 'Mensagens obtidas com sucesso',
        data: {
            messages,
            pagination: {
                limit: limitNum,
                offset: offsetNum,
                total: totalMessages,
                hasMore: offsetNum + limitNum < totalMessages
            }
        }
    });
}));
// Obter mensagem específica
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { id } = req.params;
    const message = await messageService.getMessageWithSender(id);
    if (!message) {
        return res.status(404).json({
            error: 'Mensagem não encontrada',
            message: 'Mensagem não foi encontrada'
        });
    }
    // Verificar se o usuário é membro da sala
    const room = await roomService.getRoomById(message.roomId);
    if (!room || !room.isMember(req.user.id)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não tem acesso a esta mensagem'
        });
    }
    res.json({
        message: 'Mensagem obtida com sucesso',
        data: message
    });
}));
// Editar mensagem
router.put('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { id } = req.params;
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
        return res.status(400).json({
            error: 'Conteúdo obrigatório',
            message: 'Novo conteúdo é obrigatório'
        });
    }
    try {
        const updatedMessage = await messageService.editMessage(id, content, req.user.id);
        if (!updatedMessage) {
            return res.status(404).json({
                error: 'Mensagem não encontrada',
                message: 'Mensagem não foi encontrada'
            });
        }
        // Buscar mensagem atualizada com informações do remetente
        const messageWithSender = await messageService.getMessageWithSender(id);
        res.json({
            message: 'Mensagem editada com sucesso',
            data: messageWithSender
        });
    }
    catch (error) {
        if (error.message.includes('não pode editar')) {
            return res.status(403).json({
                error: 'Permissão negada',
                message: error.message
            });
        }
        throw error;
    }
}));
// Deletar mensagem
router.delete('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { id } = req.params;
    try {
        const deleted = await messageService.deleteMessage(id, req.user.id);
        if (!deleted) {
            return res.status(404).json({
                error: 'Mensagem não encontrada',
                message: 'Mensagem não foi encontrada'
            });
        }
        res.json({
            message: 'Mensagem deletada com sucesso'
        });
    }
    catch (error) {
        if (error.message.includes('não pode deletar')) {
            return res.status(403).json({
                error: 'Permissão negada',
                message: error.message
            });
        }
        throw error;
    }
}));
// Buscar mensagens em uma sala
router.get('/room/:roomId/search', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { roomId } = req.params;
    const { q: query, limit = 20 } = req.query;
    if (!query || query.toString().trim().length === 0) {
        return res.status(400).json({
            error: 'Query obrigatória',
            message: 'Termo de busca é obrigatório'
        });
    }
    // Verificar se o usuário é membro da sala
    const room = await roomService.getRoomById(roomId);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'Sala não foi encontrada'
        });
    }
    if (!room.isMember(req.user.id)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não é membro desta sala'
        });
    }
    const limitNum = parseInt(limit) || 20;
    if (limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
            error: 'Limite inválido',
            message: 'Limite deve ser entre 1 e 100'
        });
    }
    const messages = await messageService.searchMessages(query.toString(), roomId, limitNum);
    res.json({
        message: 'Busca realizada com sucesso',
        data: {
            messages,
            query: query.toString(),
            total: messages.length,
            limit: limitNum
        }
    });
}));
// Obter última mensagem de uma sala
router.get('/room/:roomId/last', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { roomId } = req.params;
    // Verificar se o usuário é membro da sala
    const room = await roomService.getRoomById(roomId);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'Sala não foi encontrada'
        });
    }
    if (!room.isMember(req.user.id)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não é membro desta sala'
        });
    }
    const lastMessage = await messageService.getLastMessage(roomId);
    res.json({
        message: 'Última mensagem obtida com sucesso',
        data: lastMessage
    });
}));
// Obter mensagens de um usuário
router.get('/user/:userId', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    // Usuários só podem ver suas próprias mensagens
    if (req.user.id !== userId) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você só pode ver suas próprias mensagens'
        });
    }
    const limitNum = parseInt(limit) || 50;
    if (limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
            error: 'Limite inválido',
            message: 'Limite deve ser entre 1 e 100'
        });
    }
    const messages = await messageService.getMessagesByUser(userId, limitNum);
    res.json({
        message: 'Mensagens do usuário obtidas com sucesso',
        data: {
            messages,
            total: messages.length,
            limit: limitNum
        }
    });
}));
// Obter contagem de mensagens não lidas
router.get('/room/:roomId/unread-count', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { roomId } = req.params;
    const { lastRead } = req.query;
    if (!lastRead) {
        return res.status(400).json({
            error: 'Timestamp obrigatório',
            message: 'Timestamp da última leitura é obrigatório'
        });
    }
    // Verificar se o usuário é membro da sala
    const room = await roomService.getRoomById(roomId);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'Sala não foi encontrada'
        });
    }
    if (!room.isMember(req.user.id)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não é membro desta sala'
        });
    }
    const lastReadDate = new Date(lastRead);
    if (isNaN(lastReadDate.getTime())) {
        return res.status(400).json({
            error: 'Timestamp inválido',
            message: 'Formato de timestamp inválido'
        });
    }
    const unreadCount = await messageService.getUnreadMessageCount(roomId, lastReadDate);
    res.json({
        message: 'Contagem de mensagens não lidas obtida com sucesso',
        data: {
            roomId,
            unreadCount,
            lastRead: lastReadDate
        }
    });
}));
// Marcar mensagens de uma sala como lidas
router.post('/room/:roomId/read', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { roomId } = req.params;
    const userId = req.user.id;
    // Verificar se o usuário é membro da sala
    const room = await roomService.getRoomById(roomId);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'Sala não foi encontrada'
        });
    }
    if (!room.isMember(userId)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não é membro desta sala'
        });
    }
    try {
        // Marcar sala como lida
        const success = await messageService.markRoomAsRead(roomId, userId);
        if (success) {
            res.json({
                message: 'Sala marcada como lida com sucesso',
                data: {
                    roomId,
                    userId,
                    timestamp: new Date().toISOString()
                }
            });
        }
        else {
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível marcar a sala como lida'
            });
        }
    }
    catch (error) {
        console.error('Erro ao marcar sala como lida:', error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao processar a solicitação'
        });
    }
}));
// Marcar todas as mensagens de uma sala como lidas
router.post('/room/:roomId/mark-all-read', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { roomId } = req.params;
    const userId = req.user.id;
    // Verificar se o usuário é membro da sala
    const room = await roomService.getRoomById(roomId);
    if (!room) {
        return res.status(404).json({
            error: 'Sala não encontrada',
            message: 'Sala não foi encontrada'
        });
    }
    if (!room.isMember(userId)) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Você não é membro desta sala'
        });
    }
    try {
        // Marcar todas as mensagens como lidas
        const success = await messageService.markAllMessagesAsRead(roomId, userId);
        if (success) {
            res.json({
                message: 'Todas as mensagens marcadas como lidas com sucesso',
                data: {
                    roomId,
                    userId,
                    timestamp: new Date().toISOString()
                }
            });
        }
        else {
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível marcar as mensagens como lidas'
            });
        }
    }
    catch (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao processar a solicitação'
        });
    }
}));
exports.default = router;
//# sourceMappingURL=messages.js.map