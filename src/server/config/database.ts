import path from 'path';

export const databaseConfig = {
  // Caminho para o banco SQLite
  path: process.env.DB_PATH || path.join(__dirname, '../../../data/mensageria.db'),
  
  // Configurações do SQLite
  sqlite: {
    // Habilitar foreign keys
    foreignKeys: true,
    
    // Configurações de performance
    pragma: {
      journal_mode: 'WAL', // Write-Ahead Logging para melhor performance
      synchronous: 'NORMAL', // Balance entre performance e segurança
      cache_size: -64000, // 64MB de cache
      temp_store: 'MEMORY', // Armazenar temporários na memória
      mmap_size: 268435456, // 256MB para memory mapping
      page_size: 4096, // Tamanho da página
      auto_vacuum: 'INCREMENTAL' // Vacuum automático incremental
    }
  },
  
  // Configurações de backup
  backup: {
    enabled: process.env.DB_BACKUP_ENABLED === 'true',
    interval: parseInt(process.env.DB_BACKUP_INTERVAL || '86400000'), // 24 horas em ms
    maxBackups: parseInt(process.env.DB_MAX_BACKUPS || '7'),
    backupDir: process.env.DB_BACKUP_DIR || path.join(__dirname, '../../../backups')
  },
  
  // Configurações de migração
  migration: {
    enabled: process.env.DB_MIGRATION_ENABLED === 'true',
    tableName: 'migrations',
    directory: process.env.DB_MIGRATION_DIR || path.join(__dirname, '../migrations')
  },
  
  // Configurações de logging
  logging: {
    enabled: process.env.DB_LOGGING_ENABLED === 'true',
    level: process.env.DB_LOG_LEVEL || 'info',
    slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000') // 1 segundo
  },
  
  // Configurações de pool de conexões (para futuras implementações)
  pool: {
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '1'),
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000'), // 60 segundos
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '300000') // 5 minutos
  }
};

// Configurações específicas para diferentes ambientes
export const getDatabaseConfig = (environment: string = process.env.NODE_ENV || 'development') => {
  const baseConfig = { ...databaseConfig };
  
  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        sqlite: {
          ...baseConfig.sqlite,
          pragma: {
            ...baseConfig.sqlite.pragma,
            synchronous: 'FULL', // Máxima segurança em produção
            journal_mode: 'DELETE' // Modo mais seguro para produção
          }
        },
        backup: {
          ...baseConfig.backup,
          enabled: true,
          interval: 3600000 // Backup a cada hora em produção
        }
      };
      
    case 'test':
      return {
        ...baseConfig,
        path: ':memory:', // Banco em memória para testes
        sqlite: {
          ...baseConfig.sqlite,
          pragma: {
            ...baseConfig.sqlite.pragma,
            synchronous: 'OFF', // Máxima performance para testes
            journal_mode: 'OFF'
          }
        },
        backup: {
          ...baseConfig.backup,
          enabled: false
        }
      };
      
    default: // development
      return baseConfig;
  }
};

// Validação da configuração
export const validateDatabaseConfig = () => {
  const config = getDatabaseConfig();
  
  const errors: string[] = [];
  
  // Validar caminho do banco
  if (!config.path || config.path.trim() === '') {
    errors.push('DB_PATH não pode estar vazio');
  }
  
  // Validar configurações de backup
  if (config.backup.enabled) {
    if (config.backup.interval < 60000) { // Mínimo 1 minuto
      errors.push('DB_BACKUP_INTERVAL deve ser pelo menos 60000ms (1 minuto)');
    }
    
    if (config.backup.maxBackups < 1) {
      errors.push('DB_MAX_BACKUPS deve ser pelo menos 1');
    }
  }
  
  // Validar configurações de pool
  if (config.pool.maxConnections < config.pool.minConnections) {
    errors.push('DB_MAX_CONNECTIONS deve ser maior ou igual a DB_MIN_CONNECTIONS');
  }
  
  if (config.pool.acquireTimeout < 1000) { // Mínimo 1 segundo
    errors.push('DB_ACQUIRE_TIMEOUT deve ser pelo menos 1000ms (1 segundo)');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuração de banco inválida: ${errors.join(', ')}`);
  }
  
  return config;
};
