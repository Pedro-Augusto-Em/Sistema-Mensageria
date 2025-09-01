"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-aqui';
function authenticateToken(req, res, next) {
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
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                error: 'Token expirado',
                message: 'O token de autenticação expirou. Faça login novamente.'
            });
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                error: 'Token inválido',
                message: 'O token de autenticação é inválido.'
            });
        }
        else {
            res.status(401).json({
                error: 'Erro de autenticação',
                message: 'Erro ao verificar o token de autenticação.'
            });
        }
    }
}
function generateToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        username: user.username,
        email: user.email
    }, JWT_SECRET, { expiresIn: '7d' } // Token expira em 7 dias
    );
}
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        return null;
    }
}
// Middleware opcional para rotas que podem ou não ter autenticação
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.user = {
                id: decoded.id,
                username: decoded.username,
                email: decoded.email
            };
        }
        catch (error) {
            // Token inválido, mas não falha a requisição
            console.warn('Token inválido fornecido para rota opcional:', error);
        }
    }
    next();
}
//# sourceMappingURL=auth.js.map