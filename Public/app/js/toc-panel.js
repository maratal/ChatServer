// Table Of Contents panel, shared by the journal page and the Personal Notes chat,
// and the message search panel of the other chats, which works the same way.
//
// The panel slides in from the edge of the screen like the other info panels, and lists posts
// in a compact form, grouped by year, newest first. More posts are loaded page by page as the list is scrolled.
// In search-only mode (chat search) nothing is listed until something is typed.
//
// Typing in the search field filters the posts that are already loaded straight away.
// Once the search is at least TOC_SEARCH_MIN_LENGTH characters long, the server is asked for matches
// in the background, so that older posts which have not been loaded yet can be found as well.
// The request goes out only after a pause in typing: every keystroke within TOC_SEARCH_DELAY_MS
// of the previous one restarts the timer with the new search.

const TOC_PAGE_SIZE = 50;
const TOC_SEARCH_DELAY_MS = 1000;
const TOC_SEARCH_MIN_LENGTH = 2;
const TOC_SNIPPET_CONTEXT = 24; // How many characters to show before a match that is deep inside the body
const TOC_LINE_MAX_LENGTH = 256; // Longest text drawn in a row's title or text line
const TOC_ANIMATION_MS = 300; // Matches the slide transition of .user-info-content

let activeTocPanel = null;

// Opens the panel, or closes it when it is already open for the same button.
//
// options:
//   anchor        – the button that opens the panel
//   side          – 'right' (default) or 'left': the screen edge the panel slides in from
//   title         – the panel header, 'Contents' by default
//   noun          – what the items are called in placeholders and messages, 'posts' by default
//   searchOnly    – list nothing until something is typed, and never load pages without a search
//   getLocalItems – for searchOnly: returns the items that are already loaded on the page,
//                   so they can be filtered right away while the server is asked
//   fetchPage     – async ({ before, search, count }) => ({ items, nextCursor, done }),
//                   where `items` are made with createTocItem() or createMessageSearchItem()
//                   and `nextCursor` is passed back as `before` to get the following page
//   fetchPinned   – optional async () => items: the pinned posts, listed in their own section on top
//   onSelect      – called with the picked item after the panel has closed
//   onClose       – optional: called whenever the panel closes, whether or not an item was picked
//   presentation  – 'panel' (default) slides in from the screen edge; 'popup' shows the same search
//                   and list in a small floating popup instead, without dimming the rest of the page
//   popupClassName – for 'popup': extra classes for the popup element, to style it like its neighbours
//   positionPopup – for 'popup': (popupElement) => void, places the popup; called on open and on resize
function toggleTocPanel(options) {
    if (activeTocPanel) {
        const isSameAnchor = activeTocPanel.anchor === options.anchor;
        closeTocPanel();
        if (isSameAnchor) return;
    }
    openTocPanel(options);
}

function closeTocPanel() {
    const state = activeTocPanel;
    if (!state) return;
    activeTocPanel = null;

    clearTimeout(state.searchTimer);
    window.removeEventListener('keydown', state.onKeyDown, true);

    const modal = state.modal;
    if (state.isPopup) {
        document.removeEventListener('mousedown', state.onOutsideMouseDown);
        window.removeEventListener('resize', state.onResize);
        modal.remove();
    } else {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), TOC_ANIMATION_MS);
    }
    state.onClose?.();
}

// Closes the panel when its button lives inside `element`, which is about to go away.
function closeTocPanelIfInside(element) {
    if (activeTocPanel && element && element.contains(activeTocPanel.anchor)) {
        closeTocPanel();
    }
}

// Converts a post into the compact form shown in the panel: a single line with the post's title,
// or with its text when it has no title, the same way posts are shown in the chat.
// `text` may contain the app's inline formatting; it is reduced to plain text here.
function createTocItem({ id, createdAt, text, attachmentsCount = 0, isPinned = false, isPublished = false }) {
    const plainText = tocPlainText(text || '').trim();
    const firstNewlineIndex = plainText.indexOf('\n');
    const firstLine = (firstNewlineIndex >= 0 ? plainText.substring(0, firstNewlineIndex) : plainText).trim();
    const restText = firstNewlineIndex >= 0 ? plainText.substring(firstNewlineIndex + 1) : '';

    // Same rule as the post view: the first line is a title when more text follows it
    // and it isn't longer than one sentence
    const sentenceCount = (firstLine.match(/[.!?](\s|$)/g) || []).length;
    const hasTitle = firstNewlineIndex >= 0 && firstLine.length > 0 && sentenceCount <= 1;

    let title = hasTitle ? firstLine : plainText.replace(/\s+/g, ' ').trim();
    const body = hasTitle ? restText.replace(/\s+/g, ' ').trim() : '';
    let isPlaceholderTitle = false;
    if (!title) {
        isPlaceholderTitle = true;
        title = attachmentsCount > 1
            ? `${attachmentsCount} attachments`
            : attachmentsCount === 1 ? 'Attachment' : 'Empty post';
    }

    return {
        id: String(id),
        date: normalizeTimestamp(createdAt),
        title,
        body,
        isPlaceholderTitle,
        // Without a title the line is the whole text, so a search shows it around the match
        isTitleWholeText: !hasTitle && !isPlaceholderTitle,
        // The body is shown only while searching, to reveal a match that isn't in the line itself
        isBodyShownOnlyForMatches: true,
        // The beginning of the post, with its line breaks, shown when hovering the row
        tooltip: isPlaceholderTitle ? '' : tocLineText(plainText),
        isPinned,
        isPublished,
        searchText: `${isPlaceholderTitle ? '' : title}\n${body}`.toLowerCase()
    };
}

// Converts a chat message into the compact form shown in the search panel:
// the author on the first line and the text below. Only the text is searched.
function createMessageSearchItem({ id, createdAt, authorName, text, attachmentsCount = 0 }) {
    const body = tocPlainText(text || '').replace(/\s+/g, ' ').trim();
    const placeholder = attachmentsCount > 1
        ? `${attachmentsCount} attachments`
        : attachmentsCount === 1 ? 'Attachment' : 'Empty message';

    return {
        id: String(id),
        date: normalizeTimestamp(createdAt),
        title: authorName || 'Unknown',
        body: body || placeholder,
        isPlaceholderTitle: false,
        isPlaceholderBody: !body,
        isTitleSearchable: false,
        isPinned: false,
        isPublished: false,
        searchText: body.toLowerCase()
    };
}

// Strips the app's inline markup (embedded media tags, markdown links, bold, italic and strikethrough)
// so that titles and snippets read as plain text.
function tocPlainText(text) {
    return text
        .replace(/<(popup|embed)(\s+[^>]*)?>([\s\S]*?)<\/\1>/gi, (_match, tagName, _attributes, content) => {
            const media = typeof parseInlineMediaReference === 'function' ? parseInlineMediaReference(content) : null;
            if (tagName.toLowerCase() === 'embed') return '';
            return media?.label ?? content;
        })
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/(?<![\w*])_(.+?)_(?![\w*])/g, '$1');
}

function openTocPanel(options) {
    const side = options.side === 'left' ? 'left' : 'right';
    const title = options.title || 'Contents';
    const noun = options.noun || 'posts';
    const isPopup = options.presentation === 'popup';

    // The search field and the list are the same in both presentations
    const bodyHtml = `
            <div class="toc-search">
                <span class="toc-search-icon">${searchIcon}</span>
                <input type="text" class="toc-search-input" placeholder="Search ${escapeHtml(noun)}" autocomplete="off" spellcheck="false" aria-label="Search ${escapeHtml(noun)}">
                <button class="toc-search-clear" type="button" title="Clear search" hidden>${closeIcon}</button>
            </div>
            <div class="toc-list"></div>
    `;

    let modal;
    if (isPopup) {
        // In a popup the element is both the "modal" and the panel: there is no dimmed backdrop
        modal = document.createElement('div');
        modal.className = `toc-panel toc-popup ${options.popupClassName || ''}`.trim();
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', title);
        modal.innerHTML = `<div class="toc-popup-header">${escapeHtml(title)}</div>${bodyHtml}`;
    } else {
        modal = document.createElement('div');
        modal.className = `user-info-modal toc-modal toc-modal-${side}`;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', title);
        modal.style.zIndex = String(nextTocModalZIndex());
        modal.innerHTML = `
        <div class="user-info-content toc-panel">
            <div class="modal-panel-header">
                <h1 class="text-2xl font-bold text-sidebar-foreground">${escapeHtml(title)}</h1>
                <button class="inline-button toc-panel-close" type="button" title="Close">${closeIcon}</button>
            </div>
            ${bodyHtml}
        </div>
    `;
    }
    document.body.appendChild(modal);
    const panel = isPopup ? modal : modal.querySelector('.toc-panel');

    const state = {
        modal,
        panel,
        anchor: options.anchor,
        isPopup,
        positionPopup: options.positionPopup,
        onClose: options.onClose,
        noun,
        searchOnly: !!options.searchOnly,
        getLocalItems: options.getLocalItems,
        fetchPage: options.fetchPage,
        fetchPinned: options.searchOnly ? null : options.fetchPinned,
        onSelect: options.onSelect,
        list: panel.querySelector('.toc-list'),
        input: panel.querySelector('.toc-search-input'),
        clearButton: panel.querySelector('.toc-search-clear'),

        // Pinned posts, all loaded at once when the panel opens and shown above the years
        pinnedItems: [],

        // Posts loaded page by page without a search, newest first.
        // In search-only mode these are the items already loaded on the page, refreshed on every keystroke.
        items: [],
        cursor: null,
        isDone: false,
        isLoading: false,
        hasError: false,

        // Matches returned by the server for the current search
        query: '',
        searchItems: [],
        searchCursor: null,
        searchToken: 0,
        searchTimer: null,
        isSearchPending: false, // waiting for the typing pause before the request goes out
        isSearchStarted: false,
        isSearchDone: false,
        isSearchLoading: false,
        hasSearchError: false
    };
    activeTocPanel = state;

    if (isPopup) {
        // A click anywhere outside the popup closes it, except on the button that opened it,
        // which handles its own clicks
        state.onOutsideMouseDown = (event) => {
            if (modal.contains(event.target) || state.anchor?.contains(event.target)) return;
            closeTocPanel();
        };
        state.onResize = () => state.positionPopup?.(modal);
        // Wait for the click that opened the popup to finish before listening for clicks outside it
        setTimeout(() => {
            if (activeTocPanel === state) {
                document.addEventListener('mousedown', state.onOutsideMouseDown);
            }
        }, 0);
        window.addEventListener('resize', state.onResize);
    } else {
        // A click on the dimmed area outside the panel closes it, like the other info panels
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeTocPanel();
        });
    }
    state.onKeyDown = (event) => {
        if (event.key !== 'Escape') return;
        // Handled here in the capture phase so the panels underneath stay open
        event.preventDefault();
        event.stopPropagation();
        closeTocPanel();
    };
    window.addEventListener('keydown', state.onKeyDown, true);

    panel.querySelector('.toc-panel-close')?.addEventListener('click', () => closeTocPanel());
    state.input.addEventListener('input', () => handleTocSearchInput(state));
    state.input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            // Enter opens the first post in the list
            event.preventDefault();
            const firstItem = state.list.querySelector('.toc-item');
            if (firstItem) selectTocItem(state, firstItem.dataset.id);
        }
    });
    state.clearButton.addEventListener('click', () => {
        state.input.value = '';
        handleTocSearchInput(state);
        state.input.focus();
    });
    state.list.addEventListener('click', (event) => {
        const row = event.target.closest('.toc-item');
        if (row) selectTocItem(state, row.dataset.id);
    });
    state.list.addEventListener('scroll', () => {
        if (state.list.scrollTop + state.list.clientHeight >= state.list.scrollHeight - 200) {
            loadMoreTocItems(state);
        }
    });

    if (isPopup) {
        options.positionPopup?.(modal);
    } else {
        // Slide in the same way as the other info panels
        modal.style.display = 'block';
        modal.offsetHeight;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modal.classList.add('show');
            });
        });
    }

    renderTocList(state);
    loadTocPinnedItems(state);
    loadMoreTocItems(state);

    // Focusing would pop up the on-screen keyboard on phones, so only do it with a mouse or trackpad
    if (window.matchMedia?.('(pointer: fine)').matches) {
        state.input.focus();
    }
}

// Places the panel above any info panels that are already open
function nextTocModalZIndex() {
    let zIndex = 1000;
    document.querySelectorAll('.user-info-modal').forEach(element => {
        if (element.style.display === 'none' || getComputedStyle(element).display === 'none') return;
        const value = parseInt(getComputedStyle(element).zIndex, 10);
        if (!Number.isNaN(value)) zIndex = Math.max(zIndex, value + 10);
    });
    return zIndex;
}

function handleTocSearchInput(state) {
    const query = state.input.value.trim();
    state.clearButton.hidden = state.input.value.length === 0;
    if (query === state.query) return;

    const previousQuery = state.query;
    state.query = query;
    clearTimeout(state.searchTimer);

    if (state.searchOnly) {
        // Pick up messages that were loaded or changed since the last keystroke
        state.items = state.getLocalItems?.() ?? [];
    }

    // Results for a shorter query stay useful while the server works on the longer one,
    // because the local filter narrows them down to what still matches
    if (!query || !query.toLowerCase().includes(previousQuery.toLowerCase())) {
        state.searchItems = [];
    }
    state.searchToken++;
    state.searchCursor = null;
    state.isSearchStarted = false;
    state.isSearchDone = false;
    state.isSearchLoading = false;
    state.hasSearchError = false;

    // The server is asked only for searches of a useful length, and only once typing pauses:
    // each keystroke cancels the pending request and starts the wait again with the new search
    state.isSearchPending = query.length >= TOC_SEARCH_MIN_LENGTH;
    if (state.isSearchPending) {
        state.searchTimer = setTimeout(() => {
            state.isSearchPending = false;
            state.isSearchStarted = true;
            loadMoreTocSearchResults(state);
        }, TOC_SEARCH_DELAY_MS);
    }

    state.list.scrollTop = 0;
    renderTocList(state);
}

// Pinned posts can be far back in history, so they are fetched on their own instead of waiting for paging
async function loadTocPinnedItems(state) {
    if (!state.fetchPinned) return;
    try {
        const items = await state.fetchPinned();
        if (activeTocPanel !== state) return;
        state.pinnedItems = [...items].sort((a, b) => b.date - a.date);
        renderTocList(state);
    } catch (error) {
        // The rest of the list still works; the pinned posts just stay in their years
        console.error('Failed to load pinned posts:', error);
    }
}

function loadMoreTocItems(state) {
    if (state.query) {
        if (state.isSearchStarted) loadMoreTocSearchResults(state);
        return;
    }
    if (!state.searchOnly) loadMoreTocPage(state);
}

async function loadMoreTocPage(state) {
    if (state.isLoading || state.isDone || state.hasError) return;
    state.isLoading = true;
    renderTocList(state);

    try {
        const page = await state.fetchPage({ before: state.cursor, search: null, count: TOC_PAGE_SIZE });
        if (activeTocPanel !== state) return;
        const knownIds = new Set(state.items.map(item => item.id));
        state.items.push(...page.items.filter(item => !knownIds.has(item.id)));
        state.cursor = page.nextCursor;
        state.isDone = page.done || page.nextCursor == null;
    } catch (error) {
        console.error('Failed to load the table of contents:', error);
        state.hasError = true;
    } finally {
        state.isLoading = false;
    }

    if (activeTocPanel !== state) return;
    renderTocList(state);
    fillTocListIfNeeded(state);
}

async function loadMoreTocSearchResults(state) {
    if (!state.query || state.isSearchLoading || state.isSearchDone || state.hasSearchError) return;
    const token = state.searchToken;
    const isFirstPage = state.searchCursor == null;
    state.isSearchLoading = true;
    renderTocList(state);

    try {
        const page = await state.fetchPage({ before: state.searchCursor, search: state.query, count: TOC_PAGE_SIZE });
        // Drop the answer if the panel was closed or the query has changed in the meantime
        if (activeTocPanel !== state || token !== state.searchToken) return;
        if (isFirstPage) state.searchItems = [];
        const knownIds = new Set(state.searchItems.map(item => item.id));
        state.searchItems.push(...page.items.filter(item => !knownIds.has(item.id)));
        state.searchCursor = page.nextCursor;
        state.isSearchDone = page.done || page.nextCursor == null;
    } catch (error) {
        if (token !== state.searchToken) return;
        console.error('Failed to search the table of contents:', error);
        state.hasSearchError = true;
    } finally {
        if (token === state.searchToken) state.isSearchLoading = false;
    }

    if (activeTocPanel !== state || token !== state.searchToken) return;
    renderTocList(state);
    fillTocListIfNeeded(state);
}

// Keeps loading while the list is too short to scroll, so scrolling can always bring more posts
function fillTocListIfNeeded(state) {
    requestAnimationFrame(() => {
        if (activeTocPanel !== state) return;
        if (state.list.scrollHeight <= state.list.clientHeight + 200) {
            loadMoreTocItems(state);
        }
    });
}

function tocItemMatches(item, query) {
    return item.searchText.includes(query.toLowerCase());
}

// Returns the posts to show for the current state: all loaded posts without a search,
// or the loaded posts that match the search together with the server's matches.
function visibleTocItems(state) {
    if (!state.query) return state.searchOnly ? [] : state.items;

    const merged = new Map();
    for (const item of state.items) {
        if (tocItemMatches(item, state.query)) merged.set(item.id, item);
    }
    for (const item of state.searchItems) {
        // The server searches the raw text, markup included, so "up" also finds every post with
        // a <popup> tag and a link's hidden address matches too. Server results are therefore
        // filtered again by the visible text, the same way as the loaded items. This also narrows
        // down results left from a shorter query while the server works on the longer one.
        if (tocItemMatches(item, state.query)) merged.set(item.id, item);
    }
    return [...merged.values()].sort((a, b) => b.date - a.date);
}

function findTocItem(state, id) {
    return state.pinnedItems.find(item => item.id === id)
        || state.items.find(item => item.id === id)
        || state.searchItems.find(item => item.id === id)
        || null;
}

function selectTocItem(state, id) {
    const item = findTocItem(state, id);
    if (!item) return;
    closeTocPanel();
    state.onSelect?.(item);
}

function renderTocList(state) {
    // Pinned posts are listed once, in their own section on top, and left out of the years below
    const pinnedIds = new Set(state.pinnedItems.map(item => item.id));
    const pinnedItems = state.query
        ? state.pinnedItems.filter(item => tocItemMatches(item, state.query))
        : state.pinnedItems;
    const items = visibleTocItems(state).filter(item => !pinnedIds.has(item.id));
    const scrollTop = state.list.scrollTop;

    let html = '';
    if (pinnedItems.length > 0) {
        html += '<div class="toc-year-group toc-pinned-group"><div class="toc-year">Pinned</div>';
        html += pinnedItems.map(item => renderTocItem(item, state.query, { isInPinnedSection: true })).join('');
        html += '</div>';
    }
    html += tocGroupedItemsHtml(items, state.query);

    const status = tocStatusText(state, pinnedItems.length + items.length);
    if (status) {
        html += `<div class="toc-status">${escapeHtml(status)}</div>`;
    }

    state.list.innerHTML = html;
    state.list.scrollTop = scrollTop;

    // A popup grows and shrinks with the list, so it is placed again to stay inside the viewport
    if (state.isPopup) state.positionPopup?.(state.modal);
}

// Renders the rows under a header for each year
function tocGroupedItemsHtml(items, query) {
    let html = '';
    let currentYear = null;
    for (const item of items) {
        const year = item.date.getFullYear();
        if (year !== currentYear) {
            if (currentYear !== null) html += '</div>';
            html += `<div class="toc-year-group"><div class="toc-year">${year}</div>`;
            currentYear = year;
        }
        html += renderTocItem(item, query);
    }
    if (currentYear !== null) html += '</div>';
    return html;
}

function tocStatusText(state, visibleCount) {
    const noun = state.noun;
    if (state.query) {
        if (state.query.length < TOC_SEARCH_MIN_LENGTH) {
            return visibleCount === 0 ? `Type at least ${TOC_SEARCH_MIN_LENGTH} characters to search all ${noun}` : '';
        }
        if (state.isSearchPending || state.isSearchLoading) return 'Searching...';
        if (state.hasSearchError) return visibleCount > 0 ? `Can't search older ${noun}` : `Can't search ${noun}`;
        return visibleCount === 0 ? `No matching ${noun}` : '';
    }
    if (state.searchOnly) return '';
    if (state.isLoading) return 'Loading...';
    if (state.hasError) return `Can't load ${noun}`;
    return visibleCount === 0 ? `No ${noun} yet` : '';
}

// In the Pinned section there is no year header, so the date shows the year too
function renderTocItem(item, query, { isInPinnedSection = false } = {}) {
    const dateText = isInPinnedSection
        ? item.date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
        : item.date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    const fullDateText = typeof formatFullDateTime === 'function' ? formatFullDateTime(item.date) : item.date.toLocaleString();

    // Each line shows a single row of text anyway, so only its beginning is drawn. This keeps long posts
    // out of the page, and Safari's automatic tooltip for text cut off with an ellipsis stays short.
    // The item keeps the full text for searching and for placing the snippet around a match.
    // A post's own tooltip (the beginning of the post) is set on the whole row.
    const title = tocLineText(item.isTitleWholeText ? tocSnippet(item.title, query) : item.title);
    const titleHtml = item.isPlaceholderTitle
        ? `<span class="toc-item-title placeholder">${escapeHtml(title)}</span>`
        : `<span class="toc-item-title">${item.isTitleSearchable === false ? escapeHtml(title) : highlightTocText(title, query)}</span>`;

    let snippetHtml = '';
    if (item.isPlaceholderBody) {
        snippetHtml = `<span class="toc-item-snippet placeholder">${escapeHtml(item.body)}</span>`;
    } else {
        const lowerQuery = query.toLowerCase();
        const showBody = !item.isBodyShownOnlyForMatches
            || (!!query && item.body.toLowerCase().includes(lowerQuery) && !item.title.toLowerCase().includes(lowerQuery));
        const snippet = showBody ? tocLineText(tocSnippet(item.body, query)) : '';
        if (snippet) snippetHtml = `<span class="toc-item-snippet">${highlightTocText(snippet, query)}</span>`;
    }

    let iconsHtml = '';
    if (item.isPinned && !isInPinnedSection) iconsHtml += `<span class="toc-item-icon" title="Pinned">${pinIcon}</span>`;
    if (item.isPublished) iconsHtml += `<span class="toc-item-icon" title="Published">${globeIcon}</span>`;

    return `
        <button class="toc-item" type="button" data-id="${escapeHtml(item.id)}"${item.tooltip ? ` title="${escapeHtml(item.tooltip)}"` : ''}>
            <span class="toc-item-date${isInPinnedSection ? ' full-date' : ''}" title="${escapeHtml(fullDateText)}">${escapeHtml(dateText)}</span>
            <span class="toc-item-text">${titleHtml}${snippetHtml}</span>
            ${iconsHtml ? `<span class="toc-item-icons">${iconsHtml}</span>` : ''}
        </button>
    `;
}

// Cuts the text to TOC_LINE_MAX_LENGTH characters, ending with an ellipsis when it was longer.
// Counts whole characters, so an emoji is never split in half.
function tocLineText(text) {
    const characters = Array.from(text || '');
    if (characters.length <= TOC_LINE_MAX_LENGTH) return text || '';
    return characters.slice(0, TOC_LINE_MAX_LENGTH - 1).join('').trimEnd() + '…';
}

// When the match is deep inside the body, the snippet starts a little before it so it can be seen
function tocSnippet(body, query) {
    if (!body) return '';
    if (!query) return body;
    const matchIndex = body.toLowerCase().indexOf(query.toLowerCase());
    if (matchIndex <= TOC_SNIPPET_CONTEXT) return body;
    const start = body.lastIndexOf(' ', matchIndex - TOC_SNIPPET_CONTEXT);
    return '…' + body.substring(start >= 0 ? start + 1 : matchIndex - TOC_SNIPPET_CONTEXT);
}

// Escapes the text and wraps every occurrence of the query in <mark>
function highlightTocText(text, query) {
    if (!query) return escapeHtml(text);
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    // Lowercasing can change the length of some characters; positions would not line up then
    if (lowerText.length !== text.length) return escapeHtml(text);

    let html = '';
    let position = 0;
    while (position < text.length) {
        const matchIndex = lowerText.indexOf(lowerQuery, position);
        if (matchIndex < 0) break;
        html += escapeHtml(text.substring(position, matchIndex));
        html += `<mark>${escapeHtml(text.substring(matchIndex, matchIndex + query.length))}</mark>`;
        position = matchIndex + query.length;
    }
    return html + escapeHtml(text.substring(position));
}
