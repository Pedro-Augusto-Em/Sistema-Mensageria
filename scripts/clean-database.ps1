# Script PowerShell para limpar o banco de dados do sistema de mensageria
# Autor: Sistema de Mensageria

Write-Host "Iniciando limpeza completa do banco de dados..." -ForegroundColor Cyan

# Caminho para o banco de dados
$dbPath = Join-Path $PSScriptRoot "..\data\mensageria.db"

# Verificar se o banco existe
if (-not (Test-Path $dbPath)) {
    Write-Host "Banco de dados nao encontrado em: $dbPath" -ForegroundColor Red
    Write-Host "Certifique-se de que o banco foi criado primeiro" -ForegroundColor Yellow
    exit 1
}

Write-Host "Banco de dados encontrado em: $dbPath" -ForegroundColor Green

# Função para executar comandos SQL
function Invoke-SQLiteCommand {
    param(
        [string]$DatabasePath,
        [string]$SQL
    )
    
    try {
        # Usar sqlite3.exe se disponível
        if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
            $command = "sqlite3 `"$DatabasePath`" `"$SQL`""
            $result = Invoke-Expression $command 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                return $result
            } else {
                throw "Erro SQLite: $result"
            }
        }
        # Alternativa usando arquivo temporário
        else {
            $tempFile = [System.IO.Path]::GetTempFileName()
            $sqlFile = [System.IO.Path]::GetTempFileName()
            
            # Criar arquivo SQL temporário
            $SQL | Out-File -FilePath $sqlFile -Encoding UTF8
            
            # Executar com sqlite3 (se disponível via chocolatey ou instalado)
            if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
                $command = "sqlite3 `"$DatabasePath`" < `"$sqlFile`""
                $result = cmd /c $command 2>&1
                
                # Limpar arquivos temporários
                Remove-Item $tempFile -ErrorAction SilentlyContinue
                Remove-Item $sqlFile -ErrorAction SilentlyContinue
                
                return $result
            } else {
                throw "SQLite3 nao esta disponivel no sistema. Instale o SQLite3."
            }
        }
    }
    catch {
        Write-Host "Erro ao executar comando SQL: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Função para consultar dados
function Get-SQLiteData {
    param(
        [string]$DatabasePath,
        [string]$SQL
    )
    
    try {
        if (Get-Command sqlite3 -ErrorAction SilentlyContinue) {
            $command = "sqlite3 `"$DatabasePath`" `"$SQL`""
            $result = Invoke-Expression $command 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                return $result
            } else {
                throw "Erro SQLite: $result"
            }
        }
        else {
            throw "SQLite3 nao esta disponivel"
        }
    }
    catch {
        Write-Host "Erro ao consultar dados: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

try {
    Write-Host "Iniciando processo de limpeza..." -ForegroundColor Yellow
    
    # 1. Remover TODAS as mensagens
    Write-Host "Removendo mensagens..." -ForegroundColor Blue
    try {
        $result = Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "DELETE FROM messages"
        Write-Host "Mensagens removidas com sucesso" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao remover mensagens: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # 2. Remover TODAS as salas
    Write-Host "Removendo salas..." -ForegroundColor Blue
    try {
        $result = Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "DELETE FROM rooms"
        Write-Host "Salas removidas com sucesso" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao remover salas: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # 3. Remover TODOS os usuários
    Write-Host "Removendo usuarios..." -ForegroundColor Blue
    try {
        $result = Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "DELETE FROM users"
        Write-Host "Usuarios removidos com sucesso" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao remover usuarios: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # 4. Remover leituras de mensagens
    Write-Host "Removendo registros de leitura..." -ForegroundColor Blue
    try {
        $result = Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "DELETE FROM message_reads"
        Write-Host "Registros de leitura removidos com sucesso" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao remover registros de leitura: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # 5. Remover arquivos
    Write-Host "Removendo registros de arquivos..." -ForegroundColor Blue
    try {
        $result = Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "DELETE FROM files"
        Write-Host "Registros de arquivos removidos com sucesso" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao remover registros de arquivos: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # 6. Resetar sequências de ID (se existirem)
    Write-Host "Resetando sequencias de ID..." -ForegroundColor Blue
    try {
        $result = Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "DELETE FROM sqlite_sequence WHERE name IN ('users', 'messages', 'rooms', 'files', 'message_reads')"
        Write-Host "Sequencias de ID resetadas com sucesso" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao resetar sequencias: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Verificar se a limpeza foi bem-sucedida
    Write-Host "`nVerificando resultado da limpeza..." -ForegroundColor Cyan
    
    try {
        $remainingUsers = Get-SQLiteData -DatabasePath $dbPath -SQL "SELECT COUNT(*) as count FROM users"
        $remainingMessages = Get-SQLiteData -DatabasePath $dbPath -SQL "SELECT COUNT(*) as count FROM messages"
        $remainingRooms = Get-SQLiteData -DatabasePath $dbPath -SQL "SELECT COUNT(*) as count FROM rooms"
        
        Write-Host "   Usuarios restantes: $remainingUsers" -ForegroundColor White
        Write-Host "   Mensagens restantes: $remainingMessages" -ForegroundColor White
        Write-Host "   Salas restantes: $remainingRooms" -ForegroundColor White
        
        if ($remainingUsers -eq "0" -and $remainingMessages -eq "0" -and $remainingRooms -eq "0") {
            Write-Host "`nLimpeza concluida com sucesso! Todas as tabelas estao vazias." -ForegroundColor Green
        } else {
            Write-Host "`nAlgumas tabelas ainda contem dados. Verifique manualmente." -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "Erro ao verificar resultado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # 7. Otimizar banco de dados
    Write-Host "`nOtimizando banco de dados..." -ForegroundColor Blue
    try {
        Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "VACUUM"
        Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "ANALYZE"
        Write-Host "Banco de dados otimizado com sucesso" -ForegroundColor Green
    }
    catch {
        Write-Host "Erro ao otimizar banco: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Write-Host "`nProcesso de limpeza finalizado!" -ForegroundColor Green
    Write-Host "O banco de dados esta limpo e pronto para uso" -ForegroundColor Cyan
    
}
catch {
    Write-Host "`nErro critico durante a limpeza: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Verifique se o SQLite3 esta instalado ou se ha permissoes adequadas" -ForegroundColor Yellow
    exit 1
}
finally {
    Write-Host "`nDicas de uso:" -ForegroundColor Magenta
    Write-Host "   • Execute este script sempre que quiser limpar o banco" -ForegroundColor White
    Write-Host "   • Use npm run init-db para recriar as tabelas" -ForegroundColor White
    Write-Host "   • Certifique-se de que o servidor nao esta rodando" -ForegroundColor White
    Write-Host "   • Faca backup antes de executar em producao" -ForegroundColor White
}
