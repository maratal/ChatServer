// Table Of Contents panel, shared by the journal page and the Personal Notes chat.
//
// The panel slides in from the edge of the screen like the other info panels, and lists posts
// in a compact form, grouped by year, newest first. More posts are loaded page by page as the list is scrolled.
// Typing in the search field filters the posts that are already loaded straight away,
// and then asks the server for matching posts in the background, so that older posts
// which have not been loaded yet can be found as well.

const TOC_PAGE_SIZE = 50;
const TOC_SEARCH_DELAY_MS = 300;
const TOC_SNIPPET_CONTEXT = 24; // How many characters to show before a match that is deep inside the body
const TOC_ANIMATION_MS = 300; // Matches the slide transition of .user-info-content

let activeTocPanel = null;

// Opens the panel, or closes it when it is already open for the same button.
//
// options:
//   anchor    – the button that opens the panel
//   side      – 'right' (default) or 'left': the screen edge the panel slides in from
//   fetchPage – async ({ before, search, count }) => ({ items, nextCursor, done }),
//               where `items` are made with createTocItem() and `nextCursor` is passed back as `before`
//               to get the following page
//   onSelect  – called with the picked item after the panel has closed
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
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), TOC_ANIMATION_MS);
}

// Closes the panel when its button lives inside `element`, which is about to go away.
function closeTocPanelIfInside(element) {
    if (activeTocPanel && element && element.contains(activeTocPanel.anchor)) {
        closeTocPanel();
    }
}

// Converts a post into the compact form shown in the panel.
// `text` may contain the app's inline formatting; it is reduced to plain text here.
function createTocItem({ id, createdAt, text, attachmentsCount = 0, isPinned = false, isPublished = false }) {
    const plainText = tocPlainText(text || '').trim();
    const firstNewlineIndex = plainText.indexOf('\n');
    const firstLine = (firstNewlineIndex >= 0 ? plainText.substring(0, firstNewlineIndex) : plainText).trim();
    const restText = firstNewlineIndex >= 0 ? plainText.substring(firstNewlineIndex + 1) : '';
    const body = restText.replace(/\s+/g, ' ').trim();

    let title = firstLine;
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
        isPinned,
        isPublished,
        searchText: `${isPlaceholderTitle ? '' : title}\n${body}`.toLowerCase()
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
    const modal = document.createElement('div');
    modal.className = `user-info-modal toc-modal toc-modal-${side}`;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Table Of Contents');
    modal.style.zIndex = String(nextTocModalZIndex());
    modal.innerHTML = `
        <div class="user-info-content toc-panel">
            <div class="modal-panel-header">
                <h1 class="text-2xl font-bold text-sidebar-foreground">Contents</h1>
                <button class="inline-button toc-panel-close" type="button" title="Close">${closeIcon}</button>
            </div>
            <div class="toc-search">
                <span class="toc-search-icon">${searchIcon}</span>
                <input type="text" class="toc-search-input" placeholder="Search posts" autocomplete="off" spellcheck="false" aria-label="Search posts">
                <button class="toc-search-clear" type="button" title="Clear search" hidden>${closeIcon}</button>
            </div>
            <div class="toc-list"></div>
        </div>
    `;
    document.body.appendChild(modal);
    const panel = modal.querySelector('.toc-panel');

    const state = {
        modal,
        panel,
        anchor: options.anchor,
        fetchPage: options.fetchPage,
        onSelect: options.onSelect,
        list: panel.querySelector('.toc-list'),
        input: panel.querySelector('.toc-search-input'),
        clearButton: panel.querySelector('.toc-search-clear'),

        // Posts loaded page by page without a search, newest first
        items: [],
        cursor: null,
        isDone: false,
        isLoading: false,
        hasError: false,

        // Matches returned by the server for the current search
        query: '',
        searchItems: [],
        searchItemsQuery: '', // the query that `searchItems` were found for
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

    // A click on the dimmed area outside the panel closes it, like the other info panels
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeTocPanel();
    });
    state.onKeyDown = (event) => {
        if (event.key !== 'Escape') return;
        // Handled here in the capture phase so the panels underneath stay open
        event.preventDefault();
        event.stopPropagation();
        closeTocPanel();
    };
    window.addEventListener('keydown', state.onKeyDown, true);

    panel.querySelector('.toc-panel-close').addEventListener('click', () => closeTocPanel());
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

    // Slide in the same way as the other info panels
    modal.style.display = 'block';
    modal.offsetHeight;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    });

    renderTocList(state);
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

    // Results for a shorter query stay useful while the server works on the longer one,
    // because the local filter narrows them down to what still matches
    if (!query || !query.toLowerCase().includes(previousQuery.toLowerCase())) {
        state.searchItems = [];
        state.searchItemsQuery = '';
    }
    state.searchToken++;
    state.searchCursor = null;
    state.isSearchStarted = false;
    state.isSearchDone = false;
    state.isSearchLoading = false;
    state.hasSearchError = false;
    state.isSearchPending = !!query;

    if (query) {
        state.searchTimer = setTimeout(() => {
            state.isSearchPending = false;
            state.isSearchStarted = true;
            loadMoreTocSearchResults(state);
        }, TOC_SEARCH_DELAY_MS);
    }

    state.list.scrollTop = 0;
    renderTocList(state);
}

function loadMoreTocItems(state) {
    if (state.query) {
        if (state.isSearchStarted) loadMoreTocSearchResults(state);
        return;
    }
    loadMoreTocPage(state);
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
        if (isFirstPage) {
            state.searchItems = [];
            state.searchItemsQuery = state.query;
        }
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
    if (!state.query) return state.items;

    const merged = new Map();
    for (const item of state.items) {
        if (tocItemMatches(item, state.query)) merged.set(item.id, item);
    }
    const isCurrentSearch = state.searchItemsQuery === state.query;
    for (const item of state.searchItems) {
        // Server matches for the current query are all shown, because the server also searches
        // the markup that the local filter does not see. Matches left from a shorter query
        // are shown only while they still match locally.
        if (isCurrentSearch || tocItemMatches(item, state.query)) merged.set(item.id, item);
    }
    return [...merged.values()].sort((a, b) => b.date - a.date);
}

function findTocItem(state, id) {
    return state.items.find(item => item.id === id) || state.searchItems.find(item => item.id === id) || null;
}

function selectTocItem(state, id) {
    const item = findTocItem(state, id);
    if (!item) return;
    closeTocPanel();
    state.onSelect?.(item);
}

function renderTocList(state) {
    const items = visibleTocItems(state);
    const scrollTop = state.list.scrollTop;

    let html = tocGroupedItemsHtml(items, state.query);

    const status = tocStatusText(state, items.length);
    if (status) {
        html += `<div class="toc-status">${escapeHtml(status)}</div>`;
    }

    state.list.innerHTML = html;
    state.list.scrollTop = scrollTop;
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
    if (state.query) {
        if (state.isSearchPending || state.isSearchLoading) return 'Searching...';
        if (state.hasSearchError) return visibleCount > 0 ? 'Can\'t search older posts' : 'Can\'t search posts';
        return visibleCount === 0 ? 'No matching posts' : '';
    }
    if (state.isLoading) return 'Loading...';
    if (state.hasError) return 'Can\'t load posts';
    return visibleCount === 0 ? 'No posts yet' : '';
}

function renderTocItem(item, query) {
    const dateText = item.date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    const fullDateText = typeof formatFullDateTime === 'function' ? formatFullDateTime(item.date) : item.date.toLocaleString();

    const titleHtml = item.isPlaceholderTitle
        ? `<span class="toc-item-title placeholder">${escapeHtml(item.title)}</span>`
        : `<span class="toc-item-title">${highlightTocText(item.title, query)}</span>`;

    const snippet = tocSnippet(item.body, query);
    const snippetHtml = snippet ? `<span class="toc-item-snippet">${highlightTocText(snippet, query)}</span>` : '';

    let iconsHtml = '';
    if (item.isPinned) iconsHtml += `<span class="toc-item-icon" title="Pinned">${pinIcon}</span>`;
    if (item.isPublished) iconsHtml += `<span class="toc-item-icon" title="Published">${globeIcon}</span>`;

    return `
        <button class="toc-item" type="button" data-id="${escapeHtml(item.id)}">
            <span class="toc-item-date" title="${escapeHtml(fullDateText)}">${escapeHtml(dateText)}</span>
            <span class="toc-item-text">${titleHtml}${snippetHtml}</span>
            ${iconsHtml ? `<span class="toc-item-icons">${iconsHtml}</span>` : ''}
        </button>
    `;
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
