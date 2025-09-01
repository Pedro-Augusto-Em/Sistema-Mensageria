import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { Emoji, IEmoji } from '../models/Emoji';

export class EmojiService {
  private db = getDatabase();

  async createEmoji(name: string, url: string, uploadedBy: string): Promise<Emoji> {
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

    const id = uuidv4();
    const now = new Date();

    await this.db.run(
      `INSERT INTO custom_emojis (id, name, url, uploadedBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, url, uploadedBy, now.toISOString(), now.toISOString()]
    );

    return new Emoji({
      id,
      name,
      url,
      uploadedBy,
      createdAt: now,
      updatedAt: now
    });
  }

  async getEmojiById(id: string): Promise<Emoji | null> {
    const emojiData = await this.db.get(
      'SELECT * FROM custom_emojis WHERE id = ?',
      [id]
    );

    return emojiData ? Emoji.fromDatabase(emojiData) : null;
  }

  async getEmojiByName(name: string): Promise<Emoji | null> {
    const emojiData = await this.db.get(
      'SELECT * FROM custom_emojis WHERE name = ?',
      [name]
    );

    return emojiData ? Emoji.fromDatabase(emojiData) : null;
  }

  async getAllEmojis(): Promise<Emoji[]> {
    const emojisData = await this.db.all(
      'SELECT * FROM custom_emojis ORDER BY name ASC'
    );

    return emojisData.map(data => Emoji.fromDatabase(data));
  }

  async getEmojisByUser(userId: string): Promise<Emoji[]> {
    const emojisData = await this.db.all(
      'SELECT * FROM custom_emojis WHERE uploadedBy = ? ORDER BY name ASC',
      [userId]
    );

    return emojisData.map(data => Emoji.fromDatabase(data));
  }

  async updateEmoji(id: string, name?: string, url?: string): Promise<Emoji | null> {
    const emoji = await this.getEmojiById(id);
    if (!emoji) {
      return null;
    }

    const updates: string[] = [];
    const params: any[] = [];

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

    await this.db.run(
      `UPDATE custom_emojis SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return await this.getEmojiById(id);
  }

  async deleteEmoji(id: string): Promise<boolean> {
    const result = await this.db.run(
      'DELETE FROM custom_emojis WHERE id = ?',
      [id]
    );

    return result.changes > 0;
  }

  async searchEmojis(query: string): Promise<Emoji[]> {
    const emojisData = await this.db.all(
      'SELECT * FROM custom_emojis WHERE name LIKE ? ORDER BY name ASC',
      [`%${query}%`]
    );

    return emojisData.map(data => Emoji.fromDatabase(data));
  }

  // Função para parsear texto e substituir emojis customizados
  async parseEmojis(text: string): Promise<string> {
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
  extractEmojiNames(text: string): string[] {
    const emojiRegex = /:([a-zA-Z0-9_]+):/g;
    const matches = text.match(emojiRegex);
    
    if (!matches) {
      return [];
    }
    
    return matches.map(match => match.slice(1, -1)); // Remove os dois pontos
  }
}
