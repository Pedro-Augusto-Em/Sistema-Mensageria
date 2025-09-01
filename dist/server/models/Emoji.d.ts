export interface IEmoji {
    id: string;
    name: string;
    url: string;
    uploadedBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class Emoji implements IEmoji {
    id: string;
    name: string;
    url: string;
    uploadedBy: string;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: IEmoji);
    static fromDatabase(data: any): Emoji;
    toJSON(): IEmoji;
}
//# sourceMappingURL=Emoji.d.ts.map