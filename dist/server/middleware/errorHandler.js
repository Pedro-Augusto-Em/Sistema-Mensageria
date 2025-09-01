"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
exports.createError = createError;
exports.validationErrorHandler = validationErrorHandler;
exports.databaseErrorHandler = databaseErrorHandler;
exports.notFoundHandler = notFoundHandler;
function errorHandler(error, req, res, next) {
    console.error('Erro capturado:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    // Se já foi enviada uma resposta, não fazer nada
    if (res.headersSent) {
        return next(error);
    }
    // Definir status code padrão
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Erro interno do servidor';
    // Resposta de erro
    const errorResponse = {
        error: {
            message,
            statusCode,
            timestamp: new Date().toISOString(),
            path: req.url,
            method: req.method
        }
    };
    // Em desenvolvimento, incluir stack trace
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.stack = error.stack;
    }
    res.status(statusCode).json(errorResponse);
}
// Middleware para capturar erros assíncronos
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
// Função para criar erros personalizados
function createError(message, statusCode = 500) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
}
// Middleware para capturar erros de validação
function validationErrorHandler(error, req, res, next) {
    if (error.name === 'ValidationError') {
        res.status(400).json({
            error: {
                message: 'Erro de validação',
                statusCode: 400,
                details: error.details || error.message,
                timestamp: new Date().toISOString(),
                path: req.url,
                method: req.method
            }
        });
        return;
    }
    next(error);
}
// Middleware para capturar erros de banco de dados
function databaseErrorHandler(error, req, res, next) {
    if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({
            error: {
                message: 'Violação de restrição do banco de dados',
                statusCode: 400,
                details: 'Os dados fornecidos violam as regras de integridade',
                timestamp: new Date().toISOString(),
                path: req.url,
                method: req.method
            }
        });
        return;
    }
    if (error.code === 'SQLITE_BUSY') {
        res.status(503).json({
            error: {
                message: 'Serviço temporariamente indisponível',
                statusCode: 503,
                details: 'O banco de dados está ocupado. Tente novamente em alguns instantes.',
                timestamp: new Date().toISOString(),
                path: req.url,
                method: req.method
            }
        });
        return;
    }
    next(error);
}
// Middleware para capturar erros de arquivo não encontrado
function notFoundHandler(req, res) {
    res.status(404).json({
        error: {
            message: 'Recurso não encontrado',
            statusCode: 404,
            details: `A rota ${req.method} ${req.url} não foi encontrada`,
            timestamp: new Date().toISOString(),
            path: req.url,
            method: req.method
        }
    });
}
//# sourceMappingURL=errorHandler.js.map