import { User, IUserCreate, IUserUpdate, IUserPublic } from '../models/User';
export declare class UserService {
    private db;
    createUser(userData: IUserCreate): Promise<User>;
    getUserById(id: string): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    getAllUsers(): Promise<IUserPublic[]>;
    getBasicUsersList(): Promise<Array<{
        id: string;
        username: string;
        nickname: string;
        avatar?: string;
    }>>;
    searchUsers(query: string, currentUserId: string): Promise<IUserPublic[]>;
    updateUser(id: string, updateData: IUserUpdate): Promise<User | null>;
    updateUserStatus(id: string, status: 'online' | 'offline' | 'away'): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean>;
    deleteUser(id: string): Promise<boolean>;
    authenticateUser(username: string, password: string): Promise<User | null>;
    getUsersByStatus(status: 'online' | 'offline' | 'away'): Promise<IUserPublic[]>;
    getOnlineUsers(): Promise<IUserPublic[]>;
}
//# sourceMappingURL=userService.d.ts.map