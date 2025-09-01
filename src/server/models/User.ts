export interface IUser {
  id: string;
  username: string;
  password: string;
  nickname: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserCreate {
  username: string;
  password: string;
  nickname: string;
  avatar?: string;
}

export interface IUserUpdate {
  username?: string;
  nickname?: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'away';
}

export interface IUserPublic {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
}

export class User implements IUser {
  id: string;
  username: string;
  password: string;
  nickname: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: IUser) {
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

  static validateCreate(data: IUserCreate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

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

  static validateUpdate(data: IUserUpdate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

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



  toPublic(): IUserPublic {
    return {
      id: this.id,
      username: this.username,
      nickname: this.nickname,
      avatar: this.avatar,
      status: this.status,
      lastSeen: this.lastSeen
    };
  }

  updateStatus(status: 'online' | 'offline' | 'away'): void {
    this.status = status;
    this.lastSeen = new Date();
    this.updatedAt = new Date();
  }
}
