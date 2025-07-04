// options.js - v1.7.2 - Final Working Version

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// --- Web Crypto Encryption Function ---
async function encryptPAT(pat, masterPassword) {
    try {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const keyMaterial = await window.crypto.subtle.importKey(
            "raw", new TextEncoder().encode(masterPassword), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        const key = await window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt"]
        );
        const encryptedData = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(pat)
        );
        const saltHex = Array.from(new Uint8Array(salt)).map(b => b.toString(16).padStart(2, '0')).join('');
        const ivHex = Array.from(new Uint8Array(iv)).map(b => b.toString(16).padStart(2, '0')).join('');
        const encryptedHex = Array.from(new Uint8Array(encryptedData)).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${saltHex}:${ivHex}:${encryptedHex}`;
    } catch (e) {
        console.error("Encryption failed:", e);
        return null;
    }
}

function initializeApp() {
    const elements = {
        encryptionToggle: document.getElementById('encryption-toggle'),
        passwordSection: document.querySelector('.password-section'),
        securityWarning: document.querySelector('.security-warning'),
        masterPasswordInput: document.getElementById('master-password'),
        confirmMasterPasswordInput: document.getElementById('confirm-master-password'),
        tabButtons: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        settingsForm: document.getElementById('settings-form'),
        repoListContainer: document.getElementById('repo-list-container'),
        addRepoBtn: document.getElementById('add-repo-btn'),
        settingsStatus: document.getElementById('settings-status'),
        promptsList: document.getElementById('prompts-list'),
        refreshBtn: document.getElementById('refresh-btn'),
        clearCacheBtn: document.getElementById('clear-cache-btn'),
        repoStatus: document.getElementById('repo-status'),
        promptsCount: document.getElementById('prompts-count'),
        lastSync: document.getElementById('last-sync'),
        connectionStatus: document.getElementById('connection-status'),
        promptsBadge: document.getElementById('prompts-badge')
    };
    
    if (elements.encryptionToggle) {
        elements.encryptionToggle.addEventListener('change', () => toggleEncryptionSection(elements));
    }
    
    setupTabs(elements);
    setupSettings(elements);
    setupDashboard(elements);
    loadAllData(elements);
    window.elements = elements;
}

function toggleEncryptionSection(elements) {
    const isEnabled = elements.encryptionToggle.checked;
    elements.passwordSection.classList.toggle('hidden', !isEnabled);
    elements.securityWarning.classList.toggle('hidden', isEnabled);
}

function setupTabs(elements) {
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab, elements));
    });
}

function switchTab(tabName, elements) {
    elements.tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-button[data-tab='${tabName}']`).classList.add('active');
    elements.tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active', 'animate-fade-in');
}

function setupSettings(elements) {
    if (elements.addRepoBtn) {
        elements.addRepoBtn.addEventListener('click', () => addRepoEntry({}, elements));
    }
    if (elements.settingsForm) {
        elements.settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveAllSettings(elements);
        });
    }
}

function addRepoEntry(repo = {}) {
    const repoId = repo.id || `repo-${Date.now()}`;
    const repoEntry = document.createElement('div');
    repoEntry.className = 'repo-entry animate-fade-in';
    repoEntry.id = repoId;

    repoEntry.innerHTML = `
        <div class="repo-entry-header">
            <h4 class="repo-entry-title">Repository Configuration</h4>
            <button type="button" class="btn btn-gray remove-repo-btn"><i class="fas fa-trash-alt"></i></button>
        </div>
        <div class="grid lg:grid-cols-2 gap-4">
            <div class="form-group"><label class="form-label">Display Name</label><input type="text" class="input-field repo-name" value="${repo.name || ''}" placeholder="e.g., Personal Prompts" required></div>
            <div class="form-group">
                <label class="form-label">Color</label>
                <div class="color-input-wrapper">
                    <input type="color" class="repo-color" value="${repo.color || '#3b82f6'}">
                </div>
            </div>
        </div>
        <div class="form-group mt-4"><label class="form-label">GitHub Repository URL</label><input type="text" class="input-field repo-url" value="${repo.url || ''}" placeholder="https://github.com/username/repo-name" required></div>
        <div class="form-group"><label class="form-label">Personal Access Token (for private repos)</label><input type="password" class="input-field repo-pat" placeholder="Enter token to save or update"></div>
    `;

    const repoListContainer = document.getElementById('repo-list-container');
    if (repoListContainer) {
        repoListContainer.appendChild(repoEntry);
    }

    repoEntry.querySelector('.remove-repo-btn').addEventListener('click', (e) => {
        e.preventDefault();
        repoEntry.remove();
    });
}

async function saveAllSettings(elements) {
    const saveBtn = elements.settingsForm.querySelector('button[type="submit"]');
    saveBtn.classList.add('loading');
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';

    const encryptionEnabled = elements.encryptionToggle.checked;
    const masterPassword = elements.masterPasswordInput.value;
    const confirmPassword = elements.confirmMasterPasswordInput.value;

    if (encryptionEnabled && masterPassword !== confirmPassword) {
        showSettingsStatus('Master passwords do not match.', 'error', elements);
        saveBtn.classList.remove('loading');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All Settings';
        return;
    }

    let requiresMasterPassword = false;
    document.querySelectorAll('.repo-entry .repo-pat').forEach(input => {
        if (input.value.trim()) requiresMasterPassword = true;
    });

    if (encryptionEnabled && requiresMasterPassword && !masterPassword) {
        showSettingsStatus('A master password is required when encryption is enabled and tokens are provided.', 'error', elements);
        saveBtn.classList.remove('loading');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All Settings';
        return;
    }

    const repositories = [];
    for (const entry of document.querySelectorAll('.repo-entry')) {
        const name = entry.querySelector('.repo-name').value.trim();
        const url = entry.querySelector('.repo-url').value.trim();
        if (name && url) {
            const repoConfig = {
                id: entry.id, name, url,
                color: entry.querySelector('.repo-color').value,
                pat: '', isEncrypted: false
            };
            const patToSave = entry.querySelector('.repo-pat').value.trim();
            if (patToSave) {
                if (encryptionEnabled) {
                    repoConfig.pat = await encryptPAT(patToSave, masterPassword);
                    repoConfig.isEncrypted = true;
                } else {
                    repoConfig.pat = patToSave;
                }
            }
            repositories.push(repoConfig);
        }
    }

    chrome.storage.local.set({ repositories, encryptionEnabled }, () => {
        showSettingsStatus('✅ Settings saved successfully!', 'success', elements);
        chrome.runtime.sendMessage({ action: 'fetchData', force: true }, () => updateDashboard(elements));
        saveBtn.classList.remove('loading');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All Settings';
        elements.masterPasswordInput.value = '';
        elements.confirmMasterPasswordInput.value = '';
    });
}

function showSettingsStatus(message, type, elements) {
    if (elements.settingsStatus) {
        elements.settingsStatus.innerHTML = `<span>${message}</span>`;
        elements.settingsStatus.className = `status-message status-${type}`;
        elements.settingsStatus.classList.remove('hidden');
        if (type === 'success') {
            setTimeout(() => elements.settingsStatus.classList.add('hidden'), 5000);
        }
    }
}

function setupDashboard(elements) {
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', () => refreshData(elements));
    }
    if (elements.clearCacheBtn) {
        elements.clearCacheBtn.addEventListener('click', () => clearCache(elements));
    }
}

function updateDashboard(elements) {
    chrome.storage.local.get(['repositories', 'prompts', 'fetchError', 'lastFetchTime'], (data) => {
        const repoCount = data.repositories?.length || 0;
        const promptCount = data.prompts?.length || 0;

        if (elements.repoStatus) elements.repoStatus.textContent = `${repoCount} configured`;
        if (elements.promptsCount) elements.promptsCount.textContent = `${promptCount} available`;
        if (elements.promptsBadge) elements.promptsBadge.textContent = promptCount;

        if (elements.lastSync) {
            if (data.lastFetchTime) {
                const minutesAgo = Math.round((Date.now() - data.lastFetchTime) / 60000);
                elements.lastSync.textContent = minutesAgo < 1 ? 'Just now' : `${minutesAgo}m ago`;
            } else {
                elements.lastSync.textContent = 'Never';
            }
        }

        if (elements.connectionStatus) elements.connectionStatus.textContent = data.fetchError ? 'Error' : 'Connected';
        
        updatePromptsList(data.prompts || [], elements);
    });
}

function updatePromptsList(prompts, elements) {
    if (elements.promptsList) {
        if (prompts.length > 0) {
            elements.promptsList.innerHTML = prompts.map(p => `
                <div class="prompt-item">
                    <div class="flex items-center">
                        <span class="repo-color-dot" style="background-color: ${p.repoColor || '#ccc'};"></span>
                        <div class="flex-1">
                            <div class="prompt-name">${p.name.replace(/{/g, '<span style="color: #2563eb; font-weight: 500;">{').replace(/}/g, '}</span>')}</div>
                            <div class="prompt-meta">${p.repoName}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            elements.promptsList.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>No Prompts Found</h3><p>Configure a repository and click "Refresh Data".</p></div>`;
        }
    }
}

function refreshData(elements) {
    elements.refreshBtn.classList.add('loading');
    elements.refreshBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'fetchData', force: true }, () => {
        setTimeout(() => {
            updateDashboard(elements);
            elements.refreshBtn.classList.remove('loading');
            elements.refreshBtn.disabled = false;
        }, 1000);
    });
}

function clearCache(elements) {
    elements.clearCacheBtn.classList.add('loading');
    elements.clearCacheBtn.disabled = true;
    
    const keysToRemove = ['prompts', 'prompts_timestamp', 'fetchError', 'lastFetchTime'];
    
    chrome.storage.local.remove(keysToRemove, () => {
        console.log("Cache cleared:", keysToRemove);
        setTimeout(() => {
            updateDashboard(elements);
            elements.clearCacheBtn.classList.remove('loading');
            elements.clearCacheBtn.disabled = false;
        }, 500);
    });
}

function loadAllData(elements) {
    chrome.storage.local.get(['repositories', 'encryptionEnabled'], (result) => {
        if(elements.encryptionToggle) {
            elements.encryptionToggle.checked = !!result.encryptionEnabled;
            toggleEncryptionSection(elements);
        }
        if (result.repositories && result.repositories.length > 0) {
            result.repositories.forEach(repo => addRepoEntry(repo, elements));
        } else {
            addRepoEntry({}, elements);
        }
    });
    updateDashboard(elements);
}
