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
let recentMediaItems = []; // Cached recent media list
let hasMoreRecents = true; // Whether more recents can be loaded
let isLoadingRecents = false; // Prevent concurrent loads
let activeMediaTab = 'attachments'; // 'attachments' | 'recents'
let isUploadPanelCollapsed = false; // Whether the upload panel items row is collapsed
let hasConfirmedSendWithUploading = false; // Whether the user confirmed sending while uploads are in progress

const notePopupController = createNotePopupController({
    title: 'Journal post',
    loadingText: 'Loading journal post...',
    unavailableText: 'Journal post is unavailable',
    errorText: 'Can\'t load this journal post',
    onDismiss: () => dismissNotePopup(),
    renderRow: (note) => createNotePopupRow(note)
});

const noteNavigation = createNoteNavigationController({
    popupController: notePopupController,
    getBaseState: () => {
        const chatId = currentChatId ?? history.state?.chatId ?? null;
        const baseState = { ...(history.state || {}) };
        delete baseState.messageLink;
        delete baseState.note;
        delete baseState.baseState;
        delete baseState.baseUrl;
        if (chatId) {
            baseState.chatId = chatId;
        }
        return baseState;
    },
    getBaseUrl: ({ historyMode }) => {
        const chatId = currentChatId ?? history.state?.chatId ?? null;
        return historyMode === 'replace'
            ? (chatId ? `#chat-${chatId}` : '/main')
            : getCurrentPageHistoryUrl();
    }
});

function closeNotePopup() {
    return noteNavigation.close();
}

function dismissNotePopup() {
    return noteNavigation.dismiss();
}

function openNoteLinkTarget(noteId, userId, options = {}) {
    return noteNavigation.openLinkTarget(noteId, userId, options);
}

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

    // Content that is still loading (images, embeds, fonts) can grow the list after this,
    // so keep the list pinned to the bottom until the user scrolls away.
    isMessagesPinnedToBottom = true;

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

// Whether the message list should stay at the bottom when its content or viewport changes size.
let isMessagesPinnedToBottom = false;

// How close to the bottom, in pixels, the list must be for it to count as being at the bottom.
const messagesBottomPinThreshold = 4;

// Keeps the message list scrolled to the bottom while it is there and its height changes without any scrolling.
// Long posts keep growing after they are rendered (lazy-loaded images and embeds, web fonts), so a single
// scroll to the bottom right after rendering stops short of the real end of the list.
function setupMessagesBottomPinning() {
    const messagesContainer = document.getElementById('messagesContainer');
    const scrollableContainer = messagesContainer?.parentElement;
    if (!scrollableContainer) return;

    // The user scrolling (or any other scroll) decides whether the list is still pinned.
    // Growing content does not fire scroll events, so it leaves the pinned state unchanged.
    scrollableContainer.addEventListener('scroll', () => {
        const distanceFromBottom = scrollableContainer.scrollHeight - scrollableContainer.clientHeight - scrollableContainer.scrollTop;
        isMessagesPinnedToBottom = distanceFromBottom <= messagesBottomPinThreshold;
    }, { passive: true });

    // Watch both the content (posts growing) and the scroll area itself (window or input field resizing).
    const resizeObserver = new ResizeObserver(() => {
        if (!isMessagesPinnedToBottom) return;
        scrollableContainer.scrollTop = scrollableContainer.scrollHeight - scrollableContainer.clientHeight;
    });
    resizeObserver.observe(messagesContainer);
    resizeObserver.observe(scrollableContainer);
}

function highlightMessageRow(row) {
    row.classList.add('message-highlight');
    setTimeout(() => row.classList.remove('message-highlight'), 1500);
}

function createNotePopupRow(note) {
    if (!note?.message) return null;

    const message = {
        ...note.message,
        note: {
            id: note.id,
            createdAt: note.createdAt,
            userId: note.message.author?.id
        },
        createdAt: note.createdAt ?? note.message.createdAt
    };

    return finalizeNotePopupRow(createPersonalNote(message));
}

// Scroll to a specific message by ID and briefly highlight it.
function scrollToMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    closeNotePopup();

    const row = messageElement.querySelector('.message-row-content') || messageElement;
    scrollElementIntoScroller(row, document.getElementById('messagesScrollWrapper'), 'center');

    // Posts in Personal Notes flash their balloon border, the same way as when a post link leads to them
    if (messageElement.classList.contains('personal-note-row')) {
        flashPostBubble(messageElement);
    } else {
        highlightMessageRow(row);
    }
}

// ── Table Of Contents (Personal Notes) ─────────────────────────────────────

// More than the server allows to pin (NotesService.maxPinnedNotes), so every pinned post is fetched
const PERSONAL_NOTES_MAX_PINNED = 20;

function togglePersonalNotesTableOfContents(chatId, anchor) {
    toggleTocPanel({
        anchor,
        side: 'right',
        fetchPage: async ({ before, search, count }) => {
            const messages = await apiGetMessages(chatId, count, before, search);
            return {
                items: messages
                    .filter(message => message.id != null && message.deletedAt == null)
                    .map(message => createTocItem({
                        id: message.id,
                        createdAt: message.createdAt,
                        text: message.text,
                        attachmentsCount: message.attachments?.length ?? 0,
                        isPinned: !!message.note?.isPinned,
                        isPublished: !!message.note
                    })),
                nextCursor: messages.length > 0 ? messages[messages.length - 1].id : before,
                done: messages.length < count
            };
        },
        // Only published posts can be pinned, so the pinned ones come from the user's own journal.
        // They are listed by message id, like the rest of this panel.
        fetchPinned: async () => {
            const userId = currentUser?.info?.id;
            if (userId == null) return [];
            const notes = await apiGetUserNotes(userId, { count: PERSONAL_NOTES_MAX_PINNED, pinned: true });
            return notes.filter(note => note.message?.id != null).map(note => createTocItem({
                id: note.message.id,
                createdAt: note.message.createdAt,
                text: note.message.text,
                attachmentsCount: note.message.attachments?.length ?? 0,
                isPinned: true,
                isPublished: true
            }));
        },
        onSelect: (item) => {
            revealChatMessage(chatId, item.id).catch(console.error);
        }
    });
}

// ── Message search (all chats except Personal Notes) ───────────────────────

function toggleChatSearch(chatId, anchor) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    toggleTocPanel({
        anchor,
        side: 'right',
        title: 'Search',
        noun: 'messages',
        searchOnly: true,
        getLocalItems: () => loadedChatMessageSearchItems(chat),
        fetchPage: async ({ before, search, count }) => {
            const messages = await apiGetMessages(chatId, count, before, search);
            return {
                items: messages
                    .filter(message => message.id != null && message.deletedAt == null)
                    .map(message => createMessageSearchItem({
                        id: message.id,
                        createdAt: message.createdAt,
                        authorName: chatSearchAuthorName(chat, message.author?.id, message.author?.name),
                        text: message.text,
                        attachmentsCount: message.attachments?.length ?? 0
                    })),
                nextCursor: messages.length > 0 ? messages[messages.length - 1].id : before,
                done: messages.length < count
            };
        },
        onSelect: (item) => {
            revealChatMessage(chatId, item.id).catch(console.error);
        }
    });
}

// "You" for the current user, otherwise the author's name as the chat knows it
function chatSearchAuthorName(chat, authorId, fallbackName) {
    if (authorId != null && authorId === currentUser?.info?.id) return 'You';
    return chat?.allUsers?.find(user => user.id === authorId)?.name || fallbackName || 'Unknown';
}

// The messages currently shown in the chat, as search items, so typing can filter them right away
function loadedChatMessageSearchItems(chat) {
    const rows = document.querySelectorAll('#messagesContainer .message-row[data-message-id]');
    const items = [];
    rows.forEach(row => {
        if (row.querySelector('.message-deleted')) return;
        const textElement = row.querySelector('.message-text');
        let attachmentsCount = 0;
        try {
            attachmentsCount = JSON.parse(row.dataset.attachments || '[]').length;
        } catch (_) {
            attachmentsCount = 0;
        }
        const authorId = row.dataset.authorId ? Number(row.dataset.authorId) : null;
        items.push(createMessageSearchItem({
            id: row.dataset.messageId,
            createdAt: row.dataset.createdAt,
            authorName: chatSearchAuthorName(chat, authorId),
            // The rendered text, which already has the inline formatting applied
            text: textElement ? textElement.textContent : '',
            attachmentsCount
        }));
    });
    return items.sort((a, b) => b.date - a.date);
}

// Shows a single chat message that isn't loaded in the chat, in the same popup as linked journal posts
const messagePopupController = createNotePopupController({
    title: 'Message',
    loadingText: 'Loading message...',
    unavailableText: 'Message is unavailable',
    errorText: 'Can\'t load this message',
    // The popup passes its two ids through as given: here they are the message id and the chat id
    load: async (messageId, chatId) => {
        // The one message before the next id is the message itself, if it still exists
        const messages = await apiGetMessages(chatId, 1, Number(messageId) + 1);
        const message = messages[0];
        return message && String(message.id) === String(messageId) && message.deletedAt == null ? message : null;
    },
    renderRow: (message) => {
        if (!message) return null;
        const chat = chats.find(c => c.id === currentChatId);
        const row = isPersonalNotes(chat) ? createPersonalNote(message) : createMessageElement(message);
        return finalizeNotePopupRow(row);
    }
});

// Closes any info panels, opens the chat if needed, and scrolls to the message.
// A message that isn't loaded is shown in a popup instead: loading every page in between
// could take very long in a chat with years of history.
async function revealChatMessage(chatId, messageId) {
    while (userInfoModalStack.length > 0) {
        closeTopModalInfoPanel();
    }
    if (currentChatId !== chatId) {
        await selectChat(chatId);
    }

    const container = document.getElementById('messagesContainer');
    if (container?.querySelector(`[data-message-id="${messageId}"]`)) {
        requestAnimationFrame(() => scrollToMessage(messageId));
        return;
    }
    await messagePopupController.open(messageId, chatId);
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

function isPersonalNotes(chat) {
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
    const isPersonalNotesChat = isPersonalNotes(chat);
    
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
    if (message.note?.id) noteDiv.dataset.noteId = String(message.note.id).toLowerCase();

    const fullDateTime = formatFullDateTime(normalizedDate);
    const messageTime = normalizedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Date header: e.g. "Today, 14:30"
    const dateGroupText = formatChatGroupingDate(normalizedDate);
    const dateHeaderText = `${dateGroupText}, ${messageTime}`;

    const hasAttachments = message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0;
    const messageId = message.id || message.localId;
    // No overlay HTML — timestamp is in the date header, not inside the balloon
    const attachmentHTML = hasAttachments ? buildAttachmentHTML(message.attachments, messageId, '', { journal: true }) : '';

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

    const publishedIconHTML = message.note ? (() => {
        const publishedDateTime = formatFullDateTime(normalizeTimestamp(message.note.createdAt));
        const journalUrl = createNoteHref(message.note.userId ?? currentUser?.info?.id, message.note.id, { target: 'popup' });
        if (!journalUrl) return '';
        return `<a class="personal-note-published-icon" href="${journalUrl}" target="_blank" rel="noopener noreferrer" title="Published: ${escapeHtml(publishedDateTime)}">${globeIcon}</a>`;
    })() : '';

    const pinnedIconHTML = message.note?.isPinned
        ? `<span class="personal-note-pinned-icon" title="Pinned">${pinIcon}</span>`
        : '';

    // The edited pencil goes before the post date, while the other status icons follow it.
    const editedIconHTML = postEditedIconHtml(message);
    const leadingIconsHTML = editedIconHTML
        ? `<span class="personal-note-status-icons personal-note-status-icons-leading">${editedIconHTML}</span>`
        : '';
    const statusIconsHTML = [publishedIconHTML, pinnedIconHTML]
        .filter(Boolean)
        .map(icon => `<span class="personal-note-status-icons">${icon}</span>`)
        .join('');

    noteDiv.innerHTML = `
        <div class="personal-note-date-header">
            <span class="personal-note-date-side personal-note-date-side-left">${leadingIconsHTML}</span><span class="personal-note-date-text" title="${escapeHtml(fullDateTime)}">${escapeHtml(dateHeaderText)}</span><span class="personal-note-date-side personal-note-date-side-right">${statusIconsHTML}</span>
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
    const formatButtons = document.getElementById('messageInputFormatButtons');
    showPopupToolbar({
        items: [
            { id: 'recents', tooltip: 'Recent Uploads', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' }
        ],
        hoverElement: button,
        position: formatButtons && formatButtons.classList.contains('is-visible') ? 'right' : 'top',
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
    if (selectedAttachments.length > 0) {
        activeMediaTab = 'attachments';
    }
    renderMediaPanel();
    updateSendButtonState();
}

function closeMediaPanel() {
    isRecentsPanelOpen = false;
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

// Render the unified media panel (tabs: Attachments / Recents)
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

    // Rebuilding the panel in the middle of a drag would drop the dragged thumbnail, so wait until it ends.
    if (attachmentReorderDrag) {
        attachmentReorderDrag.renderWhenDone = true;
        return;
    }

    const hasAttachments = selectedAttachments.length > 0;
    const panelVisible = hasAttachments || isRecentsPanelOpen;

    if (!panelVisible) {
        container.style.display = 'none';
        isUploadPanelCollapsed = false;
        return;
    }

    // Auto-switch tab if current tab has no content
    if (activeMediaTab === 'attachments' && !hasAttachments) {
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

    if (isUploadPanelCollapsed && hasAttachments) {
        // Collapsed: show progress summary instead of tabs
        const summarySpan = document.createElement('span');
        summarySpan.className = 'media-panel-tab active';
        summarySpan.textContent = getUploadProgressSummary();
        tabs.appendChild(summarySpan);
    } else {
        // Attachments tab: new uploads and media picked in Recents. It is shown once there is at least one.
        if (hasAttachments) {
            const attachmentsTab = document.createElement('button');
            attachmentsTab.className = `media-panel-tab${activeMediaTab === 'attachments' ? ' active' : ''}`;
            attachmentsTab.textContent = `Attachments (${selectedAttachments.length})`;
            attachmentsTab.onclick = () => switchMediaTab('attachments');
            tabs.appendChild(attachmentsTab);
        }

        // Recents tab
        const recentsTab = document.createElement('button');
        recentsTab.className = `media-panel-tab${activeMediaTab === 'recents' ? ' active' : ''}`;
        recentsTab.textContent = 'Recents';
        recentsTab.onclick = () => switchMediaTab('recents');
        tabs.appendChild(recentsTab);
    }

    header.appendChild(tabs);

    // Right-side controls: collapse (if there are attachments) and close, grouped together
    const headerControls = document.createElement('div');
    headerControls.style.cssText = 'display:flex;align-items:center;gap:2px;flex-shrink:0;';

    if (hasAttachments) {
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
        if (activeMediaTab === 'attachments') {
            renderAttachmentsTabContent(container);
        } else {
            renderRecentsTabContent(container);
        }
    }

    updateSendButtonState();
}

// The Attachments tab is shown only while there are attachments; otherwise the panel shows Recents.
function renderAttachmentsTabContent(container) {
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

        // Click opens media viewer with all attachments
        attachmentDiv.style.cursor = 'pointer';
        attachmentDiv.onclick = (e) => {
            if (e.target.closest('.attachment-close-button')) return;
            openAttachmentsMediaViewer(attachment.id);
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
    enableAttachmentReordering(itemsRow);

    // Restore progress visuals now that items are in the DOM
    selectedAttachments.forEach(attachment => {
        if (attachment.uploading && attachment.uploadProgress > 0) {
            updateAttachmentProgressVisual(attachment.id, attachment.uploadProgress);
        }
    });
}

// ── Reordering uploads ───────────────────────────────────────────────────────
// Attachment thumbnails can be dragged left and right to change the order the attachments are sent in.
// With a mouse the drag starts once the pointer moves a few pixels; on touch screens it starts after a
// short press, so that a plain swipe still scrolls the row.

let attachmentReorderDrag = null;
const ATTACHMENT_DRAG_THRESHOLD = 6;
const ATTACHMENT_TOUCH_HOLD_MS = 300;

function enableAttachmentReordering(itemsRow) {
    const items = itemsRow.querySelectorAll('.attachment-preview-item[data-attachment-id]');
    if (items.length < 2) return;
    items.forEach(item => {
        item.addEventListener('pointerdown', (e) => onAttachmentPointerDown(e, item, itemsRow));
        // Once a touch drag has started, stop the row from scrolling under the finger.
        item.addEventListener('touchmove', (e) => {
            if (attachmentReorderDrag?.active) e.preventDefault();
        }, { passive: false });
        item.addEventListener('contextmenu', (e) => {
            if (attachmentReorderDrag) e.preventDefault();
        });
    });
}

function onAttachmentPointerDown(e, item, itemsRow) {
    if (attachmentReorderDrag || !e.isPrimary || e.button !== 0) return;
    if (e.target.closest('.attachment-close-button')) return;

    const drag = {
        item,
        itemsRow,
        pointerId: e.pointerId,
        isTouch: e.pointerType !== 'mouse',
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        grabOffset: 0,
        active: false,
        holdTimer: null,
        renderWhenDone: false
    };
    attachmentReorderDrag = drag;

    if (drag.isTouch) {
        drag.holdTimer = setTimeout(() => startAttachmentDrag(drag), ATTACHMENT_TOUCH_HOLD_MS);
    }

    window.addEventListener('pointermove', onAttachmentPointerMove);
    window.addEventListener('pointerup', onAttachmentPointerUp);
    window.addEventListener('pointercancel', onAttachmentPointerCancel);
}

function startAttachmentDrag(drag) {
    if (attachmentReorderDrag !== drag || drag.active) return;
    drag.active = true;
    drag.grabOffset = drag.startX - drag.item.getBoundingClientRect().left;
    drag.item.classList.add('attachment-dragging');
    try { drag.item.setPointerCapture(drag.pointerId); } catch (_) { /* the pointer may already be gone */ }
    if (drag.isTouch && navigator.vibrate) navigator.vibrate(10);
}

function onAttachmentPointerMove(e) {
    const drag = attachmentReorderDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.lastX = e.clientX;

    if (!drag.active) {
        const distance = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
        if (distance < ATTACHMENT_DRAG_THRESHOLD) return;
        if (drag.isTouch) {
            // The finger moved before the hold time passed, so this is a scroll and not a drag.
            finishAttachmentDrag(false);
            return;
        }
        startAttachmentDrag(drag);
    }

    e.preventDefault();
    autoScrollAttachmentRow(drag.itemsRow, e.clientX);
    moveDraggedAttachment(drag, e.clientX);
}

// Moves the dragged thumbnail into the slot under the pointer and keeps it following the pointer.
function moveDraggedAttachment(drag, pointerX) {
    const { item, itemsRow } = drag;
    const siblings = Array.from(itemsRow.querySelectorAll('.attachment-preview-item[data-attachment-id]'))
        .filter(el => el !== item);

    item.style.transform = '';
    const itemWidth = item.offsetWidth;
    const draggedCenter = pointerX - drag.grabOffset + itemWidth / 2;
    const targetIndex = siblings.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.left + rect.width / 2 < draggedCenter;
    }).length;

    const currentIndex = Array.from(itemsRow.querySelectorAll('.attachment-preview-item[data-attachment-id]')).indexOf(item);
    if (targetIndex !== currentIndex) {
        // Animate the thumbnails that make room, so the swap is easy to follow.
        const before = new Map(siblings.map(el => [el, el.getBoundingClientRect().left]));
        const reference = siblings[targetIndex] ?? siblings[siblings.length - 1].nextSibling;
        itemsRow.insertBefore(item, reference);
        siblings.forEach(el => {
            const shift = before.get(el) - el.getBoundingClientRect().left;
            if (!shift) return;
            el.style.transition = 'none';
            el.style.transform = `translateX(${shift}px)`;
            el.getBoundingClientRect();
            el.style.transition = 'transform 150ms ease';
            el.style.transform = '';
        });
    }

    const naturalLeft = item.getBoundingClientRect().left;
    item.style.transform = `translateX(${pointerX - drag.grabOffset - naturalLeft}px)`;
}

function autoScrollAttachmentRow(itemsRow, pointerX) {
    const rect = itemsRow.getBoundingClientRect();
    const edge = 40;
    if (pointerX < rect.left + edge) {
        itemsRow.scrollLeft -= 10;
    } else if (pointerX > rect.right - edge) {
        itemsRow.scrollLeft += 10;
    }
}

function onAttachmentPointerUp(e) {
    const drag = attachmentReorderDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    finishAttachmentDrag(drag.active);
}

function onAttachmentPointerCancel(e) {
    const drag = attachmentReorderDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    finishAttachmentDrag(false);
}

// Ends the drag. When keepOrder is true the new thumbnail order becomes the attachment order;
// otherwise the panel is redrawn in the order it had before.
function finishAttachmentDrag(keepOrder) {
    const drag = attachmentReorderDrag;
    if (!drag) return;
    attachmentReorderDrag = null;

    clearTimeout(drag.holdTimer);
    window.removeEventListener('pointermove', onAttachmentPointerMove);
    window.removeEventListener('pointerup', onAttachmentPointerUp);
    window.removeEventListener('pointercancel', onAttachmentPointerCancel);

    const wasActive = drag.active;
    drag.item.classList.remove('attachment-dragging');
    drag.item.style.transform = '';
    try { drag.item.releasePointerCapture(drag.pointerId); } catch (_) { /* already released */ }

    if (wasActive) {
        // The click that follows a drag must not open the media viewer.
        const swallowClick = (e) => e.stopImmediatePropagation();
        drag.item.addEventListener('click', swallowClick, { capture: true, once: true });
        // If no click follows (for example on touch screens), stop waiting for one.
        setTimeout(() => drag.item.removeEventListener('click', swallowClick, { capture: true }), 0);
    }

    if (keepOrder) {
        const orderedIds = Array.from(drag.itemsRow.querySelectorAll('.attachment-preview-item[data-attachment-id]'))
            .map(el => el.dataset.attachmentId);
        const position = new Map(orderedIds.map((id, index) => [id, index]));
        selectedAttachments = [...selectedAttachments].sort((a, b) =>
            (position.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (position.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }

    if (drag.renderWhenDone || (wasActive && !keepOrder)) {
        renderMediaPanel();
    }
}

function renderRecentsTabContent(container) {
    const visibleItems = visibleRecentMediaItems();
    if (visibleItems.length === 0 && !hasMoreRecents) {
        const empty = document.createElement('div');
        empty.className = 'media-panel-empty';
        empty.textContent = 'No recent media';
        container.appendChild(empty);
        return;
    }

    const row = document.createElement('div');
    row.className = 'media-panel-items-row';
    visibleItems.forEach(media => {
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
    const isSelected = isRecentMediaAttached(media.id);
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
    const items = visibleRecentMediaItems();
    const photos = items.map(m => ({
        id: m.id,
        fileType: m.fileType,
        createdAt: m.createdAt
    }));
    const index = items.findIndex(m => m.id === mediaId);
    if (index < 0 || photos.length === 0) return;
    const currentItem = items[index];
    const autoplay = /^(mp4|webm|mov)$/i.test(currentItem.fileType);
    openMediaViewer(photos, index, null, null, autoplay);
}

function openAttachmentsMediaViewer(attachmentId) {
    // Build photos array from attachments that have previews
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

// The server lists a file in Recents as soon as it is uploaded, but new uploads are shown there only once
// they leave the draft, by being sent or kept with "Only upload media". Until then they are hidden, which
// also keeps them from being picked a second time. The same goes for the attachments of a message being edited.
function isUnsentDraftFile(mediaId) {
    return selectedAttachments.some(a => !a.fromRecents && isSameMediaId(a.uploadedId, mediaId));
}

function visibleRecentMediaItems() {
    return recentMediaItems.filter(m => !isUnsentDraftFile(m.id));
}

// Fetches Recents again after files leave the draft, if the list is loaded. Otherwise it is fetched when Recents opens.
async function refreshRecents() {
    if (!isRecentsPanelOpen) return;
    const itemsRow = document.querySelector('.media-panel-items-row');
    const savedScroll = activeMediaTab === 'recents' && itemsRow ? itemsRow.scrollLeft : 0;
    recentMediaItems = [];
    hasMoreRecents = true;
    await loadMoreRecents();
    renderMediaPanel();
    if (activeMediaTab === 'recents') {
        const newItemsRow = document.querySelector('.media-panel-items-row');
        if (newItemsRow) newItemsRow.scrollLeft = savedScroll;
    }
}

// Media picked in Recents becomes an attachment, so it can be reordered or removed in the Attachments tab.
// The same file can also be in the draft as a fresh upload, so attachments are matched by their uploaded id.
// Fresh uploads keep the lowercase id generated in the browser, while the server returns ids in uppercase,
// so the ids are compared without regard to case.
function isSameMediaId(a, b) {
    return !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();
}

function isRecentMediaAttached(mediaId) {
    return selectedAttachments.some(a => isSameMediaId(a.uploadedId, mediaId));
}

function toggleRecentMediaSelection(mediaId) {
    if (isRecentMediaAttached(mediaId)) {
        // Unpicking only takes the file out of the draft; it stays in Recents.
        selectedAttachments = selectedAttachments.filter(a => !isSameMediaId(a.uploadedId, mediaId));
    } else {
        if (selectedAttachments.length >= MAX_ATTACHMENTS) {
            alert(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
            return;
        }
        const media = recentMediaItems.find(m => m.id === mediaId);
        if (!media) return;
        selectedAttachments.push(recentMediaToAttachment(media));
    }
    // Save scroll position before full re-render
    const itemsRow = document.querySelector('.media-panel-items-row');
    const savedScroll = itemsRow ? itemsRow.scrollLeft : 0;
    renderMediaPanel(); // Update the selection marks and the Attachments tab
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
        // The file is gone from the server, so it can no longer be attached either.
        selectedAttachments = selectedAttachments.filter(a => !isSameMediaId(a.uploadedId, mediaId));
        renderMediaPanel();
        updateSendButtonState();
    } catch (e) {
        console.error('Failed to delete media:', e);
    }
}

// Turns a Recents item into an attachment. The file is already on the server, so it is ready to send.
function recentMediaToAttachment(media) {
    const isVideo = /^(mp4|webm|mov)$/i.test(media.fileType);
    const extension = media.fileType.toLowerCase();
    const mimeType = isVideo
        ? `video/${extension}`
        : `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return {
        id: crypto.randomUUID(),
        uploadedId: media.id,
        fileType: media.fileType,
        file: { size: media.fileSize, type: mimeType },
        preview: isVideo ? getVideoPreviewUrl(media.id) : getPreviewUrl(media.id, media.fileType),
        uploaded: true,
        previewWidth: media.previewWidth,
        previewHeight: media.previewHeight,
        duration: media.duration || null,
        fromRecents: true
    };
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
    
    const newAttachments = filesToAdd.map(file => ({
        id: crypto.randomUUID(),
        file: file,
        uploaded: false,
        uploadProgress: 0,
        uploading: false
    }));
    selectedAttachments.push(...newAttachments);
    
    activeMediaTab = 'attachments';
    updateAttachmentPreview();
    updateSendButtonState();
    
    // Upload the new files with a short delay between each to avoid connection saturation.
    // Only the files added here are queued, so attachments picked from Recents don't hold the queue up.
    (async () => {
        for (let i = 0; i < newAttachments.length; i++) {
            const attachment = newAttachments[i];
            // Skip files the user removed from the draft while they were waiting.
            if (!selectedAttachments.includes(attachment) && !attachment.keepInRecents) continue;

            uploadAttachment(attachment);

            // Add delay before next upload (except for last one)
            if (i < newAttachments.length - 1) {
                await delay(500);
            }
        }
    })();

    // Reset input
    event.target.value = '';
}

// Deletes a discarded attachment's file from the server. Once it was saved to Recent Uploads,
// it is deleted as media, which also removes it from there.
async function deleteUploadedAttachment(attachment) {
    if (attachment.savedToRecents) {
        await apiDeleteMedia(attachment.uploadedId);
    } else {
        await apiDeleteUpload(`${attachment.uploadedId}.${attachment.fileType}`);
    }
}

// Clear all attachments (cancel uploads, delete uploaded files, reset state)
function clearAllAttachments() {
    selectedAttachments.forEach(async (attachment) => {
        // Cancel uploads if in progress
        const upload = attachmentUploads.get(attachment.id);
        if (upload && upload.xhr) {
            upload.xhr.abort();
        }
        
        // Delete uploaded files from server (but not if editing existing message, or if the file was picked from Recents)
        if (attachment.uploaded && attachment.uploadedId && attachment.fileType && !attachment.fromRecents && !editingMessage) {
            try {
                await deleteUploadedAttachment(attachment);
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
        
        // Add the file to Recent Uploads right away, so it can be found there even if it is never sent.
        // Without this record the file would still upload and send fine, so a failure here is only logged.
        try {
            await apiSaveMedia({
                id: uploadedFileId,
                fileType: uploadedFileType,
                fileSize: attachment.file.size,
                previewWidth,
                previewHeight,
                duration
            });
            attachment.savedToRecents = true;
        } catch (error) {
            console.error('Error saving uploaded file to recents:', error);
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
        // The user chose to only upload this file while it was still uploading; it is no longer part of the draft,
        // so it now belongs in Recents.
        if (attachment.keepInRecents) {
            refreshRecents();
            return;
        }
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
    // Files picked from Recents stay there; they are only taken out of the draft.
    if (attachment.uploaded && attachment.uploadedId && attachment.fileType && !attachment.fromRecents && !editingMessage) {
        try {
            await deleteUploadedAttachment(attachment);
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

        // Show send button if text is present OR any attachment exists (even uploading)
        if (hasText || hasAnyAttachment) {
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
    const messageInputContainer = document.getElementById('messageInputContainer');
    const messageInputRow = messageInputContainer?.querySelector('.message-input-row');
    const messageInputFormatButtons = document.getElementById('messageInputFormatButtons');
    const messageInputBoldButton = document.getElementById('messageInputBoldButton');
    const messageInputItalicButton = document.getElementById('messageInputItalicButton');
    const messageInputStrikeButton = document.getElementById('messageInputStrikeButton');
    const messageInputLinkButton = document.getElementById('messageInputLinkButton');
    const attachButton = document.getElementById('attachButton');
    const sendButton = document.getElementById('sendButton');
    const messageInputFormatting = createMessageInputFormattingController({
        messageInput,
        messageInputFormatButtons,
        messageInputBoldButton,
        messageInputItalicButton,
        messageInputStrikeButton,
        messageInputLinkButton,
        attachButton
    });
    let preferredHeight = null;
    let isResizingInput = false;
    let resizeStartY = 0;
    let resizeStartHeight = 0;

    function getMessageInputMinHeight() {
        const minHeight = parseFloat(window.getComputedStyle(messageInput).minHeight);
        return Number.isFinite(minHeight) ? minHeight : 40;
    }

    function getMessageInputMaxHeight() {
        return Math.max(getMessageInputMinHeight(), Math.floor(window.innerHeight * 0.5));
    }

    function updateMessageInputLayoutState() {
        if (!messageInputRow) return;

        const isExpanded = messageInput.getBoundingClientRect().height > getMessageInputMinHeight() + 1;
        messageInputRow.classList.toggle('is-expanded', isExpanded);
    }

    function applyMessageInputHeight(height) {
        const clampedHeight = Math.min(Math.max(height, getMessageInputMinHeight()), getMessageInputMaxHeight());
        messageInput.style.height = clampedHeight + 'px';
        return clampedHeight;
    }

    function resetMessageInputHeight() {
        messageInput.style.height = 'auto';
        const naturalHeight = Math.max(messageInput.scrollHeight, preferredHeight ?? 0, getMessageInputMinHeight());
        applyMessageInputHeight(naturalHeight);
    }

    function resetMessageInputToDefaultHeight() {
        preferredHeight = null;
        resetMessageInputHeight();
        updateMessageInputLayoutState();
        messageInputFormatting.updateMessageInputFormattingButtons();
        messageInputFormatting.updateMessageInputFormatButtonStates();
        updateSendButtonState();
    }
    
    function adjustHeight() {
        resetMessageInputHeight();
        updateMessageInputLayoutState();
        messageInputFormatting.updateMessageInputFormattingButtons();
        messageInputFormatting.updateMessageInputFormatButtonStates();
        
        // Update send button state
        updateSendButtonState();
    }

    function syncResizeCursor(clientY) {
        if (!messageInputContainer || isResizingInput) return;

        const resizeHotspotHeight = 12;
        const rect = messageInputContainer.getBoundingClientRect();
        const isInTopResizeZone = clientY >= rect.top && clientY <= rect.top + resizeHotspotHeight;
        messageInputContainer.style.cursor = isInTopResizeZone ? 'ns-resize' : '';
    }

    function stopInputResize() {
        if (!isResizingInput) return;

        isResizingInput = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        syncResizeCursor(-1);
    }

    function handleInputResize(event) {
        if (!isResizingInput) return;

        const nextHeight = resizeStartHeight + (resizeStartY - event.clientY);
        preferredHeight = applyMessageInputHeight(nextHeight);
        updateMessageInputLayoutState();
        messageInputFormatting.updateMessageInputFormattingButtons();
        updateSendButtonState();
    }

    function startInputResize(event) {
        if (!messageInputContainer || event.button !== 0) return;

        const resizeHotspotHeight = 12;
        const rect = messageInputContainer.getBoundingClientRect();
        const isInTopResizeZone = event.clientY >= rect.top && event.clientY <= rect.top + resizeHotspotHeight;
        if (!isInTopResizeZone) return;

        isResizingInput = true;
        resizeStartY = event.clientY;
        resizeStartHeight = messageInput.getBoundingClientRect().height;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        event.preventDefault();
    }

    function resetInputResizeToContent(event) {
        if (!messageInputContainer) return;

        const resizeHotspotHeight = 12;
        const rect = messageInputContainer.getBoundingClientRect();
        const isInTopResizeZone = event.clientY >= rect.top && event.clientY <= rect.top + resizeHotspotHeight;
        if (!isInTopResizeZone) return;

        const formattingRevealHeight = messageInputFormatting.getMessageInputFormattingRevealHeight();
        const isEmpty = !messageInput.value.trim();
        const shouldExpandToFormatting = isEmpty
            && Number.isFinite(formattingRevealHeight)
            && messageInput.getBoundingClientRect().height + 1 < formattingRevealHeight;

        preferredHeight = shouldExpandToFormatting ? formattingRevealHeight : null;
        adjustHeight();
        event.preventDefault();
    }

    messageInput._resetToDefaultHeight = resetMessageInputToDefaultHeight;
    
    messageInput.addEventListener('input', adjustHeight);
    messageInput.addEventListener('click', messageInputFormatting.queueMessageInputFormatButtonStateUpdate);
    messageInput.addEventListener('focus', messageInputFormatting.queueMessageInputFormatButtonStateUpdate);
    messageInput.addEventListener('keyup', messageInputFormatting.queueMessageInputFormatButtonStateUpdate);
    messageInput.addEventListener('mouseup', messageInputFormatting.queueMessageInputFormatButtonStateUpdate);
    messageInput.addEventListener('select', messageInputFormatting.queueMessageInputFormatButtonStateUpdate);

    if (messageInputContainer) {
        messageInputContainer.addEventListener('mousemove', (event) => syncResizeCursor(event.clientY));
        messageInputContainer.addEventListener('mouseleave', () => syncResizeCursor(-1));
        messageInputContainer.addEventListener('mousedown', startInputResize);
        messageInputContainer.addEventListener('dblclick', resetInputResizeToContent);
        document.addEventListener('mousemove', handleInputResize);
        document.addEventListener('mouseup', stopInputResize);
    }

    document.addEventListener('selectionchange', () => {
        if (document.activeElement === messageInput) {
            messageInputFormatting.updateMessageInputFormatButtonStates();
        }
    });

    window.addEventListener('resize', adjustHeight);
    
    messageInput.addEventListener('focus', function() {
        // Mark chat as read when message input is focused
        if (currentChatId) {
            markChatAsRead(currentChatId);
        }
    });
    
    // This is set when Esc is pressed on long text, and the confirmation is shown once Esc is released.
    let pendingEscapeDiscardConfirmation = false;

    messageInput.addEventListener('keyup', function(e) {
        if (e.key !== 'Escape' || !pendingEscapeDiscardConfirmation) return;
        pendingEscapeDiscardConfirmation = false;

        // The dialog is opened only after the key is released. If it opened while Esc was still held down,
        // the browser would pass that same key press to the dialog and cancel it immediately.
        setTimeout(() => {
            if (this.value.length >= 100 && confirm('Discard the message you are typing?')) {
                this.value = '';
                resetMessageInputToDefaultHeight();
            }
        }, 0);
    });

    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            
            // Priority 1: Clear text if there's any.
            // Short text is cleared right away, but longer text needs confirmation so it isn't lost by accident.
            if (this.value.trim()) {
                if (this.value.length >= 100) {
                    // Stop other Escape handlers from acting while the confirmation is pending.
                    e.stopPropagation();
                    if (!e.repeat) {
                        pendingEscapeDiscardConfirmation = true;
                    }
                    return;
                }
                this.value = '';
                resetMessageInputToDefaultHeight();
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
                    resetMessageInputToDefaultHeight();
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
// ── Personal note language ──────────────────────────────────────────────────

let composeLanguageCode = null; // initialized from the journal default language on first use, resets on refresh

// Shows the language toolbar button for personal notes; hides it for other chats
function updateComposeLanguageControl(chat) {
    const button = document.getElementById('messageLanguageButton');
    if (!button) return;
    if (!chat || !isPersonalNotes(chat) || !getJournalMultilingualSetting()) {
        button.style.display = 'none';
        return;
    }
    button.textContent = getSavedComposeLanguageCode() || 'A';
    button.style.display = '';
}

// Returns the selected compose language code if it is among the journal's supported languages
function getSavedComposeLanguageCode() {
    if (composeLanguageCode === null) {
        composeLanguageCode = getJournalLanguageSetting();
    }
    return getJournalLanguagesSetting().some(language => language.code === composeLanguageCode) ? composeLanguageCode : '';
}

function showComposeLanguageMenu(event) {
    event.stopPropagation();
    const button = document.getElementById('messageLanguageButton');
    if (!button) return;

    const selectedCode = getSavedComposeLanguageCode();
    const items = [
        { id: 'none', label: '—', icon: selectedCode === '' ? checkIcon : blankIcon },
        ...getJournalLanguagesSetting().map(language => ({
            id: language.code,
            label: Language.displayedName(language),
            icon: language.code === selectedCode ? checkIcon : blankIcon
        }))
    ];

    const rect = button.getBoundingClientRect();
    showContextMenu({
        items,
        x: rect.left,
        y: rect.top - 6,
        anchor: 'bottom-left',
        highlightElement: button,
        onAction: (action) => {
            composeLanguageCode = action === 'none' ? '' : action;
            button.textContent = composeLanguageCode || 'A';
        }
    });
}

// Returns the selected compose language code for the current chat, or null (regular chats are language agnostic)
function getComposeLanguage() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat || !isPersonalNotes(chat)) return null;
    return getSavedComposeLanguageCode() || null;
}

// With uploaded files and no text, the send button asks whether to send the files as a message
// or only to upload them, so they wait in Recent Uploads to be attached later.
function handleSendButtonClick(event) {
    const messageInput = getMessageInputElement();
    const hasText = !!messageInput?.value.trim();
    // "Only upload media" means nothing for files picked from Recents, which are already uploaded,
    // so the choice is offered only when there are new uploads in the draft.
    const hasNewUploads = selectedAttachments.some(a => !a.fromRecents);
    if (hasText || editingMessage || !hasNewUploads) {
        sendMessage();
        return;
    }

    event?.stopPropagation();
    const button = document.getElementById('sendButton');
    const rect = button.getBoundingClientRect();
    showContextMenu({
        items: [
            { id: 'send', label: 'Send without text', icon: sendIcon },
            { id: 'upload', label: 'Only upload media', icon: uploadIcon }
        ],
        x: rect.right,
        y: rect.top - 6,
        anchor: 'bottom-right',
        highlightElement: button,
        onAction: (action) => {
            if (action === 'send') {
                sendMessage();
            } else if (action === 'upload') {
                saveAttachments();
            }
        }
    });
}

// Takes the uploaded files out of the draft without sending them. Every attachment is saved to
// Recent Uploads as soon as it is uploaded, so they can be attached later from there.
// Files that are still uploading finish in the background and show up there once they are done.
function saveAttachments() {
    const attachments = selectedAttachments;
    selectedAttachments = [];
    attachmentUploads.clear();
    hasConfirmedSendWithUploading = false;

    for (const attachment of attachments) {
        attachment.keepInRecents = true;
        // Files waiting in the upload queue would otherwise never be uploaded, because the queue walks the draft's list.
        if (!attachment.uploaded) {
            uploadAttachment(attachment);
        }
    }

    updateAttachmentPreview();
    updateSendButtonState();
    // Files that are still uploading refresh Recents again when they finish.
    refreshRecents();
}

async function sendMessage(textOverride = null) {
    const messageInput = getMessageInputElement();
    const text = textOverride !== null ? textOverride.trim() : messageInput.value.trim();
    
    if (!text && selectedAttachments.length === 0) return;
    if (!currentChatId || !currentUser || !currentUser.info.id) return;

    // Only send attachments that are ready, in the order the user arranged them.
    // Media picked from Recents is always ready.
    const uploadedAttachments = selectedAttachments.filter(a => a.uploaded);
    const pendingCount = selectedAttachments.filter(a => !a.uploaded).length;
    const allReadyAttachments = uploadedAttachments;

    // If some attachments are still uploading, ask the user before proceeding
    if (pendingCount > 0) {
        const readyCount = uploadedAttachments.length;
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

    // Check if we're editing a message
    if (editingMessage) {
        await updateMessage(editingMessage, text, allReadyAttachments);
        return;
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

    const composeLanguage = getComposeLanguage();
    if (composeLanguage) {
        message.language = composeLanguage;
    }

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
        // Close recents
        isRecentsPanelOpen = false;
        if (selectedAttachments.length === 0) {
            attachmentUploads.clear();
        }
        renderMediaPanel();
    }
    
    // Reset the input after sending when we're using the live textarea.
    if (textOverride === null && messageInput) {
        messageInput.value = '';
        messageInput._resetToDefaultHeight?.();
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

    if (shouldSendAttachments) {
        refreshRecents();
    }

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

    if (uploadedAttachments.length > 0) {
        refreshRecents();
    }
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
    
    const chat = chats.find(c => c.id === currentChatId);
    const isPersonalNote = isPersonalNotes(chat);
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
    const chat = chats.find(c => c.id === currentChatId);
    if (isPersonalNotes(chat) && message.id) {
        const publishIcon = bookmarkIcon;
        if (message.note) {
            menuItems.push({ id: message.note.isPinned ? 'unpin' : 'pin', label: message.note.isPinned ? 'Unpin' : 'Pin', icon: pinIcon });
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
        case 'pin':
            pinNote(message);
            break;
        case 'unpin':
            unpinNote(message);
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
            let previewUrl = null;
            if (att.fileType) {
                const fileTypeExt = att.fileType.toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileTypeExt)) {
                    mimeType = `image/${fileTypeExt === 'jpg' ? 'jpeg' : fileTypeExt}`;
                    previewUrl = getPreviewUrl(att.id, att.fileType);
                } else if (['mp4', 'webm', 'mov'].includes(fileTypeExt)) {
                    mimeType = `video/${fileTypeExt}`;
                    previewUrl = getVideoPreviewUrl(att.id);
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
                preview: att.id ? previewUrl : null,
                uploaded: true,
                previewWidth: att.previewWidth,
                previewHeight: att.previewHeight
            };
        });
        // Open the panel on the message's attachments, even if Recents was the last tab shown.
        activeMediaTab = 'attachments';
        isUploadPanelCollapsed = false;
        updateAttachmentPreview();
    }
    
    // Fill input with message text
    messageInput.value = message.text || '';
    messageInput.dispatchEvent(new Event('input'));
    
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
    messageInput._resetToDefaultHeight?.();
    
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
        const chat = chats.find(c => c.id === currentChatId);
        const isPersonalNote = isPersonalNotes(chat);
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
        const chat = chats.find(c => c.id === currentChatId);
        const isPersonalNote = isPersonalNotes(chat);
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
            message.replyTo || null,
            message.language || null
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
        if (Array.isArray(message.attachments)) {
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
        message.note = result;
        replaceMessageElement(message.localId ?? message.id, message, false);
        console.log('Note published:', message.id);
    } catch (error) {
        console.error('Failed to publish note:', error);
    }
}

// Pin a published personal note
async function pinNote(message) {
    if (!message.note?.id) return;
    try {
        message.note = await apiPinNote(message.note.id);
        replaceMessageElement(message.localId ?? message.id, message, false);
        console.log('Note pinned:', message.id);
    } catch (error) {
        console.error('Failed to pin note:', error);
        alert(apiErrorReason(error));
    }
}

// Unpin a published personal note
async function unpinNote(message) {
    if (!message.note?.id) return;
    try {
        message.note = await apiUnpinNote(message.note.id);
        replaceMessageElement(message.localId ?? message.id, message, false);
        console.log('Note unpinned:', message.id);
    } catch (error) {
        console.error('Failed to unpin note:', error);
    }
}

// Unpublish a personal note message
async function unpublishNote(message) {
    if (!message.id) return;
    try {
        await apiUnpublishNote(message.id);
        message.note = null;
        replaceMessageElement(message.localId ?? message.id, message, false);
        console.log('Note unpublished:', message.id);
    } catch (error) {
        console.error('Failed to unpublish note:', error);
    }
}