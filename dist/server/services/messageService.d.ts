import { IMessage, IMessageCreate, IMessageUpdate, IMessageWithSender } from '../models/Message';
export declare class MessageService {
    private db;
    private emojiService;
    createMessage(messageData: IMessageCreate): Promise<IMessage>;
    getMessageById(id: string): Promise<IMessage | null>;
    getMessagesByRoom(roomId: string, limit?: number, offset?: number): Promise<IMessageWithSender[]>;
    getMessageWithSender(id: string): Promise<IMessageWithSender | null>;
    updateMessage(id: string, updateData: IMessageUpdate, userId: string): Promise<IMessage | null>;
    editMessage(id: string, newContent: string, userId: string): Promise<IMessage | null>;
    deleteMessage(id: string, userId: string): Promise<boolean>;
    searchMessages(query: string, roomId: string, limit?: number): Promise<IMessageWithSender[]>;
    getMessageCount(roomId: string): Promise<number>;
    getLastMessage(roomId: string): Promise<IMessageWithSender | null>;
    getMessagesByUser(userId: string, limit?: number): Promise<IMessageWithSender[]>;
    getUnreadMessageCount(roomId: string, lastReadTimestamp: Date): Promise<number>;
    markRoomAsRead(roomId: string, userId: string): Promise<boolean>;
    getLastReadTimestamp(roomId: string, userId: string): Promise<Date | null>;
    markMessageAsDelivered(messageId: string): Promise<boolean>;
    markMessageAsRead(messageId: string): Promise<boolean>;
    markAllMessagesAsRead(roomId: string, userId: string): Promise<boolean>;
}
//# sourceMappingURL=messageService.d.ts.map