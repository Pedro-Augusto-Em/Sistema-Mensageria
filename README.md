# Sistema de Mensageria Local

Um sistema completo de mensageria para rede local com funcionalidades avançadas de chat em tempo real.

## 🚀 Funcionalidades

- ✅ **Autenticação completa** com JWT
- ✅ **Chat em tempo real** via Socket.IO
- ✅ **Criação de grupos** com múltiplos usuários
- ✅ **Upload de arquivos** e imagens
- ✅ **Fotos de perfil** personalizáveis
- ✅ **Edição e exclusão** de mensagens
- ✅ **Indicadores de leitura** de mensagens
- ✅ **Busca de conversas** e usuários
- ✅ **Interface responsiva** e moderna

## 📋 Pré-requisitos

- Node.js 16+ 
- npm ou yarn
- SQLite3 (opcional, para scripts PowerShell)

## 🛠️ Instalação

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd sistema-mensageria
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o banco de dados
```bash
npm run setup
```

### 4. Inicie o servidor
```bash
npm run dev:server
```

## 🗄️ Scripts de Banco de Dados

### **Inicializar Banco**
```bash
npm run init-db
```
Cria as tabelas e estrutura inicial do banco.

### **Limpar Banco (PowerShell)**
```bash
npm run clean-db
```
**⚠️ ATENÇÃO:** Remove TODOS os dados do banco. Use apenas quando necessário.

### **Limpar Banco (Node.js)**
```bash
npm run clean-db-node
```
**⚠️ ATENÇÃO:** Remove TODOS os dados do banco. Alternativa ao PowerShell.

### **Limpar Apenas Usuários**
```bash
npm run clean-users
```
Remove apenas usuários de teste, mantendo estrutura.

## 🔧 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev:server` | Inicia servidor em modo desenvolvimento |
| `npm run build` | Compila o projeto para produção |
| `npm run start` | Inicia servidor em produção |
| `npm run init-db` | Inicializa banco de dados |
| `npm run clean-db` | Limpa banco via PowerShell |
| `npm run clean-db-node` | Limpa banco via Node.js |
| `npm run clean-users` | Remove usuários de teste |
| `npm run setup` | Instala dependências + inicializa banco |

## 🌐 Acesso

- **Local:** http://localhost:PORTA
- **Rede Local:** (IP da sua máquina na rede):PORTA

> **💡 Dica:** Configuramos para acesso local! Veja [local-access.md](local-access.md) para detalhes.

## 📱 Como Usar

### 1. **Registro e Login**
- Crie uma conta com username, nickname e senha
- Faça login para acessar o sistema

### 2. **Criar Grupos**
- Clique em "Novo Grupo"
- Selecione membros
- Defina nome e descrição

### 3. **Chat em Tempo Real**
- Envie mensagens de texto
- Anexe arquivos e imagens
- Veja indicadores de leitura

### 4. **Gerenciar Perfil**
- Altere foto de perfil
- Edite informações pessoais

### 5. **Editar/Excluir Mensagens**
- Passe o mouse sobre mensagens próprias
- Use botões de edição e exclusão

## 🗂️ Estrutura do Projeto

```
sistema-mensageria/
├── src/
│   └── server/
│       ├── models/          # Modelos de dados
│       ├── services/        # Lógica de negócio
│       ├── routes/          # Rotas da API
│       ├── middleware/      # Middlewares
│       ├── public/          # Frontend estático
│       └── index.ts         # Servidor principal
├── scripts/                 # Scripts de banco
├── data/                    # Banco SQLite
└── uploads/                 # Arquivos enviados
```

## 🔒 Segurança

- **JWT** para autenticação
- **bcrypt** para hash de senhas
- **Helmet** para headers de segurança
- **Rate limiting** para prevenir spam
- **CORS** configurado para rede local

## 📊 Banco de Dados

### Tabelas Principais
- **users** - Usuários do sistema
- **rooms** - Salas de chat (diretas e grupos)
- **messages** - Mensagens enviadas
- **files** - Arquivos anexados
- **message_reads** - Status de leitura

### Scripts de Manutenção
- **clean-database.ps1** - PowerShell (requer SQLite3)
- **clean-database-node.js** - Node.js (não requer SQLite3)
- **init-db.js** - Inicialização do banco

## 🚨 Avisos Importantes

### **Scripts de Limpeza**
- ⚠️ **DESTRUTIVOS** - Removem TODOS os dados
- 🔒 **Faça backup** antes de executar
- 🛑 **Pare o servidor** antes de limpar
- 🧪 **Use apenas** em desenvolvimento/testes

### **Produção**
- 🔐 Configure variáveis de ambiente
- 🚫 Não execute scripts de limpeza
- 💾 Implemente backup automático
- 📝 Monitore logs de erro

## 🔍 Solução de Problemas

### **Erro: "Banco em uso"**
```bash
# Pare o servidor primeiro
Ctrl+C

# Verifique processos Node.js
tasklist | findstr node
taskkill /F /IM node.exe
```

### **Erro: "Permissão negada"**
```bash
# Execute como Administrador
# Ou verifique permissões da pasta data/
```

### **Erro: "SQLite3 não encontrado"**
```bash
# Use o script Node.js
npm run clean-db-node

# Ou instale SQLite3
choco install sqlite
```

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs do servidor
2. Confirme pré-requisitos
3. Teste com banco limpo
4. Verifique permissões de arquivo

## 📝 Logs

O sistema gera logs detalhados:
- **Console** - Durante desenvolvimento
- **Arquivos** - Em produção (configurável)
- **Socket.IO** - Conexões e eventos

## 🎯 Próximos Passos

- [ ] Notificações push
- [ ] Criptografia end-to-end
- [ ] Backup automático
- [ ] Interface mobile
- [ ] Integração com LDAP

---

**⚠️ LEMBRE-SE: Os scripts de limpeza são destrutivos. Use com responsabilidade!**

