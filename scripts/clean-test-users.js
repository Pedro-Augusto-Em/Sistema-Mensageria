const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Caminho para o banco de dados
const dbPath = path.join(__dirname, '../data/mensageria.db');

// Função para executar queries de alteração (INSERT, UPDATE, DELETE) com promises
function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes, lastID: this.lastID });
      }
    });
  });
}

// Função para executar queries de consulta (SELECT) com promises
function getAllQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Conecta ao banco de dados e limpa todas as tabelas (users, messages, rooms).
 */
async function cleanDatabase() {
  console.log('🧹 Iniciando limpeza completa do banco de dados...');
  
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Erro ao conectar ao banco:', err.message);
      return;
    }
    console.log('✅ Conectado ao banco de dados SQLite');
  });

  try {
    // 1. Remover TODOS os usuários
    try {
      const userResult = await runQuery(db, 'DELETE FROM users');
      console.log(`✅ ${userResult.changes} usuários removidos`);
    } catch (error) {
      console.log('⚠️ Erro ao remover usuários:', error.message);
    }

    // 2. Remover TODAS as mensagens
    try {
      const messageResult = await runQuery(db, 'DELETE FROM messages');
      console.log(`✅ ${messageResult.changes} mensagens removidas`);
    } catch (error) {
      console.log('⚠️ Erro ao remover mensagens:', error.message);
    }

    // 3. Remover TODAS as salas
    try {
      const roomResult = await runQuery(db, 'DELETE FROM rooms');
      console.log(`✅ ${roomResult.changes} salas removidas`);
    } catch (error) {
      console.log('⚠️ Erro ao remover salas:', error.message);
    }
    
    // Opcional: Se você usa IDs autoincrementais e quer que eles comecem do 1 novamente
    // try {
    //   await runQuery(db, "DELETE FROM sqlite_sequence WHERE name IN ('users', 'messages', 'rooms')");
    //   console.log('🔄 IDs autoincrementais resetados.');
    // } catch (error) {
    //   console.log('⚠️ Erro ao resetar a sequência de IDs:', error.message);
    // }

    // Verificar usuários restantes para confirmar a limpeza
    try {
      const remainingUsers = await getAllQuery(db, 'SELECT username, nickname FROM users');
      console.log('\n📋 Verificação de usuários restantes no sistema:');
      if (remainingUsers.length === 0) {
        console.log('   Nenhum usuário encontrado. Limpeza bem-sucedida!');
      } else {
        console.log('   Ainda existem usuários no banco:');
        remainingUsers.forEach(user => {
          console.log(`   👤 ${user.username} - ${user.nickname}`);
        });
      }
    } catch (error) {
      console.log('⚠️ Erro ao verificar usuários restantes:', error.message);
    }

    console.log('\n🎉 Limpeza concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro crítico durante a limpeza:', error.message);
  } finally {
    // Fechar a conexão com o banco de dados
    db.close((err) => {
      if (err) {
        console.error('❌ Erro ao fechar o banco de dados:', err.message);
      } else {
        console.log('🔒 Conexão com o banco de dados fechada.');
      }
    });
  }
}

// Executar a função de limpeza
cleanDatabase();