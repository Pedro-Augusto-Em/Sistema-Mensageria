"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
class Room {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.type = data.type;
        this.avatar = data.avatar;
        this.createdBy = data.createdBy;
        this.members = data.members;
        this.admins = data.admins;
        this.isPrivate = data.isPrivate;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }
    static validateCreate(data) {
        const errors = [];
        if (!data.name || data.name.trim().length === 0) {
            errors.push('Nome da sala é obrigatório');
        }
        if (!data.type || !['direct', 'group', 'channel'].includes(data.type)) {
            errors.push('Tipo de sala inválido');
        }
        if (!data.createdBy) {
            errors.push('ID do criador é obrigatório');
        }
        if (!data.members || data.members.length === 0) {
            errors.push('A sala deve ter pelo menos um membro');
        }
        if (data.type === 'direct' && data.members.length !== 2) {
            errors.push('Conversa direta deve ter exatamente 2 membros');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateUpdate(data) {
        const errors = [];
        if (data.name !== undefined && data.name.trim().length === 0) {
            errors.push('Nome da sala não pode estar vazio');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    addMember(userId) {
        if (!this.members.includes(userId)) {
            this.members.push(userId);
            this.updatedAt = new Date();
            return true;
        }
        return false;
    }
    removeMember(userId) {
        const index = this.members.indexOf(userId);
        if (index > -1) {
            this.members.splice(index, 1);
            this.updatedAt = new Date();
            return true;
        }
        return false;
    }
    addAdmin(userId) {
        if (this.members.includes(userId) && !this.admins.includes(userId)) {
            this.admins.push(userId);
            this.updatedAt = new Date();
            return true;
        }
        return false;
    }
    removeAdmin(userId) {
        const index = this.admins.indexOf(userId);
        if (index > -1) {
            this.admins.splice(index, 1);
            this.updatedAt = new Date();
            return true;
        }
        return false;
    }
    isMember(userId) {
        return this.members.includes(userId);
    }
    isAdmin(userId) {
        return this.admins.includes(userId);
    }
    canManage(userId) {
        return this.createdBy === userId || this.isAdmin(userId);
    }
    isDirectMessage() {
        return this.type === 'direct';
    }
    getOtherMember(userId) {
        if (this.type === 'direct') {
            return this.members.find(member => member !== userId) || null;
        }
        return null;
    }
}
exports.Room = Room;
//# sourceMappingURL=Room.js.map