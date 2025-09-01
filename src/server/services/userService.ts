import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { User, IUser, IUserCreate, IUserUpdate, IUserPublic } from '../models/User';

export class UserService {
  private db = getDatabase();

  async createUser(userData: IUserCreate): Promise<User> {
    const validation = User.validateCreate(userData);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }

    // Verificar se username já existe
    const existingUser = await this.db.get(
      'SELECT id FROM users WHERE username = ?',
      [userData.username]
    );

    if (existingUser) {
      throw new Error('Username já existe');
    }

    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    const user: IUser = {
      id: uuidv4(),
      username: userData.username,
      password: hashedPassword,
      nickname: userData.nickname,
      avatar: userData.avatar,
      status: 'offline',
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.run(
      `INSERT INTO users (id, username, password, nickname, avatar, status, lastSeen, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id, user.username, user.password, user.nickname,
        user.avatar, user.status, user.lastSeen.toISOString(),
        user.createdAt.toISOString(), user.updatedAt.toISOString()
      ]
    );

    return new User(user);
  }

  async getUserById(id: string): Promise<User | null> {
    const userData = await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
    return userData ? new User(userData) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const userData = await this.db.get('SELECT * FROM users WHERE username = ?', [username]);
    return userData ? new User(userData) : null;
  }



  async getAllUsers(): Promise<IUserPublic[]> {
    const users = await this.db.all('SELECT * FROM users ORDER BY username');
    return users.map(user => new User(user).toPublic());
  }

  async getBasicUsersList(): Promise<Array<{ id: string; username: string; nickname: string; avatar?: string }>> {
    const users = await this.db.all('SELECT id, username, nickname, avatar FROM users ORDER BY username');
    return users.map(user => ({
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar
    }));
  }

  async searchUsers(query: string, currentUserId: string): Promise<IUserPublic[]> {
    const searchQuery = `%${query}%`;
    const users = await this.db.all(
      `SELECT * FROM users 
       WHERE (username LIKE ? OR nickname LIKE ?) AND id != ?
       ORDER BY username`,
      [searchQuery, searchQuery, currentUserId]
    );
    return users.map(user => new User(user).toPublic());
  }

  async updateUser(id: string, updateData: IUserUpdate): Promise<User | null> {
    const validation = User.validateUpdate(updateData);
    if (!validation.isValid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }

    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar se username já existe (se estiver sendo alterado)
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.db.get(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [updateData.username, id]
      );
      if (existingUser) {
        throw new Error('Username já existe');
      }
    }

    // Construir query de atualização dinamicamente
    const updateFields: string[] = [];
    const updateValues: any[] = [];

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

  async updateUserStatus(id: string, status: 'online' | 'offline' | 'away'): Promise<void> {
    await this.db.run(
      'UPDATE users SET status = ?, lastSeen = ?, updatedAt = ? WHERE id = ?',
      [status, new Date().toISOString(), new Date().toISOString(), id]
    );
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Senha atual incorreta');
    }

    // Hash da nova senha
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha
    await this.db.run(
      'UPDATE users SET password = ?, updatedAt = ? WHERE id = ?',
      [hashedNewPassword, new Date().toISOString(), userId]
    );

    return true;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM users WHERE id = ?', [id]);
    return result.changes > 0;
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Atualizar status para online
    await this.updateUserStatus(user.id, 'online');

    return user;
  }



  async getUsersByStatus(status: 'online' | 'offline' | 'away'): Promise<IUserPublic[]> {
    const users = await this.db.all(
      'SELECT * FROM users WHERE status = ? ORDER BY username',
      [status]
    );
    return users.map(user => new User(user).toPublic());
  }

  async getOnlineUsers(): Promise<IUserPublic[]> {
    return this.getUsersByStatus('online');
  }
}
