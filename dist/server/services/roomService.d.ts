import { Room, IRoom, IRoomCreate, IRoomUpdate, IRoomWithMembers } from '../models/Room';
export declare class RoomService {
    private db;
    createRoom(roomData: IRoomCreate): Promise<IRoom>;
    getRoomById(id: string): Promise<Room | null>;
    getRoomWithMembers(id: string): Promise<IRoomWithMembers | null>;
    getRoomsByUser(userId: string): Promise<Room[]>;
    getDirectMessageRoom(userId1: string, userId2: string): Promise<Room | null>;
    createDirectMessage(userId1: string, userId2: string): Promise<Room>;
    updateRoom(id: string, updateData: IRoomUpdate, userId: string): Promise<Room | null>;
    addMember(roomId: string, userId: string, adminUserId: string): Promise<boolean>;
    removeMember(roomId: string, userId: string, adminUserId: string): Promise<boolean>;
    addAdmin(roomId: string, userId: string, adminUserId: string): Promise<boolean>;
    removeAdmin(roomId: string, userId: string, adminUserId: string): Promise<boolean>;
    deleteRoom(roomId: string, userId: string): Promise<boolean>;
    searchRooms(query: string, userId: string): Promise<IRoom[]>;
    getPublicRooms(): Promise<IRoom[]>;
}
//# sourceMappingURL=roomService.d.ts.map