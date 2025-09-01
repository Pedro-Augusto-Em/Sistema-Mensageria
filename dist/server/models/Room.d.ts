export interface IRoom {
    id: string;
    name: string;
    description?: string;
    type: 'direct' | 'group' | 'channel';
    avatar?: string;
    createdBy: string;
    members: string[];
    admins: string[];
    isPrivate: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface IRoomCreate {
    name: string;
    description?: string;
    type: 'direct' | 'group' | 'channel';
    avatar?: string;
    createdBy: string;
    members: string[];
    admins?: string[];
    isPrivate?: boolean;
}
export interface IRoomUpdate {
    name?: string;
    description?: string;
    avatar?: string;
    isPrivate?: boolean;
}
export interface IRoomWithMembers {
    id: string;
    name: string;
    description?: string;
    type: 'direct' | 'group' | 'channel';
    avatar?: string;
    createdBy: string;
    members: Array<{
        id: string;
        username: string;
        nickname: string;
        avatar?: string;
        status: 'online' | 'offline' | 'away';
    }>;
    admins: string[];
    isPrivate: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class Room implements IRoom {
    id: string;
    name: string;
    description?: string;
    type: 'direct' | 'group' | 'channel';
    avatar?: string;
    createdBy: string;
    members: string[];
    admins: string[];
    isPrivate: boolean;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: IRoom);
    static validateCreate(data: IRoomCreate): {
        isValid: boolean;
        errors: string[];
    };
    static validateUpdate(data: IRoomUpdate): {
        isValid: boolean;
        errors: string[];
    };
    addMember(userId: string): boolean;
    removeMember(userId: string): boolean;
    addAdmin(userId: string): boolean;
    removeAdmin(userId: string): boolean;
    isMember(userId: string): boolean;
    isAdmin(userId: string): boolean;
    canManage(userId: string): boolean;
    isDirectMessage(): boolean;
    getOtherMember(userId: string): string | null;
}
//# sourceMappingURL=Room.d.ts.map