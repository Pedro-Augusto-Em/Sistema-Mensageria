import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { Room, IRoom, IRoomCreate, IRoomUpdate, IRoomWithMembers } from '../models/Room';

export class RoomService {
  private db = getDatabase();

  async createRoom(roomData: IRoomCreate): Promise<IRoom> {
    const validation = Room.validateCreate(roomData);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }

    const room: IRoom = {
      id: uuidv4(),
      name: roomData.name,
      description: roomData.description,
      type: roomData.type,
      avatar: roomData.avatar,
      createdBy: roomData.createdBy,
      members: roomData.members,
      admins: roomData.admins || [roomData.createdBy], // Criador é admin por padrão
      isPrivate: roomData.isPrivate || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.run(
      `INSERT INTO rooms (id, name, description, type, avatar, createdBy, members, admins, isPrivate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room.id, room.name, room.description, room.type, room.avatar,
        room.createdBy, JSON.stringify(room.members), JSON.stringify(room.admins),
        room.isPrivate, room.createdAt.toISOString(), room.updatedAt.toISOString()
      ]
    );

    return room;
  }

  async getRoomById(id: string): Promise<Room | null> {
    const roomData = await this.db.get('SELECT * FROM rooms WHERE id = ?', [id]);
    if (!roomData) return null;

    const room = {
      ...roomData,
      members: JSON.parse(roomData.members),
      admins: JSON.parse(roomData.admins),
      createdAt: new Date(roomData.createdAt),
      updatedAt: new Date(roomData.updatedAt)
    };

    // Retornar instância da classe Room para ter acesso aos métodos
    return new Room(room);
  }

  async getRoomWithMembers(id: string): Promise<IRoomWithMembers | null> {
    const roomData = await this.db.get('SELECT * FROM rooms WHERE id = ?', [id]);
    if (!roomData) return null;

    const members = JSON.parse(roomData.members);
    const admins = JSON.parse(roomData.admins);

    // Buscar informações dos membros
    const memberUsers = await Promise.all(
      members.map(async (memberId: string) => {
        const userData = await this.db.get(
          'SELECT id, username, nickname, avatar, status FROM users WHERE id = ?',
          [memberId]
        );
        return userData ? {
          id: userData.id,
          username: userData.username,
          nickname: userData.nickname,
          avatar: userData.avatar,
          status: userData.status
        } : null;
      })
    );

    const validMembers = memberUsers.filter(member => member !== null);

    return {
      ...roomData,
      members: validMembers,
      admins,
      createdAt: new Date(roomData.createdAt),
      updatedAt: new Date(roomData.updatedAt)
    };
  }

  async getRoomsByUser(userId: string): Promise<Room[]> {
    const rooms = await this.db.all(
      'SELECT * FROM rooms WHERE json_extract(members, "$") LIKE ? ORDER BY updatedAt DESC',
      [`%${userId}%`]
    );

    return rooms.map(room => {
      const roomData = {
        ...room,
        members: JSON.parse(room.members),
        admins: JSON.parse(room.admins),
        createdAt: new Date(room.createdAt),
        updatedAt: new Date(room.updatedAt)
      };
      return new Room(roomData);
    });
  }

  async getDirectMessageRoom(userId1: string, userId2: string): Promise<Room | null> {
    const rooms = await this.db.all(
      `SELECT * FROM rooms 
       WHERE type = 'direct' 
       AND json_extract(members, "$") LIKE ? 
       AND json_extract(members, "$") LIKE ?`,
      [`%${userId1}%`, `%${userId2}%`]
    );

    if (rooms.length === 0) return null;

    const room = rooms[0];
    const roomData = {
      ...room,
      members: JSON.parse(room.members),
      admins: JSON.parse(room.admins),
      createdAt: new Date(room.createdAt),
      updatedAt: new Date(room.updatedAt)
    };
    return new Room(roomData);
  }

  async createDirectMessage(userId1: string, userId2: string): Promise<Room> {
    // Verificar se já existe uma conversa direta
    const existingRoom = await this.getDirectMessageRoom(userId1, userId2);
    if (existingRoom) {
      return existingRoom;
    }

    // Buscar nomes dos usuários para criar o nome da sala
    const user1 = await this.db.get('SELECT username FROM users WHERE id = ?', [userId1]);
    const user2 = await this.db.get('SELECT username FROM users WHERE id = ?', [userId2]);

    if (!user1 || !user2) {
      throw new Error('Usuário não encontrado');
    }

    const roomData: IRoomCreate = {
      name: `${user1.username} & ${user2.username}`,
      type: 'direct',
      createdBy: userId1,
      members: [userId1, userId2],
      isPrivate: true
    };

    const room = await this.createRoom(roomData);
    return new Room(room);
  }

  async updateRoom(id: string, updateData: IRoomUpdate, userId: string): Promise<Room | null> {
    const room = await this.getRoomById(id);
    if (!room) {
      throw new Error('Sala não encontrada');
    }

    if (!room.canManage(userId)) {
      throw new Error('Você não tem permissão para gerenciar esta sala');
    }

    const validation = Room.validateUpdate(updateData);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updateData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updateData.name);
    }

    if (updateData.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(updateData.description);
    }

    if (updateData.avatar !== undefined) {
      updateFields.push('avatar = ?');
      updateValues.push(updateData.avatar);
    }

    if (updateData.isPrivate !== undefined) {
      updateFields.push('isPrivate = ?');
      updateValues.push(updateData.isPrivate);
    }

    if (updateFields.length === 0) {
      return room;
    }

    updateFields.push('updatedAt = ?');
    updateValues.push(new Date().toISOString());
    updateValues.push(id);

    const updateQuery = `UPDATE rooms SET ${updateFields.join(', ')} WHERE id = ?`;
    await this.db.run(updateQuery, updateValues);

    return await this.getRoomById(id);
  }

  async addMember(roomId: string, userId: string, adminUserId: string): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Sala não encontrada');
    }

    if (!room.canManage(adminUserId)) {
      throw new Error('Você não tem permissão para adicionar membros');
    }

    if (room.isMember(userId)) {
      return false; // Usuário já é membro
    }

    const newMembers = [...room.members, userId];
    await this.db.run(
      'UPDATE rooms SET members = ?, updatedAt = ? WHERE id = ?',
      [JSON.stringify(newMembers), new Date().toISOString(), roomId]
    );

    return true;
  }

  async removeMember(roomId: string, userId: string, adminUserId: string): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Sala não encontrada');
    }

    if (!room.canManage(adminUserId)) {
      throw new Error('Você não tem permissão para remover membros');
    }

    if (room.createdBy === userId) {
      throw new Error('Não é possível remover o criador da sala');
    }

    if (!room.isMember(userId)) {
      return false; // Usuário não é membro
    }

    const newMembers = room.members.filter(member => member !== userId);
    const newAdmins = room.admins.filter(admin => admin !== userId);

    await this.db.run(
      'UPDATE rooms SET members = ?, admins = ?, updatedAt = ? WHERE id = ?',
      [JSON.stringify(newMembers), JSON.stringify(newAdmins), new Date().toISOString(), roomId]
    );

    return true;
  }

  async addAdmin(roomId: string, userId: string, adminUserId: string): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Sala não encontrada');
    }

    if (!room.canManage(adminUserId)) {
      throw new Error('Você não tem permissão para gerenciar administradores');
    }

    if (!room.isMember(userId)) {
      throw new Error('Usuário deve ser membro da sala para ser administrador');
    }

    if (room.isAdmin(userId)) {
      return false; // Usuário já é admin
    }

    const newAdmins = [...room.admins, userId];
    await this.db.run(
      'UPDATE rooms SET admins = ?, updatedAt = ? WHERE id = ?',
      [JSON.stringify(newAdmins), new Date().toISOString(), roomId]
    );

    return true;
  }

  async removeAdmin(roomId: string, userId: string, adminUserId: string): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Sala não encontrada');
    }

    if (!room.canManage(adminUserId)) {
      throw new Error('Você não tem permissão para gerenciar administradores');
    }

    if (room.createdBy === userId) {
      throw new Error('Não é possível remover o criador da sala como administrador');
    }

    if (!room.isAdmin(userId)) {
      return false; // Usuário não é admin
    }

    const newAdmins = room.admins.filter(admin => admin !== userId);
    await this.db.run(
      'UPDATE rooms SET admins = ?, updatedAt = ? WHERE id = ?',
      [JSON.stringify(newAdmins), new Date().toISOString(), roomId]
    );

    return true;
  }

  async deleteRoom(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new Error('Sala não encontrada');
    }

    // Verificar permissões baseado no tipo de sala
    if (room.type === 'direct') {
      // Para conversas diretas, qualquer membro pode deletar
      if (!room.members.includes(userId)) {
        throw new Error('Você não é membro desta conversa');
      }
    } else {
      // Para grupos, apenas o criador pode deletar
      if (room.createdBy !== userId) {
        throw new Error('Apenas o criador pode deletar o grupo');
      }
    }

    const result = await this.db.run('DELETE FROM rooms WHERE id = ?', [roomId]);
    return result.changes > 0;
  }

  async searchRooms(query: string, userId: string): Promise<IRoom[]> {
    const searchQuery = `%${query}%`;
    const rooms = await this.db.all(
      `SELECT * FROM rooms 
       WHERE (name LIKE ? OR description LIKE ?) 
       AND json_extract(members, "$") LIKE ?
       AND isPrivate = 0
       ORDER BY name`,
      [searchQuery, searchQuery, `%${userId}%`]
    );

    return rooms.map(room => {
      const roomData = {
        ...room,
        members: JSON.parse(room.members),
        admins: JSON.parse(room.admins),
        createdAt: new Date(room.createdAt),
        updatedAt: new Date(room.updatedAt)
      };
      return new Room(roomData);
    });
  }

  async getPublicRooms(): Promise<IRoom[]> {
    const rooms = await this.db.all(
      'SELECT * FROM rooms WHERE isPrivate = 0 ORDER BY name'
    );

    return rooms.map(room => {
      const roomData = {
        ...room,
        members: JSON.parse(room.members),
        admins: JSON.parse(room.admins),
        createdAt: new Date(room.createdAt),
        updatedAt: new Date(room.updatedAt)
      };
      return new Room(roomData);
    });
  }
}
