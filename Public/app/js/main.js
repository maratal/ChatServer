// Global variables
let currentUser = null;
let currentChatId = null;
let chats = [];
let websocket = null;
let deviceSessionId = null;
let currentChatFilter = 'all'; // 'all', 'unread', 'archived', 'muted', 'blocked'

// User selection variables
let displayedUsers = [];
let allLoadedUsers = []; // Full paginated list, unaffected by search
let userSearchTimeout = null;
let lastUserId = null;
let isLoadingUsers = false;
let hasMoreUsers = true;

// Enhanced authentication check to get current user
async function checkAuth() {
    console.log('checkAuth called');
    const currentUserData = localStorage.getItem('currentUser');
    
    console.log('Current user data:', currentUserData ? 'exists' : 'missing');
    
    if (!currentUserData) {
        console.log('No current user data, redirecting to home');
        window.location.href = '/';
        return;
    }
    
    try {
        const userData = JSON.parse(currentUserData);
        currentUser = userData;
        console.log('Parsed currentUser from localStorage:', currentUser);
        
        if (!getAccessToken()) {
            console.log('No access token in current user data, redirecting to home');
            window.location.href = '/';
            return;
        }
        
        try {
            updateCurrentUserButton();
        } catch (error) {
            console.error('Error updating current user display:', error);
        }
        
        // Get device session ID for WebSocket
        deviceSessionId = getDeviceSessionId();
        
        // Initialize everything
        await loadChats();
        initializeMessageInput();
        
        // Initialize attachment file input
        const attachmentInput = document.getElementById('attachmentInput');
        if (attachmentInput) {
            attachmentInput.addEventListener('change', handleAttachmentFileSelect);
        }
        
        // Initialize WebSocket if device session ID is available
        if (deviceSessionId) {
            initializeWebSocket();
        } else {
            console.error('Device sessionId is empty.');
        }
    } catch (e) {
        console.error('Error parsing current user data:', e);
        // If parsing fails, redirect to login
        window.location.href = '/';
    }
}

// Logout function
async function logout() {
    try {
        // Call logout API
        await apiLogoutUser();
    } catch (error) {
        console.error('Logout API error:', error);
    }
    
    // Clear local storage
    localStorage.removeItem('currentUser');
    
    // Redirect to home page
    window.location.href = '/';
}

// Check authentication when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth().catch(console.error);
    });
} else {
    checkAuth().catch(console.error);
}

// Load chats from API
async function loadChats() {
    try {
        chats = await apiGetChats(true);
        displayChats();
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Check if chat is Personal Notes (personal chat with only yourself)
function isPersonalNotes(chat) {
    return chat.isPersonal && chat.allUsers.length === 1 && chat.allUsers[0].id === currentUser?.info?.id;
}

// Get the date of the last message in a chat (for sorting)
function getChatLastMessageDate(chat) {
    if (!chat.lastMessage) return null;
    
    let dateObj = chat.lastMessage.updatedAt || chat.lastMessage.createdAt;
    if (!dateObj) return null;
    
    if (typeof dateObj === 'string') {
        dateObj = new Date(dateObj);
    }
    else if (typeof dateObj === 'number') {
        // Server sends UNIX timestamps in seconds (since 1970)
        dateObj = new Date(dateObj * 1000);
    }
    
    return dateObj;
}

let shouldRestoreChatSelection = true;

function restoreSelectedChatId() {
    if (!shouldRestoreChatSelection) return null;

    // Disable further restoration attempts until next page load
    shouldRestoreChatSelection = false;
    
    let chatIdToSelect = null;

    // 1. Check if URL has a chat hash
    if (window.location.hash.startsWith('#chat-')) {
        const hashChatId = window.location.hash.substring(6); // Remove '#chat-'
        if (chats.some(c => c.id === hashChatId)) {
            chatIdToSelect = hashChatId;
        }
    }

    // 2. Fall back to localStorage
    if (!chatIdToSelect) {
        const savedChatId = localStorage.getItem('selectedChatId');
        if (savedChatId && chats.some(c => c.id === savedChatId)) {
            chatIdToSelect = savedChatId;
        }
    }

    return chatIdToSelect;
}

// Update page title with unread chats count
let originalTitle = document.title;

async function markChatAsRead(chatId) {
    if (!chatId) return;
    
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    const lastMessage = chat.lastMessage;
    if (!lastMessage || !lastMessage.id || isMessageReadByCurrentUser(lastMessage)) return;
    
    setStorageUnreadCount(chat.id, 0);
    
    // Update the DOM to remove badge and bold style
    const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (chatItem) {
        const lastMessageElement = chatItem.querySelector('.chat-last-message');
        if (lastMessageElement) {
            lastMessageElement.classList.remove('unread');
        }
        
        const badgeElement = chatItem.querySelector('.chat-badge');
        if (badgeElement) {
            badgeElement.remove();
        }
    }
    
    // Call API to mark messages as read
    try {
        const message = await apiMarkAsRead(chatId, lastMessage.id);
        lastMessage.readMarks = message.readMarks; // Update readMarks for the last message
    } catch (error) {
        console.error('Failed to mark messages as read:', error);
    }

    // Update page title badge
    updatePageTitleBadge();
}

function updatePageTitleBadge() {
    // Count chats with unread messages
    const unreadChatsCount = chats.filter(chat => getStorageUnreadCount(chat.id) > 0).length;
    
    if (unreadChatsCount > 0 && document.hidden) {
        document.title = `(${unreadChatsCount}) ${originalTitle}`;
    } else {
        document.title = originalTitle;
    }
}

// Display chats in the sidebar
function displayChats(restoreSelection = true) {
    const chatItems = document.getElementById('chatItems');
    chatItems.innerHTML = '';
    
    // Filter chats based on current filter
    let filteredChats = chats.filter(chat => {
        const isBlocked = chat.isBlocked || false;
        const isArchived = chat.isArchived || false;
        const isMuted = chat.isMuted || false;
        
        switch (currentChatFilter) {
            case 'all':
                // Show all chats except blocked and archived
                return !isBlocked && !isArchived;
            case 'unread':
                return getStorageUnreadCount(chat.id) > 0 && !isBlocked && !isArchived;
            case 'archived':
                return isArchived;
            case 'blocked':
                return isBlocked;
            case 'muted':
                return isMuted;
            default:
                return true;
        }
    });
    
    // Update filter pill active states (do this before early return)
    updateFilterPills();

    if (filteredChats.length === 0) {
        // Only show "Find someone to chat" button if filter is set to "all"
        // Otherwise show "No chats" label for other filters
        if (currentChatFilter === 'all') {
            chatItems.innerHTML = `
                <div class="no-chats-container">
                    <a href="#" class="find-users-link" onclick="event.preventDefault(); openUserSelection();">
                        Find someone to chat
                    </a>
                </div>
            `;
        } else {
            const filterLabel = currentChatFilter === 'unread' ? 'unread' :
                               currentChatFilter === 'archived' ? 'archived' :
                               currentChatFilter === 'blocked' ? 'blocked' :
                               currentChatFilter === 'muted' ? 'muted' : '';
            chatItems.innerHTML = `
                <div class="no-chats-container">
                    <span class="no-chats-label">No ${filterLabel} chats</span>
                </div>
            `;
        }
    }

    // Sort chats: Personal Notes first, then by lastMessage date (newest first)
    const sortedChats = [...filteredChats].sort((a, b) => {
        // Personal Notes always on top
        if (isPersonalNotes(a)) return -1;
        if (isPersonalNotes(b)) return 1;

        // Sort by lastMessage date (newest first), with chats having lastMessage taking precedence
        const aDate = getChatLastMessageDate(a);
        const bDate = getChatLastMessageDate(b);

        // Both have lastMessage - sort by lastMessage date (newest first)
        if (aDate && bDate) {
            return bDate - aDate;
        }

        // Only a has lastMessage - a comes first
        if (aDate) {
            return -1;
        }

        // Only b has lastMessage - b comes first
        if (bDate) {
            return 1;
        }

        // Neither has lastMessage - sort by updatedAt (newest first)
        const aUpdatedAt = typeof a.updatedAt === 'string' ? new Date(a.updatedAt) : (typeof a.updatedAt === 'number' ? new Date(a.updatedAt * 1000) : new Date(0));
        const bUpdatedAt = typeof b.updatedAt === 'string' ? new Date(b.updatedAt) : (typeof b.updatedAt === 'number' ? new Date(b.updatedAt * 1000) : new Date(0));
        return bUpdatedAt - aUpdatedAt;
    });

    sortedChats.forEach(chat => {
        const chatItem = createChatItem(chat);
        chatItems.appendChild(chatItem);
    });

    if (restoreSelection) {
        // Restore selected chat if applicable
        if (currentChatId === null) {
            // Restore selected chat if page just reloaded
            let restoredChatId = restoreSelectedChatId();

            // Validate restoredChatId
            if (!sortedChats.some(chat => chat.id === restoredChatId)) {
                restoredChatId = null;
            }

            // Select the chat and initialize history state
            if (restoredChatId) {
                // Replace initial state instead of pushing
                history.replaceState({ chatId: restoredChatId }, '', `#chat-${restoredChatId}`);
                selectChat(restoredChatId, false); // addToHistory = false to avoid pushing another state
            } else if (sortedChats.length > 0) {
                // Select the first chat by default
                selectChat(sortedChats[0].id);
            } else {
                makeNoChatsSelected();
            }
        } else {
            // Ensure current chat is selected in the UI
            selectChat(currentChatId, false);
        }
    }
    // Update page title badge
    updatePageTitleBadge();
}

// Create a chat item element
function createChatItem(chat) {
    const item = document.createElement('button');
    item.className = 'chat-item';
    item.dataset.chatId = chat.id; // Add chat ID as data attribute
    item.onclick = () => selectChat(chat.id);
    
    // Determine chat name and avatar
    let chatName, avatarContent, avatarClass, hasOnlineStatus = false;
    
    let avatarUserId = null;
    if (chat.isPersonal) {
        // For personal chats, show the other user's name
        const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
        if (!otherUser) {
            // Chat with oneself
            chatName = 'Personal Notes';
            avatarContent = '️🗒️';
            avatarClass = 'avatar-initials avatar-personal-notes-chat-list';
        } else {
            chatName = otherUser.name;
            avatarUserId = otherUser.id;
            // Show online status only if user is actually online
            hasOnlineStatus = otherUser.lastSeen ? isUserOnline(otherUser.lastSeen) : false;
        }
    } else {
        // For group chats, show chat title or member names
        chatName = getGroupChatDisplayName(chat);
        avatarUserId = `group_${chat.id}`; // Use chat id for group color
    }
    
    // Get last message preview and time
    const isBlocked = chat.isBlocked || false;
    const isArchived = chat.isArchived || false;
    const isMuted = chat.isMuted || false;
    const lastMessageText = getChatLastMessageText(chat);
    const messageDate = getChatLastMessageDate(chat);
    const messageDateString = messageDate ? formatMessageTime(messageDate) : null;
    
    // Get unread count from chat
    const unreadCount = resolveUnreadCount(chat);
    
    // Generate avatar HTML
    let avatarHtml;
    if (avatarUserId) {
        // Check if there's an image for this chat (for group chats) or user (for personal chats)
        if (chat.isPersonal) {
            const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
            if (otherUser) {
                const mainPhoto = mainPhotoForUser(otherUser);
                if (mainPhoto) {
                    avatarHtml = getAvatarImageHtml(mainPhoto);
                } else {
                    avatarHtml = getAvatarInitialsHtml(chatName, avatarUserId);
                }
            } else {
                avatarHtml = getAvatarInitialsHtml(chatName, avatarUserId);
            }
        } else {
            // Group chat - check for chat images
            const chatImage = mainImageForChat(chat);
            if (chatImage) {
                avatarHtml = getAvatarImageHtml(chatImage);
            } else {
                avatarHtml = getAvatarInitialsHtml(chatName, avatarUserId);
            }
        }
    } else {
        // Personal notes - use special class without colors
        avatarHtml = `<span class="${avatarClass}">${escapeHtml(avatarContent)}</span>`;
    }
    
    item.innerHTML = `
        <span class="avatar-small">
            ${avatarHtml}
            ${hasOnlineStatus ? '<span class="chat-status-indicator"></span>' : ''}
        </span>
        <div class="chat-info">
            <div class="chat-header-row">
                <h3 class="chat-name">${escapeHtml(chatName)}</h3>
                ${messageDateString ? `<span class="chat-time">${messageDateString}</span>` : ''}
            </div>
            <div class="chat-message-row">
                ${isBlocked ? 
                    `<span class="chat-muted-indicator">
                        <span class="chat-muted-text">Blocked</span>
                    </span>` : 
                    isArchived ? 
                    `<span class="chat-muted-indicator">
                        <span class="chat-muted-text">Archived</span>
                    </span>` : 
                    isMuted ? 
                    `<span class="chat-muted-indicator">
                        <span class="chat-muted-text">Muted</span>
                    </span>` : 
                    `<p class="chat-last-message${unreadCount > 0 ? ' unread' : ''}">${escapeHtml(lastMessageText)}</p>`
                }
                ${unreadCount > 0 ? `<div class="chat-badge">${unreadCount}</div>` : ''}
            </div>
        </div>
    `;
    
    // Add long press handler to show chat menu
    addLongPressHandler(item, {
        onLongPress: (event, startPosition) => {
            const rect = item.getBoundingClientRect();
            showChatMenu({ x: event.clientX, y: event.clientY }, chat.id);
        },
        excludeSelectors: ['.avatar-small'],
        duration: 300,
        maxMovement: 10
    });
    
    return item;
}

// Select a chat and load its messages
async function selectChat(chatId, addToHistory = true) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    // Update active state - find button by data-chatId
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.chatId === chatId) {
            item.classList.add('active');
        }
    });

    // Update chat header
    const chatHeader = document.getElementById('chatHeader');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    const chatHeaderStatusIndicator = document.getElementById('chatHeaderStatusIndicator');
    const chatHeaderAvatarContainer = document.getElementById('chatHeaderAvatarContainer');
    const messagesContainer = document.getElementById('messagesContainer');
    
    // Add/remove personal chat class for styling
    if (chat.isPersonal) {
        messagesContainer.classList.add('personal-chat');
        const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
        if (!otherUser) {
            // Chat with oneself - Personal Notes (no avatar color)
            chatTitle.textContent = 'Personal Notes';
            chatSubtitle.textContent = '';
            chatHeaderAvatar.textContent = '️🗒️';
            chatHeaderAvatar.style.color = '';
            chatHeaderAvatar.style.backgroundColor = '';
            chatHeaderAvatarContainer.title = 'Journal';
            chatHeaderStatusIndicator.style.display = 'none'; // No status for self-chat
        } else {
            chatTitle.textContent = otherUser.name;
            // Show last seen (status indicator shows if online)
            const isOnline = otherUser.lastSeen ? isUserOnline(otherUser.lastSeen) : false;
            const lastSeen = otherUser.lastSeen ? formatLastSeen(otherUser.lastSeen) : null;
            chatSubtitle.textContent = lastSeen ? `Last seen ${lastSeen}` : '';
            
            // Display user avatar image if available, otherwise use initials
            const mainPhoto = mainPhotoForUser(otherUser);
            if (mainPhoto) {
                chatHeaderAvatar.innerHTML = getAvatarImageHtml(mainPhoto);
                chatHeaderAvatar.style.color = '';
                chatHeaderAvatar.style.backgroundColor = '';
            } else {
                applyAvatarColor(chatHeaderAvatar, otherUser.name, otherUser.id);
            }
            chatHeaderAvatarContainer.title = '';
            chatHeaderStatusIndicator.style.display = isOnline ? 'block' : 'none';
        }
    } else {
        messagesContainer.classList.remove('personal-chat');
        const groupName = getGroupChatDisplayName(chat);
        chatTitle.textContent = groupName;
        chatSubtitle.textContent = `${chat.allUsers.length} members`;
        
        // Display group chat avatar image if available, otherwise use initials
        const chatImage = mainImageForChat(chat);
        if (chatImage) {
            chatHeaderAvatar.innerHTML = getAvatarImageHtml(chatImage);
            chatHeaderAvatar.style.color = '';
            chatHeaderAvatar.style.backgroundColor = '';
        } else {
            applyAvatarColor(chatHeaderAvatar, groupName, `group_${chat.id}`);
        }
        chatHeaderAvatarContainer.title = '';
        chatHeaderStatusIndicator.style.display = 'none'; // No status for group chats
    }
    
    if (currentChatId === chatId) {
        return;
    }
    currentChatId = chatId;
    
    // Push to history (only if not navigating from back/forward button)
    if (addToHistory) {
        history.pushState({ chatId: chatId }, '', `#chat-${chatId}`);
    }
    
    // Save selected chat ID to localStorage
    localStorage.setItem('selectedChatId', chatId);
    
    chatHeader.style.display = 'flex';
    
    // Add click handler to chat header avatar
    if (chatHeaderAvatarContainer) {
        if (isPersonalNotes(chat)) {
            chatHeaderAvatarContainer.onclick = async () => {
                try {
                    const fullChat = await apiGetChat(chat.id);
                    const chatIndex = chats.findIndex(c => c.id === chat.id);
                    if (chatIndex !== -1) chats[chatIndex] = fullChat;
                    showNotesInfo(fullChat, { isOwner: true });
                } catch (error) {
                    console.error('Error fetching chat for notes info:', error);
                }
            };
        } else if (chat.isPersonal) {
            const user = chat.allUsers.find(user => user.id !== currentUser?.info.id) || currentUser.info;
            chatHeaderAvatarContainer.onclick = () => showUserInfo(user.id);
        } else {
            // For group chats, show group chat info
            chatHeaderAvatarContainer.onclick = () => showGroupChatInfo(chat.id);
        }
    }
    
    // Show message input
    const messageInputContainer = document.getElementById('messageInputContainer');
    
    if (chat.isBlocked || false) {
        // Hide message input for blocked chats
        messageInputContainer.style.display = 'none';
        // For blocked chats, show load messages button instead of loading automatically
        messagesContainer.innerHTML = `
            <div class="no-messages">
                You have blocked this chat. Click <span class="blocked-chat-load-btn" onclick="loadMessagesAndPrepareInputForChat('${chatId}')">here</span> to load messages.
            </div>
        `;
    } else {
        messageInputContainer.style.display = 'flex';
        await loadMessagesAndPrepareInputForChat(chatId);
    }
}

// Update current user display in chat list header
function updateCurrentUserButton() {
    if (!currentUser || !currentUser.info) {
        console.log('No currentUser or currentUser.info');
        return;
    }
    
    const userName = currentUser.info.name || currentUser.info.username || 'User';
    
    console.log('Updating display with:', userName);
    
    // Update sidebar current user avatar
    const sidebarAvatar = document.getElementById('sidebarCurrentUserAvatar');
    if (sidebarAvatar) {
        const mainPhoto = mainPhotoForUser(currentUser.info);
        
        if (mainPhoto) {
            sidebarAvatar.innerHTML = `<img src="${getPreviewUrl(mainPhoto.id, mainPhoto.fileType)}" alt="">`;
        } else {
            sidebarAvatar.innerHTML = getAvatarInitialsHtml(userName, currentUser.info.id);
        }
    }
}

// Update chat list when new message arrives
async function updateChatListWithMessage(message) {
    const chat = chats.find(c => c.id === message.chatId);
    if (!chat || !chat.id) {
        console.warn('Received message for unknown chat:', message.chatId);
        return;
    }

    const chatItem = document.querySelector(`[data-chat-id="${message.chatId}"]`);
    if (!chatItem) {
        console.warn('Chat item not found for message:', message.chatId);
        return;
    }

    chat.lastMessage = message;

    const lastMessageElement = chatItem.querySelector('.chat-last-message');
    if (lastMessageElement) {
        const lastMessageText = getChatLastMessageText(chat);
        lastMessageElement.textContent = lastMessageText;
    }

    // If the message is from the current user, don't increment unread count
    if (isOwnMessage(message)) {
        return;
    }

    var unreadCount = getStorageUnreadCount(chat.id);

    // If the chat is currently open and the document is visible, mark it as read immediately
    if (message.chatId === currentChatId && !document.hidden) {
        await markChatAsRead(chat.id);
    } else {
        setStorageUnreadCount(chat.id, ++unreadCount);
    }

    if (lastMessageElement) {
        // Update bold style based on unread count
        if (unreadCount > 0) {
            lastMessageElement.classList.add('unread');
        } else {
            lastMessageElement.classList.remove('unread');
        }
    }
    
    // Update or add badge
    const messageRow = chatItem.querySelector('.chat-message-row');
    if (messageRow) {
        let badgeElement = messageRow.querySelector('.chat-badge');
        if (unreadCount > 0) {
            if (badgeElement) {
                badgeElement.textContent = unreadCount;
            } else {
                badgeElement = document.createElement('div');
                badgeElement.className = 'chat-badge';
                badgeElement.textContent = unreadCount;
                messageRow.appendChild(badgeElement);
            }
        } else if (badgeElement) {
            badgeElement.remove();
        }
    }
}


// Get device session ID from current user session
function getDeviceSessionId() {
    return currentUser.session.id;
}

// User Selection Functions
function openUserSelection() {
    const modal = document.getElementById('userSelectionModal');
    modal.style.display = 'block';
    
    // Force a reflow to ensure initial styles are applied
    modal.offsetHeight;
    
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    });
    
    // Reset state
    displayedUsers = [];
    allLoadedUsers = [];
    lastUserId = null;
    hasMoreUsers = true;
    isLoadingUsers = false;
    
    // Clear search input
    document.getElementById('userSearchInput').value = '';
    
    // Load initial users
    loadUsers(document.getElementById('usersList'), displayUsers);
    
    // Setup search listener
    setupUserSearch();
    
    // Setup scroll listener for pagination
    setupUserScrollPagination();

    // Close on backdrop click
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeUserSelection();
        }
    });
}

function closeUserSelection() {
    const modal = document.getElementById('userSelectionModal');
    modal.classList.remove('show');
    
    // Hide modal after animation completes
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Clear timeout if exists
    if (userSearchTimeout) {
        clearTimeout(userSearchTimeout);
        userSearchTimeout = null;
    }
}

function setupUserSearch() {
    const searchInput = document.getElementById('userSearchInput');
    
    searchInput.addEventListener('input', function() {
        // Clear existing timeout
        if (userSearchTimeout) {
            clearTimeout(userSearchTimeout);
        }
        
        // Set new timeout for search
        userSearchTimeout = setTimeout(() => {
            const query = this.value.trim();
            const usersList = document.getElementById('usersList');
            if (query.length > 1) {
                searchUsers(query, usersList, displayUsers);
            } else if (query.length === 1) {
                // Local filter on the full paginated list (no network request)
                const lowerQuery = query.toLowerCase();
                const filtered = allLoadedUsers.filter(user =>
                    (user.name || '').toLowerCase().includes(lowerQuery) ||
                    (user.username || '').toLowerCase().includes(lowerQuery)
                );
                displayedUsers = filtered;
                displayUsers();
            } else {
                // Reset to full loaded list
                displayedUsers = allLoadedUsers;
                displayUsers();
            }
        }, 300);
    });
}

function setupUserScrollPagination() {
    const usersList = document.getElementById('usersList');
    
    usersList.addEventListener('scroll', function() {
        // Check if scrolled to bottom
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 5) {
            // Load more users if available and not currently loading
            if (hasMoreUsers && !isLoadingUsers && !document.getElementById('userSearchInput').value.trim()) {
                loadUsers(document.getElementById('usersList'), displayUsers);
            }
        }
    });
}

async function loadUsers(domElement, displayCallback) {
    if (isLoadingUsers || !hasMoreUsers) return;
    // Show loading
    domElement.innerHTML = '<div class="users-loading">Looking...</div>';

    isLoadingUsers = true;
    const pageSize = 20;
    
    try {
        const users = await apiGetAllUsers(lastUserId, pageSize);
        
        // Add users to current users
        if (users.length > 0) {
            allLoadedUsers = [...allLoadedUsers, ...users];
            displayedUsers = [...allLoadedUsers];
            // Update lastUserId to the ID of the last user for cursor-based pagination
            lastUserId = users[users.length - 1].id;
        }
        
        // Set hasMoreUsers to false if we got less than the requested amount
        if (users.length < pageSize) {
            hasMoreUsers = false;
        }
        
        displayCallback();
    } catch (error) {
        console.error('Error loading users:', error);
        domElement.innerHTML = `<div class="users-empty">Error loading users</div>`;
    } finally {
        isLoadingUsers = false;
    }
}

async function searchUsers(query, domElement, displayCallback) {
    // Show loading
    domElement.innerHTML = '<div class="users-loading">Looking...</div>';
    
    try {
        const users = await apiSearchUsers(query);
        displayedUsers = users;
        displayCallback();
    } catch (error) {
        console.error('Error searching users:', error);
        domElement.innerHTML = `<div class="users-empty">Error searching users</div>`;
    }
}

function displayUsers() {
    const usersList = document.getElementById('usersList');
    
    if (displayedUsers.length === 0) {
        usersList.innerHTML = '<div class="users-empty">No users found</div>';
        return;
    }
    
    let html = '';
    displayedUsers.forEach(user => {
        const avatarHtml = getAvatarHtml(user);
        html += `
            <div class="user-item" onclick="selectUser(${user.id})">
                <div class="avatar-small">${avatarHtml}</div>
                <div class="user-item-info">
                    <div class="user-item-name">${escapeHtml(user.name || user.username || 'Unknown User')}</div>
                    <div class="user-item-username">@${escapeHtml(user.username || 'unknown')}</div>
                </div>
            </div>
        `;
    });
    
    // Add loading indicator if there are more users to load
    if (hasMoreUsers && !document.getElementById('userSearchInput').value.trim()) {
        html += '<div class="users-loading" style="padding: 20px;">Loading more users...</div>';
    }
    
    usersList.innerHTML = html;
}

function showUsersError(message) {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = `<div class="users-empty">${message}</div>`;
}

async function selectUser(userId) {
    // Close modal
    closeUserSelection();
    
    // Close all open user info modals
    closeAllModalInfoPanels();

    // Create or find chat with this user
    await createOrOpenPersonalChat(userId);
}

// Find personal chat by user ID or Personal Notes if userId is the current user
function findPersonalChatByUserId(userId) {
    return chats.find(chat => {
        if (!chat.isPersonal) return false;
        
        if (currentUser?.info?.id === userId) {
            // Personal Notes: chat with only yourself
            return chat.allUsers.length === 1 && chat.allUsers[0].id === userId;
        } else {
            // Personal chat with another user: must have exactly 2 users including the target
            return chat.allUsers.length === 2 && chat.allUsers.some(user => user.id === userId);
        }
    });
}

async function createOrOpenPersonalChat(userId) {
    try {
        const existingChat = findPersonalChatByUserId(userId);
        
        if (existingChat) {
            // Open existing chat
            selectChat(existingChat.id);
            return;
        }
        
        // Create new personal chat
        const newChat = await apiCreateChat(true, [userId]);
        
        // Check if chat already exists in the list (API might return existing chat)
        const existingChatIndex = chats.findIndex(c => c.id === newChat.id);
        if (existingChatIndex === -1) {
            // Chat doesn't exist, add it
            chats.unshift(newChat);
        }
        
        // Refresh chat display
        displayChats(false);

        // Select the newly created chat
        selectChat(newChat.id);

    } catch (error) {
        console.error('Error creating chat:', error);
        alert('Error creating chat. Please try again.');
    }
}

// Add plus button click handler when page loads
document.addEventListener('DOMContentLoaded', function() {
    const addChatButton = document.getElementById('addChatButton');
    if (addChatButton) {
        addChatButton.addEventListener('click', openUserSelection);
    }
});

// User Info Modal Functions
// User info modal stack management
let userInfoModalStack = []; // Array of { userId, element, closeHandler }

async function showUserInfo(userId) {
    if (!userId) return;
    
    // Create a new modal container
    const modalId = `userInfoModal_${userId}`;
    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.className = 'user-info-modal';
    modalElement.style.zIndex = 1000 + userInfoModalStack.length * 10;
    
    modalElement.innerHTML = `
        <div class="user-info-content">
            <div class="user-info-header">
                <button class="ellipsis-button" id="userInfoMenuButton_${userId}" onclick="event.stopPropagation(); showUserInfoMenu(${userId})" title="Chat menu">
                    •••
                </button>
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="inline-button" onclick="closeTopModalInfoPanel()">
                    ${closeIcon}
                </button>
            </div>
            <div class="user-info-body" id="${modalId}_body">
                <div class="user-info-loading">Loading user information...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalElement);
    const body = document.getElementById(`${modalId}_body`);
    
    // Close on backdrop click
    modalElement.addEventListener('click', function(event) {
        if (event.target === modalElement) {
            closeTopModalInfoPanel();
        }
    });
    
    // Show modal - same pattern as user selection modal
    modalElement.style.display = 'block';
    // Force a reflow to ensure initial styles are applied
    modalElement.offsetHeight;
    
    // Trigger animation after display is set (double RAF ensures transition works)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modalElement.classList.add('show');
        });
    });
    
    // Add to stack
    userInfoModalStack.push({ userId, element: modalElement, bodyId: `${modalId}_body` });

    try {
        const user = await apiGetUser(userId);
        console.log('User data received:', user);
        displayUserInfo(user, `${modalId}_body`);
    } catch (error) {
        console.error('Error fetching user info:', error);
        body.innerHTML = `<div class="user-info-loading" style="color: #ef4444;">Error: ${error.message || 'Failed to load user information'}</div>`;
    }
}

function closeAllModalInfoPanels() {
    // Close all user info modals
    while (userInfoModalStack.length > 0) {
        closeTopModalInfoPanel();
    }
}

async function loadMessagesAndPrepareInputForChat(chatId) {
    // Load messages and setup infinite scroll
    await loadMessages(chatId, true);
    setupInfiniteScroll(chatId);
    
    // Focus message input field
    const messageInput = getMessageInputElement();
    if (messageInput) {
        messageInput.focus();
    }
}

function closeTopModalInfoPanel() {
    if (userInfoModalStack.length === 0) return;
    
    const modalInfo = userInfoModalStack.pop();
    modalInfo.element.classList.remove('show');
    
    // Hide modal after animation completes
    setTimeout(() => {
        if (modalInfo.element.parentNode) {
            modalInfo.element.parentNode.removeChild(modalInfo.element);
        }
    }, 300);
}

function showChatHeaderMenu(event) {
    const menuButton = document.getElementById('chatHeaderMenuButton');
    if (!menuButton) return;
    
    const rect = menuButton.getBoundingClientRect();
    
    showChatMenu({ x: rect.left, y: rect.bottom + 2 }, currentChatId, false);
}

function showChatMenu(point, chatId, fromModal = true) {
    if (!chatId) return;
    
    const chat = chats.find(chat => chat.id === chatId);
    if (!chat) return;
    
    const isMuted = chat.isMuted || false;
    const isArchived = chat.isArchived || false;
    const isBlocked = chat.isBlocked || false;
    const isPersonal = chat.isPersonal || false;
    const isPersonalNotesChat = isPersonalNotes(chat);
    const isOwner = chat.owner.id === currentUser?.info.id;

    const menuItems = fromModal ? [] : [
        { id: 'info', label: 'Info', icon: infoIcon },
    ];

    // Don't show mute option for Personal Notes
    if (!isPersonalNotesChat) {
        menuItems.push(
            { id: 'mute', label: isMuted ? 'Unmute' : 'Mute', icon: isMuted ? unmuteIcon : muteIcon },
        );
    }
    
    menuItems.push(
        { id: 'archive', label: isArchived ? 'Unarchive' : 'Archive', icon: archiveIcon },
    );
    
    // Don't show block option for Personal Notes
    if (!isPersonalNotesChat) {
        menuItems.push(
            { id: 'block', label: isBlocked ? 'Unblock' : 'Block', icon: blockIcon }
        );
    }
    
    if (isOwner || chat.isPersonal) {
        menuItems.push(
            { id: 'delete', label: 'Delete', icon: deleteIcon, separator: true, destructive: true }
        );
    } else {
        menuItems.push(
            { id: 'leave', label: 'Leave', icon: deleteIcon, separator: true }
        );
    }
    
    showContextMenu({
        items: menuItems,
        x: point.x,
        y: point.y,
        anchor: 'top-left',
        onAction: async (action) => {
            await handleChatMenuAction(action, chatId, fromModal);
        }
    });
}

async function handleChatMenuAction(action, chatId, fromModal) {
    const chat = chats.find(chat => chat.id === chatId);
    if (!chat) return;
    
    switch (action) {
        case 'info':
            if (isPersonalNotes(chat)) {
                // Fetch full chat info then show notes info panel
                try {
                    const fullChat = await apiGetChat(chatId);
                    const chatIndex = chats.findIndex(c => c.id === chatId);
                    if (chatIndex !== -1) chats[chatIndex] = fullChat;
                    showNotesInfo(fullChat, { isOwner: true });
                } catch (error) {
                    console.error('Error fetching chat for notes info:', error);
                }
            } else if (chat.isPersonal) {
                const user = chat.allUsers.find(user => user.id !== currentUser?.info.id) || currentUser.info;
                showUserInfo(user.id);
            } else {
                showGroupChatInfo(chat.id);
            }
            return;
        case 'mute':
            toggleMuteChat(chatId);
            break;
        case 'block':
            toggleBlockChat(chatId);
            break;
        case 'archive':
            toggleArchiveChat(chatId);
            break;
        case 'delete':
            deleteChat(chatId);
            break;
        case 'leave':
            leaveChat(chatId);
            break;
    }
    if (fromModal) {
        closeTopModalInfoPanel();
    }
}

async function toggleMuteChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        console.error('Chat not found:', chatId);
        return;
    }
    
    const newMuteState = !(chat.isMuted || false);
    
    try {
        const updatedChat = await apiUpdateChatSettings(chatId, { isMuted: newMuteState });
        
        // Update the local chat object
        chat.isMuted = updatedChat.isMuted;
        
        // Refresh the chat list display to show updated mute state
        displayChats();
        
        // Update header if this chat is selected
        if (currentChatId === chatId) {
            selectChat(currentChatId, false);
        }
    } catch (error) {
        console.error('Error toggling mute:', error);
        alert('Error ' + (newMuteState ? 'muting' : 'unmuting') + ' chat: ' + error.message);
    }
}

async function toggleArchiveChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        console.error('Chat not found:', chatId);
        return;
    }
    
    const newArchiveState = !(chat.isArchived || false);
    
    try {
        const updatedChat = await apiUpdateChatSettings(chatId, { isArchived: newArchiveState });
        
        // Update the local chat object
        chat.isArchived = updatedChat.isArchived;

        // Clear current chat if it was the archived one
        if (currentChatId === chatId) {
            currentChatId = null;
        }

        // Refresh the chat list display to show updated archive state
        displayChats();

    } catch (error) {
        console.error('Error toggling archive:', error);
        alert('Error ' + (newArchiveState ? 'archiving' : 'unarchiving') + ' chat: ' + error.message);
    }
}

async function toggleBlockChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        console.error('Chat not found:', chatId);
        return;
    }
    
    const newBlockState = !(chat.isBlocked || false);
    
    try {
        if (newBlockState) {
            await apiBlockChat(chatId);
        } else {
            await apiUnblockChat(chatId);
        }
        
        // Update the local chat object
        chat.isBlocked = newBlockState;

        // Clear current chat if it was the blocked one
        if (currentChatId === chatId) {
            currentChatId = null;
        }

        // Refresh the chat list display to show updated block state
        displayChats();

    } catch (error) {
        console.error('Error toggling block:', error);
        alert('Error ' + (newBlockState ? 'blocking' : 'unblocking') + ' chat: ' + error.message);
    }
}

async function deleteChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        console.error('Chat not found:', chatId);
        return;
    }
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this chat? This will delete all messages in the chat together with all media content. This action cannot be undone.')) {
        return;
    }
    
    try {
        // Call the API to delete the chat
        await apiDeleteChat(chatId);
        
        // Remove the chat from the local chats array
        const chatIndex = chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            chats.splice(chatIndex, 1);
        }

        // Clear current chat if it was the deleted one
        if (currentChatId === chatId) {
            currentChatId = null;
        }

        // Refresh the chat list display
        displayChats();

    } catch (error) {
        console.error('Error deleting chat:', error);
        alert('Error deleting chat: ' + error.message);
    }
}

async function leaveChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        console.error('Chat not found:', chatId);
        return;
    }
    
    // Confirm leaving
    if (!confirm('Are you sure you want to leave this chat?')) {
        return;
    }
    
    try {
        // Call the API to exit the chat
        await apiExitChat(chatId);
        
        // Remove the chat from the local chats array
        const chatIndex = chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            chats.splice(chatIndex, 1);
        }

        // Clear current chat if it was the one we left
        if (currentChatId === chatId) {
            currentChatId = null;
        }

        // Refresh the chat list display
        displayChats();

    } catch (error) {
        console.error('Error leaving chat:', error);
        alert('Error leaving chat: ' + error.message);
    }
}

function showChatInfoMenu(chatId) {
    const menuButton = document.getElementById(`chatInfoMenuButton_${chatId}`);
    if (!menuButton) return;
    
    const rect = menuButton.getBoundingClientRect();
    
    showChatMenu({ x: rect.left, y: rect.bottom + 2 }, chatId);
}

async function showUserInfoMenu(userId) {
    const menuButton = document.getElementById(`userInfoMenuButton_${userId}`);
    if (!menuButton) return;

    const rect = menuButton.getBoundingClientRect();
    
    // Find if a personal chat exists with this user
    const personalChat = findPersonalChatByUserId(userId);
    
    if (personalChat && currentChatId === personalChat.id) {
        // Show chat menu if personal chat exists
        showChatMenu({ x: rect.left, y: rect.bottom + 2 }, personalChat.id);
    } else {
        // Show menu with option to start chat
        const menuItems = [
            { id: 'open_chat', label: 'Open Chat', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' }
        ];
        
        showContextMenu({
            items: menuItems,
            x: rect.left,
            y: rect.bottom + 2,
            anchor: 'top-left',
            onAction: async (action) => {
                if (action === 'open_chat') {
                    await createOrOpenPersonalChat(userId);
                    closeAllModalInfoPanels();
                }
            }
        });
    }
}

async function showGroupChatInfo(chatId) {
    if (!chatId) return;
    
    // Create a new modal container (using the same stack system as user info)
    const modalId = `chatInfoModal_${chatId}`;
    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.dataset.chatId = chatId;
    modalElement.className = 'user-info-modal';
    modalElement.style.zIndex = 1000 + userInfoModalStack.length * 10;
    
    modalElement.innerHTML = `
        <div class="user-info-content">
            <div class="user-info-header">
                <button class="ellipsis-button" id="chatInfoMenuButton_${chatId}" onclick="event.stopPropagation(); showChatInfoMenu('${chatId}')" title="Chat menu">
                    •••
                </button>
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="inline-button" onclick="closeTopModalInfoPanel()">
                    ${closeIcon}
                </button>
            </div>
            <div class="user-info-body" id="${modalId}_body">
                <div class="user-info-loading">Loading group information...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalElement);
    const body = document.getElementById(`${modalId}_body`);
    
    // Close on backdrop click
    modalElement.addEventListener('click', function(event) {
        if (event.target === modalElement) {
            closeTopModalInfoPanel();
        }
    });
    
    // Show modal
    modalElement.style.display = 'block';
    modalElement.offsetHeight;
    
    // Trigger animation after display is set (double RAF ensures transition works)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modalElement.classList.add('show');
        });
    });
    
    // Add to stack
    userInfoModalStack.push({ chatId, element: modalElement, bodyId: `${modalId}_body`, isGroupChat: true });

    try {
        const chat = await apiGetChat(chatId);

        // Update the local chat object with the latest info
        const chatIndex = chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            chats[chatIndex] = chat;
        }

        displayGroupChatInfo(chat);
    } catch (error) {
        console.error('Error fetching group chat info:', error);
        body.innerHTML = `<div class="user-info-loading" style="color: #ef4444;">Error: ${error.message || 'Failed to load group chat information'}</div>`;
    }
}

function groupChatSaveBtnHTML(chatId, field) {
    return saveBtnHTML(`groupChat${field}SaveBtn_${chatId}`, `saveGroupChat${field}('${chatId}')`);
}

function displayGroupChatInfo(chat) {
    const bodyId = `chatInfoModal_${chat.id}_body`;
    const body = document.getElementById(bodyId);
    
    if (!body) {
        console.error('Element body not found:', bodyId);
        return;
    }
    
    const groupName = getGroupChatDisplayName(chat, currentUser);
    const memberCount = chat.allUsers?.length || 0;
    const isOwner = chat.owner?.id === currentUser?.info?.id;
    
    // Store images globally for viewer
    const chatImage = chat.images && chat.images.length > 0 ? chat.images[0] : null;
    const avatarColor = getAvatarColorForUser(`group_${chat.id}`);
    
    // Get current photo
    const photoUrl = chatImage ? getPreviewUrl(chatImage.id, chatImage.fileType) : null;
    
    // Filter out current user from members list
    const otherMembers = (chat.allUsers || []).filter(user => user.id !== currentUser?.info?.id)
        .sort((a, b) => {
            const aIsOwner = chat.owner && chat.owner.id === a.id ? -1 : 0;
            const bIsOwner = chat.owner && chat.owner.id === b.id ? 1 : 0;
            return aIsOwner + bIsOwner;
        });
    
    let html = '';
    
    if (isOwner) {
        // Editable version for owner
        html += `
            <div class="user-info-avatar-container">
                <div class="user-info-avatar-wrapper" id="userInfoAvatarWrapper">
                    <div class="user-info-avatar" id="groupChatAvatarDisplay">
                        ${photoUrl ? `<img src="${photoUrl}" alt="" id="groupChatAvatarImg">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(groupName)}</span>`}
                    </div>
                    <svg class="user-profile-avatar-progress" id="groupChatAvatarProgress" viewBox="0 0 100 100" style="display: none;">
                        <circle class="user-profile-avatar-progress-bg" cx="50" cy="50" r="48"></circle>
                        <circle class="user-profile-avatar-progress-bar" cx="50" cy="50" r="48" id="groupChatAvatarProgressBar"></circle>
                    </svg>
                    <button class="ellipsis-button" id="groupChatAvatarMenuButton" onclick="event.stopPropagation(); showGroupChatAvatarMenu(event)" title="Avatar menu">
                        •••
                    </button>
                </div>
                <input type="file" id="groupChatAvatarInput" accept="image/*" style="display: none;" onchange="handleExistingGroupChatAvatarFileSelect(event)">
            </div>
            <div class="user-profile-section">
                <div class="user-profile-section-title">Group Name</div>
                <div class="group-name-input-container">
                    <input type="text" class="user-profile-name-input" id="groupChatTitleInput_${chat.id}" value="${escapeHtml(chat.title || '')}" placeholder="Enter group name" data-original-value="${escapeHtml(chat.title || '')}">
                    ${groupChatSaveBtnHTML(chat.id, 'Title')}
                </div>
            </div>
        `;
    } else {
        // Read-only version for non-owners
        html += `
            <div class="user-info-avatar-container">
                <div class="user-info-avatar-wrapper" id="userInfoAvatarWrapper">
                    <div class="user-info-avatar" id="userInfoAvatar">
                        ${photoUrl ? `<img src="${photoUrl}" alt="" id="userInfoAvatarImg">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(groupName)}</span>`}
                    </div>
                </div>
            </div>
        `;
        
        // Only show title if it exists
        if (chat.title && chat.title.trim()) {
            html += `<div class="user-info-name">${escapeHtml(chat.title)}</div>`;
        }
    }
    
    // Members section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Members${isOwner ? ' <button class="inline-link-button" onclick="openGroupChatModal(\'' + chat.id + '\')">Add</button>' : ''}</div>
            <div class="group-chat-members-grid" id="groupChatMembersGrid">
                ${otherMembers.map(user => {
                    const avatarHtml = getAvatarHtml(user);
                    const isBlocked = chat.blockedUsers && chat.blockedUsers.some(bu => bu.id === user.id);
                    const blockedClass = isBlocked ? ' blocked' : '';
                    const isMemberOwner = chat.owner && chat.owner.id === user.id;
                    const ownerClass = isMemberOwner ? ' owner' : '';
                    return `
                        <div class="group-chat-member-cell${blockedClass}" onclick="showGroupMemberMenu(event, '${chat.id}', ${user.id})">
                            <div class="avatar-small${ownerClass}">${avatarHtml}</div>
                            <div class="group-chat-member-name">${escapeHtml(user.name || user.username || 'Unknown User')}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    // Meta information
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Information</div>
            <div class="user-info-meta">
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>${memberCount} ${memberCount === 1 ? 'member' : 'members'}</span>
                </div>
                ${chat.owner ? `
                <div class="user-info-meta-item" style="cursor: pointer;" onclick="showUserInfo(${chat.owner.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294l2.952-5.605z"></path>
                    </svg>
                    <span>Owner: <span class="info-link">${escapeHtml(chat.owner.name || chat.owner.username || 'Unknown')}</span></span>
                </div>
                ` : ''}
                ${chat.createdAt ? `
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                        <line x1="16" x2="16" y1="2" y2="6"></line>
                        <line x1="8" x2="8" y1="2" y2="6"></line>
                        <line x1="3" x2="21" y1="10" y2="10"></line>
                    </svg>
                    <span>Created: ${new Date(chat.createdAt).toLocaleDateString()}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    body.innerHTML = html;
    
    // Add click handler to avatar
    if (isOwner) {
        const avatar = document.getElementById('groupChatAvatarDisplay');
        if (avatar) {
            avatar.addEventListener('click', function(event) {
                // Don't trigger if clicking on menu button
                if (event.target.closest('.user-profile-avatar-menu-button')) {
                    return;
                }
                // If there are images, open viewer; otherwise open file dialog
                if (chat.images && chat.images.length > 0) {
                    openGroupChatImageViewer(chat);
                } else {
                    openExistingGroupChatAvatarFileDialog();
                }
            });
        }
        
        // Add input change listener
        const nameInput = document.getElementById(`groupChatTitleInput_${chat.id}`);
        const saveBtn = document.getElementById(`groupChatTitleSaveBtn_${chat.id}`);
        if (nameInput && saveBtn) {
            nameInput.addEventListener('input', function() {
                const originalValue = this.getAttribute('data-original-value') || '';
                const currentValue = this.value.trim();
                if (currentValue !== originalValue) {
                    saveBtn.style.display = 'flex';
                } else {
                    saveBtn.style.display = 'none';
                }
            });
            
            // Add Enter key handler
            nameInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && saveBtn.style.display !== 'none') {
                    e.preventDefault();
                    saveGroupChatTitle(chat.id);
                }
            });
        }
    } else {
        const avatar = document.getElementById('userInfoAvatar');
        if (avatar && photoUrl) {
            avatar.addEventListener('click', function(event) {
                openGroupChatImageViewer(chat);
            });
        }
    }
}

function showGroupChatAvatarMenu(event) {
    const menuButton = document.getElementById('groupChatAvatarMenuButton');
    const rect = menuButton.getBoundingClientRect();

    const chatId = currentChatId;
    const chat = chats.find(c => c.id === chatId);

    if (!chat) {
        console.error('Chat not found for avatar menu:', chatId);
        return;
    }

    let menuItems = [];

    // Only one image is supported for group chat avatar
    if (chat.images && chat.images.length > 0) {
        menuItems.push({ id: 'delete', label: 'Delete', icon: trashIcon });
    } else {
        menuItems.push({ id: 'upload', label: 'Upload', icon: uploadIcon });
    }

    showContextMenu({
        items: menuItems,
        x: rect.left,
        y: rect.bottom + 5,
        onAction: async (action) => {
            if (action === 'upload') {
                openExistingGroupChatAvatarFileDialog();
            } else if (action === 'delete') {
                if (!chat.images || chat.images.length === 0) return;
                const currentImage = chat.images[0];
                if (!currentImage) return;

                if (!confirm('Are you sure you want to delete this photo?')) return;

                try {
                    await apiDeleteChatImage(chatId, currentImage.id);
                    const updatedChat = await apiGetChat(chatId);
                    const chatIndex = chats.findIndex(c => c.id === chatId);
                    if (chatIndex !== -1) {
                        chats[chatIndex] = updatedChat;
                    }
                    if (isPersonalNotes(updatedChat)) {
                        const modalEntry = userInfoModalStack.find(entry => entry.chatId === chatId);
                        if (modalEntry) {
                            displayNotesInfo(updatedChat, modalEntry.bodyId, true);
                        }
                    } else {
                        displayGroupChatInfo(updatedChat);
                    }
                    displayChats();
                    if (currentChatId === chatId) {
                        selectChat(currentChatId, false);
                    }
                } catch (error) {
                    console.error('Error deleting group chat avatar:', error);
                    alert('Error deleting avatar: ' + error.message);
                }
            }
        }
    });
}

function openGroupChatImageViewer(chat) {
    if (!chat.images || chat.images.length === 0) return;
    openMediaViewer(chat.images, 0, () => {});
}

// ── Notes Info Panel ────────────────────────────────────────────────────────

function showNotesInfo(chat, options = {}) {
    const isOwner = options.isOwner !== false;
    const modalId = `notesInfoModal_${chat.id}`;
    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.className = 'user-info-modal';
    modalElement.style.zIndex = 1000 + userInfoModalStack.length * 10;

    const headerButtons = isOwner
        ? `<button class="ellipsis-button" id="notesInfoMenuButton_${chat.id}" onclick="event.stopPropagation(); showNotesInfoMenu('${chat.id}')" title="Notes menu">•••</button>`
        : '<div></div>';

    modalElement.innerHTML = `
        <div class="user-info-content">
            <div class="user-info-header">
                ${headerButtons}
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="inline-button" onclick="closeTopModalInfoPanel()">
                    ${closeIcon}
                </button>
            </div>
            <div class="user-info-body" id="${modalId}_body">
                <div class="user-info-loading">Loading notes information...</div>
            </div>
        </div>
    `;

    document.body.appendChild(modalElement);

    modalElement.addEventListener('click', function(event) {
        if (event.target === modalElement) {
            closeTopModalInfoPanel();
        }
    });

    modalElement.style.display = 'block';
    modalElement.offsetHeight;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modalElement.classList.add('show');
        });
    });

    userInfoModalStack.push({ chatId: chat.id, element: modalElement, bodyId: `${modalId}_body`, isGroupChat: true });

    displayNotesInfo(chat, `${modalId}_body`, isOwner);
}

function showNotesInfoMenu(chatId) {
    const menuButton = document.getElementById(`notesInfoMenuButton_${chatId}`);
    if (!menuButton) return;

    const rect = menuButton.getBoundingClientRect();
    const userId = currentUser?.info?.id;
    const notesUrl = `${window.location.origin}/users/${userId}/notes`;

    showContextMenu({
        items: [
            { id: 'open', label: 'Open Journal', icon: openLinkIcon },
            { id: 'share', label: 'Share Link', icon: shareIcon }
        ],
        x: rect.left,
        y: rect.bottom + 2,
        onAction: async (action) => {
            if (!userId) return;
            if (action === 'share') {
                try {
                    await navigator.clipboard.writeText(notesUrl);
                    alert('Link copied to clipboard');
                } catch (error) {
                    console.error('Failed to copy notes URL:', error);
                }
            } else if (action === 'open') {
                window.open(notesUrl, '_blank', 'noopener,noreferrer');
            }
        }
    });
}

function displayNotesInfo(chat, bodyId, isOwner) {
    const body = document.getElementById(bodyId);
    if (!body) return;

    const notesTitle = getNotesDisplayTitle(chat);
    const chatImage = chat.images && chat.images.length > 0 ? chat.images[0] : null;
    const avatarColor = getAvatarColorForUser(`group_${chat.id}`);
    const photoUrl = chatImage ? getPreviewUrl(chatImage.id, chatImage.fileType) : null;

    const owner = chat.owner || (currentUser ? currentUser.info : null);
    const ownerName = owner ? (owner.name || owner.username || 'Unknown') : 'Unknown';
    const createdDate = chat.createdAt ? new Date(chat.createdAt).toLocaleDateString() : 'N/A';

    let html = '';

    // Avatar
    if (isOwner) {
        html += `
            <div class="user-info-avatar-container">
                <div class="user-info-avatar-wrapper" id="userInfoAvatarWrapper">
                    <div class="user-info-avatar" id="groupChatAvatarDisplay">
                        ${photoUrl ? `<img src="${photoUrl}" alt="" id="groupChatAvatarImg">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(notesTitle)}</span>`}
                    </div>
                    <svg class="user-profile-avatar-progress" id="groupChatAvatarProgress" viewBox="0 0 100 100" style="display: none;">
                        <circle class="user-profile-avatar-progress-bg" cx="50" cy="50" r="48"></circle>
                        <circle class="user-profile-avatar-progress-bar" cx="50" cy="50" r="48" id="groupChatAvatarProgressBar"></circle>
                    </svg>
                    <button class="ellipsis-button" id="groupChatAvatarMenuButton" onclick="event.stopPropagation(); showGroupChatAvatarMenu(event)" title="Avatar menu">
                        •••
                    </button>
                </div>
                <input type="file" id="groupChatAvatarInput" accept="image/*" style="display: none;" onchange="handleExistingGroupChatAvatarFileSelect(event)">
            </div>
            <div class="user-profile-section">
                <div class="user-profile-section-title">Journal Title</div>
                <div class="group-name-input-container">
                    <input type="text" class="user-profile-name-input" id="groupChatTitleInput_${chat.id}" value="${escapeHtml(chat.title || '')}" placeholder="Personal Notes" data-original-value="${escapeHtml(chat.title || '')}">
                    ${groupChatSaveBtnHTML(chat.id, 'Title')}
                </div>
            </div>
            <div class="user-profile-section">
                <div class="user-profile-section-title">Description</div>
                <div class="group-name-input-container" style="align-items: flex-start;">
                    <textarea class="user-profile-about-input" id="groupChatDescriptionInput_${chat.id}" placeholder="Add a description" data-original-value="${escapeHtml(chat.description || '')}">${escapeHtml(chat.description || '')}</textarea>
                    ${groupChatSaveBtnHTML(chat.id, 'Description')}
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="user-info-avatar-container">
                <div class="user-info-avatar-wrapper" id="userInfoAvatarWrapper">
                    <div class="user-info-avatar" id="userInfoAvatar">
                        ${photoUrl ? `<img src="${photoUrl}" alt="" id="userInfoAvatarImg">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(notesTitle)}</span>`}
                    </div>
                </div>
            </div>
        `;
        if (notesTitle) {
            html += `<div class="user-info-name">${escapeHtml(notesTitle)}</div>`;
        }
        if (chat.description) {
            html += `
                <div class="user-info-section">
                    <div class="user-info-section-title">Description</div>
                    <div class="user-info-about">${escapeHtml(chat.description)}</div>
                </div>
            `;
        }
    }

    // Information section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Information</div>
            <div class="user-info-meta">
                <div class="user-info-meta-item"${isOwner ? ` style="cursor: pointer;" onclick="showUserInfo(${owner?.id || 0})"` : ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294l2.952-5.605z"></path>
                    </svg>
                    <span>Author: ${isOwner ? `<span class="info-link">${escapeHtml(ownerName)}</span>` : escapeHtml(ownerName)}</span>
                </div>
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                        <line x1="16" x2="16" y1="2" y2="6"></line>
                        <line x1="8" x2="8" y1="2" y2="6"></line>
                        <line x1="3" x2="21" y1="10" y2="10"></line>
                    </svg>
                    <span>Since: ${escapeHtml(createdDate)}</span>
                </div>
            </div>
        </div>
    `;

    // Share section - link to the journal
    const journalShareUrl = `${window.location.origin}/${owner?.id || ''}`;
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Share</div>
            <div class="notes-info-share">
                <a class="notes-info-share-link" href="${journalShareUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(journalShareUrl)}</a>
                <button class="inline-button small notes-info-share-copy" onclick="copyNotesShareLink(this)" title="Copy link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;

    body.innerHTML = html;

    // Avatar click handlers
    if (isOwner) {
        const avatar = document.getElementById('groupChatAvatarDisplay');
        if (avatar) {
            avatar.addEventListener('click', function(event) {
                if (event.target.closest('.user-profile-avatar-menu-button')) return;
                if (chat.images && chat.images.length > 0) {
                    openGroupChatImageViewer(chat);
                } else {
                    openExistingGroupChatAvatarFileDialog();
                }
            });
        }
        const nameInput = document.getElementById(`groupChatTitleInput_${chat.id}`);
        const saveBtn = document.getElementById(`groupChatTitleSaveBtn_${chat.id}`);
        if (nameInput && saveBtn) {
            nameInput.addEventListener('input', function() {
                const originalValue = this.getAttribute('data-original-value') || '';
                saveBtn.style.display = this.value.trim() !== originalValue ? 'flex' : 'none';
            });
            nameInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && saveBtn.style.display !== 'none') {
                    e.preventDefault();
                    saveGroupChatTitle(chat.id);
                }
            });
        }
        const descriptionInput = document.getElementById(`groupChatDescriptionInput_${chat.id}`);
        const descriptionSaveBtn = document.getElementById(`groupChatDescriptionSaveBtn_${chat.id}`);
        if (descriptionInput && descriptionSaveBtn) {
            descriptionInput.addEventListener('input', function() {
                const originalValue = this.getAttribute('data-original-value') || '';
                descriptionSaveBtn.style.display = this.value.trim() !== originalValue ? 'flex' : 'none';
            });
            descriptionInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && descriptionSaveBtn.style.display !== 'none') {
                    e.preventDefault();
                    saveGroupChatDescription(chat.id);
                }
            });
        }
    } else {
        const avatar = document.getElementById('userInfoAvatar');
        if (avatar && photoUrl) {
            avatar.addEventListener('click', function() {
                openGroupChatImageViewer(chat);
            });
        }
    }

}

function copyNotesShareLink(button) {
    const shareLink = button.closest('.notes-info-share')?.querySelector('.notes-info-share-link');
    if (!shareLink) return;

    const url = shareLink.href;
    navigator.clipboard.writeText(url).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    });

    const balloon = button.closest('.notes-info-share');
    if (!balloon) return;
    balloon.classList.remove('flash');
    void balloon.offsetWidth;
    balloon.classList.add('flash');
    balloon.addEventListener('animationend', () => balloon.classList.remove('flash'), { once: true });
}

function getNotesDisplayTitle(chat) {
    return chat.title || 'Personal Notes';
}

// Member management
function showGroupMemberMenu(event, chatId, userId) {
    event.stopPropagation();
    const cell = event.currentTarget;
    const rect = cell.getBoundingClientRect();
    
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        console.error('Chat not found:', chatId);
        return;
    }

    let items = [
        { id: 'personal_chat', label: 'Personal Chat', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' },
        { id: 'view_info', label: 'View Info', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>' }
    ];

    // Show block/remove options only if current user is the owner of the group chat
    if (chat.owner?.id === currentUser?.info?.id) {
        const isBlocked = chat.blockedUsers && chat.blockedUsers.some(bu => bu.id === userId);
        items.push(
            { id: 'block', label: isBlocked ? 'Unblock in Group' : 'Block in Group', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"></line></svg>', separator: true },
            { id: 'remove', label: 'Remove from Group', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line></svg>' }
        );
    }

    showContextMenu({
        items: items,
        x: event.x,
        y: event.y,
        anchor: 'top-left',
        onAction: async (action) => {
            if (action === 'personal_chat') {
                await createOrOpenPersonalChat(userId);
                closeAllModalInfoPanels();
            } else if (action === 'view_info') {
                showUserInfo(userId);
            } else if (action === 'block') {
                await toggleBlockGroupChatMember(chatId, userId);
            } else if (action === 'remove') {
                await removeGroupChatMember(chatId, userId);
            }
        },
        highlightElement: cell,
        highlightClass: 'menu-active'
    });
}

async function toggleBlockGroupChatMember(chatId, userId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    const isBlocked = chat.blockedUsers && chat.blockedUsers.some(bu => bu.id === userId);
    const action = isBlocked ? 'unblock' : 'block';
    const confirmMessage = isBlocked ? 'Unblock this member in this group chat?' : 'Block this member in this group chat?';
    
    if (!confirm(confirmMessage)) return;
    
    try {
        if (isBlocked) {
            await apiUnblockUserInChat(chatId, userId);
        } else {
            await apiBlockUserInChat(chatId, userId);
        }
        
        // Refresh the chat from server to get updated blockedUsers
        const updatedChat = await apiGetChat(chatId);
        const chatIndex = chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) {
            chats[chatIndex] = updatedChat;
        }
        
        displayGroupChatInfo(updatedChat);
    } catch (error) {
        console.error(`Error ${action}ing user:`, error);
        alert(`Error ${action}ing user: ` + error.message);
    }
}

async function removeGroupChatMember(chatId, userId) {
    if (!confirm('Remove this member from the group?')) return;
    
    try {
        const updatedChat = await apiRemoveChatUsers(chatId, [userId]);
        
        // Update the local allUsers array for this chat
        const chat = chats.find(c => c.id === chatId);
        if (!chat) {
            console.error('Chat not found:', chatId);
            return;
        }
        
        const removedUserIds = updatedChat.removedUsers.map(u => u.id);
        chat.allUsers = chat.allUsers.filter(u => !removedUserIds.includes(u.id));
        displayGroupChatInfo(chat);
        
        // Update header if this chat is selected
        if (currentChatId === chatId) {
            selectChat(currentChatId, false);
        }
    } catch (error) {
        console.error('Error removing member:', error);
        alert('Error removing member: ' + error.message);
    }
}

async function saveGroupChatField(chatId, field, inputId, saveBtnId, { refreshUI = false } = {}) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        console.error('Chat not found:', chatId);
        return;
    }

    const input = document.getElementById(inputId);
    const saveBtn = document.getElementById(saveBtnId);
    if (!input || !saveBtn) return;

    const newValue = input.value.trim();
    const originalValue = input.getAttribute('data-original-value') || '';

    if (newValue === originalValue) {
        saveBtn.style.display = 'none';
        return;
    }

    saveBtn.classList.remove('idle', 'success');
    saveBtn.classList.add('saving');
    saveBtn.disabled = true;

    try {
        await apiUpdateChat(chat.id, { [field]: newValue });
        chat[field] = newValue;

        input.setAttribute('data-original-value', newValue);

        saveBtn.classList.remove('saving');
        saveBtn.classList.add('success');

        if (refreshUI) {
            displayChats();
            if (currentChatId === chat.id) {
                selectChat(currentChatId, false);
            }
        }

        setTimeout(() => {
            saveBtn.classList.add('hiding');
            setTimeout(() => {
                saveBtn.style.display = 'none';
                saveBtn.classList.remove('success', 'hiding');
                saveBtn.classList.add('idle');
                saveBtn.disabled = false;
            }, 300);
        }, 500);
    } catch (error) {
        console.error(`Error saving group chat ${field}:`, error);
        alert(`Error saving ${field}: ` + error.message);

        saveBtn.classList.remove('saving');
        saveBtn.classList.add('idle');
        saveBtn.disabled = false;
    }
}

function saveGroupChatTitle(chatId) {
    return saveGroupChatField(chatId, 'title', `groupChatTitleInput_${chatId}`, `groupChatTitleSaveBtn_${chatId}`, { refreshUI: true });
}

function saveGroupChatDescription(chatId) {
    return saveGroupChatField(chatId, 'description', `groupChatDescriptionInput_${chatId}`, `groupChatDescriptionSaveBtn_${chatId}`);
}

async function saveGroupChatAvatar(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat || !groupChatUploadedAvatarInfo) {
        return;
    }

    try {
        const updatedChat = await apiAddChatImage(
            chat.id,
            groupChatUploadedAvatarInfo.id,
            groupChatUploadedAvatarInfo.fileType,
            groupChatUploadedAvatarInfo.fileSize
        );

        // Update local state with the server response
        chat.images = updatedChat.images;
        
        displayChats();
        
        // Update header if this chat is selected
        if (currentChatId === chat.id) {
            selectChat(currentChatId, false);
        }
        
        // Reset upload state
        groupChatUploadedAvatarInfo = null;
    } catch (error) {
        console.error('Error saving group chat avatar:', error);
        alert('Error saving avatar: ' + error.message);
        throw error;
    }
}

// Handle avatar clicks using event delegation
document.addEventListener('click', function(event) {
    // Check if clicked element is a message avatar or inside it
    let avatar = event.target.closest('.message-row .avatar-small[data-clickable="true"]');
    
    // Also check if the clicked element itself is the avatar
    if (!avatar && event.target.classList.contains('avatar-small') && event.target.dataset.clickable === 'true') {
        avatar = event.target;
    }
    
    // Also check if clicked inside avatar initials
    if (!avatar && event.target.closest('.avatar-initials')) {
        avatar = event.target.closest('.avatar-small[data-clickable="true"]');
    }
    
    if (avatar && avatar.dataset.authorId) {
        event.preventDefault();
        event.stopPropagation();
        const userId = parseInt(avatar.dataset.authorId);
        if (userId && !isNaN(userId)) {
            console.log('Opening user info for user ID:', userId);
            showUserInfo(userId);
            return;
        }
    }
}, true); // Use capture phase to catch events earlier

// Consolidated Escape key handler (prioritized order)
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // 1. Media viewer has highest priority
        const viewer = document.getElementById('mediaViewer');
        if (viewer) {
            return; // Viewer will handle Escape key
        }
        
        // 2. Group chat modal (check before user info modals since it can overlay them)
        const groupModal = document.getElementById('groupChatModal');
        if (groupModal && groupModal.classList.contains('show')) {
            closeGroupChatModal();
            return;
        }
        
        // 3. User info modal stack (dynamically created modals)
        if (userInfoModalStack.length > 0) {
            closeTopModalInfoPanel();
            return;
        }
        
        // 4. Settings modal
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal && settingsModal.classList.contains('show')) {
            closeSettings();
            return;
        }
        
        // 5. User profile modal
        const userProfileModal = document.getElementById('userProfileModal');
        if (userProfileModal && userProfileModal.classList.contains('show')) {
            closeCurrentUserProfile();
            return;
        }
        
        // 6. User selection modal (lowest priority)
        const userSelectionModal = document.getElementById('userSelectionModal');
        if (userSelectionModal && userSelectionModal.classList.contains('show')) {
            closeUserSelection();
            return;
        }
    }
}, true); // Use capture phase

// New Chat Menu Functions
let newChatMenuOpen = false;

function showNewChatMenu(event) {
    event.stopPropagation();
    
    const button = document.getElementById('newChatButton');
    const rect = button.getBoundingClientRect();

    const hasPersonalNotes = chats.some(chat => isPersonalNotes(chat));
    const items = [];

    if (!hasPersonalNotes) {
        items.push({ id: 'personal_notes', label: 'Personal Notes', icon: newChatNotesIcon });
        items.push({ separator: true });
    }

    items.push({ id: 'personal', label: 'Personal Chat', icon: newChatPersonalIcon });
    items.push({ id: 'group', label: 'Group Chat', icon: newChatGroupIcon });
    
    showContextMenu({
        items,
        x: rect.left,
        y: rect.top - 4,
        anchor: 'bottom-left',
        onAction: (action) => {
            if (action === 'personal_notes') {
                createOrOpenPersonalChat(currentUser.info.id);
            } else if (action === 'personal') {
                openUserSelection();
            } else if (action === 'group') {
                openGroupChatModal();
            }
        }
    });
}

// Group Chat Modal Functions
let groupChatSearchTimeout = null;
let groupChatSelectedUsers = [];
let groupChatAvatarUploadInProgress = false;

function openGroupChatModal(chatId = null) {
    const modal = document.getElementById('groupChatModal');
    const isAddUsersMode = chatId !== null;
    
    // Set chat ID as data attribute
    if (chatId) {
        modal.dataset.chatId = chatId;
    } else {
        delete modal.dataset.chatId;
    }
    
    // Update UI based on mode
    const title = document.getElementById('groupChatModalTitle');
    const avatarNameSection = document.getElementById('groupChatAvatarNameSection');
    const btn = document.getElementById('groupChatCreateBtn');
    const content = modal.querySelector('.group-chat-content');
    
    if (isAddUsersMode) {
        // Add users mode
        const chat = chats.find(c => c.id === chatId);
        const groupName = chat ? getGroupChatDisplayName(chat, currentUser) : '';
        
        title.textContent = 'Add Users';
        avatarNameSection.style.display = 'none';
        btn.textContent = 'Add Users';
        
        // Add class for right-side positioning
        content.classList.add('slide-from-right');
        modal.style.zIndex = 1000 + (userInfoModalStack.length + 1) * 10;
    } else {
        // Create group mode
        title.textContent = 'New Group';
        avatarNameSection.style.display = 'block';
        btn.textContent = 'Create Group';
        
        // Remove right-side class if it exists
        content.classList.remove('slide-from-right');
        modal.style.zIndex = 1000;
    }
    
    modal.style.display = 'block';
    modal.offsetHeight; // Force reflow
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    });
    
    // Reset state
    displayedUsers = [];
    allLoadedUsers = [];
    lastUserId = null;
    hasMoreUsers = true;
    isLoadingUsers = false;

    groupChatSelectedUsers = [];
    groupChatUploadedAvatarInfo = null;
    
    // Clear inputs
    document.getElementById('newGroupChatNameInput').value = '';
    document.getElementById('groupUserSearchInput').value = '';
    
    // Reset avatar (only if creating new group)
    if (!isAddUsersMode) {
        const avatar = document.getElementById('groupChatAvatar');
        avatar.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
            </svg>
        `;
        
        // Hide remove button
        document.getElementById('groupChatAvatarRemove').style.display = 'none';
    }
    
    // Update create button state
    updateGroupChatCreateButton();
    
    // Load initial users
    loadUsers(document.getElementById('groupChatUsersList'), displayGroupChatUsers);
    
    // Setup search listener
    setupGroupUserSearch();
    
    // Setup scroll listener for pagination
    setupGroupUserScrollPagination();
}

async function closeGroupChatModal() {
    const modal = document.getElementById('groupChatModal');
    
    // Remove show class - CSS transition handles the slide-out animation
    modal.classList.remove('show');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    if (groupChatSearchTimeout) {
        clearTimeout(groupChatSearchTimeout);
        groupChatSearchTimeout = null;
    }
    
    const chatId = modal.dataset.chatId; // null if creating new group
    // Clean up uploaded avatar if not used (only in create mode)
    if (groupChatUploadedAvatarInfo && chatId === null) {
        try {
            await apiDeleteUpload(groupChatUploadedAvatarInfo.fileName);
        } catch (error) {
            console.error('Error cleaning up unused avatar:', error);
        }
        groupChatUploadedAvatarInfo = null;
    }
    // Remove chat ID data attribute
    delete modal.dataset.chatId;
}

function setupGroupUserSearch() {
    const searchInput = document.getElementById('groupUserSearchInput');
    
    // Remove previous listener
    searchInput.removeEventListener('input', handleGroupUserSearchInput);
    searchInput.addEventListener('input', handleGroupUserSearchInput);
}

function handleGroupUserSearchInput(event) {
    if (groupChatSearchTimeout) {
        clearTimeout(groupChatSearchTimeout);
    }
    
    groupChatSearchTimeout = setTimeout(() => {
        const query = event.target.value.trim();
        const usersList = document.getElementById('groupChatUsersList');
        if (query.length > 1) {
            searchUsers(query, usersList, displayGroupChatUsers);
        } else if (query.length === 1) {
            // Local filter on the full paginated list (no network request)
            const lowerQuery = query.toLowerCase();
            displayedUsers = allLoadedUsers.filter(user =>
                (user.name || '').toLowerCase().includes(lowerQuery) ||
                (user.username || '').toLowerCase().includes(lowerQuery)
            );
            displayGroupChatUsers();
        } else {
            // Restore full loaded list
            displayedUsers = [...allLoadedUsers];
            displayGroupChatUsers();
        }
    }, 300);
}

function setupGroupUserScrollPagination() {
    const usersList = document.getElementById('groupChatUsersList');
    
    usersList.removeEventListener('scroll', handleGroupUserScroll);
    usersList.addEventListener('scroll', handleGroupUserScroll);
}

function handleGroupUserScroll(event) {
    const usersList = event.target;
    if (usersList.scrollTop + usersList.clientHeight >= usersList.scrollHeight - 5) {
        if (hasMoreUsers && !isLoadingUsers && !document.getElementById('groupUserSearchInput').value.trim()) {
            loadUsers(usersList, displayGroupChatUsers);
        }
    }
}

function displayGroupChatUsers(error = null) {
    const usersList = document.getElementById('groupChatUsersList');
    
    if (error) {
        usersList.innerHTML = `<div class="users-empty">${error}</div>`;
        return;
    }
    
    // Filter out current user
    let availableUsers = displayedUsers.filter(u => u.id !== currentUser?.info?.id);
    
    const modal = document.getElementById('groupChatModal');
    const chatId = modal?.dataset.chatId;
    // If in add users mode, also filter out existing members
    if (chatId) {
        const chat = chats.find(c => c.id === chatId);
        const existingMemberIds = chat?.allUsers?.map(u => u.id) || [];
        availableUsers = availableUsers.filter(u => !existingMemberIds.includes(u.id));
    }
    
    if (availableUsers.length === 0) {
        usersList.innerHTML = '<div class="users-empty">No users found</div>';
        return;
    }
    
    let html = '';
    availableUsers.forEach(user => {
        const avatarHtml = getAvatarHtml(user);
        const isSelected = groupChatSelectedUsers.some(u => u.id === user.id);
        
        html += `
            <div class="group-user-item ${isSelected ? 'selected' : ''}" onclick="toggleGroupChatUser(${user.id})">
                <div class="avatar-small">${avatarHtml}</div>
                <div class="user-item-info">
                    <div class="user-item-name">${escapeHtml(user.name || user.username || 'Unknown User')}</div>
                    <div class="user-item-username">@${escapeHtml(user.username || 'unknown')}</div>
                </div>
                <div class="group-user-checkbox ${isSelected ? 'checked' : ''}">
                    ${isSelected ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </div>
            </div>
        `;
    });
    
    if (hasMoreUsers && !document.getElementById('groupUserSearchInput').value.trim()) {
        html += '<div class="users-loading" style="padding: 20px;">Loading more users...</div>';
    }
    
    usersList.innerHTML = html;
}

function toggleGroupChatUser(userId) {
    const user = displayedUsers.find(u => u.id === userId);
    if (!user) return;
    
    const index = groupChatSelectedUsers.findIndex(u => u.id === userId);
    if (index === -1) {
        groupChatSelectedUsers.push(user);
    } else {
        groupChatSelectedUsers.splice(index, 1);
    }
    
    displayGroupChatUsers();
    updateGroupChatCreateButton();
}

function updateGroupChatCreateButton() {
    const btn = document.getElementById('groupChatCreateBtn');
    const countLabel = document.getElementById('groupChatSelectedCount');
    const count = groupChatSelectedUsers.length;
    
    // Enable button if at least one user is selected
    btn.disabled = count === 0;
    
    // Update selected count label
    if (count === 0) {
        countLabel.textContent = '';
    } else if (count === 1) {
        countLabel.textContent = '1 user selected';
    } else {
        countLabel.textContent = `${count} users selected`;
    }
}

// Group chat avatar functions
let groupChatUploadedAvatarInfo = null; // Store uploaded file info {id, fileType, fileSize}

function openNewGroupChatAvatarFileDialog() {
    if (groupChatAvatarUploadInProgress) return;
    const input = document.getElementById('newGroupChatAvatarInput');
    if (input) {
        input.click();
    }
}

function openExistingGroupChatAvatarFileDialog() {
    if (groupChatAvatarUploadInProgress) return;
    const input = document.getElementById('groupChatAvatarInput');
    if (input) {
        input.click();
    }
}

function handleNewGroupChatAvatarFileSelect(event) {
    handleGroupChatAvatarFileSelect(event, (error) => {
        if (error) {
            resetNewGroupAvatarDisplay();
            alert('Error uploading avatar: ' + error.message);
        }
    });
}

function handleExistingGroupChatAvatarFileSelect(event) {
    handleGroupChatAvatarFileSelect(event, async (error) => {
        if (error) {
            resetExistingGroupAvatarDisplay();
            alert('Error uploading avatar: ' + error.message);
            return;
        }
        // Save avatar immediately after upload
        await saveGroupChatAvatar(currentChatId);
    });
}

function handleGroupChatAvatarFileSelect(event, callback) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('Image size must be less than 2MB');
        return;
    }
        
    // Get container element and find all required DOM elements
    const container = event.target.parentElement;
    const avatar = container.querySelector('.group-chat-avatar, .user-info-avatar');

    if (!avatar) {
        console.error('Avatar element not found');
        return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = function(e) {
        avatar.innerHTML = `<img src="${e.target.result}" alt="Group avatar preview">`;
    };
    reader.readAsDataURL(file);
    
    // Show remove button if it exists (new group modal only)
    const removeButton = document.getElementById('groupChatAvatarRemove');
    if (removeButton) {
        removeButton.style.display = 'flex';
    }

    // Get progress bar and progress circle (different classes for different containers)
    const progressBar = container.querySelector('.group-chat-avatar-progress, .user-profile-avatar-progress');
    const progressCircle = container.querySelector('.group-chat-avatar-progress-bar, .user-profile-avatar-progress-bar');
    
    // Create container info object with all DOM elements
    const containerInfo = {
        progressBar: progressBar,
        progressCircle: progressCircle,
        avatar: avatar
    };
    
    // Upload group avatar
    uploadGroupChatAvatar(containerInfo, file, callback);
    
    event.target.value = '';
}

async function uploadGroupChatAvatar(containerInfo, file, callback) {
    groupChatAvatarUploadInProgress = true;
    
    const { progressBar, progressCircle, avatar } = containerInfo;
    
    progressBar.style.display = 'block';
    avatar.style.opacity = '0.7';
    
    const updateProgressVisual = (progress) => {
        const circumference = 2 * Math.PI * 48;
        const offset = circumference - (progress / 100) * circumference;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = offset;
    };
    
    try {
        const fileId = crypto.randomUUID();
        const fileExtension = file.name.split('.').pop().toLowerCase() || 'jpg';
        
        // Upload file
        const uploadedFileName = await apiUploadFile(file, fileId, file.type, (progress) => {
            updateProgressVisual(progress);
        });
        
        const uploadedFileId = uploadedFileName.split('.').slice(0, -1).join('.');
        
        // Store uploaded file info for later use
        groupChatUploadedAvatarInfo = {
            id: uploadedFileId,
            fileType: fileExtension,
            fileSize: file.size,
            fileName: uploadedFileName
        };
        
        callback && callback(null);
        
    } catch (error) {
        console.error('Error uploading group avatar:', error);
        // Reset on error
        groupChatUploadedAvatarInfo = null;
        
        callback && callback(error);
    } finally {
        groupChatAvatarUploadInProgress = false;
        progressBar.style.display = 'none';
        avatar.style.opacity = '1';
    }
}

async function removeGroupAvatar() {
    // Delete from server if already uploaded
    if (groupChatUploadedAvatarInfo) {
        try {
            await apiDeleteUpload(groupChatUploadedAvatarInfo.fileName);
        } catch (error) {
            console.error('Error deleting group avatar from server:', error);
        }
        groupChatUploadedAvatarInfo = null;
    }
    resetNewGroupAvatarDisplay();
}

function resetNewGroupAvatarDisplay() {
    const avatar = document.getElementById('groupChatAvatar');
    avatar.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
        </svg>
    `;
    
    // Hide remove button
    document.getElementById('groupChatAvatarRemove').style.display = 'none';
}

function resetExistingGroupAvatarDisplay() {
    // Get the current chat to restore its original avatar
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) {
        console.error('Chat not found for reset');
        return;
    }

    const avatar = document.getElementById('groupChatAvatarDisplay');
    if (!avatar) {
        console.error('Avatar element not found');
        return;
    }

    const groupName = getGroupChatDisplayName(chat, currentUser);
    const chatImage = chat.images && chat.images.length > 0 ? chat.images[0] : null;
    const avatarColor = getAvatarColorForUser(`group_${chat.id}`);
    const photoUrl = chatImage ? getPreviewUrl(chatImage.id, chatImage.fileType) : null;

    // Reset to original state
    if (photoUrl) {
        avatar.innerHTML = `<img src="${photoUrl}" alt="" id="groupChatAvatarImg">`;
    } else {
        avatar.innerHTML = `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(groupName)}</span>`;
    }

    // Clear uploaded avatar info
    groupChatUploadedAvatarInfo = null;
}

async function handleGroupChatAction() {
    // Get chat ID from modal's data attribute
    const modal = document.getElementById('groupChatModal');
    const chatId = modal.dataset.chatId;
    if (chatId) {
        await addUsersToChat(chatId);
    } else {
        await createGroupChat();
    }
}

async function createGroupChat() {
    const nameInput = document.getElementById('newGroupChatNameInput');
    const groupName = nameInput.value.trim() || null;
    
    if (groupChatSelectedUsers.length === 0) {
        alert('Please select at least one member');
        return;
    }
    
    const btn = document.getElementById('groupChatCreateBtn');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    
    try {
        // Create the chat first
        const participants = groupChatSelectedUsers.map(u => u.id);
        const newChat = await apiCreateChat(false, participants, groupName);
        
        // If there's an uploaded avatar, add it to the chat
        if (groupChatUploadedAvatarInfo) {
            try {
                const updatedChat = await apiAddChatImage(
                    newChat.id, 
                    groupChatUploadedAvatarInfo.id, 
                    groupChatUploadedAvatarInfo.fileType, 
                    groupChatUploadedAvatarInfo.fileSize
                );
                // Update newChat with the returned chat info that includes the image
                newChat.images = updatedChat.images;
            } catch (error) {
                console.error('Error adding avatar to chat:', error);
                // Continue anyway - chat is created, just without avatar
            }
            // Clear so closeGroupChatModal doesn't try to delete it
            groupChatUploadedAvatarInfo = null;
        }
        
        // Close modal (won't delete avatar since we cleared groupChatUploadedAvatarInfo)
        closeGroupChatModal();
        
        // Check if chat already exists in the list (API might return existing chat)
        const existingChatIndex = chats.findIndex(c => c.id === newChat.id);
        if (existingChatIndex === -1) {
            // Chat doesn't exist, add it
            chats.unshift(newChat);
        }
        
        // Refresh chat list
        displayChats(false);

        // Select the new chat
        selectChat(newChat.id);
        
    } catch (error) {
        console.error('Error creating group chat:', error);
        alert('Error creating group chat: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Create Group';
    }
}

async function addUsersToChat(chatId) { 
    if (groupChatSelectedUsers.length === 0) {
        alert('Please select at least one user');
        return;
    }
    
    const btn = document.getElementById('groupChatCreateBtn');
    btn.disabled = true;
    btn.textContent = 'Adding...';
    
    try {
        const userIds = groupChatSelectedUsers.map(u => u.id);
        const updatedChat = await apiAddChatUsers(chatId, userIds);
        
        // Update the local allUsers array for this chat
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
            const addedUsers = updatedChat.addedUsers;
            chat.allUsers.push(...addedUsers);
        }
        
        // Close modal
        closeGroupChatModal();
        
        // Refresh chat list
        displayChats();
        
        // Refresh group chat info if it's open
        const chatInfoModal = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (chatInfoModal) {
            const refreshedChat = await apiGetChat(chatId);
            displayGroupChatInfo(refreshedChat);
        }
        
        // Update header if this chat is selected
        if (currentChatId === chatId) {
            selectChat(currentChatId, false);
        }
        
    } catch (error) {
        console.error('Error adding users to chat:', error);
        alert('Error adding users: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Add Users';
    }
}

// Close group chat modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('groupChatModal');
    const content = document.querySelector('.group-chat-content');
    if (modal && modal.classList.contains('show') && content && !content.contains(event.target)) {
        closeGroupChatModal();
    }
}, true);

// Browser back/forward button navigation through chat history
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.chatId) {
        // Navigate to the chat from history
        selectChat(event.state.chatId, false);
    } else {
        // No state or no chatId - clear selection
        currentChatId = null;
        localStorage.removeItem('selectedChatId');
        
        // Clear active state
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Clear UI
        makeNoChatsSelected();
    }
});

function makeNoChatsSelected() {
    const chatHeader = document.getElementById('chatHeader');
    const messageInputContainer = document.getElementById('messageInputContainer');
    const messagesContainer = document.getElementById('messagesContainer');

    // Hide chat header and message input
    if (chatHeader) chatHeader.style.display = 'none';
    if (messageInputContainer) messageInputContainer.style.display = 'none';

    // Show no chat selected message
    if (messagesContainer) {
        messagesContainer.innerHTML = '<div class="no-chat-selected">Select a chat to start messaging</div>';
    }
    // Clear current chat for menu
    window.currentChatForMenu = null;

    // No chats to select - set initial state with no chat
    history.replaceState({}, '', window.location.pathname);
}

function setChatFilter(filter) {
    currentChatFilter = filter;
    displayChats();
}

function updateFilterPills() {
    document.querySelectorAll('.chat-filter-pill').forEach(pill => {
        if (pill.dataset.filter === currentChatFilter) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
    
    // Update "More" button to show active state for archived/blocked
    const moreButton = document.getElementById('moreFiltersButton');
    if (moreButton) {
        if (currentChatFilter === 'archived' || currentChatFilter === 'blocked') {
            moreButton.classList.add('active');
        } else {
            moreButton.classList.remove('active');
        }
    }
}

function showMoreFiltersMenu(event) {
    event.stopPropagation();
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    const selectedIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(82, 82, 86)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6" fill="rgb(82, 82, 86)"></circle></svg>';
    const unselectedIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(82, 82, 86)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>';
    
    const menuItems = [
        { id: 'archived', label: 'Archived', icon: currentChatFilter === 'archived' ? selectedIcon : unselectedIcon },
        { id: 'blocked', label: 'Blocked', icon: currentChatFilter === 'blocked' ? selectedIcon : unselectedIcon }
    ];
    
    showContextMenu({
        items: menuItems,
        x: rect.left,
        y: rect.bottom + 4,
        anchor: 'top-left',
        onAction: (action) => {
            setChatFilter(action);
        },
        highlightElement: button,
        highlightClass: 'menu-active'
    });
}