const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Caminho para o banco de dados
const dbPath = path.join(__dirname, '../data/mensageria.db');

// Criar diretório data se não existir
const dataDir = path.dirname(dbPath);
if (!require('fs').existsSync(dataDir)) {
  require('fs').mkdirSync(dataDir, { recursive: true });
}

// Conectar ao banco
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    process.exit(1);
  }
  console.log('Conectado ao banco de dados SQLite');
});

// Habilitar foreign keys
db.run('PRAGMA foreign_keys = ON');

// Função para executar queries de forma assíncrona
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Função para criar tabelas
async function createTables() {
  try {
    console.log('Criando tabelas...');

    // Tabela de usuários
    await runQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nickname TEXT NOT NULL,
        avatar TEXT,
        status TEXT DEFAULT 'offline',
        lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de salas
    await runQuery(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK(type IN ('direct', 'group', 'channel')),
        avatar TEXT,
        createdBy TEXT NOT NULL,
        members TEXT NOT NULL,
        admins TEXT NOT NULL,
        isPrivate BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Tabela de mensagens
    await runQuery(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'image', 'file', 'audio', 'video')),
        roomId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        replyToId TEXT,
        isEdited BOOLEAN DEFAULT 0,
        isDeleted BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (replyToId) REFERENCES messages(id) ON DELETE SET NULL
      )
    `);

    // Tabela de arquivos
    await runQuery(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        originalName TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        size INTEGER NOT NULL,
        path TEXT NOT NULL,
        messageId TEXT,
        uploadedBy TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE SET NULL,
        FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Tabela de leituras de mensagens
    await runQuery(`
      CREATE TABLE IF NOT EXISTS message_reads (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL,
        userId TEXT NOT NULL,
        readAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Criar índices
    await runQuery('CREATE INDEX IF NOT EXISTS idx_messages_roomId ON messages(roomId)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_messages_senderId ON messages(senderId)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_messages_createdAt ON messages(createdAt)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type)');
    await runQuery('CREATE INDEX IF NOT EXISTS idx_rooms_createdBy ON rooms(createdBy)');

    console.log('✅ Tabelas criadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
    throw error;
  }
}

// Função para criar usuários de teste
async function createTestUsers() {
  try {
    console.log('Criando usuários de teste...');

    // Verificar se já existem usuários
    const existingUsers = await getQuery('SELECT COUNT(*) as count FROM users');
    if (existingUsers.count > 0) {
      console.log('⚠️  Usuários já existem, removendo e recriando...');
      await runQuery('DELETE FROM users');
      await runQuery('DELETE FROM rooms');
      await runQuery('DELETE FROM messages');
    }

    const users = [
      {
        username: 'admin',
        password: 'admin123',
        nickname: 'Administrador',
        avatar: null
      },
      {
        username: 'joao',
        password: 'joao123',
        nickname: 'João Silva',
        avatar: null
      },
      {
        username: 'maria',
        password: 'maria123',
        nickname: 'Maria Santos',
        avatar: null
      },
      {
        username: 'pedro',
        password: 'pedro123',
        nickname: 'Pedro Costa',
        avatar: null
      }
    ];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const userId = uuidv4();
      
      await runQuery(
        `INSERT INTO users (id, username, password, nickname, avatar, status, lastSeen, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          userData.username,
          hashedPassword,
          userData.nickname,
          userData.avatar,
          'offline',
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      console.log(`✅ Usuário ${userData.username} criado com ID: ${userId}`);
    }

    console.log('✅ Usuários de teste criados com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar usuários de teste:', error);
    throw error;
  }
}

// Função para criar salas de teste
async function createTestRooms() {
  try {
    console.log('Criando salas de teste...');

    // Verificar se já existem salas
    const existingRooms = await getQuery('SELECT COUNT(*) as count FROM rooms');
    if (existingRooms.count > 0) {
      console.log('⚠️  Salas já existem, pulando criação...');
      return;
    }

    // Buscar IDs dos usuários
    const admin = await getQuery('SELECT id FROM users WHERE username = ?', ['admin']);
    const joao = await getQuery('SELECT id FROM users WHERE username = ?', ['joao']);
    const maria = await getQuery('SELECT id FROM users WHERE username = ?', ['maria']);
    const pedro = await getQuery('SELECT id FROM users WHERE username = ?', ['pedro']);

    if (!admin || !joao || !maria || !pedro) {
      throw new Error('Usuários de teste não encontrados');
    }

    const rooms = [
      {
        name: 'Geral',
        description: 'Canal geral para discussões da empresa',
        type: 'channel',
        createdBy: admin.id,
        members: [admin.id, joao.id, maria.id, pedro.id],
        admins: [admin.id],
        isPrivate: false
      },
      {
        name: 'Desenvolvimento',
        description: 'Canal para discussões técnicas',
        type: 'channel',
        createdBy: admin.id,
        members: [admin.id, joao.id, maria.id],
        admins: [admin.id, joao.id],
        isPrivate: false
      },
      {
        name: 'joao & maria',
        description: 'Conversa direta entre João e Maria',
        type: 'direct',
        createdBy: joao.id,
        members: [joao.id, maria.id],
        admins: [joao.id],
        isPrivate: true
      }
    ];

    for (const roomData of rooms) {
      const roomId = uuidv4();
      
      await runQuery(
        `INSERT INTO rooms (id, name, description, type, createdBy, members, admins, isPrivate, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          roomId,
          roomData.name,
          roomData.description,
          roomData.type,
          roomData.createdBy,
          JSON.stringify(roomData.members),
          JSON.stringify(roomData.admins),
          roomData.isPrivate,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      console.log(`✅ Sala "${roomData.name}" criada com ID: ${roomId}`);
    }

    console.log('✅ Salas de teste criadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar salas de teste:', error);
    throw error;
  }
}

// Função para criar mensagens de teste
async function createTestMessages() {
  try {
    console.log('Criando mensagens de teste...');

    // Verificar se já existem mensagens
    const existingMessages = await getQuery('SELECT COUNT(*) as count FROM messages');
    if (existingMessages.count > 0) {
      console.log('⚠️  Mensagens já existem, pulando criação...');
      return;
    }

    // Buscar sala geral
    const geralRoom = await getQuery('SELECT id FROM rooms WHERE name = ?', ['Geral']);
    if (!geralRoom) {
      console.log('⚠️  Sala Geral não encontrada, pulando criação de mensagens...');
      return;
    }

    // Buscar usuários
    const admin = await getQuery('SELECT id FROM users WHERE username = ?', ['admin']);
    const joao = await getQuery('SELECT id FROM users WHERE username = ?', ['joao']);
    const maria = await getQuery('SELECT id FROM users WHERE username = ?', ['maria']);

    const messages = [
      {
        content: 'Bem-vindos ao sistema de mensageria! 🎉',
        type: 'text',
        roomId: geralRoom.id,
        senderId: admin.id
      },
      {
        content: 'Olá pessoal! Como estão?',
        type: 'text',
        roomId: geralRoom.id,
        senderId: joao.id
      },
      {
        content: 'Oi João! Tudo bem sim, e você?',
        type: 'text',
        roomId: geralRoom.id,
        senderId: maria.id
      },
      {
        content: 'Ótimo! Estou testando o sistema de mensagens',
        type: 'text',
        roomId: geralRoom.id,
        senderId: joao.id
      }
    ];

    for (const messageData of messages) {
      const messageId = uuidv4();
      
      await runQuery(
        `INSERT INTO messages (id, content, type, roomId, senderId, replyToId, isEdited, isDeleted, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          messageId,
          messageData.content,
          messageData.type,
          messageData.roomId,
          messageData.senderId,
          null,
          false,
          false,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      console.log(`✅ Mensagem criada: "${messageData.content.substring(0, 30)}..."`);
    }

    console.log('✅ Mensagens de teste criadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar mensagens de teste:', error);
    throw error;
  }
}

// Função principal
async function main() {
  try {
    console.log('🚀 Inicializando banco de dados do sistema de mensageria...\n');

    await createTables();
    // Removido criação de usuários, salas e mensagens de teste
    // await createTestUsers();
    // await createTestRooms();
    // await createTestMessages();

    console.log('\n🎉 Banco de dados inicializado com sucesso!');
    console.log('\n📋 Estrutura criada:');
    console.log('   🗄️ Tabelas: users, rooms, messages, files, message_reads');
    console.log('   🔑 Índices e chaves estrangeiras configurados');
    console.log('\n💡 O banco está pronto para uso manual');

  } catch (error) {
    console.error('\n💥 Erro durante a inicialização:', error);
    process.exit(1);
  } finally {
    // Fechar conexão com o banco
    db.close((err) => {
      if (err) {
        console.error('Erro ao fechar banco:', err);
      } else {
        console.log('\n🔒 Conexão com banco fechada');
      }
    });
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = { createTables, createTestUsers, createTestRooms, createTestMessages };
