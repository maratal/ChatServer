// Notes Page - Public notes viewer

// Global currentUser for API auth (set by detectOwnership if user is logged in)
var currentUser = null;

const NOTES_PAGE_SIZE = 20;
let notesOldestId = null;
let isLoadingNotes = false;
let allNotesLoaded = false;
let notesPageIsOwner = false;
let notesInfoModalStack = [];

// ── Initialization ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    detectOwnership();
    initializeSidebarNotesInfo();
    initializeHeader();
    restoreSidebarState();
    loadNotes();
    setupScrollPagination();
});

function getNotesUserInfoTitle(fullName) {
    if (!fullName) return 'Notes';
    const firstName = fullName.split(/\s+/)[0];
    if (firstName.length > 12) return 'Notes';
    return `${firstName}'s Notes`;
}

function detectOwnership() {
    try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.info && parsed.info.id === pageUserId && parsed.session && parsed.session.accessToken) {
                notesPageIsOwner = true;
                currentUser = parsed;
            }
        }
    } catch (error) {
        // Not logged in or invalid data
    }
}

function initializeSidebarNotesInfo() {
    const titleElement = document.getElementById('notesSidebarTitle');
    const body = document.getElementById('notesSidebarBody');
    if (!body) return;

    const notesTitle = pageNotesTitle || getNotesUserInfoTitle(pageUserName);
    if (titleElement) titleElement.textContent = 'Journal';

    const notesImage = pageNotesImages && pageNotesImages.length > 0 ? pageNotesImages[0] : null;
    const avatarColor = getAvatarColorForUser(`group_notes_${pageUserId}`);
    const photoUrl = notesImage ? getPreviewUrl(notesImage.id, notesImage.fileType) : null;
    const createdDate = pageNotesCreatedAt ? new Date(pageNotesCreatedAt * 1000).toLocaleDateString() : null;
    const description = pageNotesDescription || '';

    let html = '';

    // Notes avatar
    html += `
        <div class="user-info-avatar-container">
            <div class="user-info-avatar-wrapper">
                <div class="user-info-avatar" id="notesSidebarAvatar"${photoUrl ? ' style="cursor: pointer;"' : ''}>
                    ${photoUrl ? `<img src="${photoUrl}" alt="">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(notesTitle)}</span>`}
                </div>
            </div>
        </div>
        <div class="user-info-name">${escapeHtml(notesTitle)}</div>
    `;

    // Information section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Information</div>
            <div class="user-info-meta">
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294l2.952-5.605z"></path>
                    </svg>
                    <span>Author: <a href="javascript:void(0)" class="info-link" onclick="showNotesUserInfo()">${escapeHtml(pageUserName)}</a></span>
                </div>
                ${createdDate ? `
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                        <line x1="16" x2="16" y1="2" y2="6"></line>
                        <line x1="8" x2="8" y1="2" y2="6"></line>
                        <line x1="3" x2="21" y1="10" y2="10"></line>
                    </svg>
                    <span>Since: ${escapeHtml(createdDate)}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    // Description section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Description</div>
            <div class="user-info-about ${description ? '' : 'empty'}">
                ${description ? escapeHtml(description) : 'No description'}
            </div>
        </div>
    `;

    body.innerHTML = html;

    // Avatar click → open image viewer if has photo
    if (photoUrl) {
        const avatar = document.getElementById('notesSidebarAvatar');
        if (avatar) {
            avatar.addEventListener('click', () => {
                const mediaPhotos = pageNotesImages.map(image => ({ id: image.id, fileType: image.fileType }));
                openMediaViewer(mediaPhotos, 0);
            });
        }
    }
}

function initializeHeader() {
    const titleElement = document.getElementById('notesHeaderTitle');
    const subtitleElement = document.getElementById('notesHeaderSubtitle');

    // Title
    const notesTitle = pageNotesTitle || getNotesUserInfoTitle(pageUserName);
    titleElement.textContent = notesTitle;

    // Subtitle: "Since <year>"
    if (pageNotesCreatedAt) {
        const createdDate = new Date(pageNotesCreatedAt * 1000);
        const year = createdDate.getFullYear();
        subtitleElement.textContent = `Since ${year}`;
    }

    // Left avatar — notes avatar, hidden initially, shown when sidebar is closed
    const leftAvatarContainer = document.getElementById('notesHeaderLeftAvatar');
    const notesImage = pageNotesImages && pageNotesImages.length > 0 ? pageNotesImages[0] : null;
    if (notesImage && notesImage.id && notesImage.fileType) {
        leftAvatarContainer.innerHTML = `<img src="${getPreviewUrl(notesImage.id, notesImage.fileType)}" alt="">`;
    } else {
        const color = getAvatarColorForUser(`group_notes_${pageUserId}`);
        leftAvatarContainer.innerHTML = `<span class="avatar-initials" style="color: ${color.text}; background-color: ${color.background}; font-size: 0.875rem; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">${getInitials(notesTitle)}</span>`;
    }
}

// ── Notes Loading ───────────────────────────────────────────────────────────

async function loadNotes() {
    if (isLoadingNotes || allNotesLoaded) return;
    isLoadingNotes = true;

    const container = document.getElementById('notesContainer');

    try {
        const notes = await apiGetUserNotes(pageUserId, NOTES_PAGE_SIZE, notesOldestId);

        if (notes.length === 0) {
            if (!notesOldestId) {
                // First load, no notes at all — ensure placeholder is visible
                const placeholder = document.getElementById('emptyPlaceholder');
                if (!placeholder) {
                    container.innerHTML = '<div class="no-messages" id="emptyPlaceholder">No published notes yet</div>';
                }
            }
            allNotesLoaded = true;
            isLoadingNotes = false;
            return;
        }

        // Remove placeholder since we have notes (must remove, not hide, so :has(.no-messages) stops matching)
        const existingPlaceholder = document.getElementById('emptyPlaceholder');
        if (existingPlaceholder) existingPlaceholder.remove();

        // Render notes
        for (const note of notes) {
            const noteElement = createNoteElement(note);
            if (noteElement) {
                container.appendChild(noteElement);
            }
        }

        // Update cursor for pagination
        const lastNote = notes[notes.length - 1];
        notesOldestId = lastNote.id;

        if (notes.length < NOTES_PAGE_SIZE) {
            allNotesLoaded = true;
        }
    } catch (error) {
        console.error('Failed to load notes:', error);
        if (!notesOldestId) {
            placeholder.textContent = 'Failed to load notes';
        }
    }

    isLoadingNotes = false;
}

function setupScrollPagination() {
    const scrollWrapper = document.getElementById('notesScrollWrapper');
    scrollWrapper.addEventListener('scroll', () => {
        if (allNotesLoaded || isLoadingNotes) return;
        const threshold = 200;
        if (scrollWrapper.scrollTop + scrollWrapper.clientHeight >= scrollWrapper.scrollHeight - threshold) {
            loadNotes();
        }
    });
}

// ── Note Rendering ──────────────────────────────────────────────────────────

function createNoteElement(note) {
    const message = note.message;
    if (!message) return null;

    const noteDiv = document.createElement('div');
    noteDiv.className = 'personal-note-row';
    noteDiv.dataset.noteId = note.id;

    const normalizedDate = normalizeTimestamp(note.createdAt ?? message.createdAt);
    noteDiv.dataset.createdAt = normalizedDate.toISOString();
    if (message.id) noteDiv.dataset.messageId = message.id;

    const fullDateTime = formatFullDateTime(normalizedDate);
    const messageTime = normalizedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateGroupText = formatChatGroupingDate(normalizedDate);
    const dateHeaderText = `${dateGroupText}, ${messageTime}`;

    const hasAttachments = message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0;
    const messageId = message.id || note.id;
    const attachmentHTML = hasAttachments ? buildAttachmentHTML(message.attachments, messageId, '') : '';

    if (hasAttachments && attachmentHTML) {
        const validAttachments = message.attachments.filter(attachment => attachment && attachment.id && attachment.fileType);
        if (validAttachments.length > 0) {
            noteDiv.dataset.attachments = JSON.stringify(validAttachments);
            noteDiv.dataset.currentAttachmentIndex = '0';
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
    if (hasAttachments && attachmentHTML) {
        innerHTML = `<div class="message-content has-attachment">
            ${rawText ? `
                <div class="personal-note-body-wrapper">
                    ${hasTitle ? `<div class="personal-note-title">${formatMessageText(firstLine)}</div>` : ''}
                    <div class="personal-note-body">${formatMessageText(hasTitle ? bodyText : rawText)}</div>
                </div>
            ` : ''}
            ${attachmentHTML}
        </div>`;
    } else if (rawText) {
        innerHTML = `<div class="message-text-container personal-note-text-container">
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

    // Owner sees context menu on long press
    if (notesPageIsOwner) {
        addLongPressHandler(noteDiv, {
            onLongPress: (event) => {
                showNoteContextMenu(event, noteDiv, note, message);
            },
            excludeSelectors: ['.personal-note-bubble'],
            duration: 300,
            maxMovement: 10
        });
    }

    return noteDiv;
}

// ── Owner Context Menu ──────────────────────────────────────────────────────

function showNoteContextMenu(event, noteDiv, note, message) {
    const menuItems = [];

    if (message.text && message.text.trim().length > 0) {
        menuItems.push({ id: 'copy', label: 'Copy Text', icon: copyIcon });
    }

    menuItems.push({ id: 'unpublish', label: 'Unpublish', icon: bookmarkIcon });

    showContextMenu({
        items: menuItems,
        x: event.clientX,
        y: event.clientY,
        highlightElement: noteDiv.querySelector('.message-row-content'),
        highlightClass: 'menu-active',
        onAction: (action) => {
            handleNoteContextAction(action, note, message, noteDiv);
        }
    });
}

async function handleNoteContextAction(action, note, message, noteDiv) {
    switch (action) {
        case 'copy':
            if (message.text) {
                try {
                    await navigator.clipboard.writeText(message.text);
                } catch (error) {
                    console.error('Failed to copy text:', error);
                }
            }
            break;
        case 'unpublish':
            try {
                await apiUnpublishNote(message.id);
                noteDiv.remove();
                // Show placeholder if no notes left
                const container = document.getElementById('notesContainer');
                const remaining = container.querySelectorAll('.personal-note-row');
                if (remaining.length === 0) {
                    container.innerHTML = '<div class="no-messages" id="emptyPlaceholder">No published notes yet</div>';
                }
            } catch (error) {
                console.error('Failed to unpublish note:', error);
            }
            break;
    }
}

// ── Notes Info Panel ────────────────────────────────────────────────────────

function openNotesInfoPanel() {
    const modalId = 'notesPageInfoModal';
    // Don't open if already open
    if (document.getElementById(modalId)) return;

    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.className = 'user-info-modal';
    modalElement.style.zIndex = 1000 + notesInfoModalStack.length * 10;

    modalElement.innerHTML = `
        <div class="user-info-content">
            <div class="user-info-header">
                <div></div>
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="inline-button" onclick="closeNotesInfoPanel()">
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
            closeNotesInfoPanel();
        }
    });

    modalElement.style.display = 'block';
    modalElement.offsetHeight;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modalElement.classList.add('show');
        });
    });

    notesInfoModalStack.push(modalElement);
    displayNotesPageInfoPanel(modalId + '_body');
}

function closeNotesInfoPanel() {
    const modalElement = notesInfoModalStack.pop();
    if (!modalElement) return;

    modalElement.classList.remove('show');
    setTimeout(() => {
        modalElement.remove();
    }, 300);
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const viewer = document.getElementById('mediaViewer');
        if (viewer) return;

        if (notesInfoModalStack.length > 0) {
            closeNotesInfoPanel();
            return;
        }
    }
});

function displayNotesPageInfoPanel(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;

    const notesTitle = pageNotesTitle || getNotesUserInfoTitle(pageUserName);
    const photos = pageUserPhotos || [];
    const authorPhoto = photos.length > 0 ? photos[0] : null;
    const avatarColor = getAvatarColorForUser(pageUserId);
    const photoUrl = authorPhoto ? getPreviewUrl(authorPhoto.id, authorPhoto.fileType) : null;
    const createdDate = pageNotesCreatedAt ? new Date(pageNotesCreatedAt * 1000).toLocaleDateString() : null;
    const description = pageNotesDescription || '';

    let html = '';

    // Avatar — author's avatar
    html += `
        <div class="user-info-avatar-container">
            <div class="user-info-avatar-wrapper">
                <div class="user-info-avatar" id="notesInfoAvatar" style="cursor: pointer;">
                    ${photoUrl ? `<img src="${photoUrl}" alt="">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(pageUserName)}</span>`}
                </div>
            </div>
        </div>
    `;

    // Title
    html += `<div class="user-info-name">${escapeHtml(notesTitle)}</div>`;

    // Information section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Information</div>
            <div class="user-info-meta">
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294l2.952-5.605z"></path>
                    </svg>
                    <span>Author: <a href="javascript:void(0)" class="info-link" onclick="showNotesUserInfo()">${escapeHtml(pageUserName)}</a></span>
                </div>
                ${createdDate ? `
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                        <line x1="16" x2="16" y1="2" y2="6"></line>
                        <line x1="8" x2="8" y1="2" y2="6"></line>
                        <line x1="3" x2="21" y1="10" y2="10"></line>
                    </svg>
                    <span>Since: ${escapeHtml(createdDate)}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    // Description section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Description</div>
            <div class="user-info-about ${description ? '' : 'empty'}">
                ${description ? escapeHtml(description) : 'No description'}
            </div>
        </div>
    `;

    body.innerHTML = html;

    // Avatar click → open user info
    const avatar = document.getElementById('notesInfoAvatar');
    if (avatar) {
        avatar.addEventListener('click', () => {
            showNotesUserInfo();
        });
    }
}

// ── Sidebar Toggle ──────────────────────────────────────────────────────────

function getSidebarStorageKey() {
    return `chatserver_journal_sidebar_closed_${pageUserId}`;
}

function restoreSidebarState() {
    const closed = localStorage.getItem(getSidebarStorageKey());
    if (closed === 'true') {
        closeNotesSidebar(false);
    }
}

function closeNotesSidebar(animate = true) {
    const sidebar = document.getElementById('notesSidebar');
    const leftAvatar = document.getElementById('notesHeaderLeftAvatar');
    const titleElement = document.getElementById('notesHeaderTitle');
    const subtitleElement = document.getElementById('notesHeaderSubtitle');

    if (sidebar) sidebar.style.display = 'none';
    if (leftAvatar) leftAvatar.style.display = '';
    localStorage.setItem(getSidebarStorageKey(), 'true');

    applyJournalTitleStyle(titleElement, subtitleElement, animate);
}

function openNotesSidebar() {
    const sidebar = document.getElementById('notesSidebar');
    const leftAvatar = document.getElementById('notesHeaderLeftAvatar');
    const titleElement = document.getElementById('notesHeaderTitle');
    const subtitleElement = document.getElementById('notesHeaderSubtitle');

    if (sidebar) sidebar.style.display = '';
    if (leftAvatar) leftAvatar.style.display = 'none';
    localStorage.setItem(getSidebarStorageKey(), 'false');

    resetJournalTitleStyle(titleElement, subtitleElement);
}

function applyJournalTitleStyle(titleElement, subtitleElement, animate) {
    const fontSetting = getJournalFontById(getJournalFontSetting());
    const sizeSetting = getJournalSizeById(getJournalSizeSetting());

    if (titleElement) {
        if (animate) {
            titleElement.style.transition = 'font-size 0.3s ease';
        } else {
            titleElement.style.transition = 'none';
        }
        titleElement.style.fontFamily = fontSetting.family;
        titleElement.style.fontSize = sizeSetting.size;
    }
    if (subtitleElement) {
        if (animate) {
            subtitleElement.style.transition = 'opacity 0.3s ease';
            subtitleElement.style.opacity = '0';
            setTimeout(() => {
                subtitleElement.style.display = 'none';
            }, 300);
        } else {
            subtitleElement.style.display = 'none';
        }
    }
}

function resetJournalTitleStyle(titleElement, subtitleElement) {
    if (titleElement) {
        titleElement.style.transition = 'font-size 0.3s ease';
        titleElement.style.fontFamily = '';
        titleElement.style.fontSize = '';
    }
    if (subtitleElement) {
        subtitleElement.style.display = '';
        subtitleElement.style.opacity = '0';
        subtitleElement.offsetHeight; // force reflow
        subtitleElement.style.transition = 'opacity 0.3s ease';
        subtitleElement.style.opacity = '';
    }
}

// ── User Info Modal ─────────────────────────────────────────────────────────

function showNotesUserInfo() {
    const modalId = `notesUserInfoModal_${pageUserId}`;
    if (document.getElementById(modalId)) return;

    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.className = 'user-info-modal notes-user-info-modal';
    modalElement.style.zIndex = 1100 + notesInfoModalStack.length * 10;

    modalElement.innerHTML = `
        <div class="user-info-content">
            <div class="user-info-header">
                <div></div>
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="inline-button" onclick="closeNotesUserInfo()">
                    ${closeIcon}
                </button>
            </div>
            <div class="user-info-body" id="${modalId}_body">
                <div class="user-info-loading">Loading user information...</div>
            </div>
        </div>
    `;

    document.body.appendChild(modalElement);

    modalElement.addEventListener('click', function(event) {
        if (event.target === modalElement) {
            closeNotesUserInfo();
        }
    });

    modalElement.style.display = 'block';
    modalElement.offsetHeight;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modalElement.classList.add('show');
        });
    });

    notesInfoModalStack.push(modalElement);

    displayUserInfo({
        id: pageUserId,
        name: pageUserName,
        username: pageUserUsername,
        about: pageUserAbout,
        photos: pageUserPhotos,
        lastSeen: pageUserLastSeen ? new Date(pageUserLastSeen * 1000).toISOString() : null
    }, `${modalId}_body`);
}

function closeNotesUserInfo() {
    const modalElement = notesInfoModalStack.pop();
    if (!modalElement) return;

    modalElement.classList.remove('show');
    setTimeout(() => {
        modalElement.remove();
    }, 300);
}
