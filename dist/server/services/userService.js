"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const database_1 = require("./database");
const User_1 = require("../models/User");
class UserService {
    constructor() {
        this.db = (0, database_1.getDatabase)();
    }
    async createUser(userData) {
        const validation = User_1.User.validateCreate(userData);
        if (!validation.isValid) {
            throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
        }
        // Verificar se username já existe
        const existingUser = await this.db.get('SELECT id FROM users WHERE username = ?', [userData.username]);
        if (existingUser) {
            throw new Error('Username já existe');
        }
        // Hash da senha
        const saltRounds = 12;
        const hashedPassword = await bcryptjs_1.default.hash(userData.password, saltRounds);
        const user = {
            id: (0, uuid_1.v4)(),
            username: userData.username,
            password: hashedPassword,
            nickname: userData.nickname,
            avatar: userData.avatar,
            status: 'offline',
            lastSeen: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await this.db.run(`INSERT INTO users (id, username, password, nickname, avatar, status, lastSeen, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            user.id, user.username, user.password, user.nickname,
            user.avatar, user.status, user.lastSeen.toISOString(),
            user.createdAt.toISOString(), user.updatedAt.toISOString()
        ]);
        return new User_1.User(user);
    }
    async getUserById(id) {
        const userData = await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
        return userData ? new User_1.User(userData) : null;
    }
    async getUserByUsername(username) {
        const userData = await this.db.get('SELECT * FROM users WHERE username = ?', [username]);
        return userData ? new User_1.User(userData) : null;
    }
    async getAllUsers() {
        const users = await this.db.all('SELECT * FROM users ORDER BY username');
        return users.map(user => new User_1.User(user).toPublic());
    }
    async getBasicUsersList() {
        const users = await this.db.all('SELECT id, username, nickname, avatar FROM users ORDER BY username');
        return users.map(user => ({
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatar: user.avatar
        }));
    }
    async searchUsers(query, currentUserId) {
        const searchQuery = `%${query}%`;
        const users = await this.db.all(`SELECT * FROM users 
       WHERE (username LIKE ? OR nickname LIKE ?) AND id != ?
       ORDER BY username`, [searchQuery, searchQuery, currentUserId]);
        return users.map(user => new User_1.User(user).toPublic());
    }
    async updateUser(id, updateData) {
        const validation = User_1.User.validateUpdate(updateData);
        if (!validation.isValid) {
            throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
        }
        const user = await this.getUserById(id);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }
        // Verificar se username já existe (se estiver sendo alterado)
        if (updateData.username && updateData.username !== user.username) {
            const existingUser = await this.db.get('SELECT id FROM users WHERE username = ? AND id != ?', [updateData.username, id]);
            if (existingUser) {
                throw new Error('Username já existe');
            }
        }
        // Construir query de atualização dinamicamente
        const updateFields = [];
        const updateValues = [];
        if (updateData.username !== undefined) {
            updateFields.push('username = ?');
            updateValues.push(updateData.username);
        }
        if (updateData.nickname !== undefined) {
            updateFields.push('nickname = ?');
            updateValues.push(updateData.nickname);
        }
        if (updateData.avatar !== undefined) {
            updateFields.push('avatar = ?');
            updateValues.push(updateData.avatar);
        }
        if (updateData.status !== undefined) {
            updateFields.push('status = ?');
            updateValues.push(updateData.status);
        }
        if (updateFields.length === 0) {
            return user;
        }
        updateFields.push('updatedAt = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(id);
        const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.db.run(updateQuery, updateValues);
        // Retornar usuário atualizado
        return await this.getUserById(id);
    }
    async updateUserStatus(id, status) {
        await this.db.run('UPDATE users SET status = ?, lastSeen = ?, updatedAt = ? WHERE id = ?', [status, new Date().toISOString(), new Date().toISOString(), id]);
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error('Usuário não encontrado');
        }
        // Verificar senha atual
        const isCurrentPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new Error('Senha atual incorreta');
        }
        // Hash da nova senha
        const saltRounds = 12;
        const hashedNewPassword = await bcryptjs_1.default.hash(newPassword, saltRounds);
        // Atualizar senha
        await this.db.run('UPDATE users SET password = ?, updatedAt = ? WHERE id = ?', [hashedNewPassword, new Date().toISOString(), userId]);
        return true;
    }
    async deleteUser(id) {
        const result = await this.db.run('DELETE FROM users WHERE id = ?', [id]);
        return result.changes > 0;
    }
    async authenticateUser(username, password) {
        const user = await this.getUserByUsername(username);
        if (!user) {
            return null;
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            return null;
        }
        // Atualizar status para online
        await this.updateUserStatus(user.id, 'online');
        return user;
    }
    async getUsersByStatus(status) {
        const users = await this.db.all('SELECT * FROM users WHERE status = ? ORDER BY username', [status]);
        return users.map(user => new User_1.User(user).toPublic());
    }
    async getOnlineUsers() {
        return this.getUsersByStatus('online');
    }
}
exports.UserService = UserService;
//# sourceMappingURL=userService.js.map