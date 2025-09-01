import { Emoji } from '../models/Emoji';
export declare class EmojiService {
    private db;
    createEmoji(name: string, url: string, uploadedBy: string): Promise<Emoji>;
    getEmojiById(id: string): Promise<Emoji | null>;
    getEmojiByName(name: string): Promise<Emoji | null>;
    getAllEmojis(): Promise<Emoji[]>;
    getEmojisByUser(userId: string): Promise<Emoji[]>;
    updateEmoji(id: string, name?: string, url?: string): Promise<Emoji | null>;
    deleteEmoji(id: string): Promise<boolean>;
    searchEmojis(query: string): Promise<Emoji[]>;
    parseEmojis(text: string): Promise<string>;
    extractEmojiNames(text: string): string[];
}
//# sourceMappingURL=emojiService.d.ts.map