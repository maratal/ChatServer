// ── Dashboard Panel ───────────────────────────────────────────────

function openDashboard() {
    closeSettings();
    const modal = document.getElementById('dashboardModal');
    modal.style.display = 'block';
    modal.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('show')));
    hideDashboardLog();
    loadDashboardProductInfo();
    loadDashboardInfo();
    loadDashboardSettings();
}

function closeDashboard() {
    const modal = document.getElementById('dashboardModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function handleDashboardModalClick(event) {
    const content = document.querySelector('#dashboardModal .settings-content');
    if (!content.contains(event.target)) {
        closeDashboard();
    }
}

async function loadDashboardProductInfo() {
    const container = document.getElementById('dashboardProductInfo');
    container.innerHTML = '<p class="dashboard-loading">Loading...</p>';
    try {
        const info = await apiInfo();
        container.innerHTML = '';
        const items = [
            { label: 'Name', value: info.productName },
            { label: 'Version', value: info.version },
            { label: 'API Version', value: info.apiVersion }
        ];
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'dashboard-info-row';
            row.innerHTML = `<span class="dashboard-info-label">${item.label}</span><span class="dashboard-info-value">${item.value}</span>`;
            container.appendChild(row);
        });
    } catch (error) {
        container.innerHTML = '<p class="dashboard-error">Failed to load product info.</p>';
    }
}

async function loadDashboardInfo() {
    const container = document.getElementById('dashboardInfo');
    container.innerHTML = '<p class="dashboard-loading">Loading...</p>';
    try {
        const info = await apiDashboardInfo();
        container.innerHTML = '';
        const items = [
            { label: 'OS', value: info.os },
            { label: 'Swift', value: info.swift },
            { label: 'PostgreSQL', value: info.postgres }
        ];
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'dashboard-info-row';
            row.innerHTML = `<span class="dashboard-info-label">${item.label}</span><span class="dashboard-info-value">${item.value}</span>`;
            container.appendChild(row);
        });
    } catch (error) {
        container.innerHTML = '<p class="dashboard-error">Failed to load system info.</p>';
    }
}

async function loadDashboardSettings() {
    const list = document.getElementById('dashboardSettingsList');
    if (!list) return;

    let settings;
    try {
        settings = await apiGetServerSettings();
    } catch (_) {
        return;
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
            select.className = 'settings-dropdown';

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
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'settings-dropdown';
            input.value = setting.value;
            input.placeholder = meta.description || '';

            let saveTimeout;
            input.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    try {
                        await apiSaveServerSetting(setting.name, input.value);
                        setting.value = input.value;
                    } catch (error) {
                        console.error('Failed to save setting:', error);
                    }
                }, 500);
            });

            section.appendChild(input);
        }

        list.appendChild(section);
    });
}

async function dashboardRefresh() {
    const button = document.getElementById('dashboardRefreshButton');
    const updateButton = document.getElementById('dashboardUpdateButton');
    button.disabled = true;
    updateButton.disabled = true;
    button.textContent = 'Refreshing...';
    hideDashboardLog();
    try {
        const result = await apiDashboardRefresh();
        button.textContent = 'Done!';
        if (result.output) showDashboardLog(result.output, false);
        setTimeout(() => {
            button.textContent = 'Refresh';
            button.disabled = false;
            updateButton.disabled = false;
        }, 2000);
    } catch (error) {
        button.textContent = 'Failed';
        showDashboardLog(error, true);
        setTimeout(() => {
            button.textContent = 'Refresh';
            button.disabled = false;
            updateButton.disabled = false;
        }, 2000);
    }
}

async function dashboardUpdate() {
    if (!confirm('This will pull latest code, rebuild and restart the server. Continue?')) return;
    const button = document.getElementById('dashboardUpdateButton');
    const refreshButton = document.getElementById('dashboardRefreshButton');
    button.disabled = true;
    refreshButton.disabled = true;
    button.textContent = 'Updating...';
    hideDashboardLog();
    try {
        await apiDashboardUpdate();
        showDashboardLog('Update started...', false);
        pollUpdateLog(button);
    } catch (error) {
        button.textContent = 'Failed';
        showDashboardLog(error, true);
        setTimeout(() => {
            button.textContent = 'Update';
            button.disabled = false;
            refreshButton.disabled = false;
        }, 2000);
    }
}

function pollUpdateLog(button) {
    const log = document.getElementById('dashboardLog');
    let previousLength = 0;
    let lastText = '';
    const interval = setInterval(async () => {
        try {
            const result = await apiDashboardUpdateLog();
            const text = result.log || '';
            if (text.length > previousLength) {
                previousLength = text.length;
                lastText = text;
                showDashboardLog(text, false);
                log.scrollTop = log.scrollHeight;
            }
            if (text.includes('Build complete!')) {
                clearInterval(interval);
                showDashboardLog(text + '\nRestarting...', false, true);
                log.scrollTop = log.scrollHeight;
                pollServerReady();
            }
        } catch (_) {
            // Server stopped — show last known log text and poll for restart
            clearInterval(interval);
            if (lastText) {
                showDashboardLog(lastText + '\nRestarting...', false, lastText.includes('Build complete!'));
                log.scrollTop = log.scrollHeight;
            }
            pollServerReady();
        }
    }, 2000);
}

function pollServerReady() {
    const interval = setInterval(async () => {
        try {
            await apiInfo();
            clearInterval(interval);
            location.reload();
        } catch (_) {
            // Server not ready yet
        }
    }, 5000);
}

function showDashboardLog(content, isError, isSuccess) {
    const log = document.getElementById('dashboardLog');
    let message;
    if (typeof content === 'string') {
        message = content;
    } else {
        message = content?.responseText || content?.message || String(content);
        try {
            const parsed = JSON.parse(message);
            if (parsed.reason) message = parsed.reason;
        } catch (_) {}
    }
    log.textContent = message;
    log.classList.toggle('dashboard-log-error', isError);
    log.classList.toggle('dashboard-log-success', isSuccess || false);
    log.style.display = '';
}

function hideDashboardLog() {
    const log = document.getElementById('dashboardLog');
    if (log) log.style.display = 'none';
}
