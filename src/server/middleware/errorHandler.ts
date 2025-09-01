import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
    (errorResponse.error as any).stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
}

// Middleware para capturar erros assíncronos
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Função para criar erros personalizados
export function createError(message: string, statusCode: number = 500): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

// Middleware para capturar erros de validação
export function validationErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
export function databaseErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
export function notFoundHandler(req: Request, res: Response): void {
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
