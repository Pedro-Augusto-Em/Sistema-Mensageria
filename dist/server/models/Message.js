"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
class Message {
    constructor(data) {
        this.id = data.id;
        this.content = data.content;
        this.type = data.type;
        this.roomId = data.roomId;
        this.senderId = data.senderId;
        this.replyToId = data.replyToId;
        this.isEdited = data.isEdited;
        this.isDeleted = data.isDeleted;
        this.status = data.status || 'sent';
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }
    static validateCreate(data) {
        const errors = [];
        // Para mensagens de texto, o conteúdo é obrigatório
        if (data.type === 'text' && (!data.content || data.content.trim().length === 0)) {
            errors.push('Conteúdo da mensagem é obrigatório');
        }
        // Para mensagens de imagem, o conteúdo (URL) é obrigatório
        if (data.type === 'image' && (!data.content || data.content.trim().length === 0)) {
            errors.push('URL da imagem é obrigatória');
        }
        // Para outros tipos de arquivo, o conteúdo (caminho) é obrigatório
        if (['file', 'audio', 'video', 'document', 'pdf'].includes(data.type) && (!data.content || data.content.trim().length === 0)) {
            errors.push('Caminho do arquivo é obrigatório');
        }
        if (!data.type || !['text', 'image', 'file', 'audio', 'video', 'document', 'pdf'].includes(data.type)) {
            errors.push('Tipo de mensagem inválido');
        }
        if (!data.roomId) {
            errors.push('ID da sala é obrigatório');
        }
        if (!data.senderId) {
            errors.push('ID do remetente é obrigatório');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static validateUpdate(data) {
        const errors = [];
        if (data.content !== undefined && data.content.trim().length === 0) {
            errors.push('Conteúdo da mensagem não pode estar vazio');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    edit(newContent) {
        this.content = newContent;
        this.isEdited = true;
        this.updatedAt = new Date();
    }
    delete() {
        this.isDeleted = true;
        this.updatedAt = new Date();
    }
    canEdit(userId) {
        return this.senderId === userId && !this.isDeleted;
    }
    canDelete(userId) {
        return this.senderId === userId && !this.isDeleted;
    }
    // Métodos para gerenciar status da mensagem
    markAsDelivered() {
        if (this.status === 'sent') {
            this.status = 'delivered';
            this.updatedAt = new Date();
        }
    }
    markAsRead() {
        if (this.status === 'delivered' || this.status === 'sent') {
            this.status = 'read';
            this.updatedAt = new Date();
        }
    }
    getStatusIcon() {
        switch (this.status) {
            case 'sent':
                return '✓'; // Enviado
            case 'delivered':
                return '✓✓'; // Entregue
            case 'read':
                return '✓✓'; // Lido (azul)
            default:
                return '✓';
        }
    }
    getStatusColor() {
        switch (this.status) {
            case 'sent':
                return '#666'; // Cinza
            case 'delivered':
                return '#666'; // Cinza
            case 'read':
                return '#0084ff'; // Azul
            default:
                return '#666';
        }
    }
}
exports.Message = Message;
//# sourceMappingURL=Message.js.map