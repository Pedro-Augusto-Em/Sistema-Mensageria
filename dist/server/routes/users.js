"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userService_1 = require("../services/userService");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const userService = new userService_1.UserService();
// Obter perfil do usuário atual (protegido)
router.get('/profile', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const user = await userService.getUserById(req.user.id);
    if (!user) {
        return res.status(404).json({
            error: 'Usuário não encontrado',
            message: 'Usuário não foi encontrado'
        });
    }
    res.json({
        message: 'Perfil obtido com sucesso',
        user: user.toPublic()
    });
}));
// Atualizar perfil do usuário atual (protegido)
router.put('/profile', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { username, nickname, avatar } = req.body;
    try {
        const updatedUser = await userService.updateUser(req.user.id, {
            username,
            nickname,
            avatar
        });
        if (!updatedUser) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não foi encontrado'
            });
        }
        res.json({
            message: 'Perfil atualizado com sucesso',
            user: updatedUser.toPublic()
        });
    }
    catch (error) {
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
// Obter usuário por ID
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (!user) {
        return res.status(404).json({
            error: 'Usuário não encontrado',
            message: 'Usuário não foi encontrado'
        });
    }
    res.json({
        message: 'Usuário obtido com sucesso',
        user: user.toPublic()
    });
}));
// Buscar usuários (protegido)
router.get('/search/:query', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { query } = req.params;
    const { limit = 20 } = req.query;
    if (!query || query.trim().length === 0) {
        return res.status(400).json({
            error: 'Query inválida',
            message: 'Termo de busca é obrigatório'
        });
    }
    const users = await userService.searchUsers(query, req.user.id);
    res.json({
        message: 'Busca realizada com sucesso',
        users,
        total: users.length,
        query
    });
}));
// Obter todos os usuários (com paginação)
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
            error: 'Parâmetros inválidos',
            message: 'Página e limite devem ser números positivos. Limite máximo: 100'
        });
    }
    // Buscar apenas informações básicas (sem status, lastSeen, etc.)
    const users = await userService.getBasicUsersList();
    // Paginação simples
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedUsers = users.slice(startIndex, endIndex);
    res.json({
        message: 'Lista básica de usuários obtida com sucesso',
        users: paginatedUsers,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: users.length,
            totalPages: Math.ceil(users.length / limitNum),
            hasNext: endIndex < users.length,
            hasPrev: pageNum > 1
        }
    });
}));
// Obter usuários online
router.get('/status/online', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const onlineUsers = await userService.getOnlineUsers();
    res.json({
        message: 'Usuários online obtidos com sucesso',
        users: onlineUsers,
        total: onlineUsers.length
    });
}));
// Obter usuários por status
router.get('/status/:status', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { status } = req.params;
    const validStatuses = ['online', 'offline', 'away'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Status inválido',
            message: 'Status deve ser: online, offline ou away'
        });
    }
    const users = await userService.getUsersByStatus(status);
    res.json({
        message: `Usuários com status ${status} obtidos com sucesso`,
        users,
        total: users.length,
        status
    });
}));
// Atualizar status do usuário (protegido)
router.patch('/status', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { status } = req.body;
    const validStatuses = ['online', 'offline', 'away'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Status inválido',
            message: 'Status deve ser: online, offline ou away'
        });
    }
    await userService.updateUserStatus(req.user.id, status);
    res.json({
        message: 'Status atualizado com sucesso',
        status
    });
}));
// Deletar usuário (apenas o próprio usuário pode deletar sua conta) (protegido)
router.delete('/', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({
            error: 'Senha obrigatória',
            message: 'Senha é obrigatória para deletar a conta'
        });
    }
    // Verificar se a senha está correta antes de deletar
    const user = await userService.getUserById(req.user.id);
    if (!user) {
        return res.status(404).json({
            error: 'Usuário não encontrado',
            message: 'Usuário não foi encontrado'
        });
    }
    const isPasswordValid = await require('bcryptjs').compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).json({
            error: 'Senha incorreta',
            message: 'Senha fornecida está incorreta'
        });
    }
    const deleted = await userService.deleteUser(req.user.id);
    if (!deleted) {
        return res.status(500).json({
            error: 'Erro ao deletar',
            message: 'Erro ao deletar usuário'
        });
    }
    res.json({
        message: 'Conta deletada com sucesso'
    });
}));
// Obter estatísticas do usuário (opcional)
router.get('/stats/summary', auth_1.authenticateToken, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Não autorizado',
            message: 'Token de autenticação é obrigatório'
        });
    }
    const user = await userService.getUserById(req.user.id);
    if (!user) {
        return res.status(404).json({
            error: 'Usuário não encontrado',
            message: 'Usuário não foi encontrado'
        });
    }
    // Aqui você poderia adicionar mais estatísticas como:
    // - Número de mensagens enviadas
    // - Número de salas participando
    // - Tempo online, etc.
    const stats = {
        userId: user.id,
        username: user.username,
        status: user.status,
        lastSeen: user.lastSeen,
        memberSince: user.createdAt,
        accountAge: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) // dias
    };
    res.json({
        message: 'Estatísticas obtidas com sucesso',
        stats
    });
}));
exports.default = router;
//# sourceMappingURL=users.js.map