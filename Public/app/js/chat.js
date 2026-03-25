// Message-related global variables
let pendingMessages = new Map(); // Track messages being sent
let selectedAttachments = [];
let attachmentUploads = new Map(); // Map of attachmentId -> { xhr, file, progress }
let isLoadingMessages = false; // Track if we're currently loading messages
let oldestMessageId = null; // Track the oldest message ID we've loaded
let hasMoreMessages = true; // Track if there are more messages to load
let editingMessage = null; // Track the message being edited
let replyingToMessage = null; // Track the message being replied to
var lastReferenceReadMessageId = null; // Track the ID of either last outgoing message that has been read by others or last incoming message (as a reference point for read status)

// Recents panel state
let isRecentsPanelOpen = false;
let selectedRecentIds = new Set(); // Set of selected media resource IDs
let recentMediaItems = []; // Cached recent media list
let hasMoreRecents = true; // Whether more recents can be loaded
let isLoadingRecents = false; // Prevent concurrent loads
let activeMediaTab = 'uploads'; // 'uploads' | 'recents'
let isUploadPanelCollapsed = false; // Whether the upload panel items row is collapsed
let hasConfirmedSendWithUploading = false; // Whether the user confirmed sending while uploads are in progress

// Load messages for a chat
async function loadMessages(chatId, initialLoad = false) {
    if (isLoadingMessages) {
        return;
    }

    if (initialLoad) {
        oldestMessageId = null;
        hasMoreMessages = true;
    }
    
    // Get existing messages from DOM
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) {
        isLoadingMessages = false;
        return;
    }

    isLoadingMessages = true;

    if (oldestMessageId) {
        console.log(`Loading older messages for chat ${chatId} before ${oldestMessageId}...`);
    } else {
        console.log(`Loading latest messages for chat ${chatId}...`);
    }
    
    try {
        const messages = await apiGetMessages(chatId, 50, oldestMessageId);
        
        if (messages.length === 0 && !initialLoad) {
            hasMoreMessages = false;
            isLoadingMessages = false;
            console.log(`No more messages to load for chat ${chatId}`);
            return;
        }
        
        // Update oldest message ID
        if (messages.length > 0) {
            oldestMessageId = messages[messages.length - 1].id;
            hasMoreMessages = messages.length === 50; // If we got exactly 50, there might be more
        } else {
            hasMoreMessages = false;
        }
        
        // Save scroll position before prepending messages (only if not initial load)
        const scrollableContainer = messagesContainer.parentElement;
        let scrollHeightBefore = 0;
        let scrollTopBefore = 0;
        if (!initialLoad) {
            scrollHeightBefore = scrollableContainer?.scrollHeight || 0;
            scrollTopBefore = scrollableContainer?.scrollTop || 0;
        }
        
        // Display messages (will prepend if not initial load, clear and append if initial)
        displayMessages(messages, initialLoad);
        
        // Restore scroll position after DOM update (only if not initial load)
        if (!initialLoad) {
            requestAnimationFrame(() => {
                if (scrollableContainer) {
                    const scrollHeightAfter = scrollableContainer.scrollHeight;
                    const heightDifference = scrollHeightAfter - scrollHeightBefore;
                    scrollableContainer.scrollTop = scrollTopBefore + heightDifference;
                }
            });
        }
    } catch (error) {
        messagesContainer.innerHTML = `<div class="no-messages">Can't load messages</div>`;
        console.error('Error loading messages:', error);
    } finally {
        isLoadingMessages = false;
    }
}

// Utility function to scroll messages to bottom
function scrollMessagesToBottom(instant = false) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    // Find the scrollable parent container
    const scrollableContainer = messagesContainer.parentElement;
    if (!scrollableContainer) return;

    // Scroll to the very bottom, accounting for padding
    const targetScrollTop = scrollableContainer.scrollHeight - scrollableContainer.clientHeight;
    
    if (instant) {
        scrollableContainer.scrollTop = targetScrollTop;
    } else {
        scrollableContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'auto'
        });
    }
}

// Scroll to a specific message by ID and briefly highlight it
function scrollToMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;
    
    const row = messageElement.querySelector('.message-row-content') || messageElement;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    row.classList.add('message-highlight');
    setTimeout(() => row.classList.remove('message-highlight'), 1500);
}

// Setup infinite scroll for messages container
function setupInfiniteScroll(chatId) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const scrollableContainer = messagesContainer.parentElement;
    if (!scrollableContainer) return;
    
    // Remove existing scroll listener if any
    scrollableContainer.removeEventListener('scroll', handleMessagesScroll);
    
    // Add scroll listener
    scrollableContainer.addEventListener('scroll', handleMessagesScroll);
    
    // Store chatId for the scroll handler
    scrollableContainer.dataset.chatId = chatId;
}

// Handle scroll event for infinite scroll
function handleMessagesScroll(e) {
    const scrollableContainer = e.target;
    const chatId = scrollableContainer.dataset.chatId;
    
    if (!chatId || !currentChatId || chatId !== currentChatId) {
        return;
    }
    
    // Check if user scrolled near the top (within 200px)
    const scrollTop = scrollableContainer.scrollTop;
    if (scrollTop < 200 && hasMoreMessages && !isLoadingMessages) {
        loadMessages(chatId, false);
    }
}

// Update grouping for a single message based on its neighbors
function updateSingleMessageGrouping(messageElement, index, allMessageElements) {
    const prevElement = index > 0 ? allMessageElements[index - 1] : null;
    const nextElement = index < allMessageElements.length - 1 ? allMessageElements[index + 1] : null;
    
    const currentAuthorId = messageElement.dataset.authorId;
    const currentCreatedAt = messageElement.dataset.createdAt;
    
    // Check if messages should be grouped
    const sameAuthorAsPrev = prevElement && prevElement.dataset.authorId === currentAuthorId;
    const sameAuthorAsNext = nextElement && nextElement.dataset.authorId === currentAuthorId;
    
    // Check time difference (10 minute rule)
    let timeGapWithPrev = false;
    let timeGapWithNext = false;
    
    // Check date difference for date header visibility
    let dateDiffersFromPrev = false;
    let dateDiffersFromNext = false;
    
    if (prevElement && prevElement.dataset.createdAt && currentCreatedAt) {
        const prevTime = normalizeTimestamp(prevElement.dataset.createdAt);
        const currentTime = normalizeTimestamp(currentCreatedAt);
        const timeDiff = Math.abs(currentTime - prevTime) / (1000 * 60); // minutes
        timeGapWithPrev = timeDiff > 10;
        
        // Check if dates differ
        const prevDateString = prevTime.toDateString();
        const currentDateString = currentTime.toDateString();
        dateDiffersFromPrev = prevDateString !== currentDateString;
    } else {
        // No previous element, show date header (this is the first message)
        dateDiffersFromPrev = true;
    }
    
    if (nextElement && nextElement.dataset.createdAt && currentCreatedAt) {
        const nextTime = normalizeTimestamp(nextElement.dataset.createdAt);
        const currentTime = normalizeTimestamp(currentCreatedAt);
        const timeDiff = Math.abs(currentTime - nextTime) / (1000 * 60); // minutes
        timeGapWithNext = timeDiff > 10;
        
        // Check if dates differ
        const nextDateString = nextTime.toDateString();
        const currentDateString = currentTime.toDateString();
        dateDiffersFromNext = nextDateString !== currentDateString;
    }
    
    // Show/hide date header based on date difference
    const dateHeader = messageElement.querySelector('.message-date-header');
    if (dateHeader) {
        if (dateDiffersFromPrev) {
            dateHeader.style.display = 'flex';
        } else {
            dateHeader.style.display = 'none';
        }
    }
    
    // Messages should be grouped if same author AND within 10 minutes AND same date
    const shouldGroupWithPrev = sameAuthorAsPrev && !timeGapWithPrev && !dateDiffersFromPrev;
    const shouldGroupWithNext = sameAuthorAsNext && !timeGapWithNext && !dateDiffersFromNext;
    
    let groupPosition;
    if (!shouldGroupWithPrev && !shouldGroupWithNext) {
        groupPosition = 'single';
    } else if (!shouldGroupWithPrev && shouldGroupWithNext) {
        groupPosition = 'first';
    } else if (shouldGroupWithPrev && shouldGroupWithNext) {
        groupPosition = 'middle';
    } else if (shouldGroupWithPrev && !shouldGroupWithNext) {
        groupPosition = 'last';
    }
    
    // Remove existing group classes
    messageElement.classList.remove('group-single', 'group-first', 'group-middle', 'group-last');
    
    // Add new group class
    messageElement.classList.add(`group-${groupPosition}`);
}

// Display messages in the chat area
function displayMessages(messages, isInitialLoad = false) {
    const prepend = !isInitialLoad;
    console.log(`Displaying ${messages.length} messages... (prepend: ${prepend})`);

    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    // If initial load, clear the container
    if (isInitialLoad) {
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            const noMessagesText = getRandomNoMessagesText();
            messagesContainer.innerHTML = `<div class="no-messages">${escapeHtml(noMessagesText)}</div>`;
            return;
        }
    } else {
        // When prepending, remove "no messages" if present
        const noMessages = messagesContainer.querySelector('.no-messages');
        if (noMessages) {
            noMessages.remove();
        }
    }
    
    // Reverse messages to show oldest first (only if initial load, as prepended messages are already oldest-first)
    if (isInitialLoad) {
        messages.reverse();
    }
    
    // Add messages in bulk mode (no animation, grouping, or scrolling - we'll batch those)
    // When prepending, we need to track the previous message in the batch for date header checks
    let previousMessageInBatch = null;
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        addMessageToChat(message, true, prepend);
        if (prepend) {
            previousMessageInBatch = message;
        }
    };
    
    // Apply grouping to all rendered messages at once (more efficient than incremental)
    const messageElements = Array.from(messagesContainer.children).filter(el => el.classList.contains('message-row'));
    messageElements.forEach((messageElement, index) => {
        updateSingleMessageGrouping(messageElement, index, messageElements);
    });

    // Mark messages as read
    showCurrentChatMessagesAsRead();

    // Handle scrolling (only for initial load)
    if (isInitialLoad) {
        // Scroll to bottom instantly when loading messages
        setTimeout(() => {
            scrollMessagesToBottom(true);
        }, 50);
    }
}

// Create date header element
function createDateHeader(dateString, date) {
    const headerDiv = document.createElement('div');
    headerDiv.className = 'date-header';
    const fullDateTime = formatFullDateTime(date);
    headerDiv.innerHTML = `<span class="date-header-text" title="${escapeHtml(fullDateTime)}">${dateString}</span>`;
    return headerDiv;
}

function isCurrentChatPersonalNotes() {
    const chat = chats.find(c => c.id === currentChatId);
    const otherUser = chat?.isPersonal ? chat.allUsers.find(user => user.id !== currentUser?.info.id) : null;
    return !!(chat?.isPersonal && (!otherUser || otherUser.id === currentUser?.info.id));
}

// Create a message element
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-row';
    
    // Set the author ID, timestamp, and IDs as data attributes
    messageDiv.dataset.authorId = message.author.id || '';
    
    // Normalize timestamp and store as ISO string
    const normalizedDate = normalizeTimestamp(message.createdAt);
    messageDiv.dataset.createdAt = normalizedDate.toISOString();
    
    if (message.localId) {
        messageDiv.dataset.localId = message.localId;
    }
    if (message.id) {
        messageDiv.dataset.messageId = message.id;
    }
    
    const chat = chats.find(c => c.id === currentChatId);
    
    // Check if this is a personal notes chat (chat with oneself)
    const otherUser = chat?.isPersonal ? chat.allUsers.find(user => user.id !== currentUser?.info.id) : null;
    const isPersonalNotesChat = chat?.isPersonal && (!otherUser || otherUser.id === currentUser?.info.id);
    
    const isOwnMessageFlag = isOwnMessage(message) && !isPersonalNotesChat;
    if (isOwnMessageFlag) {
        messageDiv.classList.add('own');
    }
    
    // Find author info
    const author = message.author;
    const authorName = author?.name ? author?.name : (chat.allUsers.find(user => user.id === author.id)?.name ?? 'Unknown');
    const authorMainPhoto = mainPhotoForUser(author);
    
    // Format time using normalized date
    const messageTime = normalizedDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    const fullDateTime = formatFullDateTime(normalizedDate);
    
    // Check if this is a group chat (show author names only for group chats)
    const isGroupChat = chat && !chat.isPersonal;
    
    // Create status icon for own messages (show sending clock if pending, checkmark if sent)
    const statusIcon = isOwnMessageFlag ? (message.isPending ? messageSendingIcon : messageStatusIcon) : '';
    
    // Create edited indicator if message was edited or deleted
    let editedIndicator = '';
    if (message.deletedAt) {
        const deletedDate = normalizeTimestamp(message.deletedAt);
        const deletedFullDateTime = formatFullDateTime(deletedDate);
        editedIndicator = `<span class="message-edited-icon" title="Deleted: ${escapeHtml(deletedFullDateTime)}">${messageEditedIcon}</span>`;
    } else if (message.editedAt) {
        const editedDate = normalizeTimestamp(message.editedAt);
        const editedFullDateTime = formatFullDateTime(editedDate);
        editedIndicator = `<span class="message-edited-icon" title="Edited: ${escapeHtml(editedFullDateTime)}">${messageEditedIcon}</span>`;
    }
    
    // Build avatar HTML
    const avatarAuthorId = message.author.id;
    const avatarDataAttrs = avatarAuthorId != null
        ? `data-author-id="${avatarAuthorId}" data-clickable="true"` 
        : '';
    
    const avatarContent = authorMainPhoto 
        ? `<img src="${getPreviewUrl(authorMainPhoto.id, authorMainPhoto.fileType)}" alt="">`
        : getAvatarInitialsHtml(authorName, message.author.id);
    
    // Handle attachments
    const hasAttachments = message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0;
    const messageId = message.id || message.localId;
    
    // Build timestamp area HTML
    const timestampAreaHTML = `<div class="message-timestamp-area">
        ${editedIndicator}
        <span class="message-time" title="${escapeHtml(fullDateTime)}">${messageTime}</span>
        ${isOwnMessageFlag ? `<span class="message-status-area">${statusIcon}</span>` : ''}
    </div>`;

    const attachmentHTML = hasAttachments ? buildAttachmentHTML(message.attachments, messageId, timestampAreaHTML) : '';
    
    // Store valid attachments for navigation
    if (hasAttachments && attachmentHTML) {
        const validAttachments = message.attachments.filter(att => att && att.id && att.fileType);
        if (validAttachments.length > 0) {
            messageDiv.dataset.attachments = JSON.stringify(validAttachments);
        }
    }
    
    const avatarClass = isOwnMessageFlag ? 'avatar-small outgoing' : 'avatar-small incoming';
    
    // Create date header text
    const dateHeaderText = formatChatGroupingDate(normalizedDate);
    
    // Build reply preview if this is a reply
    let replyPreviewHTML = '';
    if (message.replyTo) {
        const repliedToMessage = findMessageById(message.replyTo);
        if (repliedToMessage) {
            let replyPreviewText = '';
            if (repliedToMessage.text) {
                replyPreviewText = repliedToMessage.text;
            } else if (repliedToMessage.attachments && repliedToMessage.attachments.length > 0) {
                const date = normalizeTimestamp(repliedToMessage.createdAt);
                const timeString = date.toLocaleTimeString();
                replyPreviewText = `Attachments (${repliedToMessage.attachments.length}) at ${timeString}`;
            }
            
            replyPreviewHTML = `
                <div class="message-reply-preview">
                    <div data-reply-to="${message.replyTo}" onclick="scrollToMessage('${message.replyTo}')" style="cursor: pointer;">${quoteIcon}</div><div class="reply-preview-text">${escapeHtml(replyPreviewText)}</div>
                </div>
            `;
        }
    }
    
    // Check if message is deleted
    const isDeleted = message.deletedAt != null;
    const isMediaRemoved = !isDeleted && !message.text && !attachmentHTML && message.id;
    const messageTextContent = isDeleted 
        ? `<div class="message-text message-deleted">Message was deleted</div>` 
        : isMediaRemoved
        ? `<div class="message-text message-deleted">Media was removed</div>`
        : `<div class="message-text">${formatMessageText(message.text)}</div>`;
    
    messageDiv.innerHTML = `
        <div class="message-date-header" style="display: none;">
            <span class="date-header-text" title="${escapeHtml(fullDateTime)}">${dateHeaderText}</span>
        </div>
        <div class="message-row-content">
            <span class="${avatarClass}" ${avatarDataAttrs}>
                ${avatarContent}
            </span>
            <div class="message-content-wrapper">
                ${(isGroupChat && !isOwnMessageFlag) ? `<span class="message-author-name">${escapeHtml(authorName)}</span>` : ''}
                <div class="message-bubble">
                    ${replyPreviewHTML}
                    <div class="message-content ${hasAttachments && !isMediaRemoved ? 'has-attachment' : ''}">
                        ${hasAttachments && !isDeleted && !isMediaRemoved ? `
                            ${message.text ? messageTextContent : ''}
                            ${attachmentHTML}
                        ` : `
                            <div class="message-text-container">
                                ${messageTextContent}
                                ${timestampAreaHTML}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Store attachment data for navigation (already set above if valid attachments exist)
    if (hasAttachments && messageDiv.dataset.attachments) {
        messageDiv.dataset.currentAttachmentIndex = '0';
    }

    if (isOwnMessage(message) && message.id <= lastReferenceReadMessageId) {
        // remove hidden class to show read mark
        const readMark = messageDiv.querySelector('.message-status-read-mark');
        if (readMark) {
            readMark.classList.remove('hidden');
        }
    }
    
    // Add long press handler for context menu
    addLongPressHandler(messageDiv, {
        onLongPress: (event, startPosition) => {
            showMessageContextMenu(event, messageDiv, message);
        },
        excludeSelectors: ['.message-bubble', '.avatar-small'],
        duration: 300,
        maxMovement: 10
    });
    
    return messageDiv;
}

// Create a personal note element (for Personal Notes chat — chat with oneself)
function createPersonalNote(message) {
    // Deleted notes are not shown at all
    if (message.deletedAt != null) return null;

    const noteDiv = document.createElement('div');
    noteDiv.className = 'personal-note-row';

    noteDiv.dataset.authorId = message.author.id || '';
    const normalizedDate = normalizeTimestamp(message.createdAt);
    noteDiv.dataset.createdAt = normalizedDate.toISOString();
    if (message.localId) noteDiv.dataset.localId = message.localId;
    if (message.id) noteDiv.dataset.messageId = message.id;

    const fullDateTime = formatFullDateTime(normalizedDate);
    const messageTime = normalizedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Date header: e.g. "Today, 14:30"
    const dateGroupText = formatChatGroupingDate(normalizedDate);
    const dateHeaderText = `${dateGroupText}, ${messageTime}`;

    const hasAttachments = message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0;
    const messageId = message.id || message.localId;
    // No overlay HTML — timestamp is in the date header, not inside the balloon
    const attachmentHTML = hasAttachments ? buildAttachmentHTML(message.attachments, messageId, '') : '';

    if (hasAttachments && attachmentHTML) {
        const validAttachments = message.attachments.filter(att => att && att.id && att.fileType);
        if (validAttachments.length > 0) {
            noteDiv.dataset.attachments = JSON.stringify(validAttachments);
            noteDiv.dataset.currentAttachmentIndex = '0';
        }
    }

    const isMediaRemoved = !message.text && !attachmentHTML && message.id;

    // Build reply preview
    let replyPreviewHTML = '';
    if (message.replyTo) {
        const repliedToMessage = findMessageById(message.replyTo);
        if (repliedToMessage) {
            let replyPreviewText = '';
            if (repliedToMessage.text) {
                replyPreviewText = repliedToMessage.text;
            } else if (repliedToMessage.attachments && repliedToMessage.attachments.length > 0) {
                const date = normalizeTimestamp(repliedToMessage.createdAt);
                replyPreviewText = `Attachments (${repliedToMessage.attachments.length}) at ${date.toLocaleTimeString()}`;
            }
            replyPreviewHTML = `
                <div class="message-reply-preview">
                    <div data-reply-to="${message.replyTo}" onclick="scrollToMessage('${message.replyTo}')" style="cursor: pointer;">${quoteIcon}</div><div class="reply-preview-text">${escapeHtml(replyPreviewText)}</div>
                </div>
            `;
        }
    }

    // Title detection from text
    const rawText = message.text || '';
    const firstNewlineIndex = rawText.indexOf('\n');
    const firstLine = firstNewlineIndex >= 0 ? rawText.substring(0, firstNewlineIndex) : rawText;
    const bodyText = firstNewlineIndex >= 0 ? rawText.substring(firstNewlineIndex + 1) : '';
    const sentenceCount = (firstLine.match(/[.!?](\s|$)/g) || []).length;
    const hasTitle = firstNewlineIndex >= 0 && firstLine.trim().length > 0 && sentenceCount <= 1;

    let innerHTML = '';
    if (isMediaRemoved) {
        innerHTML = `<div class="message-text-container personal-note-text-container">
            <div class="message-text message-deleted">Media was removed</div>
        </div>`;
    } else if (hasAttachments && attachmentHTML) {
        innerHTML = `<div class="message-content has-attachment">
            ${replyPreviewHTML}
            ${rawText ? `
                <div class="personal-note-body-wrapper">
                    ${hasTitle ? `<div class="personal-note-title">${formatMessageText(firstLine)}</div>` : ''}
                    <div class="personal-note-body">${formatMessageText(hasTitle ? bodyText : rawText)}</div>
                </div>
            ` : ''}
            ${attachmentHTML}
        </div>`;
    } else {
        innerHTML = `<div class="message-text-container personal-note-text-container">
            ${replyPreviewHTML}
            <div class="personal-note-body-wrapper">
                ${hasTitle ? `<div class="personal-note-title">${formatMessageText(firstLine)}</div>` : ''}
                <div class="personal-note-body">${formatMessageText(hasTitle ? bodyText : rawText)}</div>
            </div>
        </div>`;
    }

    noteDiv.innerHTML = `
        <div class="personal-note-date-header">
            <span class="personal-note-date-text" title="${escapeHtml(fullDateTime)}">${escapeHtml(dateHeaderText)}</span>
        </div>
        <div class="message-row-content personal-note-content">
            <div class="personal-note-bubble">
                ${innerHTML}
            </div>
        </div>
    `;

    addLongPressHandler(noteDiv, {
        onLongPress: (event, startPosition) => {
            showMessageContextMenu(event, noteDiv, message);
        },
        excludeSelectors: ['.personal-note-bubble'],
        duration: 300,
        maxMovement: 10
    });

    return noteDiv;
}

function showCurrentChatMessagesAsRead() {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer || !lastReferenceReadMessageId) return;

    // Query only hidden read marks (more efficient - only elements that need updating)
    const hiddenReadMarks = messagesContainer.querySelectorAll('.message-status-read-mark.hidden');
    
    hiddenReadMarks.forEach(readMark => {
        // Find the parent message element
        const messageElement = readMark.closest('.message-row.own');
        if (!messageElement) return;
        
        const messageId = messageElement.dataset.messageId;
        if (!messageId) return;
        
        // If this message ID is <= the reference message ID, show as read
        if (messageId <= lastReferenceReadMessageId) {
            readMark.classList.remove('hidden');
        }
    });
}

// Attachment management
// Handle attach button click — open file upload dialog
function handleAttachButtonClick(event) {
    const existingToolbar = document.querySelector('.popup-toolbar');
    if (existingToolbar) {
        existingToolbar._closeToolbar?.();
    }
    openAttachmentDialog();
}

// Show recents toolbar on attach button hover
function handleAttachButtonHover(event) {
    const button = document.getElementById('attachButton');
    showPopupToolbar({
        items: [
            { id: 'recents', tooltip: 'Recent Uploads', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' }
        ],
        hoverElement: button,
        position: 'top',
        onAction: (action) => {
            if (action === 'recents') {
                openRecentsPanel();
            }
        }
    });
}

// Open attachment file dialog
function openAttachmentDialog() {
    const input = document.getElementById('attachmentInput');
    if (input) {
        input.click();
    }
}

// ── Recents Panel ─────────────────────────────────────────────────────────────

async function openRecentsPanel() {
    if (isRecentsPanelOpen && activeMediaTab === 'recents') {
        closeRecentsPanel();
        return;
    }
    isRecentsPanelOpen = true;
    activeMediaTab = 'recents';
    recentMediaItems = [];
    hasMoreRecents = true;
    await loadMoreRecents();
    renderMediaPanel();
}

function closeRecentsPanel() {
    isRecentsPanelOpen = false;
    selectedRecentIds.clear();
    if (selectedAttachments.length > 0) {
        activeMediaTab = 'uploads';
    }
    renderMediaPanel();
    updateSendButtonState();
}

function closeMediaPanel() {
    isRecentsPanelOpen = false;
    selectedRecentIds.clear();
    if (selectedAttachments.length > 0) {
        clearAllAttachments();
    } else {
        renderMediaPanel();
        updateSendButtonState();
    }
}

const RECENTS_PAGE_SIZE = 20;

async function loadMoreRecents() {
    if (isLoadingRecents || !hasMoreRecents) return;
    isLoadingRecents = true;
    try {
        const items = await apiGetRecentMedia(recentMediaItems.length, RECENTS_PAGE_SIZE);
        recentMediaItems = recentMediaItems.concat(items);
        hasMoreRecents = items.length === RECENTS_PAGE_SIZE;
    } catch (e) {
        console.error('Failed to load recent media:', e);
    } finally {
        isLoadingRecents = false;
    }
}

async function switchMediaTab(tab) {
    if (tab === activeMediaTab) return;
    activeMediaTab = tab;
    if (tab === 'recents' && !isRecentsPanelOpen) {
        isRecentsPanelOpen = true;
        recentMediaItems = [];
        hasMoreRecents = true;
        await loadMoreRecents();
    }
    renderMediaPanel();
}

// Render the unified media panel (tabs: Uploads / Recents)
function getUploadProgressSummary() {
    const total = selectedAttachments.length;
    const done = selectedAttachments.filter(a => a.uploaded).length;
    const inProgress = selectedAttachments.find(a => a.uploading);
    const overallProgress = inProgress ? Math.round(inProgress.uploadProgress || 0) : 0;
    if (done < total) {
        return `Uploading ${done + 1}/${total} ${overallProgress}%…`;
    }
    return `${total} file${total !== 1 ? 's' : ''} ready`;
}

function renderMediaPanel() {
    const container = document.getElementById('mediaPanelContainer');
    if (!container) return;

    const hasUploads = selectedAttachments.length > 0;
    const panelVisible = hasUploads || isRecentsPanelOpen;

    if (!panelVisible) {
        container.style.display = 'none';
        isUploadPanelCollapsed = false;
        return;
    }

    // Auto-switch tab if current tab has no content
    if (activeMediaTab === 'uploads' && !hasUploads) {
        activeMediaTab = 'recents';
    }

    container.style.display = 'block';
    container.innerHTML = '';

    // Header: tabs + collapse toggle + close button
    const header = document.createElement('div');
    header.className = 'media-panel-header';

    const tabs = document.createElement('div');
    tabs.className = 'media-panel-tabs';

    const hasUploading = selectedAttachments.some(a => a.uploading);

    if (isUploadPanelCollapsed && hasUploads) {
        // Collapsed: show progress summary instead of tabs
        const summarySpan = document.createElement('span');
        summarySpan.className = 'media-panel-tab active';
        summarySpan.textContent = getUploadProgressSummary();
        tabs.appendChild(summarySpan);
    } else {
        // Uploads tab (only show if there are uploads)
        if (hasUploads) {
            const uploadsTab = document.createElement('button');
            uploadsTab.className = `media-panel-tab${activeMediaTab === 'uploads' ? ' active' : ''}`;
            uploadsTab.textContent = `Uploads (${selectedAttachments.length})`;
            uploadsTab.onclick = () => switchMediaTab('uploads');
            tabs.appendChild(uploadsTab);
        }

        // Recents tab
        const recentsTab = document.createElement('button');
        recentsTab.className = `media-panel-tab${activeMediaTab === 'recents' ? ' active' : ''}`;
        const recentsCount = selectedRecentIds.size;
        recentsTab.textContent = recentsCount > 0 ? `Recents (${recentsCount})` : 'Recents';
        recentsTab.onclick = () => switchMediaTab('recents');
        tabs.appendChild(recentsTab);
    }

    header.appendChild(tabs);

    // Right-side controls: collapse (if uploads) and close, grouped together
    const headerControls = document.createElement('div');
    headerControls.style.cssText = 'display:flex;align-items:center;gap:2px;flex-shrink:0;';

    if (hasUploads) {
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'inline-button small';
        collapseBtn.title = isUploadPanelCollapsed ? 'Expand' : 'Collapse';
        collapseBtn.onclick = () => {
            isUploadPanelCollapsed = !isUploadPanelCollapsed;
            renderMediaPanel();
        };
        collapseBtn.innerHTML = isUploadPanelCollapsed
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
        headerControls.appendChild(collapseBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'inline-button small';
    closeBtn.onclick = closeMediaPanel;
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>`;
    headerControls.appendChild(closeBtn);

    header.appendChild(headerControls);

    container.appendChild(header);

    // Content: hidden when collapsed
    if (!isUploadPanelCollapsed) {
        if (activeMediaTab === 'uploads') {
            renderUploadsTabContent(container);
        } else {
            renderRecentsTabContent(container);
        }
    }

    updateSendButtonState();
}

function renderUploadsTabContent(container) {
    if (selectedAttachments.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'media-panel-empty';
        empty.textContent = 'No uploads';
        container.appendChild(empty);
        return;
    }

    const itemsRow = document.createElement('div');
    itemsRow.className = 'media-panel-items-row';

    selectedAttachments.forEach((attachment) => {
        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'attachment-preview-item';
        attachmentDiv.dataset.attachmentId = attachment.id;

        const isImage = attachment.file.type.startsWith('image/');
        const isVideo = attachment.file.type.startsWith('video/');

        const closeButton = document.createElement('button');
        closeButton.className = 'attachment-close-button';
        closeButton.onclick = () => removeAttachment(attachment.id);
        closeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>`;

        if (attachment.preview) {
            const img = document.createElement('img');
            img.className = 'attachment-preview-image';
            img.src = attachment.preview;
            img.alt = 'Preview';
            attachmentDiv.appendChild(img);
        } else if (isImage) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'attachment-preview-loading';
            loadingDiv.textContent = 'Loading...';
            attachmentDiv.appendChild(loadingDiv);

            const img = document.createElement('img');
            img.className = 'attachment-preview-image';
            img.alt = 'Preview';
            img.style.display = 'none';
            attachmentDiv.appendChild(img);

            const reader = new FileReader();
            reader.onload = (e) => {
                attachment.preview = e.target.result;
                img.src = e.target.result;
                img.style.display = 'block';
                loadingDiv.style.display = 'none';
            };
            reader.readAsDataURL(attachment.file);
        } else if (isVideo) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'attachment-preview-loading';
            loadingDiv.textContent = 'Loading...';
            attachmentDiv.appendChild(loadingDiv);

            const img = document.createElement('img');
            img.className = 'attachment-preview-image';
            img.alt = 'Preview';
            img.style.display = 'none';
            attachmentDiv.appendChild(img);

            generateVideoThumbnail(attachment.file).then((dataUrl) => {
                attachment.preview = dataUrl;
                img.src = dataUrl;
                img.style.display = 'block';
                loadingDiv.style.display = 'none';
            }).catch(() => {
                loadingDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"></path><rect width="14" height="12" x="2" y="6" rx="2" ry="2"></rect></svg>';
                loadingDiv.className = 'attachment-preview-video-icon';
            });
        }

        // Click opens media viewer with all uploads
        attachmentDiv.style.cursor = 'pointer';
        attachmentDiv.onclick = (e) => {
            if (e.target.closest('.attachment-close-button')) return;
            openUploadsMediaViewer(attachment.id);
        };

        attachmentDiv.appendChild(closeButton);
        itemsRow.appendChild(attachmentDiv);
    });

    if (selectedAttachments.length < MAX_ATTACHMENTS) {
        const plusButton = document.createElement('button');
        plusButton.className = 'attachment-preview-item attachment-small-button attachment-plus-button';
        plusButton.onclick = openAttachmentDialog;
        plusButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;
        itemsRow.appendChild(plusButton);
    }

    container.appendChild(itemsRow);

    // Restore progress visuals now that items are in the DOM
    selectedAttachments.forEach(attachment => {
        if (attachment.uploading && attachment.uploadProgress > 0) {
            updateAttachmentProgressVisual(attachment.id, attachment.uploadProgress);
        }
    });
}

function renderRecentsTabContent(container) {
    if (recentMediaItems.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'media-panel-empty';
        empty.textContent = 'No recent media';
        container.appendChild(empty);
        return;
    }

    const row = document.createElement('div');
    row.className = 'media-panel-items-row';
    recentMediaItems.forEach(media => {
        const item = createRecentMediaItem(media);
        row.appendChild(item);
    });

    if (hasMoreRecents) {
        const loadMoreButton = document.createElement('button');
        loadMoreButton.className = 'attachment-preview-item attachment-small-button attachment-plus-button';
        loadMoreButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;
        loadMoreButton.onclick = async () => {
            await loadMoreRecents();
            renderMediaPanel();
            const itemsRow = container.querySelector('.media-panel-items-row');
            if (itemsRow) itemsRow.scrollLeft = itemsRow.scrollWidth;
        };
        row.appendChild(loadMoreButton);
    }

    container.appendChild(row);
}

function createRecentMediaItem(media) {
    const isSelected = selectedRecentIds.has(media.id);
    const div = document.createElement('div');
    div.className = 'attachment-preview-item';
    div.dataset.mediaId = media.id;
    div.style.cursor = 'pointer';

    const isImage = /^(jpg|jpeg|png|gif|webp)$/i.test(media.fileType);
    const isVideo = /^(mp4|webm|mov)$/i.test(media.fileType);
    const url = getPreviewUrl(media.id, media.fileType);

    if (isImage) {
        const img = document.createElement('img');
        img.className = 'attachment-preview-image';
        img.src = url;
        img.alt = 'Media';
        div.appendChild(img);
    } else if (isVideo) {
        const videoUrl = getVideoPreviewUrl(media.id);
        const img = document.createElement('img');
        img.className = 'attachment-preview-image';
        img.src = videoUrl;
        img.alt = 'Video';
        div.appendChild(img);
    } else {
        const icon = document.createElement('div');
        icon.className = 'attachment-preview-video-icon';
        icon.textContent = '📎';
        div.appendChild(icon);
    }

    // Delete button — top-right, same as attachment close button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'attachment-close-button';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>`;
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteRecentMedia(media.id);
    };
    div.appendChild(deleteBtn);

    // Selection indicator — bottom-right, same position as upload checkmark
    const selCircle = document.createElement('div');
    selCircle.className = 'recent-media-select-circle';
    selCircle.innerHTML = isSelected
        ? `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="11" fill="hsl(var(--primary))"/><path d="M7 12l3 3 7-7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
        : `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.35)" stroke="white" stroke-width="1.5"/></svg>`;
    selCircle.onclick = (e) => {
        e.stopPropagation();
        toggleRecentMediaSelection(media.id);
    };
    div.appendChild(selCircle);

    // Click opens media viewer with all recents
    div.onclick = () => openRecentsMediaViewer(media.id);

    return div;
}

function openRecentsMediaViewer(mediaId) {
    const photos = recentMediaItems.map(m => ({
        id: m.id,
        fileType: m.fileType,
        createdAt: m.createdAt
    }));
    const index = recentMediaItems.findIndex(m => m.id === mediaId);
    if (index < 0 || photos.length === 0) return;
    const currentItem = recentMediaItems[index];
    const autoplay = /^(mp4|webm|mov)$/i.test(currentItem.fileType);
    openMediaViewer(photos, index, null, null, autoplay);
}

function openUploadsMediaViewer(attachmentId) {
    // Build photos array from uploaded attachments that have previews
    const viewable = selectedAttachments.filter(a => a.preview || (a.uploadedId && a.fileType));
    const photos = viewable.map(a => {
        if (a.uploadedId && a.fileType) {
            return { id: a.uploadedId, fileType: a.fileType, _localId: a.id };
        }
        // Not yet uploaded — use blob preview
        return { id: a.id, fileType: a.file.name.split('.').pop(), _blobUrl: a.preview, _localId: a.id };
    });
    const index = photos.findIndex(p => p._localId === attachmentId);
    if (index < 0 || photos.length === 0) return;
    const isVideo = /^(mp4|webm|mov)$/i.test(photos[index].fileType);
    openMediaViewer(photos, index, null, null, isVideo);
}

function toggleRecentMediaSelection(mediaId) {
    if (selectedRecentIds.has(mediaId)) {
        selectedRecentIds.delete(mediaId);
    } else {
        selectedRecentIds.add(mediaId);
    }
    // Re-render just the item
    const item = document.querySelector(`[data-media-id="${mediaId}"]`);
    if (item) {
        const media = recentMediaItems.find(m => m.id === mediaId);
        if (media) {
            const newItem = createRecentMediaItem(media);
            item.replaceWith(newItem);
        }
    }
    // Save scroll position before full re-render
    const itemsRow = document.querySelector('.media-panel-items-row');
    const savedScroll = itemsRow ? itemsRow.scrollLeft : 0;
    renderMediaPanel(); // Update tab badge count
    const newItemsRow = document.querySelector('.media-panel-items-row');
    if (newItemsRow) newItemsRow.scrollLeft = savedScroll;
    updateSendButtonState();
}

async function deleteRecentMedia(mediaId) {
    if (!confirm('Delete this media? This will also remove it from all messages.')) return;
    try {
        await apiDeleteMedia(mediaId);
        // Remove from list and re-render
        recentMediaItems = recentMediaItems.filter(m => m.id !== mediaId);
        selectedRecentIds.delete(mediaId);
        renderMediaPanel();
        updateSendButtonState();
    } catch (e) {
        console.error('Failed to delete media:', e);
    }
}

// Get selected recents as attachment objects (to be sent with message)
function getSelectedRecentAttachments() {
    return recentMediaItems
        .filter(m => selectedRecentIds.has(m.id))
        .map(m => ({
            id: m.id,
            uploadedId: m.id,
            fileType: m.fileType,
            file: { size: m.fileSize, type: '' },
            preview: getPreviewUrl(m.id, m.fileType),
            uploaded: true,
            previewWidth: m.previewWidth,
            previewHeight: m.previewHeight,
            duration: m.duration || null,
            fromRecents: true
        }));
}

// Handle attachment file selection
function handleAttachmentFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Filter only images and videos
    const mediaFiles = files.filter(file => 
        file.type.startsWith('image/') || file.type.startsWith('video/')
    );
    
    if (mediaFiles.length === 0) {
        alert('Please select image or video files');
        return;
    }
    
    // Limit to MAX_ATTACHMENTS total
    const remainingSlots = MAX_ATTACHMENTS - selectedAttachments.length;
    if (remainingSlots <= 0) {
        alert(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
        return;
    }
    
    const filesToAdd = mediaFiles.slice(0, remainingSlots);
    
    filesToAdd.forEach(file => {
        const attachmentId = crypto.randomUUID();
        const attachment = {
            id: attachmentId,
            file: file,
            uploaded: false,
            uploadProgress: 0,
            uploading: false
        };
        selectedAttachments.push(attachment);
    });
    
    activeMediaTab = 'uploads';
    updateAttachmentPreview();
    updateSendButtonState();
    
    // Upload attachments with 100ms delay between each to avoid connection saturation
    (async () => {
        for (let i = 0; i < selectedAttachments.length; i++) {
            const attachment = selectedAttachments[i];
            
            // Start upload
            uploadAttachment(attachment);
            
            // Add delay before next upload (except for last one)
            if (i < selectedAttachments.length - 1) {
                await delay(500);
            }
        }
    })();

    // Reset input
    event.target.value = '';
}

// Clear all attachments (cancel uploads, delete uploaded files, reset state)
function clearAllAttachments() {
    selectedAttachments.forEach(async (attachment) => {
        // Cancel uploads if in progress
        const upload = attachmentUploads.get(attachment.id);
        if (upload && upload.xhr) {
            upload.xhr.abort();
        }
        
        // Delete uploaded files from server (but not if editing existing message)
        if (attachment.uploaded && attachment.uploadedId && attachment.fileType && !editingMessage) {
            try {
                const fileName = `${attachment.uploadedId}.${attachment.fileType}`;
                await apiDeleteUpload(fileName);
            } catch (error) {
                console.error('Error deleting uploaded file:', error);
            }
        }
    });
    
    selectedAttachments = [];
    attachmentUploads.clear();
    hasConfirmedSendWithUploading = false;
    updateAttachmentPreview();
    updateSendButtonState();
}

// Update attachment preview area
function updateAttachmentPreview() {
    renderMediaPanel();
}

// Upload a single attachment
async function uploadAttachment(attachment) {
    if (attachment.uploading || attachment.uploaded) return;
    
    attachment.uploading = true;
    
    const fileId = crypto.randomUUID();
    const fileType = attachment.file.name.split('.').pop().toLowerCase()
    
    try {
        // For videos, upload preview thumbnail first
        if (attachment.file.type.startsWith('video/')) {
            try {
                const thumbnailDataUrl = attachment.preview || await generateVideoThumbnail(attachment.file);
                attachment.preview = thumbnailDataUrl;
                const blob = dataURLToBlob(thumbnailDataUrl);
                await apiUploadFile(blob, `${fileId}-preview`, 'image/jpeg');
            } catch (e) {
                console.warn('Failed to upload video preview:', e);
            }
        }
        
        // Start upload with progress tracking
        let uploadXhr = null;
        const uploadPromise = apiUploadFile(
            attachment.file,
            fileId,
            attachment.file.type,
            (progress) => {
                updateAttachmentProgress(attachment.id, progress);
            },
            (xhr) => {
                uploadXhr = xhr;
            }
        );
        
        attachmentUploads.set(attachment.id, {
            xhr: uploadXhr,
            file: attachment.file,
            progress: 0
        });
        
        const uploadedFileName = await uploadPromise;
        const uploadedFileNameParts = uploadedFileName.split('.');
        const uploadedFileId = uploadedFileNameParts.slice(0, -1).join('.');
        const uploadedFileType = uploadedFileNameParts.slice(-1)[0];
        
        // Get image dimensions for preview
        let previewWidth = 300;
        let previewHeight = 200;
        
        if (attachment.file.type.startsWith('image/')) {
            const dimensions = await getImageDimensions(attachment.file);
            previewWidth = dimensions.width;
            previewHeight = dimensions.height;
        }
        
        // Get video duration
        let duration = null;
        if (attachment.file.type.startsWith('video/')) {
            duration = await getVideoDuration(attachment.file);
        }

        attachment.uploaded = true;
        attachment.uploading = false;
        attachment.uploadProgress = 100;
        attachment.uploadedId = uploadedFileId;
        attachment.fileType = uploadedFileType;
        attachment.previewWidth = previewWidth;
        attachment.previewHeight = previewHeight;
        attachment.duration = duration;
        attachmentUploads.delete(attachment.id);
        hasConfirmedSendWithUploading = false; // reset confirm flag
        // Auto-expand when all uploads are done
        if (selectedAttachments.every(a => a.uploaded)) {
            isUploadPanelCollapsed = false;
        }
        updateSendButtonState();
        renderMediaPanel();
        
    } catch (error) {
        console.error('Error uploading attachment:', error);
        attachment.uploading = false;
        attachmentUploads.delete(attachment.id);
        // Remove progress indicator and show error icon
        const attachmentDiv = document.querySelector(`[data-attachment-id="${attachment.id}"]`);
        if (attachmentDiv) {
            const progressDiv = attachmentDiv.querySelector('.attachment-upload-progress');
            if (progressDiv) progressDiv.remove();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'attachment-upload-error';
            errorDiv.title = `Error: ${error.message || error}`;
            errorDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
            attachmentDiv.appendChild(errorDiv);
        }
    }
}

// Remove attachment
async function removeAttachment(attachmentId) {
    const attachment = selectedAttachments.find(a => a.id === attachmentId);
    if (!attachment) return;
    
    // Cancel upload if in progress
    const upload = attachmentUploads.get(attachmentId);
    if (upload && upload.xhr) {
        upload.xhr.abort();
        attachmentUploads.delete(attachmentId);
    }
    
    // If attachment is uploaded, delete it from server
    // But NOT if we're editing an existing message (the attachment will be handled server-side)
    if (attachment.uploaded && attachment.uploadedId && attachment.fileType && !editingMessage) {
        try {
            const fileName = `${attachment.uploadedId}.${attachment.fileType}`;
            await apiDeleteUpload(fileName);
        } catch (error) {
            console.error('Error deleting uploaded file:', error);
        }
    }
    
    selectedAttachments = selectedAttachments.filter(a => a.id !== attachmentId);
    updateAttachmentPreview();
    updateSendButtonState();
}

// Update attachment upload progress visually
function updateAttachmentProgressVisual(attachmentId, progress) {
    const attachmentDiv = document.querySelector(`[data-attachment-id="${attachmentId}"]`);
    if (!attachmentDiv) return;
    
    // Ensure progress indicator exists if uploading
    let progressDiv = attachmentDiv.querySelector('.attachment-upload-progress');
    if (!progressDiv && progress > 0) {
        progressDiv = document.createElement('div');
        progressDiv.className = 'attachment-upload-progress';
        attachmentDiv.appendChild(progressDiv);
    }
    
    if (progressDiv) {
        // Create filled pie chart SVG
        const size = 24;
        const center = size / 2;
        const radius = center - 2;
        const progressAngle = (progress / 100) * 360 - 90; // Start from top, convert to degrees
        
        // Calculate end point of arc
        const endX = center + radius * Math.cos(progressAngle * Math.PI / 180);
        const endY = center + radius * Math.sin(progressAngle * Math.PI / 180);
        
        // Determine if we need to use large arc flag (for > 180 degrees)
        const largeArcFlag = progress > 50 ? 1 : 0;
        
        // Create path for pie slice
        let pathData;
        if (progress === 0) {
            // No progress - show empty circle
            pathData = '';
        } else {
            // Partial pie slice
            pathData = `M ${center} ${center} L ${center} ${center - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
        }
        
        progressDiv.innerHTML = `
            <svg class="attachment-progress-circle" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
                <circle class="attachment-progress-bg" cx="${center}" cy="${center}" r="${radius}" fill="hsl(var(--background) / 0.5)"></circle>
                ${pathData ? `<path class="attachment-progress-bar" d="${pathData}" fill="white" filter="drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))"></path>` : ''}
            </svg>
        `;
    }
    
    // Hide progress indicator when complete
    if (progress >= 100 && progressDiv) {
        const div = attachmentDiv.querySelector('.attachment-upload-progress');
        if (div && div.parentNode) {
            div.remove();
        }
        updateSendButtonState();
    }
}

function updateAttachmentProgress(attachmentId, progress) {
    const attachment = selectedAttachments.find(a => a.id === attachmentId);
    if (!attachment) return;
    
    attachment.uploadProgress = progress;
    
    if (isUploadPanelCollapsed) {
        // Refresh just the summary text in the collapsed header
        const container = document.getElementById('mediaPanelContainer');
        const summaryEl = container?.querySelector('.media-panel-tab.active');
        if (summaryEl) summaryEl.textContent = getUploadProgressSummary();
    } else {
        updateAttachmentProgressVisual(attachmentId, progress);
    }
}

// Update send button state
function updateSendButtonState() {
    const messageInput = getMessageInputElement();
    const sendButton = document.getElementById('sendButton');
    if (messageInput && sendButton) {
        const hasText = messageInput.value.trim().length > 0;
        const hasAnyAttachment = selectedAttachments.length > 0;
        const hasSelectedRecents = selectedRecentIds.size > 0;

        // Show send button if text is present OR any attachment exists (even uploading) OR recents selected
        if (hasText || hasAnyAttachment || hasSelectedRecents) {
            sendButton.classList.remove('hidden');
            sendButton.classList.add('visible');
        } else {
            sendButton.classList.remove('visible');
            sendButton.classList.add('hidden');
        }
    }
}

// Message input handling
function initializeMessageInput() {
    const messageInput = getMessageInputElement();
    const sendButton = document.getElementById('sendButton');
    
    function adjustHeight() {
        // Reset to auto to get natural height
        messageInput.style.height = 'auto';
        // Set to scroll height, constrained by CSS max-height
        messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
        
        // Update send button state
        updateSendButtonState();
    }
    
    messageInput.addEventListener('input', adjustHeight);
    
    messageInput.addEventListener('focus', function() {
        // Mark chat as read when message input is focused
        if (currentChatId) {
            markChatAsRead(currentChatId);
        }
    });
    
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            
            // Priority 1: Clear text if there's any
            if (this.value.trim()) {
                this.value = '';
                this.style.height = '38px';
                updateSendButtonState();
                return; // Exit early to avoid clearing attachments or canceling edit/reply if text was present
            }
            
            // Priority 2: Close media panel if open
            if (isRecentsPanelOpen || selectedAttachments.length > 0) {
                closeMediaPanel();
                return;
            }
            
            // Priority 3: Cancel edit or reply mode
            if (editingMessage) {
                cancelEditMessage();
            } else if (replyingToMessage) {
                cancelReplyMessage();
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = this.value.trim();
            
            // Check if we're in debug command mode or entering it
            const isDebugCommandMode = this.dataset.debugCommandMode === 'true';
            if (isDebugCommandMode || stringIsDebugPrefix(text)) {
                if (handleDebugCommandWrapper(text)) {
                    // Debug command handled, clear input
                    this.value = '';
                    this.style.height = '38px';
                    updateSendButtonState();
                }
            } else if (text) {
                sendMessage();
            }
        }
    });
    
    // Initial adjustment
    adjustHeight();
    updateSendButtonState();
}

// Send message
async function sendMessage(textOverride = null) {
    const messageInput = getMessageInputElement();
    const text = textOverride !== null ? textOverride.trim() : messageInput.value.trim();
    
    // Merge selected recents into attachments consideration
    const recentAttachments = getSelectedRecentAttachments();
    
    if (!text && selectedAttachments.length === 0 && recentAttachments.length === 0) return;
    if (!currentChatId || !currentUser || !currentUser.info.id) return;
    
    // Check if we're editing a message
    if (editingMessage) {
        await updateMessage(editingMessage, text, selectedAttachments);
        return;
    }
    
    // Get uploaded attachments (only send those that are ready) + recents (always ready)
    const uploadedAttachments = selectedAttachments.filter(a => a.uploaded);
    const pendingCount = selectedAttachments.filter(a => !a.uploaded).length;
    const allReadyAttachments = [...uploadedAttachments, ...recentAttachments];

    // If some attachments are still uploading, ask the user before proceeding
    if (pendingCount > 0) {
        const readyCount = uploadedAttachments.length + recentAttachments.length;
        const hasAnythingToSend = text.length > 0 || readyCount > 0;
        if (!hasAnythingToSend) return; // nothing at all to send yet
        if (!hasConfirmedSendWithUploading) {
            const confirmMsg = readyCount > 0
                ? `${pendingCount} file${pendingCount > 1 ? 's are' : ' is'} still uploading. Send with ${readyCount} ready file${readyCount > 1 ? 's' : ''}?`
                : `${pendingCount} file${pendingCount > 1 ? 's are' : ' is'} still uploading. Send text only?`;
            if (!confirm(confirmMsg)) return;
            hasConfirmedSendWithUploading = true;
        }
    }

    // Determine if we should send attachments
    const shouldSendAttachments = allReadyAttachments.length > 0;
    
    const localId = generateMessageLocalId();
    
    // Create message object
    const message = {
        localId: localId,
        chatId: currentChatId,
        author: {
            id: currentUser.info.id,
            name: currentUser.info.name,
            username: currentUser.info.username,
            photos: currentUser.info.photos || []
        },
        authorId: currentUser.info.id,
        text: text,
        createdAt: new Date().toISOString(),
        isVisible: true,
        attachments: shouldSendAttachments ? allReadyAttachments.map(a => ({
            id: a.uploadedId,
            fileType: a.fileType,
            fileSize: a.file.size,
            previewWidth: a.previewWidth,
            previewHeight: a.previewHeight,
            duration: a.duration || null
        })) : [],
        readMarks: [],
        isPending: true
    };
    
    // Add replyTo if replying to a message
    if (replyingToMessage) {
        message.replyTo = replyingToMessage.id;
        // Clear reply state
        cancelReplyMessage();
    }
    
    // Clear attachments and input (only clear attachments that were sent; keep any still-uploading ones)
    if (shouldSendAttachments) {
        // Remove only the attachments that were sent
        const sentIds = new Set(uploadedAttachments.map(a => a.id));
        selectedAttachments = selectedAttachments.filter(a => !sentIds.has(a.id));
        // Close recents and clear selection
        isRecentsPanelOpen = false;
        selectedRecentIds.clear();
        if (selectedAttachments.length === 0) {
            attachmentUploads.clear();
        }
        renderMediaPanel();
    }
    
    // Only clear input if we're not overriding with direct text
    if (text && textOverride === null && messageInput) {
        messageInput.value = '';
        messageInput.style.height = '38px';
    }
    
    updateSendButtonState();
    
    // Restore focus to input after sending
    messageInput.focus();
    
    // Add message to pending list
    pendingMessages.set(localId, message);
    
    // Display message immediately with sending state
    await addMessageToChat(message);
    
    // Update chat list with new message
    await updateChatListWithMessage(message);
    
    // Send to server using the shared function
    const serverMessage = await sendMessageToServer(message);

    if (!serverMessage) {
        console.error('Failed to send message to server');
        return;
    }

    // Update message in chat with server response
    replaceMessageElement(message.localId, serverMessage);

    // Re-display chats to re-sort by latest message
    displayChats();
}

// Update message
async function updateMessage(message, newText, newAttachments) {
    if (!currentChatId || !currentUser) return;
    
    const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
    if (!messageElement) {
        console.error('Message element not found for editing');
        return;
    }
    
    // Create a copy of the message to update
    const currentMessage = { ...message };
    
    // Update text
    currentMessage.text = newText;

    // Get uploaded attachments (only send those that are ready)
    const uploadedAttachments = newAttachments.filter(a => a.uploaded);
    
    if (uploadedAttachments.length > 0) {
        currentMessage.attachments = uploadedAttachments.map(a => ({
            id: a.uploadedId,
            fileType: a.fileType,
            fileSize: a.file.size,
            previewWidth: a.previewWidth,
            previewHeight: a.previewHeight,
            duration: a.duration || null
        }));
    } else {
        currentMessage.attachments = [];
    }

    // Update editedAt timestamp
    currentMessage.isPending = true;
    currentMessage.editedAt = new Date().toISOString();

    // Clear editing state and input
    cancelEditMessage();

    // Replace old message element in DOM with new one with animation
    await replaceMessageElement(currentMessage.localId, currentMessage, true); // animated
        
    // Add message to pending list
    pendingMessages.set(currentMessage.localId, currentMessage);
    
    // Focus input
    const messageInput = getMessageInputElement();
    if (messageInput) {
        messageInput.focus();
    }
    
    // Send update to server
    const serverMessage = await updateMessageOnServer(currentMessage);

    // Update message in chat with server response
    replaceMessageElement(currentMessage.localId, serverMessage, false);

    // Update chat list with updated message
    await updateChatListWithMessage(serverMessage);
}

// Add message to chat
// bulkAddition: when true, skips animation, grouping update, and scroll
async function addMessageToChat(message, bulkAddition = false, prepend = false) {
    const animated = !bulkAddition;
    const updateGrouping = !bulkAddition;
    const scroll = !bulkAddition;
    
    const messagesContainer = document.getElementById('messagesContainer');
    
    // Remove "no chat selected" message if present
    const noChat = messagesContainer.querySelector('.no-chat-selected');
    if (noChat) {
        noChat.remove();
    }
    
    // Remove "No messages in this chat" message if present
    const noMessages = messagesContainer.querySelector('.no-messages');
    if (noMessages) {
        noMessages.remove();
    }
    
    // Check if message has read marks from other users to update lastReferenceReadMessageId
    const hasOtherUserReadMarks = message.readMarks?.some(mark =>
        mark.user && mark.user.id !== currentUser.info.id
    );

    if (hasOtherUserReadMarks || !isOwnMessage(message)) {
        // Only update if this ID is greater than current lastReferenceReadMessageId
        if (!lastReferenceReadMessageId || message.id > lastReferenceReadMessageId) {
            lastReferenceReadMessageId = message.id;
        }
    }

    // Date header is now handled inside the message element by updateSingleMessageGrouping
    // No need to check for date headers here
    
    const isPersonalNote = isCurrentChatPersonalNotes();
    const messageElement = isPersonalNote ? createPersonalNote(message) : createMessageElement(message);
    if (!messageElement) return null; // e.g. deleted personal note
    
    if (animated) {
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
    }

    // Insert message (date header is now inside the message element, handled by updateSingleMessageGrouping)
    if (prepend) {
        messagesContainer.insertBefore(messageElement, messagesContainer.firstChild);
    } else {
        messagesContainer.appendChild(messageElement);
    }

    // Re-calculate grouping for the new message and potentially the previous one
    if (updateGrouping && !isPersonalNote) {
        updateMessageGroupingIncremental(messageElement);
    }

    // Scroll to bottom before animation to avoid jumpiness
    if (scroll) {
        scrollMessagesToBottom();
    }

    if (!animated) {
        // No animation, return immediately
        return messageElement;
    }

    // Hide scrollbar during animation
    messagesContainer.style.overflowY = 'hidden';

    // Wrap animation in a Promise to wait for completion
    return new Promise((resolve) => {
        // Trigger animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                messageElement.style.transition = 'all 0.3s ease';
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
                
                // Wait for animation to complete
                setTimeout(() => {
                    // Restore scrollbar
                    messagesContainer.style.overflowY = 'auto';
                    resolve(messageElement);
                }, 350); // Match the transition duration
            });
        });
    });
}

// Update message grouping incrementally for newly added message
function updateMessageGroupingIncremental(newMessageElement) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageElements = Array.from(messagesContainer.children).filter(el => el.classList.contains('message-row'));
    
    // Find the index of the new message
    const newMessageIndex = messageElements.indexOf(newMessageElement);
    if (newMessageIndex === -1) {
        console.warn('New message element not found in container');
        return;
    }
    
    console.log(`Updating grouping for message at index ${newMessageIndex}`);
    
    // Get the messages we need to potentially update (previous, current, next)
    const messagesToUpdate = [];
    
    // Add previous message if it exists (its grouping might change from 'last' to 'middle')
    if (newMessageIndex > 0) {
        messagesToUpdate.push({
            element: messageElements[newMessageIndex - 1],
            index: newMessageIndex - 1
        });
    }
    
    // Add the new message
    messagesToUpdate.push({
        element: newMessageElement,
        index: newMessageIndex
    });
    
    // Add next message if it exists (shouldn't normally happen for new messages, but just in case)
    if (newMessageIndex < messageElements.length - 1) {
        messagesToUpdate.push({
            element: messageElements[newMessageIndex + 1],
            index: newMessageIndex + 1
        });
    }
    
    // Update grouping for each affected message
    messagesToUpdate.forEach(({ element, index }) => {
        updateSingleMessageGrouping(element, index, messageElements);
    });
}

// Show message context menu
function showMessageContextMenu(event, messageElement, message) {
    // Don't show menu for deleted messages
    if (message.deletedAt) {
        return;
    }
    
    const menuItems = [];
    
    // Add Copy Text if message has text
    if (message.text && message.text.trim().length > 0) {
        menuItems.push({ id: 'copy', label: 'Copy Text', icon: copyIcon });
    }
    
    // Only show Edit for own messages
    if (message.author.id === currentUser?.info.id) {
        menuItems.push({ id: 'edit', label: 'Edit', icon: editIcon });
    }
    
    menuItems.push(
        { id: 'reply', label: 'Reply', icon: quoteIcon },
    );
    
    // Add Publish/Unpublish for personal notes chat
    if (isCurrentChatPersonalNotes() && message.id) {
        const publishIcon = bookmarkIcon;
        if (message.note) {
            menuItems.push({ id: 'unpublish', label: 'Unpublish', icon: publishIcon });
        } else {
            menuItems.push({ id: 'publish', label: 'Publish', icon: publishIcon });
        }
    }
    
    menuItems.push(
        { id: 'delete', label: 'Delete', icon: deleteIcon, separator: true }
    );
    
    showContextMenu({
        items: menuItems,
        x: event.clientX,
        y: event.clientY,
        highlightElement: messageElement.querySelector('.message-row-content'),
        highlightClass: 'menu-active',
        onAction: (action) => {
            handleMessageContextAction(action, message, messageElement);
        }
    });
}

// Handle context menu actions
function handleMessageContextAction(action, message, messageElement) {
    switch (action) {
        case 'copy':
            if (message.text) {
                navigator.clipboard.writeText(message.text).then(() => {
                    console.log('Message text copied to clipboard');
                }).catch(err => {
                    console.error('Failed to copy text:', err);
                });
            }
            break;
        case 'edit':
            editMessage(message);
            break;
        case 'reply':
            replyToMessage(message);
            break;
        case 'bookmark':
            console.log('Bookmark message:', message);
            // TODO: Implement bookmark functionality
            break;
        case 'delete':
            deleteMessage(message);
            break;
        case 'publish':
            publishNote(message);
            break;
        case 'unpublish':
            unpublishNote(message);
            break;
    }
}

// Edit message
function editMessage(message) {
    // Check if message is own message and not pending
    if (message.author.id !== currentUser?.info.id || message.isPending) {
        return;
    }
    
    // Cancel any previous edit
    if (editingMessage && editingMessage.id !== message.id) {
        cancelEditMessage();
    }
    
    editingMessage = message;
    
    const messageInput = getMessageInputElement();
    const editPreviewContainer = document.getElementById('editPreviewContainer');
    
    // Build preview text
    let previewText = '';
    if (message.text) {
        previewText = message.text;
    } else if (message.attachments && message.attachments.length > 0) {
        const createdAt = new Date(message.createdAt).toLocaleTimeString();
        previewText = `Attachments (${message.attachments.length}) at ${createdAt}`;
    }
    
    // Display edit preview with message info
    editPreviewContainer.style.display = 'flex';
    editPreviewContainer.innerHTML = `
        <div class="edit-preview-content">
            <div class="edit-preview-header">Editing</div>
            <div class="edit-preview-text">${escapeHtml(previewText)}</div>
        </div>
        <button class="inline-button small" onclick="cancelEditMessage()" title="Cancel editing">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"></path>
                <path d="M6 6l12 12"></path>
            </svg>
        </button>
    `;
    
    // Display attachments if they exist
    if (message.attachments && message.attachments.length > 0) {
        selectedAttachments = message.attachments.map(att => {
            // Determine MIME type from fileType extension
            let mimeType = 'application/octet-stream';
            if (att.fileType) {
                const fileTypeExt = att.fileType.toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileTypeExt)) {
                    mimeType = `image/${fileTypeExt === 'jpg' ? 'jpeg' : fileTypeExt}`;
                } else if (['mp4', 'webm', 'mov'].includes(fileTypeExt)) {
                    mimeType = `video/${fileTypeExt}`;
                }
            }
            
            return {
                id: att.id,
                uploadedId: att.id,
                fileType: att.fileType || '',
                file: { 
                    size: att.fileSize,
                    type: mimeType
                },
                preview: att.id ? `${UPLOADS_URL}/${att.id}.${att.fileType}` : null,
                uploaded: true,
                previewWidth: att.previewWidth,
                previewHeight: att.previewHeight
            };
        });
        updateAttachmentPreview();
    }
    
    // Fill input with message text
    messageInput.value = message.text || '';
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
    
    // Focus input
    messageInput.focus();
    
    // Update send button state
    updateSendButtonState();
}

// Reply to message
function replyToMessage(message) {
    // Cancel any previous edit or reply
    if (editingMessage) {
        cancelEditMessage();
    }
    if (replyingToMessage && replyingToMessage.id !== message.id) {
        cancelReplyMessage();
    }
    
    replyingToMessage = message;
    
    const messageInput = getMessageInputElement();
    const editPreviewContainer = document.getElementById('editPreviewContainer');
    
    // Build preview text
    let previewText = '';
    if (message.text) {
        previewText = message.text;
    } else if (message.attachments && message.attachments.length > 0) {
        const createdAt = new Date(message.createdAt).toLocaleTimeString();
        previewText = `Attachments (${message.attachments.length}) at ${createdAt}`;
    }
    
    // Display reply preview with message info
    editPreviewContainer.style.display = 'flex';
    editPreviewContainer.innerHTML = `
        <div class="edit-preview-content">
            <div class="edit-preview-header">Reply</div>
            <div class="edit-preview-text">${escapeHtml(previewText)}</div>
        </div>
        <button class="inline-button small" onclick="cancelReplyMessage()" title="Cancel reply">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"></path>
                <path d="M6 6l12 12"></path>
            </svg>
        </button>
    `;
    
    // Focus input
    messageInput.focus();
    
    // Update send button state
    updateSendButtonState();
}

// Cancel reply message
function cancelReplyMessage() {
    if (!replyingToMessage) return;
    
    const editPreviewContainer = document.getElementById('editPreviewContainer');
    if (editPreviewContainer) {
        editPreviewContainer.style.display = 'none';
    }
    
    replyingToMessage = null;
    
    updateSendButtonState();
}

// Delete message
async function deleteMessage(message) {
    // Confirm deletion
    if (!confirm('Delete this message?')) {
        return;
    }
    
    try {
        // Update message locally first
        const updatedMessage = { ...message };
        updatedMessage.text = '';
        updatedMessage.attachments = [];
        updatedMessage.deletedAt = new Date().toISOString();
        
        // Replace message element in DOM
        replaceMessageElement(message.localId || message.id, updatedMessage, false);
        
        // Send delete request to server
        const serverMessage = await apiDeleteMessage(message.chatId, message.id);
        
        // Update with server response
        replaceMessageElement(message.localId || message.id, serverMessage, false);
        
        // Update chat list
        await updateChatListWithMessage(serverMessage);
    } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message');
    }
}

// Cancel edit message
function cancelEditMessage() {
    if (!editingMessage) return;
    
    const editPreviewContainer = document.getElementById('editPreviewContainer');
    if (editPreviewContainer) {
        editPreviewContainer.style.display = 'none';
    }
    
    editingMessage = null;
    
    const messageInput = getMessageInputElement();
    messageInput.value = '';
    messageInput.style.height = '38px';
    
    // Clear attachments
    selectedAttachments = [];
    attachmentUploads.clear();
    updateAttachmentPreview();
    
    updateSendButtonState();
}

// Update existing message
async function replaceMessageElement(messageLocalId, updatedMessage, animated = false) {
    const oldMessageElement = document.querySelector(`[data-local-id="${messageLocalId}"]`);

    if (oldMessageElement === null) {
        console.warn('Message element to replace not found for localId:', messageLocalId);
        return null;
    }
    
    // If not animated, just replace immediately
    if (!animated) {
        const isPersonalNote = isCurrentChatPersonalNotes();
        const newMessageElement = isPersonalNote ? createPersonalNote(updatedMessage) : createMessageElement(updatedMessage);
        if (!newMessageElement) { oldMessageElement.remove(); return null; }
        oldMessageElement.replaceWith(newMessageElement);
        if (!isPersonalNote) updateMessageGroupingIncremental(newMessageElement);
        return newMessageElement;
    }
    
    // Wrap animation in a Promise to wait for completion
    return new Promise((resolve) => {
        // Determine if this is an outgoing message (has 'own' class)
        const isOutgoing = oldMessageElement.classList.contains('own');
        const slideDirection = isOutgoing ? 'translateX(100%)' : 'translateX(-100%)';
        
        // Create the new message element
        const isPersonalNote = isCurrentChatPersonalNotes();
        const newMessageElement = isPersonalNote ? createPersonalNote(updatedMessage) : createMessageElement(updatedMessage);

        if (!newMessageElement) {
            oldMessageElement.style.transition = 'transform 0.2s ease-in';
            oldMessageElement.style.transform = slideDirection;
            setTimeout(() => { oldMessageElement.remove(); resolve(null); }, 250);
            return;
        }
        
        // Step 1: Slide out the old message
        oldMessageElement.style.transition = 'transform 0.2s ease-in';
        oldMessageElement.style.transform = slideDirection;
        
        // Step 2: After slide-out completes, replace and prepare new element off-screen
        setTimeout(() => {
            // Position new element off-screen in same direction
            newMessageElement.style.transform = slideDirection;
            newMessageElement.style.transition = 'none';
            
            // Replace the element
            oldMessageElement.replaceWith(newMessageElement);
            
            // Update grouping
            if (!isPersonalNote) updateMessageGroupingIncremental(newMessageElement);
            
            // Step 3: Slide in the new message after a brief delay
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    newMessageElement.style.transition = 'transform 0.2s ease-out';
                    newMessageElement.style.transform = 'translateX(0)';
                    
                    // Step 4: Resolve Promise after slide-in completes
                    setTimeout(() => {
                        resolve(newMessageElement);
                    }, 250); // Match the slide-in duration
                });
            });
        }, 250); // Match the slide-out duration
    });
}

// Mark message as failed
function markMessageAsFailed(localId) {
    const messageElement = document.querySelector(`[data-local-id="${localId}"]`);
    if (messageElement) {
        messageElement.classList.add('error');
                
        // Add error indicator in front of the message balloon
        const errorIndicator = document.createElement('span');
        errorIndicator.className = 'message-error';
        errorIndicator.innerHTML = '⚠️';
        errorIndicator.title = 'Failed to send. Click to retry.';
        errorIndicator.onclick = () => retryMessage(localId);
        
        const messageRowContent = messageElement.querySelector('.message-row-content');
        if (messageRowContent) {
            messageRowContent.appendChild(errorIndicator);
        }
    }
}

// Retry failed message
async function retryMessage(localId) {
    const message = pendingMessages.get(localId);
    if (message) {
        // Remove error indicator
        const messageElement = document.querySelector(`[data-local-id="${localId}"]`);
        const errorIndicator = messageElement?.querySelector('.message-error');
        if (errorIndicator) {
            errorIndicator.remove();
        }
        
        messageElement?.classList.remove('error');
        
        // Set message as pending and recreate to show sending icon
        message.isPending = true;
        pendingMessages.set(localId, message);
        
        // Update message element to show sending icon
        replaceMessageElement(message.localId, message, false);
        
        // Retry sending
        const serverMessage = await sendMessageToServer(message);

        // Update message in chat with server response
        replaceMessageElement(message.localId, serverMessage);
    }
}

// Send message to server
async function sendMessageToServer(message) {
    try {
        // Prepare attachments if present
        let attachments = null;
        if (message.attachments && message.attachments.length > 0) {
            attachments = message.attachments.map(att => ({
                id: att.id,
                fileType: att.fileType,
                fileSize: att.fileSize,
                previewWidth: att.previewWidth,
                previewHeight: att.previewHeight,
                duration: att.duration || null
            }));
        }
        
        const serverMessage = await apiSendMessage(
            message.chatId,
            message.localId,
            message.text || null,
            attachments,
            message.replyTo || null
        );
        
        message.isPending = false;
        pendingMessages.delete(message.localId);

        return serverMessage;
    } catch (error) {
        console.error('Error sending message:', error);
        markMessageAsFailed(message.localId);
    }
}

// Update message on server
async function updateMessageOnServer(message) {
    try {
        // Prepare attachments if present
        let attachments = null;
        if (message.attachments && message.attachments.length > 0) {
            attachments = message.attachments.map(att => ({
                id: att.id,
                fileType: att.fileType,
                fileSize: att.fileSize,
                previewWidth: att.previewWidth,
                previewHeight: att.previewHeight,
                duration: att.duration || null
            }));
        }
        
        const serverMessage = await apiUpdateMessage(
            message.chatId,
            message.id,
            message.text,
            attachments
        );
        
        message.isPending = false;
        pendingMessages.delete(message.localId);
        
        return serverMessage;
    } catch (error) {
        console.error('Error updating message:', error);
        markMessageAsFailed(message.localId);
    }
}

function getVideoDuration(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);
        video.addEventListener('loadedmetadata', () => {
            const duration = video.duration && isFinite(video.duration) ? video.duration : null;
            URL.revokeObjectURL(video.src);
            resolve(duration);
        });
        video.addEventListener('error', () => {
            URL.revokeObjectURL(video.src);
            resolve(null);
        });
    });
}

// Publish a personal note message as a public note
async function publishNote(message) {
    if (!message.id) return;
    try {
        const result = await apiPublishNote(message.id);
        message.note = { id: result.id, createdAt: result.createdAt };
        console.log('Note published:', message.id);
    } catch (error) {
        console.error('Failed to publish note:', error);
    }
}

// Unpublish a personal note message
async function unpublishNote(message) {
    if (!message.id) return;
    try {
        await apiUnpublishNote(message.id);
        message.note = null;
        console.log('Note unpublished:', message.id);
    } catch (error) {
        console.error('Failed to unpublish note:', error);
    }
}