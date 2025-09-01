export interface IMessage {
  id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'document' | 'pdf';
  roomId: string;
  senderId: string;
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageCreate {
  content: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'document' | 'pdf';
  roomId: string;
  senderId: string;
  replyToId?: string;
}

export interface IMessageUpdate {
  content?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
}

export interface IMessageWithSender {
  id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'document' | 'pdf';
  roomId: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    nickname: string;
    avatar?: string;
  };
  replyToId?: string;
  replyTo?: {
    id: string;
    content: string;
    sender: {
      username: string;
    };
  };

  isEdited: boolean;
  isDeleted: boolean;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  updatedAt: Date;
}

export class Message implements IMessage {
  id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'document' | 'pdf';
  roomId: string;
  senderId: string;
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  updatedAt: Date;

  constructor(data: IMessage) {
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

  static validateCreate(data: IMessageCreate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

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

  static validateUpdate(data: IMessageUpdate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.content !== undefined && data.content.trim().length === 0) {
      errors.push('Conteúdo da mensagem não pode estar vazio');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  edit(newContent: string): void {
    this.content = newContent;
    this.isEdited = true;
    this.updatedAt = new Date();
  }

  delete(): void {
    this.isDeleted = true;
    this.updatedAt = new Date();
  }

  canEdit(userId: string): boolean {
    return this.senderId === userId && !this.isDeleted;
  }

  canDelete(userId: string): boolean {
    return this.senderId === userId && !this.isDeleted;
  }

  // Métodos para gerenciar status da mensagem
  markAsDelivered(): void {
    if (this.status === 'sent') {
      this.status = 'delivered';
      this.updatedAt = new Date();
    }
  }

  markAsRead(): void {
    if (this.status === 'delivered' || this.status === 'sent') {
      this.status = 'read';
      this.updatedAt = new Date();
    }
  }

  getStatusIcon(): string {
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

  getStatusColor(): string {
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
