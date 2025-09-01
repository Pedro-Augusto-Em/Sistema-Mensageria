"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
// Importar rotas
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const messages_1 = __importDefault(require("./routes/messages"));
const files_1 = __importDefault(require("./routes/files"));
const rooms_1 = __importDefault(require("./routes/rooms"));
const emojis_1 = __importDefault(require("./routes/emojis"));
// Importar middleware
const auth_2 = require("./middleware/auth");
const errorHandler_1 = require("./middleware/errorHandler");
// Importar serviços
const database_1 = require("./services/database");
const messageService_1 = require("./services/messageService");
const userService_1 = require("./services/userService");
const roomService_1 = require("./services/roomService");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            process.env.CLIENT_URL || "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            "http://192.168.1.64:3001",
            /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Permitir qualquer IP da rede local
            /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/, // Permitir IPs da rede 10.x.x.x
            /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/ // Permitir IPs da rede 172.16-31.x.x
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});
// Configurações de segurança personalizadas (sem Helmet)
app.use((req, res, next) => {
    // Remover headers problemáticos
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.removeHeader('Origin-Agent-Cluster');
    // Adicionar headers seguros para HTTP local
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});
app.use((0, cors_1.default)({
    origin: [
        process.env.CLIENT_URL || "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://192.168.1.64:3001",
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Permitir qualquer IP da rede local
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/, // Permitir IPs da rede 10.x.x.x
        /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/ // Permitir IPs da rede 172.16-31.x.x
    ],
    credentials: true
}));
// Configurar trust proxy para funcionar com Cloudflare Tunnels
app.set('trust proxy', 1);
// Middleware para Cloudflare Tunnels
app.use((req, res, next) => {
    // Adicionar headers específicos do Cloudflare se necessário
    if (req.headers['cf-connecting-ip']) {
        // @ts-ignore - Ignorar erro de readonly para compatibilidade
        req.ip = req.headers['cf-connecting-ip'];
    }
    next();
});
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // limite de 100 requests por IP
});
app.use(limiter);
// Middleware para parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Servir arquivos estáticos
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
// Endpoint de health
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});
// Página inicial - servir o HTML
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'public/index.html'));
});
// Mapeamento de usuários para sockets
const userSockets = new Map();
// Disponibilizar Socket.IO e mapeamento de usuários para as rotas
app.set('io', io);
app.set('userSockets', userSockets);
// Rotas públicas
app.use('/api/auth', auth_1.default);
// Rotas de usuários (algumas protegidas, outras públicas)
app.use('/api/users', users_1.default);
app.use('/api/messages', auth_2.authenticateToken, messages_1.default);
app.use('/api/files', auth_2.authenticateToken, files_1.default);
app.use('/api/rooms', auth_2.authenticateToken, rooms_1.default);
app.use('/api/emojis', auth_2.authenticateToken, emojis_1.default);
// Middleware de tratamento de erros
app.use(errorHandler_1.errorHandler);
// Socket.IO para mensagens em tempo real
const messageService = new messageService_1.MessageService();
const userService = new userService_1.UserService();
const roomService = new roomService_1.RoomService();
io.on('connection', (socket) => {
    console.log('Usuário conectado:', socket.id);
    // Usuário se identifica
    socket.on('user_connected', (data) => {
        const { userId } = data;
        if (userId) {
            userSockets.set(userId, socket.id);
            console.log(`Usuário ${userId} mapeado para socket ${socket.id}`);
        }
    });
    // Usuário entra em uma sala (conversa)
    socket.on('join_room', async (data) => {
        const { roomId, userId } = data;
        console.log('Usuário tentando entrar na sala:', { userId, roomId, socketId: socket.id });
        socket.join(roomId);
        console.log(`Usuário ${userId} entrou na sala ${roomId}`);
    });
    // Usuário sai de uma sala
    socket.on('leave_room', (data) => {
        const { roomId } = data;
        socket.leave(roomId);
    });
    // Nova mensagem
    socket.on('send_message', async (data) => {
        try {
            console.log('Recebendo mensagem:', data);
            if (!data || typeof data !== 'object') {
                socket.emit('error', { message: 'Dados inválidos para mensagem' });
                return;
            }
            const { content, roomId, senderId, type = 'text' } = data;
            console.log('Dados da mensagem:', { content, roomId, senderId, type });
            // Validação básica
            if (!content || !roomId || !senderId) {
                console.error('Dados incompletos:', { content: !!content, roomId: !!roomId, senderId: !!senderId });
                socket.emit('error', { message: 'Dados incompletos para mensagem' });
                return;
            }
            // Verificar se o usuário é membro da sala
            const room = await roomService.getRoomById(roomId);
            console.log('Sala carregada:', { roomId, roomExists: !!room, roomData: room });
            if (!room) {
                console.error('Sala não encontrada:', roomId);
                socket.emit('error', { message: 'Sala não encontrada' });
                return;
            }
            console.log('Verificando se usuário é membro:', {
                userId: senderId,
                roomMembers: room.members,
                isMember: room.isMember(senderId)
            });
            if (!room.isMember(senderId)) {
                console.error('Usuário não é membro da sala:', { userId: senderId, roomId, roomMembers: room.members });
                socket.emit('error', { message: 'Usuário não é membro desta sala' });
                return;
            }
            console.log('Criando mensagem no banco:', { content, roomId, senderId, type });
            // Salvar mensagem no banco
            const message = await messageService.createMessage({
                content,
                roomId,
                senderId,
                type
            });
            console.log('Mensagem criada no banco:', message.id);
            // Buscar mensagem completa com informações do remetente
            const messageWithSender = await messageService.getMessageWithSender(message.id);
            console.log('Mensagem com remetente:', messageWithSender);
            // Broadcast para todos na sala
            io.to(roomId).emit('new_message', {
                ...messageWithSender,
                timestamp: new Date()
            });
            console.log(`Mensagem enviada com sucesso na sala ${roomId}`);
        }
        catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            socket.emit('error', { message: 'Erro interno ao enviar mensagem' });
        }
    });
    // Editar mensagem
    socket.on('edit_message', async (data) => {
        try {
            const { messageId, content, roomId, userId } = data;
            if (!userId) {
                socket.emit('error', { message: 'ID do usuário é obrigatório' });
                return;
            }
            // Editar mensagem no banco
            const updatedMessage = await messageService.editMessage(messageId, content, userId);
            if (updatedMessage) {
                // Emitir para todos na sala
                io.to(roomId).emit('message_edited', {
                    messageId,
                    content,
                    editedBy: userId,
                    timestamp: new Date()
                });
            }
        }
        catch (error) {
            console.error('Erro ao editar mensagem:', error);
            socket.emit('error', { message: 'Erro ao editar mensagem' });
        }
    });
    // Excluir mensagem
    socket.on('delete_message', async (data) => {
        try {
            const { messageId, roomId, userId } = data;
            if (!userId) {
                socket.emit('error', { message: 'ID do usuário é obrigatório' });
                return;
            }
            // Excluir mensagem no banco
            const deleted = await messageService.deleteMessage(messageId, userId);
            if (deleted) {
                // Emitir para todos na sala
                io.to(roomId).emit('message_deleted', {
                    messageId,
                    deletedBy: userId,
                    timestamp: new Date()
                });
            }
        }
        catch (error) {
            console.error('Erro ao excluir mensagem:', error);
            socket.emit('error', { message: 'Erro ao excluir mensagem' });
        }
    });
    // Usuário digitando
    socket.on('typing', (data) => {
        const { roomId, userId, isTyping } = data;
        socket.to(roomId).emit('user_typing', { userId, isTyping });
    });
    // Desconexão
    socket.on('disconnect', () => {
        console.log('Usuário desconectado:', socket.id);
        // Remover usuário do mapeamento
        for (const [userId, socketId] of userSockets.entries()) {
            if (socketId === socket.id) {
                userSockets.delete(userId);
                console.log(`Usuário ${userId} removido do mapeamento`);
                break;
            }
        }
    });
});
// Inicializar banco de dados
(0, database_1.initializeDatabase)().then(() => {
    console.log('Banco de dados inicializado com sucesso');
}).catch((error) => {
    console.error('Erro ao inicializar banco de dados:', error);
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
//# sourceMappingURL=index.js.map