"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
exports.initializeDatabase = initializeDatabase;
exports.getDatabase = getDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
class Database {
    constructor() {
        const dbPath = path_1.default.join(__dirname, '../../../data/mensageria.db');
        this.db = new sqlite3_1.default.Database(dbPath, (err) => {
            if (err) {
                console.error('Erro ao conectar ao banco de dados:', err);
            }
            else {
                console.log('Conectado ao banco de dados SQLite');
            }
        });
        // Habilitar foreign keys
        this.db.run('PRAGMA foreign_keys = ON');
    }
    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
    getDatabase() {
        return this.db;
    }
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(this);
                }
            });
        });
    }
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    }
    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}
exports.Database = Database;
async function initializeDatabase() {
    const db = Database.getInstance();
    try {
        // Criar tabela de usuários
        await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nickname TEXT NOT NULL,
        avatar TEXT,
        status TEXT DEFAULT 'offline',
        lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Criar tabela de salas
        await db.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK(type IN ('direct', 'group', 'channel')),
        avatar TEXT,
        createdBy TEXT NOT NULL,
        members TEXT NOT NULL, -- JSON array de IDs
        admins TEXT NOT NULL, -- JSON array de IDs
        isPrivate BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        // Criar tabela de mensagens
        await db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'image', 'file', 'audio', 'video', 'document', 'pdf')),
        roomId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        replyToId TEXT,
        isEdited BOOLEAN DEFAULT 0,
        isDeleted BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'delivered', 'read')),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (replyToId) REFERENCES messages(id) ON DELETE SET NULL
      )
    `);
        // Criar tabela de arquivos
        await db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        originalName TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        messageId TEXT,
        uploadedBy TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE SET NULL,
        FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        // Criar tabela de leituras de mensagens
        await db.run(`
      CREATE TABLE IF NOT EXISTS message_reads (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL,
        userId TEXT NOT NULL,
        readAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(messageId, userId)
      )
    `);
        // Criar tabela de leituras de salas por usuário
        await db.run(`
      CREATE TABLE IF NOT EXISTS user_room_reads (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        roomId TEXT NOT NULL,
        lastReadAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
        UNIQUE(userId, roomId)
      )
    `);
        // Criar tabela de emojis customizados
        await db.run(`
      CREATE TABLE IF NOT EXISTS custom_emojis (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        url TEXT NOT NULL,
        uploadedBy TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        // Criar índices para melhor performance
        await db.run('CREATE INDEX IF NOT EXISTS idx_messages_roomId ON messages(roomId)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_messages_senderId ON messages(senderId)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_messages_createdAt ON messages(createdAt)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_rooms_createdBy ON rooms(createdBy)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_user_room_reads_userId ON user_room_reads(userId)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_user_room_reads_roomId ON user_room_reads(roomId)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_custom_emojis_name ON custom_emojis(name)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_custom_emojis_uploadedBy ON custom_emojis(uploadedBy)');
        console.log('Tabelas criadas/verificadas com sucesso');
    }
    catch (error) {
        console.error('Erro ao inicializar banco de dados:', error);
        throw error;
    }
}
function getDatabase() {
    return Database.getInstance();
}
//# sourceMappingURL=database.js.map