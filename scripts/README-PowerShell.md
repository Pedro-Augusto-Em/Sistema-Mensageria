# Script PowerShell para Limpeza do Banco de Dados

## 📋 Descrição
Este script PowerShell (`clean-database.ps1`) foi criado para limpar completamente o banco de dados SQLite do sistema de mensageria, removendo todos os dados de usuários, mensagens, salas e arquivos.

## 🚀 Como Usar

### Opção 1: Via npm (Recomendado)
```powershell
npm run clean-db
```

### Opção 2: Execução Direta
```powershell
# Navegar para a pasta scripts
cd scripts

# Executar o script
powershell -ExecutionPolicy Bypass -File clean-database.ps1
```

### Opção 3: Execução Manual
```powershell
# Navegar para a pasta scripts
cd scripts

# Executar diretamente
.\clean-database.ps1
```

## ⚠️ Pré-requisitos

### 1. SQLite3 (Recomendado)
- **Instalar via Chocolatey:**
  ```powershell
  choco install sqlite
  ```
- **Instalar via Scoop:**
  ```powershell
  scoop install sqlite
  ```
- **Download direto:** [SQLite Downloads](https://www.sqlite.org/download.html)

### 2. PowerShell 5.1 ou Superior
- Verificar versão: `$PSVersionTable.PSVersion`
- Windows 10/11 já vem com PowerShell 5.1+

### 3. Permissões de Execução
Se encontrar erro de política de execução:
```powershell
# Verificar política atual
Get-ExecutionPolicy

# Alterar política (temporariamente)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Ou executar com bypass
powershell -ExecutionPolicy Bypass -File clean-database.ps1
```

## 🔧 O que o Script Faz

### 1. **Verificações Iniciais**
- ✅ Verifica se o banco existe
- ✅ Confirma caminho do banco
- ✅ Testa conectividade

### 2. **Limpeza Completa**
- 🗑️ **Mensagens:** Remove todas as mensagens
- 🗑️ **Salas:** Remove todas as conversas e grupos
- 🗑️ **Usuários:** Remove todos os usuários
- 🗑️ **Leituras:** Remove registros de mensagens lidas
- 🗑️ **Arquivos:** Remove registros de uploads
- 🔄 **Sequências:** Reseta IDs auto-incrementais

### 3. **Otimização**
- 🧹 **VACUUM:** Recupera espaço em disco
- 📊 **ANALYZE:** Atualiza estatísticas do banco

### 4. **Verificação**
- 📋 Conta registros restantes
- ✅ Confirma limpeza bem-sucedida
- 📊 Relatório final

## 🎯 Casos de Uso

### **Desenvolvimento**
```powershell
# Limpar banco antes de testar
npm run clean-db

# Recriar estrutura
npm run init-db
```

### **Testes**
```powershell
# Limpar dados de teste
npm run clean-db

# Executar testes
npm test
```

### **Produção**
```powershell
# ⚠️ CUIDADO: Backup antes de executar
# Limpar banco para manutenção
npm run clean-db
```

## 🚨 Avisos Importantes

### **⚠️ DESTRUTIVO**
- **TODOS os dados serão perdidos**
- **Não há confirmação adicional**
- **Execute apenas quando necessário**

### **🔒 Segurança**
- **Faça backup antes de executar**
- **Verifique se o servidor está parado**
- **Execute apenas em ambiente controlado**

### **📁 Arquivos Físicos**
- O script remove apenas registros do banco
- **Arquivos físicos em `/uploads` permanecem**
- Delete manualmente se necessário

## 🔍 Solução de Problemas

### **Erro: "SQLite3 não encontrado"**
```powershell
# Instalar SQLite3
choco install sqlite

# Ou usar método alternativo
# O script tentará usar .NET SQLite
```

### **Erro: "Acesso negado"**
```powershell
# Executar como Administrador
# Ou verificar permissões da pasta data/
```

### **Erro: "Banco em uso"**
```powershell
# Parar o servidor primeiro
# Verificar se não há outros processos usando o banco
```

### **Erro: "Política de execução"**
```powershell
# Executar com bypass
powershell -ExecutionPolicy Bypass -File clean-database.ps1

# Ou alterar política
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📚 Comandos Relacionados

```powershell
# Limpar banco
npm run clean-db

# Recriar estrutura
npm run init-db

# Limpar apenas usuários (Node.js)
npm run clean-users

# Setup completo
npm run setup
```

## 🎨 Personalização

### **Alterar Caminho do Banco**
Edite a linha no script:
```powershell
$dbPath = Join-Path $PSScriptRoot "..\data\mensageria.db"
```

### **Adicionar Mais Tabelas**
Adicione na seção de limpeza:
```powershell
# Nova tabela
$result = Invoke-SQLiteCommand -DatabasePath $dbPath -SQL "DELETE FROM nova_tabela"
```

### **Alterar Cores**
Modifique os parâmetros `-ForegroundColor`:
- `Green` = Sucesso
- `Red` = Erro
- `Yellow` = Aviso
- `Blue` = Informação
- `Cyan` = Destaque
- `Magenta` = Título

## 📞 Suporte

Se encontrar problemas:
1. **Verifique os pré-requisitos**
2. **Execute como Administrador**
3. **Verifique logs de erro**
4. **Teste com banco de exemplo**

## 📝 Logs

O script gera logs coloridos no console:
- 🧹 **Início do processo**
- ✅ **Operações bem-sucedidas**
- ⚠️ **Avisos e erros não críticos**
- ❌ **Erros críticos**
- 🎉 **Conclusão bem-sucedida**

---

**⚠️ LEMBRE-SE: Este script remove TODOS os dados do banco. Use com responsabilidade!**
