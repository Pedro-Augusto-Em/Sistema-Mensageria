// Configurações da aplicação
const API_BASE = window.location.origin;
let currentUser = null;
let currentRoom = null;
let socket = null;

// Função para tratar erros de autenticação
function handleAuthError(response, errorData) {
    if (response.status === 401 || response.status === 403) {
        // Verificar se é erro de token inválido
        if (errorData && (
            errorData.error === "Token de acesso não fornecido" ||
            errorData.message === "É necessário fornecer um token de autenticação válido" ||
            errorData.error === "Token inválido" ||
            errorData.message === "Token expirado"
        )) {
            console.log('Token inválido detectado, fazendo logout automático...');
            logoutUser();
            return true;
        }
    }
    return false;
}

// Sistema de rate limiting e retry
const rateLimiter = {
    requests: new Map(),
    maxRequests: 10, // Máximo de requisições por janela
    windowMs: 60000, // Janela de tempo em ms (1 minuto)
    retryDelay: 1000, // Delay inicial para retry em ms
    maxRetries: 3, // Máximo de tentativas
    
    // Verificar se pode fazer requisição
    canMakeRequest: function(endpoint) {
        const now = Date.now();
        const key = endpoint || 'global';
        
        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }
        
        const requests = this.requests.get(key);
        
        // Remover requisições antigas da janela
        const validRequests = requests.filter(time => now - time < this.windowMs);
        this.requests.set(key, validRequests);
        
        // Verificar se está dentro do limite
        if (validRequests.length < this.maxRequests) {
            validRequests.push(now);
            return true;
        }
        
        return false;
    },
    
    // Aguardar antes de fazer nova requisição
    waitForNextWindow: function(endpoint) {
        return new Promise((resolve) => {
            const key = endpoint || 'global';
            const requests = this.requests.get(key) || [];
            
            if (requests.length === 0) {
                resolve();
                return;
            }
            
            const oldestRequest = Math.min(...requests);
            const timeToWait = this.windowMs - (Date.now() - oldestRequest);
            
            if (timeToWait > 0) {
                const waitSeconds = Math.ceil(timeToWait/1000);
                console.log(`Rate limit atingido para ${endpoint}. Aguardando ${waitSeconds}s...`);
                
                // Mostrar notificação para o usuário
                addNotification(`Muitas requisições. Aguardando ${waitSeconds} segundos...`, 'warning');
                
                setTimeout(resolve, timeToWait);
            } else {
                resolve();
            }
        });
    },
    
    // Função para fazer requisição com retry automático
    fetchWithRetry: async function(url, options = {}, endpoint = null) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Verificar rate limit
                if (!this.canMakeRequest(endpoint)) {
                    await this.waitForNextWindow(endpoint);
                }
                
                // Fazer requisição
                const response = await fetch(url, options);
                
                // Se for 429, aguardar e tentar novamente
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelay * attempt;
                    
                    console.log(`Rate limit 429. Tentativa ${attempt}/${this.maxRetries}. Aguardando ${delay/1000}s...`);
                    
                    // Mostrar notificação para o usuário
                    addNotification(`Servidor sobrecarregado. Tentativa ${attempt}/${this.maxRetries}. Aguardando ${Math.ceil(delay/1000)}s...`, 'warning');
                    
                    if (attempt < this.maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }
                
                // Verificar erros de autenticação
                if (!response.ok && (response.status === 401 || response.status === 403)) {
                    try {
                        const errorData = await response.json();
                        if (handleAuthError(response, errorData)) {
                            // Se o logout foi executado, não continuar com as tentativas
                            return response;
                        }
                    } catch (e) {
                        // Se não conseguir fazer parse do JSON, continuar normalmente
                    }
                }
                
                // Se não for 429 ou última tentativa, retornar resposta
                return response;
                
            } catch (error) {
                lastError = error;
                console.error(`Erro na tentativa ${attempt}/${this.maxRetries}:`, error);
                
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * attempt;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError || new Error('Todas as tentativas falharam');
    }
};

// Sistema de notificações
let notifications = [];
let unreadCount = 0;
let notificationPermission = 'default';
let notificationSound = null;

// Elementos DOM
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const logoutBtn = document.getElementById('logout-btn');
const currentUserSpan = document.getElementById('current-user');
const conversationsList = document.getElementById('conversations-list');
const chatPlaceholder = document.getElementById('chat-placeholder');
const chatArea = document.getElementById('chat-area');
const chatRoomTitle = document.getElementById('chat-room-title');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const newGroupBtn = document.getElementById('new-group-btn');
const newChatModal = document.getElementById('new-chat-modal');
const newGroupModal = document.getElementById('new-group-modal');
const addMemberModal = document.getElementById('add-member-modal');
const closeModalBtn = document.getElementById('close-modal');
const closeGroupModalBtn = document.getElementById('close-group-modal');
const closeAddMemberModalBtn = document.getElementById('close-add-member-modal');
const newChatUserSelect = document.getElementById('new-chat-user');
const newChatNameInput = document.getElementById('new-chat-name');
const newGroupNameInput = document.getElementById('new-group-name');
const newGroupDescriptionInput = document.getElementById('new-group-description');
const searchUsersInput = document.getElementById('search-users-input');
const searchResults = document.getElementById('search-results');
const selectedMembers = document.getElementById('selected-members');
const createChatBtn = document.getElementById('create-chat-btn');
const createGroupBtn = document.getElementById('create-group-btn');
const cancelChatBtn = document.getElementById('cancel-chat-btn');
const cancelGroupBtn = document.getElementById('cancel-group-btn');
const searchConversations = document.getElementById('search-conversations');
const attachFileBtn = document.getElementById('attach-file-btn');
const attachImageBtn = document.getElementById('attach-image-btn');
const fileInput = document.getElementById('file-input');
const addMemberBtn = document.getElementById('add-member-btn');
const addMemberUserSelect = document.getElementById('add-member-user');
const confirmAddMemberBtn = document.getElementById('confirm-add-member-btn');
const cancelAddMemberBtn = document.getElementById('cancel-add-member-btn');
const changePhotoModal = document.getElementById('change-photo-modal');
const closeChangePhotoModalBtn = document.getElementById('close-change-photo-modal');
const profilePhotoInput = document.getElementById('profile-photo-input');
const uploadPhotoBtn = document.getElementById('upload-photo-btn');
const cancelPhotoBtn = document.getElementById('cancel-photo-btn');
const currentPhotoAvatar = document.getElementById('current-photo-avatar');
const userAvatarHeader = document.getElementById('user-avatar-header');
const editGroupBtn = document.getElementById('edit-group-btn');
const editGroupModal = document.getElementById('edit-group-modal');
const closeEditGroupModalBtn = document.getElementById('close-edit-group-modal');
const editGroupNameInput = document.getElementById('edit-group-name');
const editGroupDescriptionInput = document.getElementById('edit-group-description');
const groupPhotoInput = document.getElementById('group-photo-input');
const saveGroupBtn = document.getElementById('save-group-btn');
const cancelEditGroupBtn = document.getElementById('cancel-edit-group-btn');
const deleteGroupBtn = document.getElementById('delete-group-btn');
const sidebarToggle = document.getElementById('sidebar-toggle');
const chatSidebar = document.querySelector('.chat-sidebar');
const editMessageModal = document.getElementById('edit-message-modal');
const closeEditMessageModalBtn = document.getElementById('close-edit-message-modal');
const editMessageContentInput = document.getElementById('edit-message-content');
const saveMessageBtn = document.getElementById('save-message-btn');
const cancelEditMessageBtn = document.getElementById('cancel-edit-message-btn');

// Modal de exclusão de grupo
const deleteGroupModal = document.getElementById('delete-group-modal');
const closeDeleteGroupModalBtn = document.getElementById('close-delete-group-modal');
const confirmDeleteGroupBtn = document.getElementById('confirm-delete-group-btn');
const cancelDeleteGroupBtn = document.getElementById('cancel-delete-group-btn');
const confirmGroupNameInput = document.getElementById('confirm-group-name');
const deleteGroupNameSpan = document.getElementById('delete-group-name');

// Elementos de notificação
const notificationsBtn = document.getElementById('notifications-btn');
const notificationsCount = document.getElementById('notifications-count');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notificationsList = document.getElementById('notifications-list');
const markAllReadBtn = document.getElementById('mark-all-read-btn');

// ===== FUNÇÕES DE AUTENTICAÇÃO =====

// Alternar entre formulários de login e registro
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        }, 'auth');
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showChatScreen();
            loadConversations();
            initializeSocket();
        } else {
            showError(data.message || 'Erro no login');
        }
    } catch (error) {
        showError('Erro de conexão');
        console.error('Erro no login:', error);
    }
});

// Registro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const nickname = document.getElementById('register-nickname').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, nickname, password })
        }, 'auth');
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Conta criada com sucesso! Faça login para continuar.');
            showLoginLink.click();
        } else {
            showError(data.message || 'Erro no registro');
        }
    } catch (error) {
        showError('Erro de conexão');
        console.error('Erro no registro:', error);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (socket) {
        socket.disconnect();
    }
    showAuthScreen();
});

// ===== FUNÇÕES DE NAVEGAÇÃO =====

function showAuthScreen() {
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
}

function showChatScreen() {
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    currentUserSpan.textContent = currentUser.nickname || currentUser.username;
    updateUserAvatarDisplay();
}

// ===== FUNÇÕES DE CONVERSAS =====

async function loadConversations() {
    try {
        console.log('Carregando conversas...');
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('Token não encontrado para carregar conversas');
            return;
        }
        
        // Carregar salas do usuário
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/rooms`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, 'rooms');
        
        console.log('Resposta da API de salas:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Dados de salas recebidos:', data);
            
            const rooms = data.data || [];
            
            if (Array.isArray(rooms)) {
                displayConversations(rooms);
            } else {
                console.error('Dados de salas não são um array:', rooms);
            }
        } else {
            const errorText = await response.text();
            console.error('Erro ao carregar salas:', response.status, errorText);
        }
    } catch (error) {
        console.error('Erro ao carregar conversas:', error);
    }
}

function displayConversations(rooms) {
    conversationsList.innerHTML = '';
    
    if (rooms.length === 0) {
        conversationsList.innerHTML = '<div class="no-conversations">Nenhuma conversa encontrada</div>';
        return;
    }
    
    rooms.forEach(room => {
        createConversationElement(room);
    });
}

function createConversationElement(room) {
    const conversationDiv = document.createElement('div');
    conversationDiv.className = 'conversation-item';
    conversationDiv.setAttribute('data-room-id', room.id);
    
    // Determinar o nome da conversa baseado no tipo
    let conversationName = room.name || 'Conversa sem nome';
    let conversationAvatar = '';
    
    if (room.type === 'direct') {
        // Para conversas diretas, mostrar o nome do outro usuário
        if (room.members && room.members.length > 0) {
            const otherMember = room.members.find(member => member.id !== currentUser.id);
            if (otherMember) {
                conversationName = otherMember.nickname || otherMember.username || 'Usuário';
                conversationAvatar = otherMember.avatar;
                console.log('Avatar do outro membro:', conversationAvatar);
            }
        }
    } else if (room.type === 'group') {
        // Para grupos, sempre usar o nome do grupo
        conversationName = room.name || 'Grupo sem nome';
        // Para grupos, usar o avatar do grupo se existir
        conversationAvatar = room.avatar;
    }
    
    console.log('Criando conversa:', {
        type: room.type,
        name: conversationName,
        avatar: conversationAvatar,
        members: room.members
    });
    
    // Criar avatar da conversa
    let avatarContent = '';
    let avatarClass = 'conversation-avatar';
    
    if (conversationAvatar && conversationAvatar.trim() !== '') {
        avatarContent = `<img src="${conversationAvatar}" alt="${conversationName}" class="conversation-avatar-img" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>';">`;
        avatarClass = 'conversation-avatar has-image';
        console.log('Avatar com imagem criado para:', conversationName);
    } else if (room.type === 'group') {
        avatarContent = '<i class="fas fa-users"></i>';
        console.log('Avatar de grupo criado para:', conversationName);
    } else {
        avatarContent = '<i class="fas fa-user"></i>';
        console.log('Avatar padrão criado para:', conversationName);
    }
    
    console.log('HTML do avatar:', avatarContent);
    
    // Contador de mensagens não lidas
    const unreadCount = room.unreadCount || 0;
    const unreadBadge = unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : '';
    
    // Preparar informações da última mensagem
    let lastMessageInfo = '';
    if (room.lastMessage) {
        const lastMessage = room.lastMessage;
        let messagePreview = '';
        
        if (lastMessage.type === 'image') {
            messagePreview = '🖼️ Imagem';
        } else if (lastMessage.type === 'file') {
            messagePreview = '📎 Arquivo';
        } else {
            // Para mensagens de texto, mostrar preview (máximo 30 caracteres)
            messagePreview = lastMessage.content.length > 30 
                ? lastMessage.content.substring(0, 30) + '...' 
                : lastMessage.content;
        }
        
        const senderName = lastMessage.sender?.nickname || lastMessage.sender?.username || 'Usuário';
        const isOwnMessage = lastMessage.senderId === currentUser.id;
        const senderPrefix = isOwnMessage ? 'Você' : senderName;
        
        lastMessageInfo = `
            <div class="conversation-last-message">
                <span class="last-message-sender ${isOwnMessage ? 'own-message' : ''}">${senderPrefix}:</span>
                <span class="last-message-content">${messagePreview}</span>
                <span class="last-message-time">${formatTimeAgo(new Date(lastMessage.createdAt))}</span>
            </div>
        `;
    }
    
    conversationDiv.innerHTML = `
        <div class="${avatarClass}">
            ${avatarContent}
            ${unreadBadge}
        </div>
        <div class="conversation-info">
            <div class="conversation-name">${conversationName}</div>
            <div class="conversation-type">${room.type === 'group' ? 'Grupo' : 'Conversa privada'}</div>
            ${lastMessageInfo}
        </div>
    `;
    
    // Adicionar event listener para selecionar a conversa
    conversationDiv.addEventListener('click', (event) => selectConversation(room, event));
    
    conversationsList.appendChild(conversationDiv);
}

function selectConversation(room, event = null) {
    // Limpar mensagens anteriores antes de carregar novas
    messagesContainer.innerHTML = '<div class="loading-messages">Carregando mensagens...</div>';
    
    // Remover seleção anterior
    document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
    
    // Selecionar conversa atual (corrigido para usar o elemento correto)
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        // Se não houver event, encontrar o elemento da conversa e selecioná-lo
        const conversationElement = document.querySelector(`[data-room-id="${room.id}"]`);
        if (conversationElement) {
            conversationElement.classList.add('active');
        }
    }
    
    currentRoom = room;
    joinRoom(room.id);
    loadMessages(room.id);
    showChatArea(room.name, room.type);
    
    // Marcar mensagens como lidas ao entrar na conversa
    markConversationAsRead(room.id);
    
    // Atualizar botões baseado no tipo de sala e permissões
    console.log('Chamando updateRoomButtons com a sala:', room);
    updateRoomButtons(room);
}

// ===== FUNÇÕES DE SALAS E MENSAGENS =====

// Marcar conversa como lida
async function markConversationAsRead(roomId) {
    try {
        console.log('Marcando conversa como lida:', roomId);
        
        // Mostrar indicador visual de que está marcando como lida
        showMarkingAsReadIndicator(roomId);
        
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await makeRequestWithRateLimit(
            `${API_BASE}/api/messages/room/${roomId}/read`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            },
            'mark-read'
        );
        
        if (response.ok) {
            console.log(`Conversa ${roomId} marcada como lida com sucesso`);
            
            // Marcar todas as mensagens da sala como lidas
            await markAllMessagesAsRead(roomId);
            
            // Atualizar status visual das mensagens com animação
            updateMessageStatusesWithAnimation(roomId, 'read');
            
            // Mostrar confirmação visual
            showReadConfirmation();
            
            // Remover badge de mensagens não lidas
            removeUnreadBadge(roomId);
            
            // Validar se o badge foi removido
            validateUnreadBadge(roomId);
            
            // Atualizar indicadores de leitura em tempo real
            updateReadIndicators(roomId);
        } else {
            console.warn(`Erro ao marcar conversa como lida: ${response.status}`);
            // Fallback: remover badge mesmo com erro
            removeUnreadBadge(roomId);
            hideMarkingAsReadIndicator(roomId);
        }
    } catch (error) {
        console.error('Erro ao marcar conversa como lida:', error);
        // Fallback: remover badge mesmo com erro
        removeUnreadBadge(roomId);
        hideMarkingAsReadIndicator(roomId);
    }
}

// Marcar todas as mensagens de uma sala como lidas
async function markAllMessagesAsRead(roomId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await makeRequestWithRateLimit(
            `${API_BASE}/api/messages/room/${roomId}/mark-all-read`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            },
            'mark-all-read'
        );
        
        if (response.ok) {
            console.log(`Todas as mensagens da sala ${roomId} marcadas como lidas`);
            
            // Atualizar status visual das mensagens
            updateMessageStatuses(roomId, 'read');
        } else {
            console.warn(`Erro ao marcar mensagens como lidas: ${response.status}`);
        }
    } catch (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
    }
}

// Atualizar status visual das mensagens
function updateMessageStatuses(roomId, status) {
    const messageElements = document.querySelectorAll(`[data-message-id]`);
    messageElements.forEach(element => {
        const statusElement = element.querySelector('.message-status, .message-loading');
        if (statusElement) {
            // Adicionar classe de transição
            statusElement.classList.add('transitioning');
            
            // Atualizar status com animação
            if (status === 'read') {
                statusElement.className = 'message-status';
                statusElement.innerHTML = `
                    <span class="status-icon status-read">✓✓</span>
                `;
                
                // Adicionar indicador de leitura temporário
                setTimeout(() => {
                    addReadIndicator(element);
                }, 200);
            } else if (status === 'delivered') {
                statusElement.className = 'message-status';
                statusElement.innerHTML = `
                    <span class="status-icon status-delivered">✓✓</span>
                `;
            } else if (status === 'sent') {
                statusElement.className = 'message-status';
                statusElement.innerHTML = `
                    <span class="status-icon status-sent">✓</span>
                `;
            }
            
            // Remover classe de transição após animação
            setTimeout(() => {
                statusElement.classList.remove('transitioning');
            }, 400);
        }
    });
    
    console.log(`Status das mensagens atualizado para: ${status}`);
}

// Função auxiliar para remover badge de mensagens não lidas
function removeUnreadBadge(roomId) {
    const conversationElement = document.querySelector(`[data-room-id="${roomId}"]`);
    if (conversationElement) {
        const unreadBadge = conversationElement.querySelector('.unread-badge');
        if (unreadBadge) {
            console.log(`Removendo badge da conversa ${roomId}`);
            unreadBadge.remove();
        } else {
            console.log(`Badge não encontrado para conversa ${roomId}`);
        }
    } else {
        console.warn(`Elemento da conversa ${roomId} não encontrado`);
    }
}

// Mostrar indicador visual de que está marcando como lida
function showMarkingAsReadIndicator(roomId) {
    const messageElements = document.querySelectorAll(`[data-message-id]`);
    messageElements.forEach(element => {
        element.classList.add('marking-as-read');
    });
    
    console.log('Indicador visual de marcação como lida ativado');
}

// Esconder indicador visual de marcação como lida
function hideMarkingAsReadIndicator(roomId) {
    const messageElements = document.querySelectorAll(`[data-message-id]`);
    messageElements.forEach(element => {
        element.classList.remove('marking-as-read');
    });
    
    console.log('Indicador visual de marcação como lida desativado');
}

// Atualizar status das mensagens com animação
function updateMessageStatusesWithAnimation(roomId, status) {
    const messageElements = document.querySelectorAll(`[data-message-id]`);
    
    messageElements.forEach((element, index) => {
        setTimeout(() => {
            const statusElement = element.querySelector('.message-status, .message-loading');
            if (statusElement) {
                // Adicionar classe de transição
                statusElement.classList.add('transitioning');
                
                // Atualizar status
                if (status === 'read') {
                    statusElement.className = 'message-status';
                    statusElement.innerHTML = `
                        <span class="status-icon status-read">✓✓</span>
                    `;
                    
                    // Adicionar indicador de leitura
                    addReadIndicator(element);
                }
                
                // Remover classe de transição após animação
                setTimeout(() => {
                    statusElement.classList.remove('transitioning');
                }, 400);
            }
        }, index * 100); // Delay escalonado para efeito cascata
    });
    
    console.log('Status das mensagens atualizado com animação');
}

// Adicionar indicador de leitura
function addReadIndicator(messageElement) {
    // Remover indicador existente
    const existingIndicator = messageElement.querySelector('.read-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Criar novo indicador
    const indicator = document.createElement('div');
    indicator.className = 'read-indicator';
    indicator.textContent = 'Lida';
    
    messageElement.appendChild(indicator);
    
    // Remover após 3 segundos
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.remove();
        }
    }, 3000);
}

// Mostrar confirmação de leitura
function showReadConfirmation() {
    // Remover confirmação existente
    const existingConfirmation = document.querySelector('.read-confirmation-badge');
    if (existingConfirmation) {
        existingConfirmation.remove();
    }
    
    // Criar nova confirmação
    const confirmation = document.createElement('div');
    confirmation.className = 'read-confirmation-badge';
    confirmation.innerHTML = `
        <i class="fas fa-check-circle"></i>
        Mensagens marcadas como lidas
    `;
    
    document.body.appendChild(confirmation);
    
    // Remover após 3 segundos
    setTimeout(() => {
        if (confirmation.parentNode) {
            confirmation.remove();
        }
    }, 3000);
    
    console.log('Confirmação de leitura exibida');
}

// Atualizar indicadores de leitura em tempo real
function updateReadIndicators(roomId) {
    // Atualizar contadores de mensagens não lidas
    updateUnreadCounters();
    
    // Atualizar indicadores visuais
    updateVisualIndicators();
    
    console.log('Indicadores de leitura atualizados');
}

// Atualizar contadores de mensagens não lidas
function updateUnreadCounters() {
    const unreadBadges = document.querySelectorAll('.unread-badge');
    unreadBadges.forEach(badge => {
        const count = parseInt(badge.textContent);
        if (count > 0) {
            badge.classList.add('unread-count-badge');
        }
    });
}

// Atualizar indicadores visuais
function updateVisualIndicators() {
    // Atualizar cores e animações dos badges
    const unreadBadges = document.querySelectorAll('.unread-badge');
    unreadBadges.forEach(badge => {
        if (badge.textContent === '0') {
            badge.style.display = 'none';
        }
    });
}

// Função para validar e verificar se o badge existe
function validateUnreadBadge(roomId) {
    const conversationElement = document.querySelector(`[data-room-id="${roomId}"]`);
    if (!conversationElement) {
        console.warn(`Elemento da conversa ${roomId} não encontrado`);
        return false;
    }
    
    const unreadBadge = conversationElement.querySelector('.unread-badge');
    if (!unreadBadge) {
        console.log(`Badge não encontrado para conversa ${roomId} - OK`);
        return true;
    }
    
    // Verificar se o badge está visível e posicionado corretamente
    const badgeRect = unreadBadge.getBoundingClientRect();
    const avatarRect = conversationElement.querySelector('.conversation-avatar')?.getBoundingClientRect();
    
    if (avatarRect) {
        console.log(`Badge encontrado para conversa ${roomId}:`, {
            badgeVisible: unreadBadge.style.display !== 'none',
            badgePosition: { top: badgeRect.top, right: badgeRect.right },
            avatarPosition: { top: avatarRect.top, right: avatarRect.right },
            badgeSize: { width: badgeRect.width, height: badgeRect.height }
        });
    }
    
    return true;
}

// Função para forçar a criação de um badge se necessário
function forceCreateUnreadBadge(roomId, count = 1) {
    const conversationElement = document.querySelector(`[data-room-id="${roomId}"]`);
    if (!conversationElement) return false;
    
    // Remover badge existente se houver
    const existingBadge = conversationElement.querySelector('.unread-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Criar novo badge
    const unreadBadge = document.createElement('div');
    unreadBadge.className = 'unread-badge';
    unreadBadge.textContent = count > 99 ? '99+' : count.toString();
    
    const avatarElement = conversationElement.querySelector('.conversation-avatar');
    if (avatarElement) {
        avatarElement.appendChild(unreadBadge);
        console.log(`Badge forçado criado para conversa ${roomId} com contador ${count}`);
        return true;
    }
    
    return false;
}

// Função para fazer requests com rate limiting e retry usando o sistema existente
async function makeRequestWithRateLimit(url, options, endpoint = 'default') {
    try {
        return await rateLimiter.fetchWithRetry(url, options, endpoint);
    } catch (error) {
        console.error('Erro na requisição com rate limiting:', error);
        throw error;
    }
}

// Função para detectar tipo de arquivo
function detectFileType(file) {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
        return 'image';
    } else if (['pdf'].includes(fileExtension)) {
        return 'pdf';
    } else if (['doc', 'docx', 'txt', 'rtf'].includes(fileExtension)) {
        return 'document';
    } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExtension)) {
        return 'audio';
    } else if (['mp4', 'avi', 'mov', 'mkv'].includes(fileExtension)) {
        return 'video';
    } else {
        return 'file';
    }
}

// Função para formatar tamanho de arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Função para criar preview de arquivo
function createFilePreview(file, type) {
    const filePreview = document.createElement('div');
    filePreview.className = 'file-preview';
    
    const icon = document.createElement('span');
    icon.className = `file-type-icon file-type-${type}`;
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    
    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = formatFileSize(file.size);
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = 'Baixar';
    downloadBtn.onclick = () => downloadFile(file);
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    
    filePreview.appendChild(icon);
    filePreview.appendChild(fileInfo);
    filePreview.appendChild(downloadBtn);
    
    return filePreview;
}

// Função para download de arquivo
function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Função para download de arquivo por URL
function downloadFileFromUrl(url, fileName) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Variável global para armazenar a mensagem sendo respondida
let replyingToMessage = null;

// Função para responder a uma mensagem
function replyToMessage(message) {
    console.log('Respondendo à mensagem:', message);
    
    // Armazenar a mensagem sendo respondida
    replyingToMessage = message;
    
    // Mostrar preview da resposta
    showReplyPreview(message);
    
    // Focar no input de mensagem
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.focus();
        messageInput.placeholder = `Respondendo a ${message.sender?.nickname || 'Usuário'}...`;
    }
    
    // Adicionar classe ao input para indicar que está respondendo
    if (messageInput) {
        messageInput.classList.add('replying');
    }
    
    // Mostrar botão de resposta
    const replyBtn = document.getElementById('reply-btn');
    if (replyBtn) {
        replyBtn.style.display = 'flex';
        replyBtn.classList.add('active');
    }
}

// Função para mostrar preview da resposta
function showReplyPreview(message) {
    // Remover preview existente se houver
    removeReplyPreview();
    
    const messageInputContainer = document.querySelector('.message-input-container');
    if (!messageInputContainer) return;
    
    const replyPreview = document.createElement('div');
    replyPreview.className = 'reply-preview';
    replyPreview.id = 'reply-preview';
    
    // Determinar o tipo de conteúdo para mostrar
    let contentPreview = '';
    let fileIcon = '';
    
    if (message.type === 'image') {
        contentPreview = '🖼️ Imagem';
        fileIcon = '🖼️';
    } else if (['document', 'pdf', 'file', 'audio', 'video'].includes(message.type)) {
        contentPreview = message.fileName || 'Arquivo';
        fileIcon = getFileTypeIcon(message.type);
    } else {
        contentPreview = message.content;
        fileIcon = '';
    }
    
    // Truncar conteúdo se for muito longo
    if (contentPreview.length > 100) {
        contentPreview = contentPreview.substring(0, 100) + '...';
    }
    
    // Obter avatar do remetente
    let avatarContent = '';
    if (message.sender?.avatar) {
        avatarContent = `<img src="${message.sender.avatar}" alt="${message.sender.nickname}" class="reply-preview-avatar-img">`;
    } else {
        avatarContent = `<span>${(message.sender?.nickname || 'U').charAt(0).toUpperCase()}</span>`;
    }
    
    replyPreview.innerHTML = `
        <div class="reply-preview-header">
            <div class="reply-preview-title">Respondendo a</div>
            <button class="reply-cancel-btn" onclick="cancelReply()" title="Cancelar resposta">
                ✕
            </button>
        </div>
        <div class="reply-preview-content">
            <div class="reply-preview-avatar">
                ${avatarContent}
            </div>
            <div class="reply-preview-text">
                <div class="reply-preview-sender">${message.sender?.nickname || 'Usuário'}</div>
                <div class="reply-preview-message">
                    ${fileIcon} ${contentPreview}
                </div>
            </div>
        </div>
    `;
    
    // Inserir acima do message-input-container
    messageInputContainer.parentNode.insertBefore(replyPreview, messageInputContainer);
}

// Função para remover preview da resposta
function removeReplyPreview() {
    const existingPreview = document.getElementById('reply-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
}

// Função para cancelar resposta
function cancelReply() {
    console.log('Cancelando resposta');
    
    // Limpar variável global
    replyingToMessage = null;
    
    // Remover preview
    removeReplyPreview();
    
    // Limpar input
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.placeholder = 'Digite sua mensagem...';
        messageInput.classList.remove('replying');
    }
    
    // Ocultar botão de resposta
    const replyBtn = document.getElementById('reply-btn');
    if (replyBtn) {
        replyBtn.style.display = 'none';
        replyBtn.classList.remove('active');
    }
}

// Função para obter ícone do tipo de arquivo
function getFileTypeIcon(type) {
    switch (type) {
        case 'document':
            return '📄';
        case 'pdf':
            return '📕';
        case 'image':
            return '🖼️';
        case 'audio':
            return '🎵';
        case 'video':
            return '🎬';
        case 'file':
        default:
            return '📎';
    }
}

// Função para scroll até uma mensagem específica
function scrollToMessage(messageId) {
    console.log('Navegando para mensagem:', messageId);
    
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        // Scroll suave até a mensagem
        messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        // Destacar a mensagem temporariamente
        messageElement.style.backgroundColor = '#fff3cd';
        messageElement.style.border = '2px solid #ffc107';
        messageElement.style.borderRadius = '8px';
        
        // Remover destaque após 3 segundos
        setTimeout(() => {
            messageElement.style.backgroundColor = '';
            messageElement.style.border = '';
            messageElement.style.borderRadius = '';
        }, 3000);
        
        console.log('Mensagem encontrada e destacada');
    } else {
        console.warn('Mensagem não encontrada:', messageId);
        showError('Mensagem não encontrada');
    }
}

// Função para criar mensagem temporária (enviando)
function createTemporaryMessage(content, replyToId = null) {
    const tempMessage = {
        id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        content: content,
        type: 'text',
        roomId: currentRoom.id,
        senderId: currentUser.id,
        sender: {
            id: currentUser.id,
            username: currentUser.username,
            nickname: currentUser.nickname,
            avatar: currentUser.avatar
        },
        replyToId: replyToId,
        replyTo: replyToId ? {
            id: replyingToMessage?.id,
            content: replyingToMessage?.content?.substring(0, 50) + (replyingToMessage?.content?.length > 50 ? '...' : ''),
            sender: { username: replyingToMessage?.sender?.nickname || 'Usuário' }
        } : null,
        isEdited: false,
        isDeleted: false,
        status: 'sending',
        createdAt: new Date(),
        updatedAt: new Date(),
        isTemporary: true
    };
    
    return tempMessage;
}

// Função para atualizar status de uma mensagem
function updateMessageStatus(messageId, newStatus) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    // Remover classe temporária se a mensagem foi confirmada
    if (newStatus !== 'sending') {
        messageElement.classList.remove('temporary');
    }
    
    // Atualizar o status visual
    const statusElement = messageElement.querySelector('.message-status, .message-loading');
    if (statusElement) {
        if (newStatus === 'sending') {
            statusElement.className = 'message-loading';
            statusElement.innerHTML = `
                <div class="loading-spinner"></div>
                <span>Enviando...</span>
            `;
        } else {
            statusElement.className = 'message-status';
            const statusIcon = getStatusIcon(newStatus);
            const statusColor = getStatusColor(newStatus);
            statusElement.innerHTML = `
                <span class="status-icon" style="color: ${statusColor}">${statusIcon}</span>
            `;
        }
    }
    
    console.log(`Status da mensagem ${messageId} atualizado para: ${newStatus}`);
}

// Função para obter ícone do status
function getStatusIcon(status) {
    switch (status) {
        case 'sending':
            return '⏳';
        case 'sent':
            return '✓';
        case 'delivered':
            return '✓✓';
        case 'read':
            return '✓✓';
        case 'error':
            return '⚠️';
        default:
            return '✓';
    }
}

// Função para obter cor do status
function getStatusColor(status) {
    switch (status) {
        case 'sending':
            return '#007bff';
        case 'sent':
            return '#666';
        case 'delivered':
            return '#666';
        case 'read':
            return '#0084ff';
        case 'error':
            return '#dc3545';
        default:
            return '#666';
    }
}

// Função para marcar mensagem como erro
function markMessageAsError(messageId, errorMessage = 'Erro ao enviar') {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    // Remover classe temporária
    messageElement.classList.remove('temporary');
    
    // Atualizar status para erro
    const statusElement = messageElement.querySelector('.message-status, .message-loading');
    if (statusElement) {
        statusElement.className = 'message-status';
        statusElement.innerHTML = `
            <span class="status-error-icon" title="${errorMessage}" onclick="retryMessage('${messageId}')">⚠️</span>
        `;
    }
    
    console.log(`Mensagem ${messageId} marcada como erro: ${errorMessage}`);
}

// Função para tentar reenviar mensagem
function retryMessage(messageId) {
    console.log('Tentando reenviar mensagem:', messageId);
    
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    // Obter conteúdo da mensagem
    const messageText = messageElement.querySelector('.message-text');
    if (!messageText) return;
    
    const content = messageText.textContent;
    
    // Remover mensagem temporária
    messageElement.remove();
    
    // Tentar enviar novamente
    sendMessageWithContent(content, messageId);
}

// Função para encontrar mensagem temporária
function findTemporaryMessage(content, type) {
    const tempMessages = document.querySelectorAll('.message.temporary');
    
    for (const tempMsg of tempMessages) {
        const messageText = tempMsg.querySelector('.message-text');
        if (messageText) {
            // Para mensagens de texto, comparar conteúdo
            if (type === 'text' && messageText.textContent === content) {
                return tempMsg;
            }
            // Para outros tipos, comparar URL/conteúdo
            if (type !== 'text' && messageText.innerHTML.includes(content)) {
                return tempMsg;
            }
        }
    }
    
    return null;
}

// Função para enviar mensagem com conteúdo específico
function sendMessageWithContent(content, originalMessageId = null) {
    console.log('Reenviando mensagem com conteúdo:', content);
    
    // Preparar dados da mensagem
    const messageData = {
        content,
        roomId: currentRoom.id,
        senderId: currentUser.id,
        type: 'text'
    };
    
    // Adicionar ID da mensagem respondida se houver
    if (replyingToMessage) {
        messageData.replyToId = replyingToMessage.id;
    }
    
    // Enviar via Socket.IO
    if (socket && currentRoom) {
        socket.emit('send_message', messageData);
    } else {
        // Fallback para HTTP
        sendMessageViaHTTP(messageData);
    }
}

// Função para enviar mensagem via HTTP
async function sendMessageViaHTTP(messageData) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(messageData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.message || 'Erro ao reenviar mensagem');
        } else {
            console.log('Mensagem reenviada com sucesso via HTTP');
        }
    } catch (error) {
        console.error('Erro ao reenviar mensagem via HTTP:', error);
        showError('Erro de conexão ao reenviar');
    }
}

// Atualizar contador de mensagens não lidas
async function updateUnreadCount(roomId) {
    const conversationElement = document.querySelector(`[data-room-id="${roomId}"]`);
    if (!conversationElement) return;
    
    try {
        // Buscar contador atualizado do backend
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await makeRequestWithRateLimit(
            `${API_BASE}/api/messages/room/${roomId}/unread-count`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            },
            'unread-count'
        );
        
        if (response.ok) {
            const data = await response.json();
            const unreadCount = data.count || 0;
            
            // Atualizar ou criar badge
            let unreadBadge = conversationElement.querySelector('.unread-badge');
            
            if (unreadCount > 0) {
                if (!unreadBadge) {
                    // Criar novo badge
                    unreadBadge = document.createElement('div');
                    unreadBadge.className = 'unread-badge';
                    
                    const avatarElement = conversationElement.querySelector('.conversation-avatar');
                    if (avatarElement) {
                        avatarElement.appendChild(unreadBadge);
                    }
                }
                unreadBadge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
                unreadBadge.style.display = 'block';
            } else if (unreadBadge) {
                // Remover badge se não há mensagens não lidas
                unreadBadge.remove();
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar contador de mensagens não lidas:', error);
        
        // Fallback: incrementar contador local
        let unreadBadge = conversationElement.querySelector('.unread-badge');
        let currentCount = 0;
        
        if (unreadBadge) {
            currentCount = parseInt(unreadBadge.textContent) || 0;
            currentCount++;
            unreadBadge.textContent = currentCount > 99 ? '99+' : currentCount.toString();
        } else {
            // Criar novo badge
            unreadBadge = document.createElement('div');
            unreadBadge.className = 'unread-badge';
            unreadBadge.textContent = '1';
            
            const avatarElement = conversationElement.querySelector('.conversation-avatar');
            if (avatarElement) {
                avatarElement.appendChild(unreadBadge);
            }
        }
    }
}

// Atualizar última mensagem de uma conversa
async function updateConversationLastMessage(roomId, message) {
    const conversationElement = document.querySelector(`[data-room-id="${roomId}"]`);
    if (!conversationElement) return;
    
    try {
        // Buscar dados atualizados da sala
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await makeRequestWithRateLimit(
            `${API_BASE}/api/rooms/${roomId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            },
            'room-info'
        );
        
        if (response.ok) {
            const room = await response.json();
            
            // Atualizar elemento da conversa com novos dados
            const conversationInfo = conversationElement.querySelector('.conversation-info');
            if (conversationInfo) {
                // Atualizar última mensagem
                let lastMessageInfo = '';
                if (room.lastMessage) {
                    const lastMessage = room.lastMessage;
                    let messagePreview = '';
                    
                    if (lastMessage.type === 'image') {
                        messagePreview = '🖼️ Imagem';
                    } else if (lastMessage.type === 'file') {
                        messagePreview = '📎 Arquivo';
                    } else {
                        messagePreview = lastMessage.content.length > 30 
                            ? lastMessage.content.substring(0, 30) + '...' 
                            : lastMessage.content;
                    }
                    
                    const senderName = lastMessage.sender?.nickname || lastMessage.sender?.username || 'Usuário';
                    lastMessageInfo = `
                        <div class="conversation-last-message">
                            <span class="last-message-sender">${senderName}:</span>
                            <span class="last-message-content">${messagePreview}</span>
                        </div>
                    `;
                }
                
                // Atualizar apenas a parte da última mensagem
                const existingLastMessage = conversationInfo.querySelector('.conversation-last-message');
                if (existingLastMessage) {
                    existingLastMessage.remove();
                }
                if (lastMessageInfo) {
                    conversationInfo.insertAdjacentHTML('beforeend', lastMessageInfo);
                }
            }
            
            // Atualizar contador de mensagens não lidas
            await updateUnreadCount(roomId);
            
        } else {
            console.error('Erro ao buscar dados da sala para atualizar última mensagem');
        }
    } catch (error) {
        console.error('Erro ao atualizar última mensagem da conversa:', error);
    }
}

function joinRoom(roomId) {
    console.log('Entrando na sala:', { roomId, currentRoomId: currentRoom?.id, socketExists: !!socket });
    
    if (socket) {
        // Sair da sala anterior se existir
        if (currentRoom && currentRoom.id !== roomId) {
            console.log('Saindo da sala anterior:', currentRoom.id);
            socket.emit('leave_room', { roomId: currentRoom.id, userId: currentUser.id });
        }
        
        // Entrar na nova sala
        console.log('Entrando na nova sala:', roomId);
        socket.emit('join_room', { roomId, userId: currentUser.id });
    } else {
        console.error('Socket não disponível para entrar na sala');
    }
}

async function loadMessages(roomId) {
    try {
        console.log('Carregando mensagens para sala:', roomId);
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('Token não encontrado para carregar mensagens');
            messagesContainer.innerHTML = '<div class="error-messages">Erro: Token não encontrado</div>';
            return;
        }
        
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/messages/room/${roomId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, 'messages');
        
        console.log('Resposta da API de mensagens:', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Dados das mensagens:', data);
            const messages = data.data?.messages || [];
            console.log('Mensagens extraídas:', messages);
            displayMessages(messages);
        } else {
            console.error('Erro na API de mensagens:', response.status);
            const errorText = await response.text();
            console.error('Erro detalhado:', errorText);
            messagesContainer.innerHTML = '<div class="error-messages">Erro ao carregar mensagens. Tente novamente.</div>';
        }
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        messagesContainer.innerHTML = '<div class="error-messages">Erro ao carregar mensagens. Tente novamente.</div>';
    }
}

function displayMessages(messages) {
    console.log('Exibindo mensagens:', messages);
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="no-messages">Nenhuma mensagem ainda</div>';
        return;
    }
    
    messages.forEach((message, index) => {
        console.log(`Criando mensagem ${index + 1}/${messages.length}:`, message);
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
    });
    
    // Fazer scroll para a última mensagem após carregar
    scrollToBottom();
}

function createMessageElement(message) {
    console.log('Criando elemento de mensagem:', message);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.senderId === currentUser.id ? 'own' : ''} ${message.isEdited ? 'edited' : ''}`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    const isOwn = message.senderId === currentUser.id;
    const senderName = isOwn ? currentUser.nickname : message.sender?.nickname || 'Usuário';
    
    console.log('Informações da mensagem:', {
        isOwn,
        senderName,
        currentUserId: currentUser.id,
        messageSenderId: message.senderId,
        messageSender: message.sender,
        messageUsername: message.username,
        messageNickname: message.nickname
    });
    
    // Obter a foto do usuário
    let userAvatar = '';
    if (isOwn) {
        // Para mensagens próprias, usar a foto do usuário atual
        userAvatar = currentUser.avatar;
        console.log('Foto do usuário atual:', userAvatar);
    } else {
        // Para mensagens de outros usuários, usar a foto do remetente
        userAvatar = message.sender?.avatar || message.senderAvatar || message.avatar;
        console.log('Foto do remetente:', {
            senderAvatar: message.sender?.avatar,
            senderAvatarAlt: message.senderAvatar,
            avatar: message.avatar,
            finalAvatar: userAvatar
        });
    }
    
    // Criar o avatar da mensagem
    let avatarContent = '';
    if (userAvatar) {
        avatarContent = `<img src="${userAvatar}" alt="${senderName}" class="message-avatar-img">`;
        console.log('Avatar com imagem criado para:', senderName);
    } else {
        // Fallback para inicial do nome se não houver foto
        avatarContent = `<span>${senderName.charAt(0).toUpperCase()}</span>`;
        console.log('Avatar com inicial criado para:', senderName);
    }
    
    let content = message.content;
    
    // Renderizar conteúdo baseado no tipo de mensagem
    if (message.type === 'image') {
        console.log('Criando mensagem de imagem:', message);
        content = `<div class="message-image-container"><img src="${message.content}" alt="Imagem" class="message-image" onclick="openImageModal('${message.content}')"></div>`;
    } else if (['document', 'pdf', 'file', 'audio', 'video'].includes(message.type)) {
        console.log('Criando mensagem de arquivo:', message);
        const fileName = message.fileName || 'Arquivo';
        const fileSize = message.fileSize ? formatFileSize(message.fileSize) : '';
        
        content = `
            <div class="file-preview" onclick="downloadFileFromUrl('${message.content}', '${fileName}')">
                <span class="file-type-icon file-type-${message.type}"></span>
                <div class="file-info">
                    <div class="file-name">${fileName}</div>
                    ${fileSize ? `<div class="file-size">${fileSize}</div>` : ''}
                </div>
                <button class="download-btn">Baixar</button>
            </div>
        `;
    }
    
    // Adicionar preview da mensagem respondida se houver
    let replyPreview = '';
    if (message.replyTo) {
        replyPreview = `
            <div class="reply-to-message" onclick="scrollToMessage('${message.replyTo.id}')">
                <div class="reply-to-sender">${message.replyTo.sender.username}</div>
                <div class="reply-to-content">${message.replyTo.content}</div>
            </div>
        `;
        content = replyPreview + content;
    }
    
    // Botões de ação para mensagens próprias
    let actionButtons = '';
    if (isOwn) {
        actionButtons = `
            <div class="message-actions">
                <button class="message-action-btn edit" title="Editar mensagem" data-message-id="${message.id}" data-message-content="${message.content.replace(/"/g, '&quot;')}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="message-action-btn delete" title="Excluir mensagem" data-message-id="${message.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }
    
    // Botão de resposta para todas as mensagens
    const replyButton = `
        <button class="message-reply-btn" title="Responder" onclick="replyToMessage(${JSON.stringify(message).replace(/"/g, '&quot;')})">
            <i class="fas fa-reply"></i>
        </button>
    `;
    
    // Adicionar botão de resposta ao header da mensagem
    const messageHeader = `
        <div class="message-header">
            <span class="message-sender">${senderName}</span>
            <span class="message-time">${formatTime(message.createdAt)}</span>
            ${replyButton}
        </div>
    `;
    

    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${avatarContent}
        </div>
        <div class="message-content">
            ${actionButtons}
            ${messageHeader}
            <div class="message-text">${content}</div>
            ${isOwn ? (message.status === 'sending' ? 
                `<div class="message-loading">
                    <div class="loading-spinner"></div>
                    <span>Enviando...</span>
                </div>` : 
                `<div class="message-status">
                    <span class="status-icon ${message.status ? `status-${message.status}` : 'status-sent'}">${getStatusIcon(message.status || 'sent')}</span>
                </div>`
            ) : ''}
            ${!isOwn && message.status === 'read' ? `
                <div class="group-read-indicator">
                    <span>Lida por você</span>
                </div>
            ` : ''}
        </div>
    `;
    
    // Adicionar event listeners para botões de ação
    if (isOwn) {
        const editBtn = messageDiv.querySelector('.message-action-btn.edit');
        const deleteBtn = messageDiv.querySelector('.message-action-btn.delete');
        
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const messageId = editBtn.getAttribute('data-message-id');
                const messageContent = editBtn.getAttribute('data-message-content');
                editMessage(messageId, messageContent);
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const messageId = deleteBtn.getAttribute('data-message-id');
                deleteMessage(messageId);
            });
        }
    }
    
    return messageDiv;
}

function showChatArea(roomName, roomType) {
    chatPlaceholder.classList.add('hidden');
    chatArea.classList.remove('hidden');
    chatRoomTitle.textContent = roomName;
    
    // Mostrar botão de adicionar membro apenas para grupos
    if (roomType === 'group' || roomType === 'channel') {
        addMemberBtn.style.display = 'block';
    } else {
        addMemberBtn.style.display = 'none';
    }
}

function updateRoomButtons(room) {
    console.log('Atualizando botões da sala:', room);
    console.log('Usuário atual:', currentUser);
    
    const addMemberBtn = document.getElementById('add-member-btn');
    const editGroupBtn = document.getElementById('edit-group-btn');
    const deleteGroupBtn = document.getElementById('delete-group-btn');
    
    console.log('Botões encontrados:', {
        addMemberBtn: !!addMemberBtn,
        editGroupBtn: !!editGroupBtn,
        deleteGroupBtn: !!deleteGroupBtn
    });
    
    // Inicialmente ocultar todos os botões
    if (addMemberBtn) addMemberBtn.classList.add('hidden');
    if (editGroupBtn) editGroupBtn.classList.add('hidden');
    if (deleteGroupBtn) deleteGroupBtn.classList.add('hidden');
    
    if (!room || !currentUser) {
        console.log('Sala ou usuário não definidos, mantendo botões ocultos');
        return;
    }
    
    if (room.type === 'group') {
        console.log('Sala é grupo, verificando permissões...');
        
        // Para grupos, verificar se o usuário é membro
        const isMember = isUserMemberOfRoom(room, currentUser.id);
        console.log('Verificação de membro para grupo:', {
            isMember: isMember,
            roomMembers: room.members,
            currentUserId: currentUser.id
        });
        
        if (isMember) {
            // Mostrar botões básicos para membros
            if (addMemberBtn) addMemberBtn.classList.remove('hidden');
            if (editGroupBtn) editGroupBtn.classList.remove('hidden');
            
            // Verificar se o usuário é o criador do grupo
            const isCreator = room.createdBy === currentUser.id;
            console.log('Verificação de criador:', {
                roomCreatedBy: room.createdBy,
                currentUserId: currentUser.id,
                isCreator: isCreator
            });
            
            if (isCreator) {
                console.log('Usuário é criador, mostrando botão de deletar');
                if (deleteGroupBtn) deleteGroupBtn.classList.remove('hidden');
            } else {
                console.log('Usuário não é criador, ocultando botão de deletar');
            }
        } else {
            console.log('Usuário não é membro do grupo');
        }
    } else if (room.type === 'direct') {
        console.log('Sala é conversa direta, verificando permissões...');
        
        // Para conversas diretas, verificar se o usuário é membro
        const isMember = isUserMemberOfRoom(room, currentUser.id);
        console.log('Verificação de membro para conversa direta:', {
            isMember: isMember,
            roomMembers: room.members,
            currentUserId: currentUser.id,
            roomMembersType: typeof room.members,
            roomMembersIsArray: Array.isArray(room.members)
        });
        
        if (isMember) {
            console.log('Usuário é membro da conversa direta, mostrando botão de deletar');
            if (deleteGroupBtn) deleteGroupBtn.classList.remove('hidden');
        } else {
            console.log('Usuário não é membro da conversa direta');
        }
    } else {
        console.log('Tipo de sala desconhecido:', room.type);
    }
    
    console.log('Estado final dos botões:', {
        addMemberBtnHidden: addMemberBtn ? addMemberBtn.classList.contains('hidden') : 'N/A',
        editGroupBtnHidden: editGroupBtn ? editGroupBtn.classList.contains('hidden') : 'N/A',
        deleteGroupBtnHidden: deleteGroupBtn ? deleteGroupBtn.classList.contains('hidden') : 'N/A'
    });
}

// Função auxiliar para verificar se o usuário é membro da sala
function isUserMemberOfRoom(room, userId) {
    if (!room || !room.members || !userId) {
        return false;
    }
    
    console.log('Verificando se usuário é membro:', {
        userId: userId,
        members: room.members,
        membersType: typeof room.members,
        isArray: Array.isArray(room.members)
    });
    
    // room.members pode ser array de strings (IDs) ou array de objetos
    if (Array.isArray(room.members)) {
        return room.members.some(member => {
            if (typeof member === 'string') {
                const match = member === userId;
                console.log('Comparando string:', { member, userId, match });
                return match;
            } else if (typeof member === 'object' && member && member.id) {
                const match = member.id === userId;
                console.log('Comparando objeto:', { memberId: member.id, userId, match });
                return match;
            }
            return false;
        });
    }
    
    return false;
}

function updateRoomDisplay() {
    if (currentRoom) {
        // Atualizar título da sala
        chatRoomTitle.textContent = currentRoom.name;
        
        // Atualizar descrição se existir
        const roomDescription = document.getElementById('room-description');
        if (roomDescription) {
            roomDescription.textContent = currentRoom.description || '';
        }
        
        // Atualizar avatar da sala se existir
        const roomAvatar = document.getElementById('room-avatar');
        if (roomAvatar) {
            if (currentRoom.avatar) {
                roomAvatar.innerHTML = `<img src="${currentRoom.avatar}" alt="${currentRoom.name}">`;
            } else if (currentRoom.type === 'group') {
                roomAvatar.innerHTML = '<i class="fas fa-users"></i>';
            } else {
                roomAvatar.innerHTML = '<i class="fas fa-user"></i>';
            }
        }
        
        // Atualizar botões baseado no tipo de sala
        updateRoomButtons(currentRoom);
    }
}



// Funções para editar e excluir mensagens
function editMessage(messageId, currentContent) {
    editMessageContentInput.value = currentContent;
    editMessageModal.setAttribute('data-message-id', messageId);
    editMessageModal.classList.remove('hidden');
}

async function deleteMessage(messageId) {
    // Verificar se é uma mensagem temporária
    if (messageId.startsWith('temp_')) {
        console.log('Tentativa de excluir mensagem temporária ignorada:', messageId);
        return;
    }
    
    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) {
        return;
    }
    
    try {
        // Usar Socket.IO para excluir mensagem
        if (socket && currentRoom) {
            socket.emit('delete_message', {
                messageId,
                roomId: currentRoom.id,
                userId: currentUser.id
            });
            
            // Remover mensagem da interface imediatamente
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            showSuccess('Mensagem excluída com sucesso!');
        }
    } catch (error) {
        showError('Erro ao excluir mensagem');
        console.error('Erro:', error);
    }
}

// ===== FUNÇÕES DE ENVIO DE MENSAGENS =====

sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // Evita que o Enter cause scroll na página
        sendMessage();
    }
});

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !currentRoom) return;
    
    try {
        // Preparar dados da mensagem
        const messageData = {
            content,
            roomId: currentRoom.id,
            senderId: currentUser.id,
            type: 'text'
        };
        
        // Adicionar ID da mensagem respondida se houver
        if (replyingToMessage) {
            messageData.replyToId = replyingToMessage.id;
            console.log('Enviando resposta para mensagem:', replyingToMessage.id);
        }
        
        // Limpar input imediatamente para melhor UX
        messageInput.value = '';
        
        // Criar mensagem temporária para mostrar feedback imediato
        const tempMessage = createTemporaryMessage(content, replyingToMessage?.id);
        const messageElement = createMessageElement(tempMessage);
        messageElement.classList.add('temporary');
        messagesContainer.appendChild(messageElement);
        
        // Scroll para a nova mensagem
        setTimeout(() => {
            scrollToBottom();
        }, 100);
        
        // Enviar via Socket.IO para tempo real
        if (socket && currentRoom) {
            socket.emit('send_message', messageData);
            
            // Atualizar a lista de conversas após enviar mensagem
            setTimeout(() => {
                debouncedLoadConversations();
            }, 500);
        } else {
            // Fallback para HTTP se Socket.IO não estiver disponível
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/api/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(messageData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                
                // Verificar se é erro de autenticação
                if (handleAuthError(response, errorData)) {
                    return; // Logout já foi executado
                }
                
                showError(errorData.message || 'Erro ao enviar mensagem');
                markMessageAsError(tempMessage.id, errorData.message || 'Erro ao enviar');
            } else {
                // Marcar mensagem como enviada
                updateMessageStatus(tempMessage.id, 'sent');
                // Atualizar a lista de conversas após enviar mensagem via HTTP
                debouncedLoadConversations();
            }
        }
        
        // Limpar resposta após enviar
        if (replyingToMessage) {
            cancelReply();
        }
        
    } catch (error) {
        showError('Erro de conexão');
        console.error('Erro ao enviar mensagem:', error);
        
        // Marcar mensagem temporária como erro
        if (tempMessage) {
            markMessageAsError(tempMessage.id, 'Erro de conexão');
        }
    }
}

// ===== FUNÇÕES DE UPLOAD =====

attachImageBtn.addEventListener('click', () => {
    fileInput.accept = 'image/*';
    fileInput.click();
});

attachFileBtn.addEventListener('click', () => {
    fileInput.accept = '*/*';
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        await uploadFile(file);
    } catch (error) {
        showError('Erro ao fazer upload do arquivo');
        console.error('Erro no upload:', error);
    }
    
    // Limpar input
    fileInput.value = '';
});

async function uploadFile(file) {
    if (!currentRoom) {
        console.error('Nenhuma sala selecionada para upload');
        showError('Selecione uma conversa para enviar o arquivo');
        return;
    }
    
    // Detectar tipo de arquivo
    const fileType = detectFileType(file);
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    
    if (file.size > maxFileSize) {
        showError('Arquivo muito grande. Tamanho máximo: 50MB');
        return;
    }
    
    console.log('Iniciando upload de arquivo:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        detectedType: fileType,
        roomId: currentRoom.id
    });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', currentRoom.id);
    formData.append('fileType', fileType);
    
    try {
        const token = localStorage.getItem('token');
        console.log('Token obtido:', token ? 'Sim' : 'Não');
        
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        }, 'files');
        
        console.log('Resposta do upload:', {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Upload bem-sucedido:', data);
            showSuccess(`${fileType === 'image' ? 'Imagem' : 'Arquivo'} enviado com sucesso!`);
            
            // Criar mensagem temporária para arquivo
            const tempMessage = createTemporaryMessage(data.data.url, replyingToMessage?.id);
            tempMessage.type = fileType;
            tempMessage.fileName = file.name;
            tempMessage.fileSize = file.size;
            
            const messageElement = createMessageElement(tempMessage);
            messageElement.classList.add('temporary');
            messagesContainer.appendChild(messageElement);
            
            // Scroll para a nova mensagem
            setTimeout(() => {
                scrollToBottom();
            }, 100);
            
            // Criar e enviar mensagem via Socket.IO
            if (socket && currentRoom) {
                console.log('Enviando mensagem de arquivo via Socket.IO:', {
                    content: data.data.url,
                    roomId: currentRoom.id,
                    senderId: currentUser.id,
                    type: fileType
                });
                
                const messageData = {
                    content: data.data.url,
                    roomId: currentRoom.id,
                    senderId: currentUser.id,
                    type: fileType,
                    fileName: file.name,
                    fileSize: file.size
                };
                
                // Adicionar ID da mensagem respondida se houver
                if (replyingToMessage) {
                    messageData.replyToId = replyingToMessage.id;
                    console.log('Enviando arquivo como resposta para mensagem:', replyingToMessage.id);
                }
                
                socket.emit('send_message', messageData);
                
                // Atualizar a lista de conversas após enviar arquivo
                setTimeout(() => {
                    debouncedLoadConversations();
                }, 500);
                
                // Limpar resposta após enviar arquivo
                if (replyingToMessage) {
                    cancelReply();
                }
            } else {
                console.error('Socket ou sala não disponível para envio da mensagem');
                // Marcar como erro se não houver Socket.IO
                markMessageAsError(tempMessage.id, 'Conexão não disponível');
            }
        } else {
            const errorData = await response.json();
            console.error('Erro no upload:', errorData);
            showError(errorData.message || 'Erro ao fazer upload');
        }
    } catch (error) {
        console.error('Erro durante upload:', error);
        throw error;
    }
}

// ===== FUNÇÕES DO SOCKET.IO =====

function initializeSocket() {
    socket = io(API_BASE);
    
    socket.on('connect', () => {
        console.log('Conectado ao servidor');
        
        // Identificar usuário para o servidor
        if (currentUser && currentUser.id) {
            socket.emit('user_connected', { userId: currentUser.id });
            console.log('Usuário identificado para o servidor:', currentUser.id);
        }
        
        // Configurar notificações de mensagens (removido daqui para evitar duplicação)
        // setupMessageNotifications();
    });
    
    socket.on('new_message', (message) => {
        console.log('Nova mensagem recebida via Socket.IO:', message);
        
        // Se a mensagem tem resposta, buscar informações da mensagem respondida
        if (message.replyToId && !message.replyTo) {
            console.log('Mensagem tem resposta, buscando detalhes da mensagem respondida:', message.replyToId);
            // Aqui você pode implementar uma busca para obter detalhes da mensagem respondida
            // Por enquanto, vamos usar as informações básicas disponíveis
            message.replyTo = {
                id: message.replyToId,
                content: 'Mensagem respondida',
                sender: { username: 'Usuário' }
            };
        }
        
        if (currentRoom && message.roomId === currentRoom.id) {
            console.log('Mensagem é para a sala atual, criando elemento...');
            
            // Verificar se é uma mensagem própria (para confirmar mensagens temporárias)
            if (message.senderId === currentUser.id) {
                // Procurar por mensagem temporária com mesmo conteúdo
                const tempMessageElement = findTemporaryMessage(message.content, message.type);
                if (tempMessageElement) {
                    console.log('Mensagem temporária encontrada, confirmando:', tempMessageElement.getAttribute('data-message-id'));
                    // Atualizar status da mensagem temporária
                    updateMessageStatus(tempMessageElement.getAttribute('data-message-id'), 'sent');
                    // Remover mensagem temporária
                    tempMessageElement.remove();
                    return; // Não criar nova mensagem
                }
            }
            
            const messageElement = createMessageElement(message);
            messagesContainer.appendChild(messageElement);
            
            // Scroll inteligente: só faz scroll se o usuário estiver próximo do final
            const isNearBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
            
            console.log('Verificação de scroll para mensagem recebida:', {
                isOwn: message.senderId === currentUser.id,
                isNearBottom: isNearBottom,
                scrollHeight: messagesContainer.scrollHeight,
                scrollTop: messagesContainer.scrollTop,
                clientHeight: messagesContainer.clientHeight,
                difference: messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight
            });
            
            // Sempre fazer scroll para mensagens próprias ou se estiver próximo do final
            if (message.senderId === currentUser.id || isNearBottom) {
                console.log('Fazendo scroll para mensagem recebida...');
                setTimeout(() => {
                    scrollToBottom();
                }, 100);
            } else {
                console.log('Scroll não necessário para mensagem recebida');
            }
            
            // Atualizar contador de mensagens não lidas na lista de conversas
            updateUnreadCount(message.roomId);
            
        } else {
            console.log('Mensagem não é para a sala atual:', {
                messageRoomId: message.roomId,
                currentRoomId: currentRoom?.id
            });
            
            // Atualizar contador de mensagens não lidas na lista de conversas
            updateUnreadCount(message.roomId);
            
            // Atualizar a última mensagem da conversa na lista
            updateConversationLastMessage(message.roomId, message);
            
            // Atualizar a lista de conversas para mostrar a última mensagem
            debouncedLoadConversations();
            
            // Mostrar notificação Windows se não for mensagem própria
            if (message.senderId !== currentUser.id) {
                // Buscar informações da sala
                const room = conversations.find(c => c.id === message.roomId);
                if (room) {
                    const senderName = message.sender?.nickname || message.sender?.username || 'Usuário';
                    const roomName = room.type === 'direct' ? 
                        (room.members?.find(m => m.id !== currentUser.id)?.nickname || 'Conversa privada') :
                        room.name;
                    
                    addNotification('message', 
                        `Nova mensagem de ${senderName}`, 
                        `${message.content?.substring(0, 50)}${message.content?.length > 50 ? '...' : ''}`,
                        {
                            roomId: message.roomId,
                            messageId: message.id,
                            senderId: message.senderId,
                            actions: [{
                                type: 'view_message',
                                label: 'Ver mensagem',
                                primary: true
                            }]
                        }
                    );
                }
            }
        }
    });
    

    
    socket.on('message_edited', (data) => {
        // Atualizar mensagem editada na interface
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            const messageText = messageElement.querySelector('.message-text');
            if (messageText) {
                messageText.textContent = data.content;
            }
            messageElement.classList.add('edited');
        }
    });
    
    socket.on('message_deleted', (data) => {
        // Remover mensagem excluída da interface
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    });
    
    socket.on('user_typing', (data) => {
        // Implementar indicador de digitação se necessário
    });
    
    socket.on('disconnect', () => {
        console.log('Desconectado do servidor');
    });
    
    // Tratar erros de Socket.IO
    socket.on('error', (error) => {
        console.error('Erro no Socket.IO:', error);
        
        // Verificar se é erro de autenticação
        if (error && (error.message === "Token de acesso não fornecido" || 
                     error.message === "É necessário fornecer um token de autenticação válido")) {
            console.log('Token inválido detectado via Socket.IO, fazendo logout automático...');
            logoutUser();
            return;
        }
        
        showError(`Erro de conexão: ${error.message || 'Erro desconhecido'}`);
    });
    
    // Tratar erros de conexão
    socket.on('connect_error', (error) => {
        console.error('Erro ao conectar Socket.IO:', error);
        showError('Erro ao conectar com o servidor. Tentando reconectar...');
    });
    
    // Tratar reconexão
    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconectado ao servidor após', attemptNumber, 'tentativas');
        showSuccess('Reconectado ao servidor com sucesso!');
        
        // Reidentificar usuário após reconexão
        if (currentUser && currentUser.id) {
            socket.emit('user_connected', { userId: currentUser.id });
        }
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Tentativa de reconexão:', attemptNumber);
    });
    
    socket.on('reconnect_error', (error) => {
        console.error('Erro na tentativa de reconexão:', error);
    });
}

// ===== FUNÇÕES DE RESPONSIVIDADE =====

// Toggle do sidebar em mobile
sidebarToggle.addEventListener('click', (e) => {
    console.log('Botão toggle clicado!');
    e.preventDefault();
    e.stopPropagation();
    
    const isOpen = chatSidebar.classList.contains('open');
    console.log('Sidebar está aberto?', isOpen);
    console.log('Classes atuais do sidebar:', chatSidebar.className);
    console.log('CSS do sidebar:', window.getComputedStyle(chatSidebar));
    
    if (isOpen) {
        chatSidebar.classList.remove('open');
        console.log('Sidebar fechado');
    } else {
        chatSidebar.classList.add('open');
        console.log('Sidebar aberto');
        console.log('Classes após abrir:', chatSidebar.className);
        console.log('CSS após abrir:', window.getComputedStyle(chatSidebar));
    }
});

// Fechar sidebar ao clicar fora em mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!chatSidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
            chatSidebar.classList.remove('open');
        }
    }
});

// Verificar tamanho da tela e mostrar/ocultar botão toggle
function checkScreenSize() {
    console.log('Verificando tamanho da tela:', window.innerWidth);
    
    if (window.innerWidth <= 768) {
        console.log('Tela pequena - mostrando botão toggle');
        sidebarToggle.style.display = 'block';
        sidebarToggle.classList.remove('hidden');
    } else {
        console.log('Tela grande - ocultando botão toggle');
        sidebarToggle.style.display = 'none';
        sidebarToggle.classList.add('hidden');
        chatSidebar.classList.remove('open');
    }
}

// Verificar tamanho da tela ao carregar e redimensionar
window.addEventListener('resize', checkScreenSize);

// Verificar tamanho da tela na inicialização
document.addEventListener('DOMContentLoaded', () => {
    checkScreenSize();
});

// ===== FUNÇÕES DE EMOJIS CUSTOMIZADOS =====

// Variáveis globais para emojis
let customEmojis = [];
let emojiModal = null;
let emojiPickerTab = null;
let emojiUploadTab = null;
let emojiPickerContent = null;
let emojiUploadContent = null;
let emojiGrid = null;
let emojiSearch = null;

// Inicializar sistema de emojis
function initializeEmojiSystem() {
    emojiModal = document.getElementById('emoji-modal');
    emojiPickerTab = document.getElementById('emoji-picker-tab');
    emojiUploadTab = document.getElementById('emoji-upload-tab');
    emojiPickerContent = document.getElementById('emoji-picker-content');
    emojiUploadContent = document.getElementById('emoji-upload-content');
    emojiGrid = document.getElementById('emoji-grid');
    emojiSearch = document.getElementById('emoji-search');
    
    // Event listeners para o modal de emojis
    document.getElementById('emoji-btn').addEventListener('click', openEmojiModal);
    document.getElementById('close-emoji-modal').addEventListener('click', closeEmojiModal);
    
    // Event listeners para as abas
    emojiPickerTab.addEventListener('click', () => switchEmojiTab('picker'));
    emojiUploadTab.addEventListener('click', () => switchEmojiTab('upload'));
    
    // Event listeners para busca de emojis
    emojiSearch.addEventListener('input', searchEmojis);
    
    // Event listeners para upload de emojis
    document.getElementById('emoji-name').addEventListener('input', validateEmojiForm);
    document.getElementById('emoji-file').addEventListener('change', handleEmojiFileSelect);
    document.getElementById('upload-emoji-btn').addEventListener('click', uploadEmoji);
    
    // Fechar modal ao clicar fora
    emojiModal.addEventListener('click', (e) => {
        if (e.target === emojiModal) {
            closeEmojiModal();
        }
    });
    
    // Carregar emojis customizados
    loadCustomEmojis();
}

// Abrir modal de emojis
function openEmojiModal() {
    emojiModal.classList.remove('hidden');
    document.getElementById('emoji-btn').classList.add('active');
    loadCustomEmojis();
}

// Fechar modal de emojis
function closeEmojiModal() {
    emojiModal.classList.add('hidden');
    document.getElementById('emoji-btn').classList.remove('active');
    clearEmojiForm();
}

// Alternar entre abas do modal
function switchEmojiTab(tab) {
    if (tab === 'picker') {
        emojiPickerTab.classList.add('active');
        emojiUploadTab.classList.remove('active');
        emojiPickerContent.classList.remove('hidden');
        emojiUploadContent.classList.add('hidden');
    } else {
        emojiPickerTab.classList.remove('active');
        emojiUploadTab.classList.add('active');
        emojiPickerContent.classList.add('hidden');
        emojiUploadContent.classList.remove('hidden');
    }
}

// Carregar emojis customizados
async function loadCustomEmojis() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/emojis`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            customEmojis = data.data || [];
            displayEmojis(customEmojis);
        } else {
            console.error('Erro ao carregar emojis:', response.status);
        }
    } catch (error) {
        console.error('Erro ao carregar emojis:', error);
    }
}

// Exibir emojis na grade
function displayEmojis(emojis) {
    emojiGrid.innerHTML = '';
    
    if (emojis.length === 0) {
        emojiGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 20px;">Nenhum emoji customizado encontrado</div>';
        return;
    }
    
    emojis.forEach(emoji => {
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.innerHTML = `
            <img src="${emoji.url}" alt=":${emoji.name}:" title=":${emoji.name}:">
            <span>:${emoji.name}:</span>
        `;
        
        emojiItem.addEventListener('click', () => {
            insertEmoji(`:${emoji.name}:`);
            closeEmojiModal();
        });
        
        emojiGrid.appendChild(emojiItem);
    });
}

// Buscar emojis
async function searchEmojis() {
    const query = emojiSearch.value.trim();
    
    if (query === '') {
        displayEmojis(customEmojis);
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/emojis/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayEmojis(data.data || []);
        } else {
            console.error('Erro ao buscar emojis:', response.status);
        }
    } catch (error) {
        console.error('Erro ao buscar emojis:', error);
    }
}

// Inserir emoji no input de mensagem
function insertEmoji(emojiText) {
    const messageInput = document.getElementById('message-input');
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(messageInput.selectionEnd);
    
    messageInput.value = textBefore + emojiText + textAfter;
    
    // Reposicionar cursor
    const newCursorPos = cursorPos + emojiText.length;
    messageInput.setSelectionRange(newCursorPos, newCursorPos);
    
    // Focar no input
    messageInput.focus();
}

// Validar formulário de emoji
function validateEmojiForm() {
    const name = document.getElementById('emoji-name').value.trim();
    const file = document.getElementById('emoji-file').files[0];
    const uploadBtn = document.getElementById('upload-emoji-btn');
    
    // Validar nome
    const nameValid = /^[a-zA-Z0-9_]+$/.test(name) && name.length >= 2 && name.length <= 20;
    
    // Validar arquivo
    const fileValid = file && file.type.startsWith('image/') && file.size <= 2 * 1024 * 1024;
    
    uploadBtn.disabled = !(nameValid && fileValid);
}

// Lidar com seleção de arquivo de emoji
function handleEmojiFileSelect() {
    const file = document.getElementById('emoji-file').files[0];
    const preview = document.getElementById('emoji-preview');
    const previewImg = document.getElementById('emoji-preview-img');
    const previewName = document.getElementById('emoji-preview-name');
    
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewName.textContent = `:${document.getElementById('emoji-name').value || 'nome'}:`;
            preview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
    }
    
    validateEmojiForm();
}

// Upload de emoji
async function uploadEmoji() {
    const name = document.getElementById('emoji-name').value.trim();
    const file = document.getElementById('emoji-file').files[0];
    const uploadBtn = document.getElementById('upload-emoji-btn');
    
    if (!name || !file) {
        showError('Nome e arquivo são obrigatórios');
        return;
    }
    
    // Validar nome
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        showError('Nome deve conter apenas letras, números e underscore');
        return;
    }
    
    if (name.length < 2 || name.length > 20) {
        showError('Nome deve ter entre 2 e 20 caracteres');
        return;
    }
    
    // Validar arquivo
    if (!file.type.startsWith('image/')) {
        showError('Apenas arquivos de imagem são permitidos');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showError('Arquivo deve ter no máximo 2MB');
        return;
    }
    
    try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Enviando...';
        
        const formData = new FormData();
        formData.append('name', name);
        formData.append('emoji', file);
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/emojis/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            showSuccess('Emoji criado com sucesso!');
            clearEmojiForm();
            loadCustomEmojis();
            switchEmojiTab('picker');
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erro ao criar emoji');
        }
    } catch (error) {
        console.error('Erro ao fazer upload do emoji:', error);
        showError('Erro de conexão');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Emoji';
    }
}

// Limpar formulário de emoji
function clearEmojiForm() {
    document.getElementById('emoji-name').value = '';
    document.getElementById('emoji-file').value = '';
    document.getElementById('emoji-preview').style.display = 'none';
    document.getElementById('upload-emoji-btn').disabled = true;
}

// ===== FUNÇÕES DOS MODAIS =====

// Avatar clicável para alterar foto de perfil
userAvatarHeader.addEventListener('click', () => {
    changePhotoModal.classList.remove('hidden');
    updateCurrentPhotoDisplay();
});

closeChangePhotoModalBtn.addEventListener('click', () => {
    changePhotoModal.classList.add('hidden');
});

cancelPhotoBtn.addEventListener('click', () => {
    changePhotoModal.classList.add('hidden');
});

// Modal Editar Mensagem
closeEditMessageModalBtn.addEventListener('click', () => {
    editMessageModal.classList.add('hidden');
});

cancelEditMessageBtn.addEventListener('click', () => {
    editMessageModal.classList.add('hidden');
});

saveMessageBtn.addEventListener('click', async () => {
    const messageId = editMessageModal.getAttribute('data-message-id');
    const newContent = editMessageContentInput.value.trim();
    
    if (!newContent) {
        showError('A mensagem não pode estar vazia');
        return;
    }
    
    try {
        // Usar Socket.IO para editar mensagem
        if (socket && currentRoom) {
            socket.emit('edit_message', {
                messageId,
                content: newContent,
                roomId: currentRoom.id,
                userId: currentUser.id
            });
            
            // Atualizar mensagem na interface imediatamente
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                const messageText = messageElement.querySelector('.message-text');
                if (messageText) {
                    messageText.textContent = newContent;
                }
                messageElement.classList.add('edited');
            }
            
            editMessageModal.classList.add('hidden');
            showSuccess('Mensagem editada com sucesso!');
        }
    } catch (error) {
        showError('Erro ao editar mensagem');
        console.error('Erro:', error);
    }
});

uploadPhotoBtn.addEventListener('click', async () => {
    const file = profilePhotoInput.files[0];
    if (!file) {
        showError('Selecione uma imagem');
        return;
    }
    
    try {
        await uploadProfilePicture(file);
        changePhotoModal.classList.add('hidden');
        showSuccess('Foto de perfil atualizada com sucesso!');
        updateUserAvatarDisplay();
    } catch (error) {
        showError('Erro ao atualizar foto de perfil');
        console.error('Erro no upload:', error);
    }
});

async function uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/files/profile-picture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            // Atualizar usuário atual com nova foto
            if (currentUser) {
                currentUser.avatar = data.data.url;
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao fazer upload');
        }
    } catch (error) {
        throw error;
    }
}

function updateCurrentPhotoDisplay() {
    if (currentUser && currentUser.avatar) {
        currentPhotoAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="Foto atual">`;
    } else {
        currentPhotoAvatar.innerHTML = '<i class="fas fa-user"></i>';
    }
}

function updateUserAvatarDisplay() {
    if (currentUser && currentUser.avatar) {
        userAvatarHeader.innerHTML = `<img src="${currentUser.avatar}" alt="Foto de perfil">`;
    } else {
        userAvatarHeader.innerHTML = '<i class="fas fa-user"></i>';
    }
}

// Modal Editar Grupo
editGroupBtn.addEventListener('click', () => {
    if (currentRoom) {
        editGroupNameInput.value = currentRoom.name;
        editGroupDescriptionInput.value = currentRoom.description || '';
        editGroupModal.classList.remove('hidden');
    }
});

closeEditGroupModalBtn.addEventListener('click', () => {
    editGroupModal.classList.add('hidden');
});

cancelEditGroupBtn.addEventListener('click', () => {
    editGroupModal.classList.add('hidden');
});

// Modal Excluir Grupo/Conversa
deleteGroupBtn.addEventListener('click', () => {
    if (currentRoom) {
        if (currentRoom.type === 'group') {
            // Para grupos, usar modal com confirmação de nome
            deleteGroupNameSpan.textContent = currentRoom.name;
            confirmGroupNameInput.value = '';
            confirmDeleteGroupBtn.disabled = true;
            deleteGroupModal.classList.remove('hidden');
        } else if (currentRoom.type === 'direct') {
            // Para conversas diretas, confirmação simples
            const confirmDelete = confirm('Tem certeza que deseja excluir esta conversa?');
            if (confirmDelete) {
                deleteConversation();
            }
        }
    }
});

closeDeleteGroupModalBtn.addEventListener('click', () => {
    deleteGroupModal.classList.add('hidden');
});

cancelDeleteGroupBtn.addEventListener('click', () => {
    deleteGroupModal.classList.add('hidden');
});

// Validação do nome do grupo para exclusão
confirmGroupNameInput.addEventListener('input', () => {
    const inputValue = confirmGroupNameInput.value.trim();
    const groupName = currentRoom?.name || '';
    confirmDeleteGroupBtn.disabled = inputValue !== groupName;
});

// Confirmar exclusão do grupo
confirmDeleteGroupBtn.addEventListener('click', async () => {
    if (!currentRoom || currentRoom.type !== 'group') return;
    
    const inputValue = confirmGroupNameInput.value.trim();
    if (inputValue !== currentRoom.name) {
        showError('Nome do grupo não confere');
        return;
    }
    
    await deleteConversation();
    deleteGroupModal.classList.add('hidden');
});

// Função para excluir conversa (grupo ou direta)
async function deleteConversation() {
    if (!currentRoom) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/rooms/${currentRoom.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const messageType = currentRoom.type === 'group' ? 'Grupo' : 'Conversa';
            showSuccess(`${messageType} excluído(a) com sucesso!`);
            
            // Adicionar notificação de sistema
            addNotification('system',
                `${messageType} excluído`,
                `O ${messageType.toLowerCase()} foi excluído com sucesso`,
                { action: 'deleted' }
            );
            
            // Voltar para a tela de conversas
            currentRoom = null;
            showChatPlaceholder();
            loadConversations();
        } else {
            const errorData = await response.json();
            const messageType = currentRoom.type === 'group' ? 'grupo' : 'conversa';
            showError(errorData.message || `Erro ao excluir ${messageType}`);
        }
    } catch (error) {
        const messageType = currentRoom.type === 'group' ? 'grupo' : 'conversa';
        showError(`Erro de conexão ao excluir ${messageType}`);
        console.error('Erro ao excluir conversa:', error);
    }
}

saveGroupBtn.addEventListener('click', async () => {
    if (!currentRoom) return;
    
    try {
        const updateData = {
            name: editGroupNameInput.value,
            description: editGroupDescriptionInput.value
        };
        
        // Primeiro, atualizar dados básicos do grupo
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/rooms/${currentRoom.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
            const updatedRoom = await response.json();
            currentRoom = updatedRoom;
            
            // Se há uma foto selecionada, fazer upload
            if (groupPhotoInput.files && groupPhotoInput.files[0]) {
                try {
                    const formData = new FormData();
                    formData.append('groupPhoto', groupPhotoInput.files[0]);
                    formData.append('roomId', currentRoom.id);
                    
                    const photoResponse = await fetch(`${API_BASE}/api/files/group-photo`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    
                    if (photoResponse.ok) {
                        const photoData = await photoResponse.json();
                        currentRoom.avatar = photoData.data.url;
                        showSuccess('Grupo e foto atualizados com sucesso!');
                    } else {
                        const errorData = await photoResponse.json();
                        showError(`Grupo atualizado, mas erro na foto: ${errorData.message}`);
                    }
                } catch (photoError) {
                    showError('Grupo atualizado, mas erro ao enviar foto');
                    console.error('Erro na foto:', photoError);
                }
            } else {
                showSuccess('Grupo atualizado com sucesso!');
            }
            
            editGroupModal.classList.add('hidden');
            updateRoomDisplay();
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erro ao atualizar grupo');
        }
    } catch (error) {
        showError('Erro ao atualizar grupo');
        console.error('Erro:', error);
    }
});

// Modal Nova Conversa
newChatBtn.addEventListener('click', async () => {
    console.log('Abrindo modal de nova conversa...');
    newChatModal.classList.remove('hidden');
    
    setTimeout(async () => {
        await populateUserSelect();
    }, 100);
});

closeModalBtn.addEventListener('click', () => {
    newChatModal.classList.add('hidden');
});

cancelChatBtn.addEventListener('click', () => {
    newChatModal.classList.add('hidden');
});

createChatBtn.addEventListener('click', async () => {
    const userId = newChatUserSelect.value;
    const chatName = newChatNameInput.value;
    
    if (!userId) {
        showError('Selecione um usuário');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: chatName || 'Nova Conversa',
                type: 'direct',
                members: [currentUser.id, userId]
            })
        });
        
        if (response.ok) {
            const room = await response.json();
            newChatModal.classList.add('hidden');
            showSuccess('Conversa criada com sucesso!');
            debouncedLoadConversations(); // Recarregar lista com debounce
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erro ao criar conversa');
        }
    } catch (error) {
        showError('Erro de conexão');
        console.error('Erro ao criar conversa:', error);
    }
});

// Modal Novo Grupo
newGroupBtn.addEventListener('click', async () => {
    console.log('Abrindo modal de novo grupo...');
    newGroupModal.classList.remove('hidden');
    
    // Limpar seleções anteriores
    window.selectedGroupMembers = [];
    updateSelectedMembersDisplay();
    
    // Carregar usuários imediatamente
    await populateMembersSelection();
});

closeGroupModalBtn.addEventListener('click', () => {
    newGroupModal.classList.add('hidden');
});

cancelGroupBtn.addEventListener('click', () => {
    newGroupModal.classList.add('hidden');
});

// Event listener para pesquisa de usuários
searchUsersInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (query.length === 0) {
        searchResults.classList.add('hidden');
        return;
    }
    
    const results = searchUsers(query);
    displaySearchResults(results);
});

// Event listener para fechar resultados da pesquisa ao clicar fora
document.addEventListener('click', (e) => {
    if (!searchUsersInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

createGroupBtn.addEventListener('click', async () => {
    const groupName = newGroupNameInput.value.trim();
    const description = newGroupDescriptionInput.value.trim();
    // Obter membros selecionados
    if (!window.selectedGroupMembers || window.selectedGroupMembers.length === 0) {
        showError('Selecione pelo menos um membro');
        return;
    }
    
    const selectedMemberIds = window.selectedGroupMembers.map(member => member.id);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: groupName,
                description: description,
                type: 'group',
                members: [currentUser.id, ...selectedMemberIds]
            })
        });
        
        if (response.ok) {
            const room = await response.json();
            newGroupModal.classList.add('hidden');
            showSuccess('Grupo criado com sucesso!');
            debouncedLoadConversations(); // Recarregar lista com debounce
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erro ao criar grupo');
        }
    } catch (error) {
        showError('Erro de conexão');
        console.error('Erro ao criar grupo:', error);
    }
});

// Modal Adicionar Membro
addMemberBtn.addEventListener('click', async () => {
    if (!currentRoom || (currentRoom.type !== 'group' && currentRoom.type !== 'channel')) {
        showError('Apenas grupos podem ter membros adicionados');
        return;
    }
    
    addMemberModal.classList.remove('hidden');
    
    setTimeout(async () => {
        await populateAddMemberSelect();
    }, 100);
});

closeAddMemberModalBtn.addEventListener('click', () => {
    addMemberModal.classList.add('hidden');
});

cancelAddMemberBtn.addEventListener('click', () => {
    addMemberModal.classList.add('hidden');
});

confirmAddMemberBtn.addEventListener('click', async () => {
    const userId = addMemberUserSelect.value;
    
    if (!userId) {
        showError('Selecione um usuário');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/rooms/${currentRoom.id}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId })
        });
        
        if (response.ok) {
            addMemberModal.classList.add('hidden');
            showSuccess('Membro adicionado com sucesso!');
        } else {
            const errorData = await response.json();
            showError(errorData.message || 'Erro ao adicionar membro');
        }
    } catch (error) {
        showError('Erro de conexão');
        console.error('Erro ao adicionar membro:', error);
    }
});

// ===== FUNÇÕES AUXILIARES =====

// Debounce para evitar múltiplas chamadas de loadConversations
let loadConversationsTimeout = null;
function debouncedLoadConversations() {
    if (loadConversationsTimeout) {
        clearTimeout(loadConversationsTimeout);
    }
    loadConversationsTimeout = setTimeout(() => {
        loadConversations();
        loadConversationsTimeout = null;
    }, 300); // Aguardar 300ms antes de executar
}

// Função para verificar se o usuário ainda existe no banco
async function checkUserExists() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return false;
        
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, 'auth');
        
        if (!response.ok) {
            // Usuário não existe mais ou token inválido
            logoutUser();
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao verificar usuário:', error);
        logoutUser();
        return false;
    }
}

// Função para deslogar o usuário e limpar dados
function logoutUser() {
    console.log('Usuário não existe mais no banco. Deslogando...');
    
    // Limpar dados locais
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Desconectar socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    // Limpar variáveis globais
    currentUser = null;
    currentRoom = null;
    
    // Mostrar tela de login
    showAuthScreen();
    
    // Mostrar mensagem para o usuário
    showError('Sua sessão expirou ou sua conta foi removida. Faça login novamente.');
}

// Função para verificar periodicamente se o usuário ainda existe
function startUserVerification() {
    // Verificar a cada 5 minutos
    setInterval(async () => {
        if (currentUser && !authScreen.classList.contains('hidden')) {
            await checkUserExists();
        }
    }, 5 * 60 * 1000); // 5 minutos
}

function showChatPlaceholder() {
    chatArea.classList.add('hidden');
    chatPlaceholder.classList.remove('hidden');
}

async function populateUserSelect() {
    try {
        console.log('Populando seleção de usuários...');
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('Token não encontrado');
            return;
        }
        
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/users`, {}, 'users');
        
        console.log('Resposta da API:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Dados recebidos:', data);
            
            const users = data.users || [];
            console.log('Usuários para filtrar:', users);
            
            // Limpar seleção atual
            newChatUserSelect.innerHTML = '<option value="">Escolha um usuário...</option>';
            
            if (Array.isArray(users)) {
                const filteredUsers = users.filter(user => user.id !== currentUser.id);
                console.log('Usuários filtrados:', filteredUsers);
                
                filteredUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.nickname || user.username} (@${user.username})`;
                    newChatUserSelect.appendChild(option);
                });
                
                console.log(`Adicionados ${filteredUsers.length} usuários ao select`);
            } else {
                console.error('Dados não são um array:', users);
            }
        } else {
            const errorText = await response.text();
            console.error('Erro na API:', response.status, errorText);
        }
    } catch (error) {
        console.error('Erro ao carregar usuários para o modal:', error);
    }
}

async function populateMembersSelection() {
    try {
        console.log('Carregando usuários para seleção...');
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/users`, {}, 'users');        
        if (response.ok) {
            const data = await response.json();
            console.log('Resposta da API de usuários:', data);
            
            // Verificar a estrutura da resposta - a API retorna { users: [...] }
            const users = data.users || [];
            console.log('Usuários encontrados:', users);
            
            if (!Array.isArray(users)) {
                console.error('Dados de usuários não são um array:', users);
                return;
            }
            
            // Filtrar usuários (excluir o usuário atual)
            const filteredUsers = users.filter(user => user.id !== currentUser.id);
            console.log('Usuários filtrados:', filteredUsers);
            
            // Armazenar usuários para pesquisa
            window.availableUsers = filteredUsers;
            
            console.log(`Carregados ${filteredUsers.length} usuários para pesquisa`);
            
            // Inicializar array de membros selecionados se não existir
            if (!window.selectedGroupMembers) {
                window.selectedGroupMembers = [];
            }
            
            // Atualizar exibição
            updateSelectedMembersDisplay();
        } else {
            console.error('Erro na API de usuários:', response.status);
            const errorText = await response.text();
            console.error('Erro detalhado:', errorText);
        }
    } catch (error) {
        console.error('Erro ao carregar usuários para seleção:', error);
    }
}

async function populateAddMemberSelect() {
    try {
        const response = await rateLimiter.fetchWithRetry(`${API_BASE}/api/users`, {}, 'users');
        
        if (response.ok) {
            const data = await response.json();
            const users = data.users || [];
            
            addMemberUserSelect.innerHTML = '<option value="">Escolha um usuário...</option>';
            
            users.forEach(user => {
                if (user.id !== currentUser.id && !currentRoom.members.includes(user.id)) {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.nickname || user.username} (@${user.username})`;
                    addMemberUserSelect.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Erro ao carregar usuários para adicionar:', error);
    }
}

// Função para pesquisar usuários
function searchUsers(query) {
    if (!window.availableUsers) return [];
    
    const searchTerm = query.toLowerCase();
    return window.availableUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm) ||
        (user.nickname && user.nickname.toLowerCase().includes(searchTerm))
    );
}

// Função para exibir resultados da pesquisa
function displaySearchResults(results) {
    searchResults.innerHTML = '';
    
    if (results.length === 0) {
        searchResults.classList.add('hidden');
        return;
    }
    
    results.forEach(user => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <div class="search-result-avatar">
                ${user.avatar ? `<img src="${user.avatar}" alt="${user.nickname || user.username}">` : 
                `<i class="fas fa-user"></i>`}
            </div>
            <div class="search-result-info">
                <div class="search-result-username">${user.nickname || user.username}</div>
                <div class="search-result-nickname">@${user.username}</div>
            </div>
        `;
        
        resultItem.addEventListener('click', () => addMemberToGroup(user));
        searchResults.appendChild(resultItem);
    });
    
    searchResults.classList.remove('hidden');
}

// Função para adicionar membro ao grupo
function addMemberToGroup(user) {
    // Verificar se o usuário já foi adicionado
    if (window.selectedGroupMembers && window.selectedGroupMembers.find(m => m.id === user.id)) {
        return;
    }
    
    // Inicializar array se não existir
    if (!window.selectedGroupMembers) {
        window.selectedGroupMembers = [];
    }
    
    // Adicionar usuário à lista
    window.selectedGroupMembers.push(user);
    
    // Atualizar exibição
    updateSelectedMembersDisplay();
    
    // Limpar pesquisa
    searchUsersInput.value = '';
    searchResults.classList.add('hidden');
}

// Função para remover membro do grupo
function removeMemberFromGroup(userId) {
    if (!window.selectedGroupMembers) return;
    
    window.selectedGroupMembers = window.selectedGroupMembers.filter(m => m.id !== userId);
    updateSelectedMembersDisplay();
}

// Função para atualizar exibição dos membros selecionados
function updateSelectedMembersDisplay() {
    console.log('Atualizando exibição de membros selecionados...');
    console.log('Membros selecionados:', window.selectedGroupMembers);
    
    if (!window.selectedGroupMembers || window.selectedGroupMembers.length === 0) {
        console.log('Nenhum membro selecionado, mostrando mensagem padrão');
        selectedMembers.innerHTML = '<p class="no-members">Nenhum membro selecionado</p>';
        return;
    }
    
    console.log(`Exibindo ${window.selectedGroupMembers.length} membros selecionados`);
    selectedMembers.innerHTML = '';
    
    window.selectedGroupMembers.forEach(member => {
        console.log('Criando tag para membro:', member);
        const memberTag = document.createElement('div');
        memberTag.className = 'member-tag';
        memberTag.innerHTML = `
            <div class="member-tag-avatar">
                ${member.avatar ? `<img src="${member.avatar}" alt="${member.nickname || member.username}">` : 
                `<i class="fas fa-user"></i>`}
            </div>
            <span>${member.nickname || member.username}</span>
            <button class="remove-member-btn" data-user-id="${member.id}">&times;</button>
        `;
        
        // Adicionar event listener de forma segura
        const removeBtn = memberTag.querySelector('.remove-member-btn');
        removeBtn.addEventListener('click', () => removeMemberFromGroup(member.id));
        
        selectedMembers.appendChild(memberTag);
    });
}

// ===== FUNÇÕES UTILITÁRIAS =====

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function showError(message) {
    alert(`Erro: ${message}`);
}

function showSuccess(message) {
    alert(`Sucesso: ${message}`);
}

// Função para fazer scroll para a última mensagem
function scrollToBottom() {
    if (messagesContainer) {
        // Aguardar um pouco para garantir que o DOM foi atualizado
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            console.log('Scroll para o final executado');
        }, 100);
    }
}

// Função para abrir modal de imagem
function openImageModal(imageUrl) {
    // Criar modal se não existir
    let imageModal = document.getElementById('image-modal');
    if (!imageModal) {
        imageModal = document.createElement('div');
        imageModal.id = 'image-modal';
        imageModal.className = 'image-modal';
        imageModal.innerHTML = `
            <div class="image-modal-content">
                <span class="image-modal-close">&times;</span>
                <img src="" alt="Imagem ampliada" class="image-modal-img">
            </div>
        `;
        document.body.appendChild(imageModal);
        
        // Event listener para fechar modal
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal || e.target.classList.contains('image-modal-close')) {
                imageModal.style.display = 'none';
            }
        });
    }
    
    // Atualizar imagem e mostrar modal
    const modalImg = imageModal.querySelector('.image-modal-img');
    modalImg.src = imageUrl;
    imageModal.style.display = 'flex';
}

// ===== SISTEMA DE NOTIFICAÇÕES =====

// Inicializar sistema de notificações
function initializeNotifications() {
    // Verificar permissão de notificação do navegador
    if ('Notification' in window) {
        notificationPermission = Notification.permission;
        
        if (notificationPermission === 'default') {
            // Solicitar permissão quando o usuário fizer login
            console.log('Permissão de notificação não definida');
        } else if (notificationPermission === 'granted') {
            console.log('Permissão de notificação concedida');
        } else {
            console.log('Permissão de notificação negada');
        }
    }
    
    // Carregar som de notificação
    loadNotificationSound();
    
    // Carregar notificações salvas
    loadNotifications();
    
    // Configurar event listeners
    setupNotificationListeners();
}

// Configurar event listeners para notificações
function setupNotificationListeners() {
    // Toggle do dropdown de notificações
    notificationsBtn.addEventListener('click', toggleNotificationsDropdown);
    
    // Marcar todas como lidas
    markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!notificationsBtn.contains(e.target) && !notificationsDropdown.contains(e.target)) {
            notificationsDropdown.classList.add('hidden');
        }
    });
}

// Toggle do dropdown de notificações
function toggleNotificationsDropdown() {
    notificationsDropdown.classList.toggle('hidden');
    if (!notificationsDropdown.classList.contains('hidden')) {
        renderNotifications();
    }
}

// Carregar notificações do localStorage
function loadNotifications() {
    const savedNotifications = localStorage.getItem(`notifications_${currentUser?.id}`);
    if (savedNotifications) {
        notifications = JSON.parse(savedNotifications);
        updateUnreadCount();
    }
}

// Salvar notificações no localStorage
function saveNotifications() {
    if (currentUser) {
        localStorage.setItem(`notifications_${currentUser.id}`, JSON.stringify(notifications));
    }
}

// Adicionar nova notificação
function addNotification(type, title, message, data = {}) {
    const notification = {
        id: Date.now().toString(),
        type,
        title,
        message,
        data,
        timestamp: new Date(),
        read: false
    };
    
    notifications.unshift(notification);
    
    // Manter apenas as últimas 50 notificações
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }
    
    updateUnreadCount();
    saveNotifications();
    
    // Mostrar notificação toast se a aplicação não estiver focada
    if (!document.hasFocus()) {
        showToastNotification(notification);
    }
    
    // Mostrar notificação do Windows se permitido
    if (notificationPermission === 'granted') {
        showWindowsNotification(notification);
    }
    
    // Tocar som de notificação
    playNotificationSound();
}

// Atualizar contador de notificações não lidas
function updateUnreadCount() {
    unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
        notificationsCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
        notificationsCount.classList.remove('hidden');
    } else {
        notificationsCount.classList.add('hidden');
    }
}

// Renderizar lista de notificações
function renderNotifications() {
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = '<div class="no-notifications">Nenhuma notificação</div>';
        return;
    }
    
    notifications.forEach(notification => {
        const notificationElement = createNotificationElement(notification);
        notificationsList.appendChild(notificationElement);
    });
}

// Criar elemento de notificação
function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item ${notification.read ? '' : 'unread'}`;
    div.setAttribute('data-notification-id', notification.id);
    
    const iconClass = getNotificationIconClass(notification.type);
    const timeAgo = formatTimeAgo(notification.timestamp);
    
    div.innerHTML = `
        <div class="notification-icon ${notification.type}">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${timeAgo}</div>
            ${notification.data.actions ? `
                <div class="notification-actions">
                    ${notification.data.actions.map(action => `
                        <button class="notification-action-btn ${action.primary ? 'primary' : ''}" 
                                data-action="${action.type}" 
                                data-notification-id="${notification.id}">
                            ${action.label}
                        </button>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    // Adicionar event listeners para ações
    if (notification.data.actions) {
        const actionButtons = div.querySelectorAll('.notification-action-btn');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleNotificationAction(btn.dataset.action, notification);
            });
        });
    }
    
    // Marcar como lida ao clicar
    div.addEventListener('click', () => {
        markNotificationAsRead(notification.id);
    });
    
    return div;
}

// Obter classe do ícone baseada no tipo
function getNotificationIconClass(type) {
    switch (type) {
        case 'message': return 'fa-comment';
        case 'group': return 'fa-users';
        case 'system': return 'fa-info-circle';
        default: return 'fa-bell';
    }
}

// Formatar tempo relativo
function formatTimeAgo(timestamp) {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `${minutes} min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days} dias atrás`;
    
    return new Date(timestamp).toLocaleDateString('pt-BR');
}

// Marcar notificação como lida
function markNotificationAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        updateUnreadCount();
        saveNotifications();
        renderNotifications();
    }
}

// Marcar todas as notificações como lidas
function markAllNotificationsAsRead() {
    notifications.forEach(notification => {
        notification.read = true;
    });
    updateUnreadCount();
    saveNotifications();
    renderNotifications();
}

// Mostrar notificação toast
function showToastNotification(notification) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.setAttribute('data-notification-id', notification.id);
    
    const iconClass = getNotificationIconClass(notification.type);
    
    toast.innerHTML = `
        <div class="toast-icon ${notification.type}">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${notification.title}</div>
            <div class="toast-message">${notification.message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    document.body.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
    
    // Event listener para fechar
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    });
}

// Mostrar notificação do Windows
function showWindowsNotification(notification) {
    console.log('Tentando mostrar notificação Windows:', {
        notification,
        hasNotification: 'Notification' in window,
        permission: Notification.permission,
        notificationPermission: notificationPermission
    });
    
    if ('Notification' in window && Notification.permission === 'granted') {
        console.log('Permissão concedida, criando notificação Windows...');
        
        const options = {
            body: notification.message,
            icon: '/favicon.ico', // Ícone da aplicação
            badge: '/favicon.ico',
            tag: notification.id,
            requireInteraction: false,
            silent: false
        };
        
        console.log('Opções da notificação:', options);
        
        try {
            const windowsNotification = new Notification(notification.title, options);
            console.log('Notificação Windows criada com sucesso:', windowsNotification);
            
            // Auto-remover após 5 segundos
            setTimeout(() => {
                windowsNotification.close();
                console.log('Notificação Windows fechada automaticamente');
            }, 5000);
            
            // Event listener para clicar na notificação
            windowsNotification.onclick = () => {
                console.log('Notificação Windows clicada');
                window.focus();
                // Marcar como lida
                markNotificationAsRead(notification.id);
                // Focar na conversa se for uma mensagem
                if (notification.type === 'message' && notification.data.roomId) {
                    // Aqui você pode implementar a lógica para focar na conversa
                    console.log('Focando na conversa:', notification.data.roomId);
                }
            };
            
            // Event listeners para outros eventos
            windowsNotification.onshow = () => {
                console.log('Notificação Windows exibida');
            };
            
            windowsNotification.onerror = (error) => {
                console.error('Erro na notificação Windows:', error);
            };
            
        } catch (error) {
            console.error('Erro ao criar notificação Windows:', error);
        }
    } else {
        console.log('Não foi possível mostrar notificação Windows:', {
            reason: !('Notification' in window) ? 'API não suportada' : 'Permissão negada',
            permission: Notification.permission
        });
    }
}

// Carregar som de notificação
function loadNotificationSound() {
    try {
        notificationSound = new Audio('/notification.mp3');
        notificationSound.volume = 0.5;
        console.log('Som de notificação carregado com sucesso');
    } catch (error) {
        console.log('Erro ao carregar som de notificação:', error);
    }
}

// Tocar som de notificação
function playNotificationSound() {
    if (notificationSound) {
        notificationSound.play().catch(error => {
            console.log('Erro ao tocar som:', error);
        });
    }
}

// Solicitar permissão de notificação
function requestNotificationPermission() {
    console.log('Solicitando permissão de notificação...');
    console.log('Estado atual:', {
        hasNotification: 'Notification' in window,
        currentPermission: Notification.permission,
        notificationPermission: notificationPermission
    });
    
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            console.log('Permissão não definida, solicitando...');
            Notification.requestPermission().then(permission => {
                console.log('Resposta da permissão:', permission);
                notificationPermission = permission;
                if (permission === 'granted') {
                    console.log('Permissão de notificação concedida');
                    showSuccess('Notificações ativadas com sucesso!');
                    
                    // Testar notificação imediatamente
                    setTimeout(() => {
                        showWindowsNotification({
                            id: 'test',
                            title: 'Teste de Notificação',
                            message: 'Notificações do Windows estão funcionando!',
                            type: 'test'
                        });
                    }, 1000);
                } else {
                    console.log('Permissão de notificação negada');
                    showError('Notificações desativadas. Você pode ativá-las nas configurações do navegador.');
                }
            }).catch(error => {
                console.error('Erro ao solicitar permissão:', error);
            });
        } else if (Notification.permission === 'granted') {
            console.log('Permissão já concedida');
            notificationPermission = 'granted';
            
            // Testar notificação imediatamente
            setTimeout(() => {
                showWindowsNotification({
                    id: 'test',
                    title: 'Teste de Notificação',
                    message: 'Notificações do Windows estão funcionando!',
                    type: 'test'
                });
            }, 1000);
        } else {
            console.log('Permissão negada pelo usuário');
            notificationPermission = 'denied';
        }
    } else {
        console.log('API de notificação não suportada pelo navegador');
    }
}

// Lidar com ações de notificação
function handleNotificationAction(actionType, notification) {
    switch (actionType) {
        case 'view_message':
            if (notification.data.roomId) {
                // Focar na conversa
                const room = conversations.find(c => c.id === notification.data.roomId);
                if (room) {
                    selectConversation(room);
                    markNotificationAsRead(notification.id);
                }
            }
            break;
        case 'join_group':
            if (notification.data.roomId) {
                // Entrar no grupo
                const room = conversations.find(c => c.id === notification.data.roomId);
                if (room) {
                    selectConversation(room);
                    markNotificationAsRead(notification.id);
                }
            }
            break;
        case 'accept_invite':
            // Implementar lógica para aceitar convite
            console.log('Aceitando convite:', notification.data);
            markNotificationAsRead(notification.id);
            break;
        case 'decline_invite':
            // Implementar lógica para recusar convite
            console.log('Recusando convite:', notification.data);
            markNotificationAsRead(notification.id);
            break;
    }
}

// Integrar notificações com o sistema de mensagens
function setupMessageNotifications() {
    // Notificar sobre novas mensagens (já implementado no listener principal)
    if (socket) {
        
        // Notificar sobre convites para grupos
        socket.on('group_invite', (data) => {
            addNotification('group',
                'Convite para grupo',
                `Você foi convidado para o grupo "${data.groupName}"`,
                {
                    groupId: data.groupId,
                    groupName: data.groupName,
                    invitedBy: data.invitedBy,
                    actions: [
                        {
                            type: 'accept_invite',
                            label: 'Aceitar',
                            primary: true
                        },
                        {
                            type: 'decline_invite',
                            label: 'Recusar',
                            primary: false
                        }
                    ]
                }
            );
        });
        
        // Notificar sobre adição em grupos
        socket.on('added_to_group', (data) => {
            addNotification('group',
                'Adicionado ao grupo',
                `Você foi adicionado ao grupo "${data.groupName}"`,
                {
                    groupId: data.groupId,
                    groupName: data.groupName,
                    addedBy: data.addedBy,
                    actions: [{
                        type: 'join_group',
                        label: 'Entrar no grupo',
                        primary: true
                    }]
                }
            );
        });
        
        // Notificar sobre remoção de grupos
        socket.on('removed_from_group', (data) => {
            addNotification('group',
                'Removido do grupo',
                `Você foi removido do grupo "${data.groupName}"`,
                {
                    groupId: data.groupId,
                    groupName: data.groupName,
                    removedBy: data.removedBy
                }
            );
        });
        
        // Notificar sobre mudanças de admin
        socket.on('admin_changed', (data) => {
            if (data.added) {
                addNotification('group',
                    'Promovido a administrador',
                    `Você foi promovido a administrador do grupo "${data.groupName}"`,
                    {
                        groupId: data.groupId,
                        groupName: data.groupName
                    }
                );
            } else {
                addNotification('group',
                    'Removido como administrador',
                    `Você foi removido como administrador do grupo "${data.groupName}"`,
                    {
                        groupId: data.groupId,
                        groupName: data.groupName
                    }
                );
            }
        });
        
        // Atualizar lista de conversas quando houver mudanças
        socket.on('conversation_updated', (data) => {
            console.log('Conversa atualizada via Socket.IO:', data);
            
            if (data.type === 'member_added') {
                console.log('Membro adicionado, atualizando lista de conversas...');
                
                // Atualizar a lista de conversas automaticamente
                debouncedLoadConversations();
                
                // Mostrar notificação
                addNotification('group',
                    'Novo membro no grupo',
                    `Um novo membro foi adicionado ao grupo "${data.room.name}"`,
                    {
                        groupId: data.roomId,
                        groupName: data.room.name,
                        actions: [{
                            type: 'view_group',
                            label: 'Ver grupo',
                            primary: true
                        }]
                    }
                );
            }
        });
    }
}

// ===== INICIALIZAÇÃO =====

// Verificar se o usuário já está logado
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        try {
            currentUser = JSON.parse(user);
            showChatScreen();
            loadConversations();
            initializeSocket();
            startUserVerification(); // Iniciar verificação de usuário
            
            // Solicitar permissão de notificação após login
            requestNotificationPermission();
            
            // Configurar notificações de mensagens
            setupMessageNotifications();
        } catch (error) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            showAuthScreen();
        }
    } else {
        showAuthScreen();
    }
}

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeNotifications();
    initializeEmojiSystem();
});

