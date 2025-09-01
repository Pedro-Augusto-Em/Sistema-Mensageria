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
export declare class User implements IUser {
    id: string;
    username: string;
    password: string;
    nickname: string;
    avatar?: string;
    status: 'online' | 'offline' | 'away';
    lastSeen: Date;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: IUser);
    static validateCreate(data: IUserCreate): {
        isValid: boolean;
        errors: string[];
    };
    static validateUpdate(data: IUserUpdate): {
        isValid: boolean;
        errors: string[];
    };
    toPublic(): IUserPublic;
    updateStatus(status: 'online' | 'offline' | 'away'): void;
}
//# sourceMappingURL=User.d.ts.map