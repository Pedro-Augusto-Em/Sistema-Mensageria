#!/usr/bin/env node

/**
 * Script Node.js para limpar o banco de dados do sistema de mensageria
 * Autor: Sistema de Mensageria
 * 
 * Este script é uma alternativa ao PowerShell quando o SQLite3 não está disponível
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Cores para o console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

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
 * Conecta ao banco de dados e limpa todas as tabelas
 */
async function cleanDatabase() {
    log('🧹 Iniciando limpeza completa do banco de dados...', 'cyan');
    
    // Verificar se o banco existe
    if (!require('fs').existsSync(dbPath)) {
        log(`❌ Banco de dados não encontrado em: ${dbPath}`, 'red');
        log('💡 Certifique-se de que o banco foi criado primeiro', 'yellow');
        process.exit(1);
    }
    
    log(`✅ Banco de dados encontrado em: ${dbPath}`, 'green');
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            log(`❌ Erro ao conectar ao banco: ${err.message}`, 'red');
            return;
        }
        log('✅ Conectado ao banco de dados SQLite', 'green');
    });

    try {
        log('🔄 Iniciando processo de limpeza...', 'yellow');
        
        // 1. Remover TODAS as mensagens
        log('📝 Removendo mensagens...', 'blue');
        try {
            const result = await runQuery(db, 'DELETE FROM messages');
            log(`✅ ${result.changes} mensagens removidas`, 'green');
        } catch (error) {
            log(`⚠️ Erro ao remover mensagens: ${error.message}`, 'yellow');
        }
        
        // 2. Remover TODAS as salas
        log('🏠 Removendo salas...', 'blue');
        try {
            const result = await runQuery(db, 'DELETE FROM rooms');
            log(`✅ ${result.changes} salas removidas`, 'green');
        } catch (error) {
            log(`⚠️ Erro ao remover salas: ${error.message}`, 'yellow');
        }
        
        // 3. Remover TODOS os usuários
        log('👥 Removendo usuários...', 'blue');
        try {
            const result = await runQuery(db, 'DELETE FROM users');
            log(`✅ ${result.changes} usuários removidos`, 'green');
        } catch (error) {
            log(`⚠️ Erro ao remover usuários: ${error.message}`, 'yellow');
        }
        
        // 4. Remover leituras de mensagens
        log('📖 Removendo registros de leitura...', 'blue');
        try {
            const result = await runQuery(db, 'DELETE FROM message_reads');
            log(`✅ ${result.changes} registros de leitura removidos`, 'green');
        } catch (error) {
            log(`⚠️ Erro ao remover registros de leitura: ${error.message}`, 'yellow');
        }
        
        // 5. Remover arquivos
        log('📁 Removendo registros de arquivos...', 'blue');
        try {
            const result = await runQuery(db, 'DELETE FROM files');
            log(`✅ ${result.changes} registros de arquivos removidos`, 'green');
        } catch (error) {
            log(`⚠️ Erro ao remover registros de arquivos: ${error.message}`, 'yellow');
        }
        
        // 6. Resetar sequências de ID (se existirem)
        log('🔄 Resetando sequências de ID...', 'blue');
        try {
            const result = await runQuery(db, "DELETE FROM sqlite_sequence WHERE name IN ('users', 'messages', 'rooms', 'files', 'message_reads')");
            log(`✅ Sequências de ID resetadas`, 'green');
        } catch (error) {
            log(`⚠️ Erro ao resetar sequências: ${error.message}`, 'yellow');
        }
        
        // Verificar se a limpeza foi bem-sucedida
        log('\n📋 Verificando resultado da limpeza...', 'cyan');
        
        try {
            const remainingUsers = await getAllQuery(db, 'SELECT COUNT(*) as count FROM users');
            const remainingMessages = await getAllQuery(db, 'SELECT COUNT(*) as count FROM messages');
            const remainingRooms = await getAllQuery(db, 'SELECT COUNT(*) as count FROM rooms');
            
            log(`   👥 Usuários restantes: ${remainingUsers[0]?.count || 0}`, 'white');
            log(`   📝 Mensagens restantes: ${remainingMessages[0]?.count || 0}`, 'white');
            log(`   🏠 Salas restantes: ${remainingRooms[0]?.count || 0}`, 'white');
            
            if ((remainingUsers[0]?.count || 0) === 0 && 
                (remainingMessages[0]?.count || 0) === 0 && 
                (remainingRooms[0]?.count || 0) === 0) {
                log('\n🎉 Limpeza concluída com sucesso! Todas as tabelas estão vazias.', 'green');
            } else {
                log('\n⚠️ Algumas tabelas ainda contêm dados. Verifique manualmente.', 'yellow');
            }
        } catch (error) {
            log(`⚠️ Erro ao verificar resultado: ${error.message}`, 'yellow');
        }
        
        // 7. Otimizar banco de dados
        log('\n🔧 Otimizando banco de dados...', 'blue');
        try {
            await runQuery(db, 'VACUUM');
            await runQuery(db, 'ANALYZE');
            log('✅ Banco de dados otimizado com sucesso', 'green');
        } catch (error) {
            log(`⚠️ Erro ao otimizar banco: ${error.message}`, 'yellow');
        }
        
        log('\n✨ Processo de limpeza finalizado!', 'green');
        log('💡 O banco de dados está limpo e pronto para uso', 'cyan');
        
    } catch (error) {
        log(`\n❌ Erro crítico durante a limpeza: ${error.message}`, 'red');
        log('🔍 Verifique se há permissões adequadas', 'yellow');
        process.exit(1);
    } finally {
        // Fechar a conexão com o banco de dados
        db.close((err) => {
            if (err) {
                log(`❌ Erro ao fechar o banco de dados: ${err.message}`, 'red');
            } else {
                log('🔒 Conexão com o banco de dados fechada.', 'green');
            }
            
            log('\n📚 Dicas de uso:', 'magenta');
            log('   • Execute este script sempre que quiser limpar o banco', 'white');
            log('   • Use npm run init-db para recriar as tabelas', 'white');
            log('   • Certifique-se de que o servidor não está rodando', 'white');
            log('   • Faça backup antes de executar em produção', 'white');
            log('\n⚠️ LEMBRE-SE: Este script remove TODOS os dados do banco. Use com responsabilidade!', 'red');
        });
    }
}

// Executar a função de limpeza
cleanDatabase().catch(error => {
    log(`❌ Erro fatal: ${error.message}`, 'red');
    process.exit(1);
});

