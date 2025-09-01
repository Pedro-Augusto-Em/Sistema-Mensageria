# Sistema de Emojis Customizados

## Funcionalidades

O sistema de emojis customizados permite que os usuários:

1. **Upload de emojis**: Façam upload de imagens personalizadas como emojis
2. **Sintaxe de emoji**: Usem a sintaxe `:nome:` para inserir emojis nas mensagens
3. **Seletor visual**: Escolham emojis através de uma interface visual
4. **Busca**: Busquem emojis por nome
5. **Gerenciamento**: Visualizem e gerenciem seus emojis customizados

## Como Usar

### 1. Upload de Emojis

1. Clique no botão de emoji (😊) na barra de mensagens
2. Vá para a aba "Upload"
3. Digite um nome para o emoji (apenas letras, números e underscore)
4. Selecione uma imagem (máximo 2MB)
5. Clique em "Upload Emoji"

### 2. Usar Emojis nas Mensagens

#### Método 1: Sintaxe de Texto
Digite `:nome_do_emoji:` na mensagem. Por exemplo:
- `:haaaa:` - será substituído pela imagem do emoji
- `Olá :wave: como você está?` - mistura texto e emoji

#### Método 2: Seletor Visual
1. Clique no botão de emoji (😊)
2. Vá para a aba "Selecionar"
3. Clique no emoji desejado
4. O emoji será inserido automaticamente na mensagem

### 3. Buscar Emojis

Na aba "Selecionar", use o campo de busca para encontrar emojis por nome.

## Especificações Técnicas

### Validações

- **Nome do emoji**: 2-20 caracteres, apenas letras, números e underscore
- **Arquivo**: Apenas imagens (JPG, PNG, GIF), máximo 2MB
- **Nomes únicos**: Não é possível ter dois emojis com o mesmo nome

### API Endpoints

- `GET /api/emojis` - Listar todos os emojis
- `GET /api/emojis/search?q=termo` - Buscar emojis
- `POST /api/emojis/upload` - Upload de novo emoji
- `GET /api/emojis/:id` - Obter emoji específico
- `PUT /api/emojis/:id` - Atualizar emoji
- `DELETE /api/emojis/:id` - Excluir emoji
- `POST /api/emojis/parse` - Parsear texto com emojis

### Estrutura do Banco de Dados

```sql
CREATE TABLE custom_emojis (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  uploadedBy TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
);
```

### Processamento de Mensagens

Quando uma mensagem é enviada:
1. O conteúdo é parseado para encontrar emojis na sintaxe `:nome:`
2. Cada emoji encontrado é substituído por uma tag `<img>` com a URL da imagem
3. A mensagem processada é salva no banco de dados
4. A mensagem é exibida com os emojis renderizados

## Exemplos de Uso

### Mensagens com Emojis

```
Usuário digita: "Olá :wave: como você está? :smile:"
Sistema processa: "Olá <img src="/uploads/emojis/wave.png" class="custom-emoji"> como você está? <img src="/uploads/emojis/smile.png" class="custom-emoji">"
```

### Upload de Emoji

1. Nome: `thumbs_up`
2. Arquivo: `thumbs_up.png`
3. Resultado: Sintaxe `:thumbs_up:` disponível para uso

## Estilos CSS

Os emojis customizados usam a classe `.custom-emoji` com as seguintes propriedades:

```css
.custom-emoji {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    margin: 0 2px;
    border-radius: 2px;
}
```

## Segurança

- Apenas usuários autenticados podem fazer upload de emojis
- Validação de tipo de arquivo (apenas imagens)
- Limite de tamanho de arquivo (2MB)
- Validação de nome (apenas caracteres seguros)
- Sanitização de nomes de arquivo

## Limitações

- Máximo de 2MB por arquivo de emoji
- Apenas formatos de imagem suportados
- Nomes de emoji devem ser únicos globalmente
- Não há sistema de categorias ou tags
