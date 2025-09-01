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
export declare class Message implements IMessage {
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
    constructor(data: IMessage);
    static validateCreate(data: IMessageCreate): {
        isValid: boolean;
        errors: string[];
    };
    static validateUpdate(data: IMessageUpdate): {
        isValid: boolean;
        errors: string[];
    };
    edit(newContent: string): void;
    delete(): void;
    canEdit(userId: string): boolean;
    canDelete(userId: string): boolean;
    markAsDelivered(): void;
    markAsRead(): void;
    getStatusIcon(): string;
    getStatusColor(): string;
}
//# sourceMappingURL=Message.d.ts.map