// Settings – Theme Color Management

const THEMES = [
    { id: 'pink',    hue: 335, saturation: 100, lightness: 50, label: 'Pink'    },
    { id: 'rose',    hue: 350, saturation: 90,  lightness: 50, label: 'Rose'    },
    { id: 'purple',  hue: 273, saturation: 90,  lightness: 50, label: 'Purple'  },
    { id: 'violet',  hue: 250, saturation: 85,  lightness: 55, label: 'Violet'  },
    { id: 'blue',    hue: 220, saturation: 90,  lightness: 50, label: 'Blue'    },
    { id: 'cyan',    hue: 198, saturation: 90,  lightness: 45, label: 'Cyan'    },
    { id: 'emerald', hue: 160, saturation: 75,  lightness: 42, label: 'Emerald' },
    { id: 'orange',  hue: 24,  saturation: 95,  lightness: 50, label: 'Orange'  },
];

const DEFAULT_THEME_ID = 'pink';
const STORAGE_THEME = 'chatserver_theme';
const STORAGE_MODE  = 'chatserver_mode';

// ── Journal Title Settings ────────────────────────────────────────

const JOURNAL_FONTS_ART = [
    { id: 'snell-roundhand',  family: '"Snell Roundhand", cursive', label: 'Snell Roundhand' },
    { id: 'brush-script',     family: '"Brush Script MT", cursive', label: 'Brush Script' },
    { id: 'chalkduster',      family: 'Chalkduster, fantasy', label: 'Chalkduster' },
    { id: 'marker-felt',      family: '"Marker Felt", fantasy', label: 'Marker Felt' },
    { id: 'papyrus',          family: 'Papyrus, fantasy', label: 'Papyrus' },
    { id: 'party-let',        family: '"Party LET", cursive', label: 'Party LET' },
    { id: 'phosphate',        family: 'Phosphate, fantasy', label: 'Phosphate' },
    { id: 'chalkboard',       family: '"Chalkboard SE", Chalkboard, fantasy', label: 'Chalkboard' },
    { id: 'comic-sans',       family: '"Comic Sans MS", "Comic Sans", cursive', label: 'Comic Sans' },
    { id: 'bradley-hand',     family: '"Bradley Hand", cursive', label: 'Bradley Hand' },
    { id: 'herculanum',       family: 'Herculanum, fantasy', label: 'Herculanum' },
    { id: 'luminari',         family: 'Luminari, fantasy', label: 'Luminari' },
    { id: 'trattatello',      family: 'Trattatello, fantasy', label: 'Trattatello' },
    { id: 'savoye-let',       family: '"Savoye LET", cursive', label: 'Savoye LET' },
    { id: 'signpainter',      family: 'SignPainter-HouseScript, "SignPainter", cursive', label: 'SignPainter' },
    { id: 'noteworthy',       family: 'Noteworthy, cursive', label: 'Noteworthy' },
];

const JOURNAL_FONTS_STANDARD = [
    { id: 'default',          family: 'inherit', label: 'Default (System)' },
    { id: 'arial',            family: 'Arial, Helvetica, sans-serif', label: 'Arial' },
    { id: 'helvetica-neue',   family: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Helvetica Neue' },
    { id: 'verdana',          family: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
    { id: 'tahoma',           family: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
    { id: 'trebuchet',        family: '"Trebuchet MS", Helvetica, sans-serif', label: 'Trebuchet MS' },
    { id: 'gill-sans',        family: '"Gill Sans", "Gill Sans MT", sans-serif', label: 'Gill Sans' },
    { id: 'futura',           family: 'Futura, "Century Gothic", sans-serif', label: 'Futura' },
    { id: 'avenir',           family: '"Avenir Next", Avenir, sans-serif', label: 'Avenir' },
    { id: 'avenir-book',      family: '"Avenir Book", Avenir, sans-serif', label: 'Avenir Book' },
    { id: 'optima',           family: 'Optima, Segoe, sans-serif', label: 'Optima' },
    { id: 'san-francisco',    family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', label: 'San Francisco' },
    { id: 'segoe-ui',         family: '"Segoe UI", Tahoma, Geneva, sans-serif', label: 'Segoe UI' },
    { id: 'lucida-grande',    family: '"Lucida Grande", "Lucida Sans Unicode", sans-serif', label: 'Lucida Grande' },
    { id: 'geneva',           family: 'Geneva, Verdana, sans-serif', label: 'Geneva' },
    { id: 'impact',           family: 'Impact, "Arial Black", sans-serif', label: 'Impact' },
    { id: 'arial-black',      family: '"Arial Black", Gadget, sans-serif', label: 'Arial Black' },
    { id: 'copperplate',      family: 'Copperplate, "Copperplate Gothic Light", serif', label: 'Copperplate' },
    { id: 'georgia',          family: 'Georgia, "Times New Roman", serif', label: 'Georgia' },
    { id: 'times-new-roman',  family: '"Times New Roman", Times, serif', label: 'Times New Roman' },
    { id: 'new-york',         family: '"New York", "Iowan Old Style", Georgia, serif', label: 'New York' },
    { id: 'palatino',         family: '"Palatino Linotype", Palatino, "Book Antiqua", serif', label: 'Palatino' },
    { id: 'garamond',         family: 'Garamond, Baskerville, serif', label: 'Garamond' },
    { id: 'baskerville',      family: 'Baskerville, "Baskerville Old Face", Georgia, serif', label: 'Baskerville' },
    { id: 'didot',            family: 'Didot, "Bodoni MT", "Noto Serif Display", serif', label: 'Didot' },
    { id: 'bodoni',           family: '"Bodoni 72", "Bodoni MT", Didot, serif', label: 'Bodoni' },
    { id: 'hoefler-text',     family: '"Hoefler Text", Georgia, serif', label: 'Hoefler Text' },
    { id: 'charter',          family: 'Charter, "Bitstream Charter", Georgia, serif', label: 'Charter' },
    { id: 'cambria',          family: 'Cambria, Georgia, serif', label: 'Cambria' },
    { id: 'rockwell',         family: 'Rockwell, "Courier Bold", serif', label: 'Rockwell' },
    { id: 'superclarendon',   family: '"Superclarendon", Rockwell, serif', label: 'Superclarendon' },
    { id: 'american-typewriter', family: '"American Typewriter", Courier, serif', label: 'American Typewriter' },
    { id: 'big-caslon',       family: '"Big Caslon", "Book Antiqua", serif', label: 'Big Caslon' },
    { id: 'cochin',           family: 'Cochin, Georgia, serif', label: 'Cochin' },
    { id: 'courier-new',      family: '"Courier New", Courier, monospace', label: 'Courier New' },
    { id: 'menlo',            family: 'Menlo, Monaco, Consolas, monospace', label: 'Menlo' },
    { id: 'sf-mono',          family: '"SF Mono", "Fira Code", Menlo, monospace', label: 'SF Mono' },
    { id: 'andale-mono',      family: '"Andale Mono", monospace', label: 'Andale Mono' },
    { id: 'monaco',           family: 'Monaco, Menlo, monospace', label: 'Monaco' },
];

const JOURNAL_FONTS = [...JOURNAL_FONTS_ART, ...JOURNAL_FONTS_STANDARD];

const JOURNAL_SIZES = [
    { id: '16', size: '16px', label: '16px' },
    { id: '20', size: '20px', label: '20px' },
    { id: '24', size: '24px', label: '24px' },
    { id: '28', size: '28px', label: '28px' },
    { id: '32', size: '32px', label: '32px' },
    { id: '36', size: '36px', label: '36px' },
    { id: '40', size: '40px', label: '40px' },
];

const DEFAULT_JOURNAL_FONT_ID = 'default';
const DEFAULT_JOURNAL_SIZE_ID = '15';

// Read journal settings from the chat's settings field (or pageNotesSettings on notes page)
function getJournalSettings() {
    if (typeof pageNotesSettings !== 'undefined' && pageNotesSettings) {
        return pageNotesSettings;
    }
    if (typeof chats !== 'undefined') {
        const notesChat = chats.find(chat => isPersonalNotes(chat));
        if (notesChat?.settings) {
            try { return JSON.parse(notesChat.settings); } catch (_) {}
        }
    }
    return {};
}

function getJournalFontSetting() {
    return getJournalSettings().font || DEFAULT_JOURNAL_FONT_ID;
}

function getJournalSizeSetting() {
    return getJournalSettings().size || DEFAULT_JOURNAL_SIZE_ID;
}

function saveJournalSettings(settings) {
    if (typeof chats === 'undefined') return;
    const notesChat = chats.find(chat => isPersonalNotes(chat));
    if (!notesChat) return;
    const settingsJson = JSON.stringify(settings);
    notesChat.settings = settingsJson;
    apiUpdateChat(notesChat.id, { settings: settingsJson });
}

// ── Helpers ───────────────────────────────────────────────────────

const root = document.documentElement;

function getThemeById(id) {
    return THEMES.find(t => t.id === id) || THEMES[0];
}

function themeHsl({ hue, saturation, lightness }) {
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function isDark() {
    return root.classList.contains('dark');
}

// Returns the HSS string for contrast text over a given hue/lightness
function contrastForeground(hue, lightness) {
    const isYellowish = hue >= 40 && hue <= 75;
    return (isYellowish && lightness >= 45) ? '0 0% 13%' : '0 0% 100%';
}

// ── Theme ─────────────────────────────────────────────────────────

function applyTheme(theme) {
    const { hue, saturation, lightness } = theme;
    const fg      = contrastForeground(hue, lightness);
    const primary = `${hue} ${saturation}% ${lightness}%`;
    const ring    = `${hue} 70% 49%`;
    const tintL   = isDark() ? '28%' : '93%';
    const tintFgL = isDark() ? '85%' : '20%';
    const tint    = `${hue} ${isDark() ? 28 : 16}% ${tintL}`;
    const tintFg  = `${hue} 70% ${tintFgL}`;

    const vars = {
        '--primary':                     primary,
        '--primary-hsl':                 `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        '--primary-foreground':          fg,
        '--ring':                        ring,
        '--secondary':                   tint,
        '--secondary-foreground':        tintFg,
        '--accent':                      tint,
        '--accent-foreground':           tintFg,
        '--sidebar-primary':             ring,
        '--sidebar-primary-foreground':  '0 0% 100%',
        '--sidebar-ring':                ring,
        '--chat-bubble-sent':            primary,
        '--chat-bubble-sent-foreground': fg,
    };

    for (const [prop, value] of Object.entries(vars)) {
        root.style.setProperty(prop, value);
    }
}

function selectTheme(themeId) {
    const theme = getThemeById(themeId);
    localStorage.setItem(STORAGE_THEME, themeId);
    applyTheme(theme);
    updateSwatchSelection(themeId);
}

function loadSavedTheme() {
    selectTheme(localStorage.getItem(STORAGE_THEME) || DEFAULT_THEME_ID);
}

// ── Dark mode ─────────────────────────────────────────────────────

function applyMode(mode) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', mode === 'dark' || (mode === 'system' && prefersDark));
    // Re-apply theme so tints adjust for the new light/dark context
    applyTheme(getThemeById(localStorage.getItem(STORAGE_THEME) || DEFAULT_THEME_ID));
}

function selectMode(mode) {
    localStorage.setItem(STORAGE_MODE, mode);
    applyMode(mode);
    updateModeButtons(mode);
}

function loadSavedMode() {
    selectMode(localStorage.getItem(STORAGE_MODE) || 'system');
}

// Keep in sync when OS preference changes while mode is 'system'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const mode = localStorage.getItem(STORAGE_MODE) || 'system';
    if (mode === 'system') applyMode('system');
});

// ── Panel open / close ────────────────────────────────────────────

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function handleSettingsModalClick(event) {
    if (event.target === document.getElementById('settingsModal')) closeSettings();
}

// ── Color swatches ────────────────────────────────────────────────

function buildColorSwatches() {
    const grid = document.getElementById('settingsColorGrid');
    if (!grid) return;

    const savedId = localStorage.getItem(STORAGE_THEME) || DEFAULT_THEME_ID;
    grid.innerHTML = '';

    THEMES.forEach(theme => {
        const color = themeHsl(theme);

        const swatch = Object.assign(document.createElement('div'), {
            className: 'settings-color-swatch' + (theme.id === savedId ? ' active' : ''),
            onclick: () => selectTheme(theme.id),
        });
        swatch.dataset.themeId = theme.id;
        swatch.style.setProperty('--swatch-color', color);

        const circle = Object.assign(document.createElement('div'), { className: 'settings-color-swatch-circle' });
        circle.style.background = color;

        const label = Object.assign(document.createElement('span'), {
            className: 'settings-color-swatch-label',
            textContent: theme.label,
        });

        swatch.append(circle, label);
        grid.appendChild(swatch);
    });
}

function updateSwatchSelection(themeId) {
    document.querySelectorAll('.settings-color-swatch').forEach(el => {
        el.classList.toggle('active', el.dataset.themeId === themeId);
    });
}

function updateModeButtons(mode) {
    document.querySelectorAll('.settings-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

// ── Journal font / size helpers ────────────────────────────────────

function getJournalFontById(id) {
    return JOURNAL_FONTS.find(font => font.id === id) || JOURNAL_FONTS[0];
}

function getJournalSizeById(id) {
    return JOURNAL_SIZES.find(sizeOption => sizeOption.id === id) || JOURNAL_SIZES[0];
}

function selectJournalFont(fontId) {
    const settings = getJournalSettings();
    settings.font = fontId;
    saveJournalSettings(settings);
    updateJournalFontSelection(fontId);
}

function selectJournalSize(sizeId) {
    const settings = getJournalSettings();
    settings.size = sizeId;
    saveJournalSettings(settings);
    updateJournalSizeSelection(sizeId);
}

function buildJournalFontOptions() {
    const wrapper = document.getElementById('settingsJournalFontSelect');
    if (!wrapper) return;

    const savedId = getJournalFontSetting();
    const savedFont = getJournalFontById(savedId);

    wrapper.innerHTML = '';

    // Selected display
    const trigger = document.createElement('div');
    trigger.className = 'settings-font-trigger';
    trigger.id = 'journalFontTrigger';
    trigger.textContent = savedFont.label;
    if (savedFont.id !== 'default') trigger.style.fontFamily = savedFont.family;
    wrapper.appendChild(trigger);

    // Dropdown list
    const dropdown = document.createElement('div');
    dropdown.className = 'settings-font-dropdown';
    dropdown.id = 'journalFontDropdown';

    function addFontItem(font) {
        const item = document.createElement('div');
        item.className = 'settings-font-item' + (font.id === savedId ? ' active' : '');
        item.dataset.fontId = font.id;
        item.textContent = font.label;
        if (font.id !== 'default') item.style.fontFamily = font.family;
        item.addEventListener('click', () => {
            selectJournalFont(font.id);
            closeJournalFontDropdown();
        });
        dropdown.appendChild(item);
    }

    // Art group header
    const artHeader = document.createElement('div');
    artHeader.className = 'settings-font-group-label';
    artHeader.textContent = 'Art & Decorative';
    dropdown.appendChild(artHeader);
    JOURNAL_FONTS_ART.forEach(addFontItem);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'settings-font-divider';
    dropdown.appendChild(divider);

    // Standard group header
    const standardHeader = document.createElement('div');
    standardHeader.className = 'settings-font-group-label';
    standardHeader.textContent = 'Standard';
    dropdown.appendChild(standardHeader);
    JOURNAL_FONTS_STANDARD.forEach(addFontItem);

    wrapper.appendChild(dropdown);

    trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = dropdown.classList.contains('show');
        closeAllFontDropdowns();
        if (!isOpen) {
            dropdown.classList.add('show');
            trigger.classList.add('open');
            // Scroll active item into view
            const activeItem = dropdown.querySelector('.settings-font-item.active');
            if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
        }
    });
}

function closeJournalFontDropdown() {
    const dropdown = document.getElementById('journalFontDropdown');
    if (dropdown) dropdown.classList.remove('show');
}

function closeAllFontDropdowns() {
    document.querySelectorAll('.settings-font-dropdown').forEach(element => {
        element.classList.remove('show');
    });
    document.querySelectorAll('.settings-font-trigger').forEach(element => {
        element.classList.remove('open');
    });
}

document.addEventListener('click', () => {
    closeAllFontDropdowns();
});

function buildJournalSizeOptions() {
    const select = document.getElementById('settingsJournalSizeSelect');
    if (!select) return;

    const savedId = getJournalSizeSetting();
    select.innerHTML = '';

    JOURNAL_SIZES.forEach(sizeOption => {
        const option = document.createElement('option');
        option.value = sizeOption.id;
        option.textContent = sizeOption.label;
        option.selected = sizeOption.id === savedId;
        select.appendChild(option);
    });
}

function updateJournalFontSelection(fontId) {
    const font = getJournalFontById(fontId);
    const trigger = document.getElementById('journalFontTrigger');
    if (trigger) {
        trigger.textContent = font.label;
        trigger.style.fontFamily = font.id !== 'default' ? font.family : '';
    }
    document.querySelectorAll('.settings-font-item').forEach(element => {
        element.classList.toggle('active', element.dataset.fontId === fontId);
    });
}

function updateJournalSizeSelection(sizeId) {
    const select = document.getElementById('settingsJournalSizeSelect');
    if (select) select.value = sizeId;
}

// ── Init ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadSavedMode();
    loadSavedTheme();
    buildColorSwatches();
    buildJournalFontOptions();
    buildJournalSizeOptions();
});

// ── Server Settings (admin only) ──────────────────────────────────

async function loadServerSettings() {
    const group = document.getElementById('serverSettingsGroup');
    const divider = document.getElementById('serverSettingsDivider');
    const list = document.getElementById('serverSettingsList');
    if (!group || !list) return;

    let settings;
    try {
        settings = await apiGetServerSettings();
    } catch (_) {
        return; // not admin or not available
    }

    list.innerHTML = '';
    settings.forEach(setting => {
        let meta;
        try { meta = JSON.parse(setting.meta); } catch (_) { return; }

        const variants = meta.variants ? meta.variants.split(',').map(v => v.trim()) : [];

        const section = document.createElement('div');
        section.className = 'settings-section';

        const titleRow = document.createElement('div');
        titleRow.className = 'settings-label';

        const titleText = document.createElement('span');
        titleText.textContent = meta.title || setting.name;
        if (meta.description) {
            titleRow.title = meta.description;
        }
        titleRow.appendChild(titleText);

        section.appendChild(titleRow);

        if (variants.length > 0) {
            const select = document.createElement('select');
            select.className = 'settings-select';

            variants.forEach(variant => {
                const option = document.createElement('option');
                option.value = variant;
                option.textContent = variant.charAt(0).toUpperCase() + variant.slice(1);
                option.selected = variant === setting.value;
                select.appendChild(option);
            });

            select.addEventListener('change', async () => {
                const previousValue = setting.value;
                try {
                    await apiSaveServerSetting(setting.name, select.value);
                    setting.value = select.value;
                } catch (error) {
                    console.error('Failed to save setting:', error);
                    select.value = previousValue;
                }
            });

            section.appendChild(select);
        }

        list.appendChild(section);
    });

    group.style.display = '';
    divider.style.display = '';
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'block';
    modal.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('show')));
    if (typeof currentUser !== 'undefined' && currentUser?.info?.id === 1) {
        loadServerSettings();
    }
}
