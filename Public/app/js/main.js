// Global variables
let currentUser = null;
let currentChatId = null;
let chats = [];
let websocket = null;
let deviceSessionId = null;

// User selection variables
let fetchedUsers = [];
let userSearchTimeout = null;
let lastUserId = null;
let isLoadingUsers = false;
let hasMoreUsers = true;

// User info avatar state
let userInfoPhotos = [];
let userInfoCurrentPhotoIndex = 0;

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
            updateCurrentUserDisplay();
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

// Display chats in the sidebar
function displayChats() {
    const chatItems = document.getElementById('chatItems');
    chatItems.innerHTML = '';
    
    if (chats.length === 0) {
        chatItems.innerHTML = `
            <div class="no-chats-container">
                <a href="#" class="find-users-link" onclick="event.preventDefault(); openUserSelection();">
                    Find someone to chat
                </a>
            </div>
        `;
        return;
    }
    
    // Sort chats: Personal Notes first, then by lastMessage date (newest first)
    const sortedChats = [...chats].sort((a, b) => {
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

    // Restore previously selected chat from URL hash, localStorage, or select first chat
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
    
    // 3. Fall back to first chat
    if (!chatIdToSelect && sortedChats.length > 0) {
        chatIdToSelect = sortedChats[0].id;
    }
    
    // Select the chat and initialize history state
    if (chatIdToSelect) {
        // Replace initial state instead of pushing
        history.replaceState({ chatId: chatIdToSelect }, '', `#chat-${chatIdToSelect}`);
        selectChat(chatIdToSelect, true); // fromHistory = true to avoid pushing another state
    } else {
        // No chats to select - set initial state with no chat
        history.replaceState({}, '', window.location.pathname);
    }
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
    const lastMessageText = chat.lastMessage ? 
        truncateText(chat.lastMessage.text || '[Media]', 30) : 
        'No messages yet';
    
    const messageDate = getChatLastMessageDate(chat);
    const messageDateString = messageDate ? formatMessageTime(messageDate) : null;
    
    // Check if there are unread messages (placeholder for now)
    const unreadCount = 0; // This would come from the API
    
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
                <p class="chat-last-message">${escapeHtml(lastMessageText)}</p>
                ${unreadCount > 0 ? `<div class="chat-badge">${unreadCount}</div>` : ''}
            </div>
        </div>
    `;
    
    return item;
}

// Select a chat and load its messages
async function selectChat(chatId, fromHistory = false) {
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
        chatHeaderStatusIndicator.style.display = 'none'; // No status for group chats
    }
    
    if (currentChatId === chatId) {
        return;
    }
    currentChatId = chatId;
    
    // Push to history (only if not navigating from back/forward button)
    if (!fromHistory) {
        history.pushState({ chatId: chatId }, '', `#chat-${chatId}`);
    }
    
    // Save selected chat ID to localStorage
    localStorage.setItem('selectedChatId', chatId);
    
    chatHeader.style.display = 'flex';
    
    // Add click handler to chat header avatar
    const chatHeaderAvatarContainer = document.getElementById('chatHeaderAvatarContainer');
    if (chatHeaderAvatarContainer) {
        if (chat.isPersonal) {
            const user = chat.allUsers.find(user => user.id !== currentUser?.info.id) || currentUser.info;
            chatHeaderAvatarContainer.onclick = () => showUserInfo(user.id);
        } else {
            // For group chats, show group chat info
            chatHeaderAvatarContainer.onclick = () => showGroupChatInfo(chat.id);
        }
    }
    
    // Show message input
    const messageInputContainer = document.getElementById('messageInputContainer');
    messageInputContainer.style.display = 'flex';
    
    // Load messages
    await loadMessages(chatId, true);
    
    // Setup infinite scroll for this chat
    setupInfiniteScroll(chatId);
    
    // Focus message input field
    const messageInput = getMessageInputElement();
    if (messageInput) {
        messageInput.focus();
    }
}

// Update current user display in chat list header
function updateCurrentUserDisplay() {
    console.log('updateCurrentUserDisplay called', currentUser);
    
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
            sidebarAvatar.innerHTML = `<img src="${getUploadUrl(mainPhoto.id, mainPhoto.fileType)}" alt="">`;
        } else {
            sidebarAvatar.innerHTML = getAvatarInitialsHtml(userName, currentUser.info.id);
        }
    }
}

// Update chat list when new message arrives
function updateChatListWithMessage(message) {
    const chat = chats.find(c => c.id === message.chatId);
    if (chat) {
        chat.lastMessage = message;
        
        // Find the specific chat item in the DOM and update only the last message text
        const chatItem = document.querySelector(`[data-chat-id="${message.chatId}"]`);
        if (chatItem) {
            const lastMessageElement = chatItem.querySelector('.chat-last-message');
            if (lastMessageElement) {
                const lastMessageText = message.text ? 
                    truncateText(message.text, 30) : 
                    '[Media]';
                lastMessageElement.textContent = lastMessageText;
            }
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
    fetchedUsers = [];
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
            if (query) {
                searchUsers(query, usersList, displayUsers);
            } else {
                // Reset to all users if search is cleared
                fetchedUsers = [];
                lastUserId = null;
                hasMoreUsers = true;
                loadUsers(usersList, displayUsers);
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
            fetchedUsers = [...fetchedUsers, ...users];
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
        fetchedUsers = users;
        displayCallback();
    } catch (error) {
        console.error('Error searching users:', error);
        domElement.innerHTML = `<div class="users-empty">Error searching users</div>`;
    }
}

function displayUsers() {
    const usersList = document.getElementById('usersList');
    
    if (fetchedUsers.length === 0) {
        usersList.innerHTML = '<div class="users-empty">No users found</div>';
        return;
    }
    
    let html = '';
    fetchedUsers.forEach(user => {
        const userName = user.name || user.username || '?';
        const avatarHtml = getAvatarInitialsHtml(userName, user.id);
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
        displayChats();
        
        // Select the new chat
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
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="user-panel-close-btn" onclick="closeTopModalInfoPanel()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x">
                        <path d="M18 6 6 18"></path>
                        <path d="m6 6 12 12"></path>
                    </svg>
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

function displayUserInfo(user) {
    const bodyId = `userInfoModal_${user.id}_body`;
    const body = document.getElementById(bodyId);
    
    if (!body) {
        console.error('Element body not found:', bodyId);
        return;
    }

    const name = user.name || user.username || 'Unknown User';
    const username = user.username || 'unknown';
    const about = user.about || '';
    const lastSeen = user.lastSeen ? formatLastSeen(user.lastSeen) : null;
    const isOnline = user.lastSeen ? isUserOnline(user.lastSeen) : false;
    const avatarColor = getAvatarColorForUser(user.id);
    
    // Store photos globally
    userInfoPhotos = user.photos || [];
    userInfoCurrentPhotoIndex = 0;
    
    // Get current photo
    const currentPhoto = userInfoPhotos.length > 0 ? userInfoPhotos[userInfoCurrentPhotoIndex] : null;
    const photoUrl = currentPhoto ? getUploadUrl(currentPhoto.id, currentPhoto.fileType) : null;
    const hasMultiplePhotos = userInfoPhotos.length > 1;
    
    let html = `
        <div class="user-info-avatar-container">
            <div class="user-info-avatar-wrapper" id="userInfoAvatarWrapper">
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-left" onclick="event.stopPropagation(); navigateUserInfoPhoto(-1)" title="Previous photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m15 18-6-6 6-6"></path>
                    </svg>
                </button>
                ` : ''}
                <div class="user-info-avatar" id="userInfoAvatar">
                    ${photoUrl ? `<img src="${photoUrl}" alt="" id="userInfoAvatarImg">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(name)}</span>`}
                </div>
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-right" onclick="event.stopPropagation(); navigateUserInfoPhoto(1)" title="Next photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </button>
                ` : ''}
            </div>
            ${hasMultiplePhotos ? `
            <div class="user-profile-avatar-pagination">
                ${userInfoPhotos.map((photo, index) => `
                    <button class="user-profile-avatar-pagination-dot ${index === userInfoCurrentPhotoIndex ? 'active' : ''}" 
                            onclick="event.stopPropagation(); switchUserInfoPhoto(${index})" 
                            title="Photo ${index + 1}"></button>
                `).join('')}
            </div>
            ` : ''}
        </div>
        <div class="user-info-name">${escapeHtml(name)}</div>
        <div class="user-info-username">@${escapeHtml(username)}</div>
    `;
    
    // Status section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Status</div>
            <div class="user-info-status">
                <span class="user-info-status-indicator ${isOnline ? '' : 'offline'}"></span>
                <span>${isOnline ? 'Online' : lastSeen ? `Last seen ${lastSeen}` : 'Offline'}</span>
            </div>
        </div>
    `;
    
    // About section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">About</div>
            <div class="user-info-about ${about ? '' : 'empty'}">
                ${about ? escapeHtml(about) : 'No bio available'}
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
                    <span>User ID: ${user.id || 'N/A'}</span>
                </div>
                ${lastSeen ? `
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Last seen: ${lastSeen}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    body.innerHTML = html;
    
    // Add click handler to avatar after HTML is inserted
    const avatar = document.getElementById('userInfoAvatar');
    if (avatar && photoUrl) {
        avatar.addEventListener('click', function(event) {
            // Don't open viewer if clicking on chevrons
            if (event.target.closest('.user-profile-avatar-chevron')) {
                return;
            }
            openUserInfoViewer();
        });
    }
}

function navigateUserInfoPhoto(direction) {
    if (userInfoPhotos.length <= 1) return;
    
    userInfoCurrentPhotoIndex += direction;
    if (userInfoCurrentPhotoIndex < 0) {
        userInfoCurrentPhotoIndex = userInfoPhotos.length - 1;
    } else if (userInfoCurrentPhotoIndex >= userInfoPhotos.length) {
        userInfoCurrentPhotoIndex = 0;
    }
    
    updateUserInfoAvatarDisplay();
}

function switchUserInfoPhoto(index) {
    if (index < 0 || index >= userInfoPhotos.length) return;
    userInfoCurrentPhotoIndex = index;
    updateUserInfoAvatarDisplay();
}

function updateUserInfoAvatarDisplay() {
    const avatar = document.getElementById('userInfoAvatar');
    const avatarImg = document.getElementById('userInfoAvatarImg');
    const currentPhoto = userInfoPhotos[userInfoCurrentPhotoIndex];
    
    if (!avatar) return;
    
    if (currentPhoto && avatarImg) {
        avatarImg.src = getUploadUrl(currentPhoto.id, currentPhoto.fileType);
    } else if (currentPhoto) {
        const img = document.createElement('img');
        img.src = getUploadUrl(currentPhoto.id, currentPhoto.fileType);
        img.alt = '';
        img.id = 'userInfoAvatarImg';
        avatar.innerHTML = '';
        avatar.appendChild(img);
    }
    
    // Update pagination dots
    const dots = document.querySelectorAll('#userInfoBody .user-profile-avatar-pagination-dot');
    dots.forEach((dot, index) => {
        if (index === userInfoCurrentPhotoIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

function openUserInfoViewer() {
    if (userInfoPhotos.length === 0) return;
    
    openMediaViewer(userInfoPhotos, userInfoCurrentPhotoIndex, (newIndex) => {
        userInfoCurrentPhotoIndex = newIndex;
        updateUserInfoAvatarDisplay();
    });
}

function closeAllModalInfoPanels() {
    // Close all user info modals
    while (userInfoModalStack.length > 0) {
        closeTopModalInfoPanel();
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
    
    showChatMenu(rect, currentChatId);
}

function showChatMenu(rect, chatId) {
    if (!chatId) return;
    
    const menuItems = [
        { id: 'info', label: 'Info', icon: infoIcon },
        { id: 'mute', label: 'Mute', icon: muteIcon },
        { id: 'block', label: 'Block', icon: blockIcon },
        { id: 'archive', label: 'Archive', icon: archiveIcon },
        { id: 'delete', label: 'Delete', icon: deleteIcon, separator: true, destructive: true }
    ];
    
    showContextMenu({
        items: menuItems,
        x: rect.left,
        y: rect.bottom + 2,
        anchor: 'top-left',
        onAction: (action) => {
            handleChatHeaderMenuAction(action, chatId);
        }
    });
}

function handleChatHeaderMenuAction(action, chatId) {
    const chat = chats.find(chat => chat.id === chatId);
    if (!chat) return;
    
    switch (action) {
        case 'info':
            if (chat.isPersonal) {
                const user = chat.allUsers.find(user => user.id !== currentUser?.info.id) || currentUser.info;
                showUserInfo(user.id);
            } else {
                showGroupChatInfo(chat.id);
            }
            break;
        case 'mute':
            // TODO: Implement mute functionality
            console.log('Mute chat:', chat.id);
            break;
        case 'block':
            // TODO: Implement block functionality
            console.log('Block chat:', chat.id);
            break;
        case 'archive':
            // TODO: Implement archive functionality
            console.log('Archive chat:', chat.id);
            break;
        case 'delete':
            // TODO: Implement delete functionality
            if (confirm('Are you sure you want to delete this chat?')) {
                console.log('Delete chat:', chat.id);
            }
            break;
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
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="user-panel-close-btn" onclick="closeTopModalInfoPanel()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x">
                        <path d="M18 6 6 18"></path>
                        <path d="m6 6 12 12"></path>
                    </svg>
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
        displayGroupChatInfo(chat);
    } catch (error) {
        console.error('Error fetching group chat info:', error);
        body.innerHTML = `<div class="user-info-loading" style="color: #ef4444;">Error: ${error.message || 'Failed to load group chat information'}</div>`;
    }
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
    const photoUrl = chatImage ? getUploadUrl(chatImage.id, chatImage.fileType) : null;
    
    // Filter out current user from members list
    const otherMembers = (chat.allUsers || []).filter(user => user.id !== currentUser?.info?.id);
    
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
                <input type="file" id="groupChatAvatarInput" accept="image/*" style="display: none;" onchange="handleGroupChatAvatarFileSelect(event)">
            </div>
            <div class="user-profile-section">
                <div class="user-profile-section-title">Group Name</div>
                <input type="text" class="user-profile-name-input" id="groupChatNameInput_${chat.id}" value="${escapeHtml(chat.title || '')}" placeholder="Enter group name">
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
                    const userName = user.name || user.username || 'Unknown User';
                    const avatarHtml = getAvatarInitialsHtml(userName, user.id);
                    return `
                        <div class="group-chat-member-cell" onclick="${isOwner ? `showGroupMemberMenu(event, '${chat.id}', ${user.id})` : `showUserInfo(${user.id})`}">
                            <div class="avatar-small">${avatarHtml}</div>
                            <div class="group-chat-member-name">${escapeHtml(userName)}</div>
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
    
    // Save button for owner
    if (isOwner) {
        html += `
            <div class="user-profile-actions">
                <button class="user-profile-save-btn" onclick="saveGroupChatChanges('${chat.id}')">Save Changes</button>
            </div>
        `;
    }
    
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
                    openGroupChatAvatarFileDialog();
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

function openGroupChatImageViewer(chat) {
    if (!chat.images || chat.images.length === 0) return;
    openMediaViewer(chat.images, 0, () => {});
}

// Member management
function showGroupMemberMenu(event, chatId, userId) {
    event.stopPropagation();
    const cell = event.currentTarget;
    const rect = cell.getBoundingClientRect();
    
    showContextMenu({
        items: [
            { id: 'personal_chat', label: 'Personal Chat', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' },
            { id: 'view_info', label: 'View Info', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>' },
            { id: 'block', label: 'Block', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"></line></svg>', separator: true },
            { id: 'remove', label: 'Remove from Group', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line></svg>' }
        ],
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
                await blockGroupChatMember(chatId, userId);
            } else if (action === 'remove') {
                await removeGroupChatMember(chatId, userId);
            }
        },
        highlightElement: cell,
        highlightClass: 'menu-active'
    });
}

async function blockGroupChatMember(chatId, userId) {
    if (!confirm('Block this member in this group chat?')) return;
    
    // TODO: Implement block user in chat API call
    alert(`Blocking user ${userId} in chat ${chatId}`);
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
            selectChat(currentChatId, true);
        }
    } catch (error) {
        console.error('Error removing member:', error);
        alert('Error removing member: ' + error.message);
    }
}

async function saveGroupChatChanges(chatId) {
    console.log('Saving group chat changes for chat:', chatId);
    
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        console.error('Chat not found:', chatId);
        return;
    }

    try {
        // Get the group name input value (using chat-specific ID)
        const nameInput = document.getElementById(`groupChatNameInput_${chatId}`);
        const newTitle = nameInput ? nameInput.value.trim() || null : null;
        
        // Update chat title if it changed
        if (newTitle !== chat.title) {
            await apiUpdateChat(chat.id, { title: newTitle });
            chat.title = newTitle;
        }

        // Upload avatar if one was selected
        if (groupChatUploadedAvatarInfo) {
            await apiAddChatImage(
                chat.id,
                groupChatUploadedAvatarInfo.id,
                groupChatUploadedAvatarInfo.fileType,
                groupChatUploadedAvatarInfo.fileSize
            );

            // Update local state
            let images = chat.images || [];
            images.push({
                id: groupChatUploadedAvatarInfo.id,
                fileType: groupChatUploadedAvatarInfo.fileType,
                fileSize: groupChatUploadedAvatarInfo.fileSize
            });
            chat.images = images;
        }
        
        // Refresh chat from server to get updated data
        const updatedChat = await apiGetChat(chat.id);
        
        // Update the chat in the chats array
        const chatIndex = chats.findIndex(c => c.id === updatedChat.id);
        if (chatIndex !== -1) {
            chats[chatIndex] = updatedChat;
        }
        
        displayChats();
        
        // Update header if this chat is selected
        if (currentChatId === chat.id) {
            selectChat(currentChatId, true);
        }
        
        // Reset upload state
        groupChatUploadedAvatarInfo = null;
    } catch (error) {
        console.error('Error saving group chat changes:', error);
        alert('Error saving changes: ' + error.message);
    }
}

function isUserOnline(lastSeen) {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    // Consider online if lastSeen was within 5 minutes
    return diffMins < 5;
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
        
        // 4. User profile modal
        const userProfileModal = document.getElementById('userProfileModal');
        if (userProfileModal && userProfileModal.classList.contains('show')) {
            closeCurrentUserProfile();
            return;
        }
        
        // 5. User selection modal (lowest priority)
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
    
    showContextMenu({
        items: [
            { id: 'personal', label: 'Personal Chat' },
            { id: 'group', label: 'Group Chat' }
        ],
        x: rect.left,
        y: rect.top - 8,
        anchor: 'bottom-left',
        onAction: (action) => {
            if (action === 'personal') {
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
        
        title.textContent = 'Add users';
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
    fetchedUsers = [];
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
        if (query) {
            searchUsers(query, usersList, displayGroupChatUsers);
        } else {
            fetchedUsers = [];
            lastUserId = null;
            hasMoreUsers = true;
            loadUsers(usersList, displayGroupChatUsers);
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
    let availableUsers = fetchedUsers.filter(u => u.id !== currentUser?.info?.id);
    
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
        const userName = user.name || user.username || '?';
        const avatarHtml = getAvatarInitialsHtml(userName, user.id);
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
    const user = fetchedUsers.find(u => u.id === userId);
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

function openGroupChatAvatarFileDialog() {
    if (groupChatAvatarUploadInProgress) return;
    const input = document.getElementById('groupChatAvatarInput');
    if (input) {
        input.click();
    }
}

function handleGroupChatAvatarFileSelect(event) {
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
    uploadGroupChatAvatar(containerInfo, file);
    
    event.target.value = '';
}

async function uploadGroupChatAvatar(containerInfo, file) {
    groupChatAvatarUploadInProgress = true;
    
    const { progressBar, progressCircle, avatar } = containerInfo;
    
    progressBar.style.display = 'block';
    avatar.style.opacity = '0.7';
    
    let animationFrameId = null;
    
    const updateProgressVisual = (progress) => {
        const circumference = 2 * Math.PI * 48;
        const offset = circumference - (progress / 100) * circumference;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = offset;
    };
    
    // Smooth animation function for the last 25%
    const animateToComplete = (startProgress, duration) => {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const endProgress = 100;
            const progressRange = endProgress - startProgress;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, elapsed / duration);
                
                // Use ease-out easing for smooth animation
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                const currentProgressValue = startProgress + (progressRange * easedProgress);
                
                updateProgressVisual(currentProgressValue);
                
                if (progress < 1) {
                    animationFrameId = requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            
            animate();
        });
    };
    
    try {
        const fileId = crypto.randomUUID();
        const fileExtension = file.name.split('.').pop().toLowerCase() || 'jpg';
        
        // Upload file
        const uploadedFileName = await apiUploadFile(file, fileId, file.type, (progress) => {
            updateProgressVisual(Math.min(progress, 75));
        });
        
        const uploadedFileId = uploadedFileName.split('.').slice(0, -1).join('.');
        
        // Store uploaded file info for later use
        groupChatUploadedAvatarInfo = {
            id: uploadedFileId,
            fileType: fileExtension,
            fileSize: file.size,
            fileName: uploadedFileName
        };
        
        // Animate the last 25% smoothly over 500ms
        await animateToComplete(75, 500);
        
    } catch (error) {
        console.error('Error uploading group avatar:', error);
        // Cancel any ongoing animation
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        // Reset on error
        groupChatUploadedAvatarInfo = null;
        resetGroupAvatarDisplay();
    } finally {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
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
    resetGroupAvatarDisplay();
}

function resetGroupAvatarDisplay() {
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
                await apiAddChatImage(
                    newChat.id, 
                    groupChatUploadedAvatarInfo.id, 
                    groupChatUploadedAvatarInfo.fileType, 
                    groupChatUploadedAvatarInfo.fileSize
                );
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
        
        displayChats();
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
            selectChat(currentChatId, true);
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
        selectChat(event.state.chatId, true);
    } else {
        // No state or no chatId - clear selection
        currentChatId = null;
        localStorage.removeItem('selectedChatId');
        
        // Clear active state
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Hide chat header and message input
        const chatHeader = document.getElementById('chatHeader');
        const messageInputContainer = document.getElementById('messageInputContainer');
        const messagesContainer = document.getElementById('messagesContainer');
        
        if (chatHeader) chatHeader.style.display = 'none';
        if (messageInputContainer) messageInputContainer.style.display = 'none';
        
        // Clear current chat for menu
        window.currentChatForMenu = null;
        
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="no-chat-selected">Select a chat to start messaging</div>';
        }
    }
});
