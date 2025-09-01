import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { Message, IMessage, IMessageCreate, IMessageUpdate, IMessageWithSender } from '../models/Message';
import { EmojiService } from './emojiService';

export class MessageService {
  private db = getDatabase();
  private emojiService = new EmojiService();

  async createMessage(messageData: IMessageCreate): Promise<IMessage> {
    console.log('Criando mensagem no serviço:', messageData);
    
    const validation = Message.validateCreate(messageData);
    if (!validation.isValid) {
      console.error('Validação falhou:', validation.errors);
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }

    // Parsear emojis customizados no conteúdo
    const parsedContent = await this.emojiService.parseEmojis(messageData.content);

    const message: IMessage = {
      id: uuidv4(),
      content: parsedContent,
      type: messageData.type,
      roomId: messageData.roomId,
      senderId: messageData.senderId,
      replyToId: messageData.replyToId,
      isEdited: false,
      isDeleted: false,
      status: 'sent',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Mensagem criada:', message);

    await this.db.run(
      `INSERT INTO messages (id, content, type, roomId, senderId, replyToId, isEdited, isDeleted, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id, message.content, message.type, message.roomId, message.senderId,
        message.replyToId, message.isEdited, message.isDeleted, message.status,
        message.createdAt.toISOString(), message.updatedAt.toISOString()
      ]
    );

    console.log('Mensagem salva no banco com sucesso');
    return message;
  }

  async getMessageById(id: string): Promise<IMessage | null> {
    const messageData = await this.db.get('SELECT * FROM messages WHERE id = ?', [id]);
    return messageData ? new Message(messageData) : null;
  }

  async getMessagesByRoom(roomId: string, limit: number = 50, offset: number = 0): Promise<IMessageWithSender[]> {
    console.log('Buscando mensagens da sala:', { roomId, limit, offset });
    
    const messages = await this.db.all(
      `SELECT m.*, u.username, u.nickname, u.avatar
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE m.roomId = ? AND m.isDeleted = 0
       ORDER BY m.createdAt DESC
       LIMIT ? OFFSET ?`,
      [roomId, limit, offset]
    );
    
    console.log('Mensagens encontradas no banco:', messages.length);

    // Buscar mensagens de resposta
    const messagesWithReplies = await Promise.all(
      messages.map(async (msg, index) => {
        console.log(`Processando mensagem ${index + 1}/${messages.length}:`, {
          id: msg.id,
          type: msg.type,
          content: msg.content?.substring(0, 50) + '...',
          senderId: msg.senderId,
          roomId: msg.roomId,
          username: msg.username,
          nickname: msg.nickname,
          avatar: msg.avatar
        });
        
        let replyTo = null;
        if (msg.replyToId) {
          const replyData = await this.db.get(
            `SELECT m.id, m.content, u.username
             FROM messages m
             JOIN users u ON m.senderId = u.id
             WHERE m.id = ?`,
            [msg.replyToId]
          );
          if (replyData) {
            replyTo = {
              id: replyData.id,
              content: replyData.content,
              sender: { username: replyData.username }
            };
          }
        }

        const processedMessage = {
          ...msg,
          sender: {
            id: msg.senderId,
            username: msg.username,
            nickname: msg.nickname,
            avatar: msg.avatar
          },
          replyTo,
          createdAt: new Date(msg.createdAt),
          updatedAt: new Date(msg.updatedAt)
        };
        
        console.log(`Mensagem ${index + 1} processada:`, {
          id: processedMessage.id,
          type: processedMessage.type,
          sender: processedMessage.sender,
          senderId: processedMessage.senderId,
          username: processedMessage.username,
          nickname: processedMessage.nickname,
          fullMessage: processedMessage
        });
        
        // Verificar se a estrutura está correta
        if (!processedMessage.sender || !processedMessage.sender.nickname) {
          console.warn(`Mensagem ${index + 1} sem estrutura sender correta:`, processedMessage);
        }
        
        // Log adicional para debug
        console.log(`Estrutura sender da mensagem ${index + 1}:`, {
          hasSender: !!processedMessage.sender,
          senderType: typeof processedMessage.sender,
          senderKeys: processedMessage.sender ? Object.keys(processedMessage.sender) : 'N/A',
          nickname: processedMessage.sender?.nickname,
          username: processedMessage.sender?.username
        });
        
        // Log adicional para debug da estrutura completa
        console.log(`Estrutura completa da mensagem ${index + 1}:`, {
          id: processedMessage.id,
          senderId: processedMessage.senderId,
          sender: processedMessage.sender,
          username: processedMessage.username,
          nickname: processedMessage.nickname,
          avatar: processedMessage.avatar
        });
        
        return processedMessage;
      })
    );

    console.log('Mensagens processadas com respostas:', messagesWithReplies.length);
    return messagesWithReplies.reverse(); // Ordem cronológica
  }

  async getMessageWithSender(id: string): Promise<IMessageWithSender | null> {
    console.log('Buscando mensagem com remetente:', id);
    
    const messageData = await this.db.get(
      `SELECT m.*, u.username, u.nickname, u.avatar
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE m.id = ?`,
      [id]
    );

    console.log('Dados da mensagem encontrada:', messageData);

    if (!messageData) return null;

    let replyTo = null;
    if (messageData.replyToId) {
      const replyData = await this.db.get(
        `SELECT m.id, m.content, u.username
         FROM messages m
         JOIN users u ON m.senderId = u.id
         WHERE m.id = ?`,
        [messageData.replyToId]
      );
      if (replyData) {
        replyTo = {
          id: replyData.id,
          content: replyData.content,
          sender: { username: replyData.username }
        };
      }
    }

    return {
      ...messageData,
      sender: {
        id: messageData.senderId,
        username: messageData.username,
        nickname: messageData.nickname,
        avatar: messageData.avatar
      },
      replyTo,
      createdAt: new Date(messageData.createdAt),
      updatedAt: new Date(messageData.updatedAt)
    };
  }

  async updateMessage(id: string, updateData: IMessageUpdate, userId: string): Promise<IMessage | null> {
    const message = await this.getMessageById(id);
    if (!message) {
      throw new Error('Mensagem não encontrada');
    }

    // message é uma instância da classe Message, então tem os métodos canEdit e canDelete
    if (!(message as any).canEdit(userId)) {
      throw new Error('Você não pode editar esta mensagem');
    }

    const validation = Message.validateUpdate(updateData);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updateData.content !== undefined) {
      updateFields.push('content = ?');
      updateValues.push(updateData.content);
    }

    if (updateData.isEdited !== undefined) {
      updateFields.push('isEdited = ?');
      updateValues.push(updateData.isEdited);
    }

    if (updateData.isDeleted !== undefined) {
      updateFields.push('isDeleted = ?');
      updateValues.push(updateData.isDeleted);
    }

    if (updateFields.length === 0) {
      return message;
    }

    updateFields.push('updatedAt = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    const updateQuery = `UPDATE messages SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.run(updateQuery, updateValues);

    return await this.getMessageById(id);
  }

  async editMessage(id: string, newContent: string, userId: string): Promise<IMessage | null> {
    return this.updateMessage(id, { content: newContent, isEdited: true }, userId);
  }

  async deleteMessage(id: string, userId: string): Promise<boolean> {
    const message = await this.getMessageById(id);
    if (!message) {
      throw new Error('Mensagem não encontrada');
    }

    // message é uma instância da classe Message, então tem os métodos canEdit e canDelete
    if (!(message as any).canDelete(userId)) {
      throw new Error('Você não pode deletar esta mensagem');
    }

    const result = await this.db.run(
      'UPDATE messages SET isDeleted = 1, updatedAt = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );

    return result.changes > 0;
  }

  async searchMessages(query: string, roomId: string, limit: number = 20): Promise<IMessageWithSender[]> {
    const searchQuery = `%${query}%`;
    const messages = await this.db.all(
      `SELECT m.*, u.username, u.nickname, u.avatar
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE m.roomId = ? AND m.isDeleted = 0 AND m.content LIKE ?
       ORDER BY m.createdAt DESC
       LIMIT ?`,
      [roomId, searchQuery, limit]
    );

    return messages.map(msg => ({
      ...msg,
      createdAt: new Date(msg.createdAt),
      updatedAt: new Date(msg.updatedAt)
    }));
  }

  async getMessageCount(roomId: string): Promise<number> {
    const result = await this.db.get(
      'SELECT COUNT(*) as count FROM messages WHERE roomId = ? AND isDeleted = 0',
      [roomId]
    );
    return result?.count || 0;
  }

  async getLastMessage(roomId: string): Promise<IMessageWithSender | null> {
    const messageData = await this.db.get(
      `SELECT m.*, u.username, u.nickname, u.avatar
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE m.roomId = ? AND m.isDeleted = 0
       ORDER BY m.createdAt DESC
       LIMIT 1`,
      [roomId]
    );

    if (!messageData) return null;

    return {
      ...messageData,
      sender: {
        id: messageData.senderId,
        username: messageData.username,
        nickname: messageData.nickname,
        avatar: messageData.avatar
      },
      createdAt: new Date(messageData.createdAt),
      updatedAt: new Date(messageData.updatedAt)
    };
  }

  async getMessagesByUser(userId: string, limit: number = 50): Promise<IMessageWithSender[]> {
    const messages = await this.db.all(
      `SELECT m.*, u.username, u.nickname, u.avatar
       FROM messages m
       JOIN users u ON m.senderId = u.id
       WHERE m.senderId = ? AND m.isDeleted = 0
       ORDER BY m.createdAt DESC
       LIMIT ?`,
      [userId, limit]
    );

    return messages.map(msg => ({
      ...msg,
      createdAt: new Date(msg.createdAt),
      updatedAt: new Date(msg.updatedAt)
    }));
  }

  async getUnreadMessageCount(roomId: string, lastReadTimestamp: Date): Promise<number> {
    const result = await this.db.get(
      'SELECT COUNT(*) as count FROM messages WHERE roomId = ? AND isDeleted = 0 AND createdAt > ?',
      [roomId, lastReadTimestamp.toISOString()]
    );
    return result?.count || 0;
  }

  // Marcar mensagens de uma sala como lidas por um usuário
  async markRoomAsRead(roomId: string, userId: string): Promise<boolean> {
    try {
      // Atualizar o timestamp da última leitura do usuário na sala
      const result = await this.db.run(
        `INSERT OR REPLACE INTO user_room_reads (userId, roomId, lastReadAt, updatedAt) 
         VALUES (?, ?, ?, ?)`,
        [userId, roomId, new Date().toISOString(), new Date().toISOString()]
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Erro ao marcar sala como lida:', error);
      return false;
    }
  }

  // Obter timestamp da última leitura de um usuário em uma sala
  async getLastReadTimestamp(roomId: string, userId: string): Promise<Date | null> {
    try {
      const result = await this.db.get(
        'SELECT lastReadAt FROM user_room_reads WHERE roomId = ? AND userId = ?',
        [roomId, userId]
      );
      
      return result ? new Date(result.lastReadAt) : null;
    } catch (error) {
      console.error('Erro ao obter timestamp da última leitura:', error);
      return null;
    }
  }

  // Marcar mensagem como entregue
  async markMessageAsDelivered(messageId: string): Promise<boolean> {
    try {
      const result = await this.db.run(
        'UPDATE messages SET status = ?, updatedAt = ? WHERE id = ? AND status = ?',
        ['delivered', new Date().toISOString(), messageId, 'sent']
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Erro ao marcar mensagem como entregue:', error);
      return false;
    }
  }

  // Marcar mensagem como lida
  async markMessageAsRead(messageId: string): Promise<boolean> {
    try {
      const result = await this.db.run(
        'UPDATE messages SET status = ?, updatedAt = ? WHERE id = ? AND status IN (?, ?)',
        ['read', new Date().toISOString(), messageId, 'sent', 'delivered']
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
      return false;
    }
  }

  // Marcar todas as mensagens de uma sala como lidas por um usuário
  async markAllMessagesAsRead(roomId: string, userId: string): Promise<boolean> {
    try {
      console.log('Tentando marcar mensagens como lidas:', { roomId, userId });
      
      // Primeiro, verificar se a tabela messages tem a coluna status
      const tableInfo = await this.db.all("PRAGMA table_info(messages)");
      console.log('Estrutura da tabela messages:', tableInfo);
      
      // Verificar se há mensagens na sala
      const messageCount = await this.db.get(
        'SELECT COUNT(*) as count FROM messages WHERE roomId = ?',
        [roomId]
      );
      console.log('Total de mensagens na sala:', messageCount?.count || 0);
      
      // Verificar mensagens com status específicos
      const statusCount = await this.db.get(
        'SELECT COUNT(*) as count FROM messages WHERE roomId = ? AND senderId != ? AND status IN (?, ?)',
        [roomId, userId, 'sent', 'delivered']
      );
      console.log('Mensagens que podem ser marcadas como lidas:', statusCount?.count || 0);
      
      // Executar a atualização
      const result = await this.db.run(
        `UPDATE messages 
         SET status = ?, updatedAt = ? 
         WHERE roomId = ? AND senderId != ? AND status IN (?, ?)`,
        ['read', new Date().toISOString(), roomId, userId, 'sent', 'delivered']
      );
      
      console.log('Resultado da atualização:', result);
      return result.changes > 0;
    } catch (error: any) {
      console.error('Erro detalhado ao marcar mensagens como lidas:', error);
      console.error('Stack trace:', error.stack);
      return false;
    }
  }

}
