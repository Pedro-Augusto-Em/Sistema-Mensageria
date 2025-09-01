"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmojiService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("./database");
const Emoji_1 = require("../models/Emoji");
class EmojiService {
    constructor() {
        this.db = (0, database_1.getDatabase)();
    }
    async createEmoji(name, url, uploadedBy) {
        // Verificar se o nome já existe
        const existingEmoji = await this.getEmojiByName(name);
        if (existingEmoji) {
            throw new Error('Já existe um emoji com este nome');
        }
        // Validar nome do emoji (apenas letras, números e underscore)
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            throw new Error('Nome do emoji deve conter apenas letras, números e underscore');
        }
        if (name.length < 2 || name.length > 20) {
            throw new Error('Nome do emoji deve ter entre 2 e 20 caracteres');
        }
        const id = (0, uuid_1.v4)();
        const now = new Date();
        await this.db.run(`INSERT INTO custom_emojis (id, name, url, uploadedBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`, [id, name, url, uploadedBy, now.toISOString(), now.toISOString()]);
        return new Emoji_1.Emoji({
            id,
            name,
            url,
            uploadedBy,
            createdAt: now,
            updatedAt: now
        });
    }
    async getEmojiById(id) {
        const emojiData = await this.db.get('SELECT * FROM custom_emojis WHERE id = ?', [id]);
        return emojiData ? Emoji_1.Emoji.fromDatabase(emojiData) : null;
    }
    async getEmojiByName(name) {
        const emojiData = await this.db.get('SELECT * FROM custom_emojis WHERE name = ?', [name]);
        return emojiData ? Emoji_1.Emoji.fromDatabase(emojiData) : null;
    }
    async getAllEmojis() {
        const emojisData = await this.db.all('SELECT * FROM custom_emojis ORDER BY name ASC');
        return emojisData.map(data => Emoji_1.Emoji.fromDatabase(data));
    }
    async getEmojisByUser(userId) {
        const emojisData = await this.db.all('SELECT * FROM custom_emojis WHERE uploadedBy = ? ORDER BY name ASC', [userId]);
        return emojisData.map(data => Emoji_1.Emoji.fromDatabase(data));
    }
    async updateEmoji(id, name, url) {
        const emoji = await this.getEmojiById(id);
        if (!emoji) {
            return null;
        }
        const updates = [];
        const params = [];
        if (name !== undefined) {
            // Verificar se o novo nome já existe (exceto para o próprio emoji)
            const existingEmoji = await this.getEmojiByName(name);
            if (existingEmoji && existingEmoji.id !== id) {
                throw new Error('Já existe um emoji com este nome');
            }
            if (!/^[a-zA-Z0-9_]+$/.test(name)) {
                throw new Error('Nome do emoji deve conter apenas letras, números e underscore');
            }
            if (name.length < 2 || name.length > 20) {
                throw new Error('Nome do emoji deve ter entre 2 e 20 caracteres');
            }
            updates.push('name = ?');
            params.push(name);
        }
        if (url !== undefined) {
            updates.push('url = ?');
            params.push(url);
        }
        if (updates.length === 0) {
            return emoji;
        }
        updates.push('updatedAt = ?');
        params.push(new Date().toISOString());
        params.push(id);
        await this.db.run(`UPDATE custom_emojis SET ${updates.join(', ')} WHERE id = ?`, params);
        return await this.getEmojiById(id);
    }
    async deleteEmoji(id) {
        const result = await this.db.run('DELETE FROM custom_emojis WHERE id = ?', [id]);
        return result.changes > 0;
    }
    async searchEmojis(query) {
        const emojisData = await this.db.all('SELECT * FROM custom_emojis WHERE name LIKE ? ORDER BY name ASC', [`%${query}%`]);
        return emojisData.map(data => Emoji_1.Emoji.fromDatabase(data));
    }
    // Função para parsear texto e substituir emojis customizados
    async parseEmojis(text) {
        // Buscar todos os emojis customizados
        const emojis = await this.getAllEmojis();
        let parsedText = text;
        // Substituir cada emoji encontrado
        for (const emoji of emojis) {
            const regex = new RegExp(`:${emoji.name}:`, 'g');
            parsedText = parsedText.replace(regex, `<img src="${emoji.url}" alt=":${emoji.name}:" class="custom-emoji" title=":${emoji.name}:">`);
        }
        return parsedText;
    }
    // Função para extrair emojis customizados de um texto
    extractEmojiNames(text) {
        const emojiRegex = /:([a-zA-Z0-9_]+):/g;
        const matches = text.match(emojiRegex);
        if (!matches) {
            return [];
        }
        return matches.map(match => match.slice(1, -1)); // Remove os dois pontos
    }
}
exports.EmojiService = EmojiService;
//# sourceMappingURL=emojiService.js.map