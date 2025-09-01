"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
class User {
    constructor(data) {
        this.id = data.id;
        this.username = data.username;
        this.password = data.password;
        this.nickname = data.nickname;
        this.avatar = data.avatar;
        this.status = data.status;
        this.lastSeen = data.lastSeen;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }
    static validateCreate(data) {
        const errors = [];
        if (!data.username || data.username.length < 3) {
            errors.push('Username deve ter pelo menos 3 caracteres');
        }
        if (!data.password || data.password.length < 6) {
            errors.push('Senha deve ter pelo menos 6 caracteres');
        }
        if (!data.nickname || data.nickname.trim().length === 0) {
            errors.push('Nickname é obrigatório');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateUpdate(data) {
        const errors = [];
        if (data.username && data.username.length < 3) {
            errors.push('Username deve ter pelo menos 3 caracteres');
        }
        if (data.nickname && data.nickname.trim().length === 0) {
            errors.push('Nickname não pode estar vazio');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    toPublic() {
        return {
            id: this.id,
            username: this.username,
            nickname: this.nickname,
            avatar: this.avatar,
            status: this.status,
            lastSeen: this.lastSeen
        };
    }
    updateStatus(status) {
        this.status = status;
        this.lastSeen = new Date();
        this.updatedAt = new Date();
    }
}
exports.User = User;
//# sourceMappingURL=User.js.map