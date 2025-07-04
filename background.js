// background.js - v1.7.3 - Full Page Options

// --- Helper Classes and Functions ---
class SecurityManager {
    static validateGitHubUrl(url) {
        try {
            const urlObj = new URL(url);
            if (!['github.com', 'www.github.com'].includes(urlObj.hostname)) return false;
            const pathParts = urlObj.pathname.split('/').filter(part => part);
            return pathParts.length >= 2;
        } catch { return false; }
    }
    static validatePAT(token) {
        if (!token) return true;
        return /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})$/.test(token);
    }
    static sanitizeContent(content) {
        return typeof content === 'string' ? content : '';
    }
}

class PromptCache {
    constructor() { this.CACHE_DURATION = 30 * 60 * 1000; }
    async isCacheValid(key) {
        const result = await chrome.storage.local.get([`${key}_timestamp`]);
        return result[`${key}_timestamp`] && (Date.now() - result[`${key}_timestamp`]) < this.CACHE_DURATION;
    }
    async setCacheData(key, data) {
        await chrome.storage.local.set({ [key]: data, [`${key}_timestamp`]: Date.now() });
    }
    async getCacheData(key) {
        return (await chrome.storage.local.get([key]))[key];
    }
}

function parseGitHubUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(part => part);
        if (urlObj.hostname === 'github.com' && pathParts.length >= 2) {
            return { owner: pathParts[0], repo: pathParts[1].replace('.git', '') };
        }
    } catch { return null; }
}

// --- Web Crypto Decryption Function ---
async function decryptPAT(encryptedString, masterPassword) {
    try {
        const [saltHex, ivHex, encryptedHex] = encryptedString.split(':');
        const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const encryptedData = new Uint8Array(encryptedHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const keyMaterial = await crypto.subtle.importKey(
            "raw", new TextEncoder().encode(masterPassword), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        const key = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, true, ["decrypt"]
        );
        const decryptedData = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encryptedData);
        return new TextDecoder().decode(decryptedData);
    } catch (e) {
        console.error("Decryption failed, likely incorrect master password.", e);
        throw new Error("Decryption failed. Incorrect master password.");
    }
}

// --- Session Password Management ---
let sessionPassword = null;
let passwordPromise = null;

async function getSessionPassword() {
    if (sessionPassword) return sessionPassword;
    if (passwordPromise) return passwordPromise;

    passwordPromise = new Promise(async (resolve, reject) => {
        let windowId = null;

        try {
            const window = await chrome.windows.create({
                url: chrome.runtime.getURL('password-prompt.html'),
                type: 'popup',
                width: 400,
                height: 250,
            });
            windowId = window.id;
        } catch (e) {
            console.error("Failed to create password prompt window:", e);
            reject(e);
            return;
        }

        const messageListener = (message) => {
            if (message.type === 'masterPasswordSubmit') {
                chrome.runtime.onMessage.removeListener(messageListener);
                if (windowId) chrome.windows.remove(windowId);
                
                if (message.password) {
                    sessionPassword = message.password;
                    resolve(sessionPassword);
                } else {
                    reject(new Error("Password prompt was cancelled."));
                }
                passwordPromise = null;
            }
        };
        chrome.runtime.onMessage.addListener(messageListener);

        const windowListener = (closedWindowId) => {
            if (closedWindowId === windowId) {
                chrome.windows.onRemoved.removeListener(windowListener);
                chrome.runtime.onMessage.removeListener(messageListener);
                reject(new Error("Password prompt was closed by the user."));
                passwordPromise = null;
            }
        };
        chrome.windows.onRemoved.addListener(windowListener);
    });
    return passwordPromise;
}

async function getDecryptedToken(encryptedToken) {
    const password = await getSessionPassword();
    return decryptPAT(encryptedToken, password).catch(err => {
        sessionPassword = null;
        throw err;
    });
}

// --- API Fetching Logic ---
async function fetchAllPrompts(force = false) {
    const cache = new PromptCache();
    if (!force && await cache.isCacheValid('prompts')) {
        const cachedPrompts = await cache.getCacheData('prompts');
        if (cachedPrompts && cachedPrompts.length > 0) {
            return { success: true, count: cachedPrompts.length, cached: true };
        }
    }

    const { repositories } = await chrome.storage.local.get(['repositories']);
    if (!repositories || repositories.length === 0) {
        return { success: false, error: 'No repositories configured' };
    }

    let allPrompts = [];
    let firstError = null;

    for (const repoConfig of repositories) {
        if (!repoConfig.url || !SecurityManager.validateGitHubUrl(repoConfig.url)) continue;
        try {
            const repoInfo = parseGitHubUrl(repoConfig.url);
            if (!repoInfo) throw new Error(`Invalid URL for ${repoConfig.name}`);
            const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents`;
            const headers = { 'Accept': 'application/vnd.github.v3+json' };
            
            if (repoConfig.pat) {
                let token = repoConfig.pat;
                if (repoConfig.isEncrypted) {
                    try {
                        token = await getDecryptedToken(repoConfig.pat);
                    } catch (error) {
                        if (!firstError) firstError = error.message;
                        continue;
                    }
                }
                headers['Authorization'] = `token ${token}`;
            }

            const response = await fetch(apiUrl, { headers });
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${repoConfig.name}`);
            const files = await response.json();
            if (!Array.isArray(files)) throw new Error(`Invalid API response for ${repoConfig.name}`);

            const mdFiles = files
                .filter(file => file && file.name && file.name.endsWith('.md'))
                .map(file => ({
                    name: file.name.replace('.md', ''),
                    path: file.path,
                    repoUrl: repoConfig.url,
                    repoName: repoConfig.name,
                    repoColor: repoConfig.color
                }));
            allPrompts = allPrompts.concat(mdFiles);
        } catch (error) {
            if (!firstError) firstError = error.message;
        }
    }

    await cache.setCacheData('prompts', allPrompts);
    await chrome.storage.local.set({ fetchError: firstError, lastFetchTime: Date.now() });
    return { success: !firstError, count: allPrompts.length, error: firstError };
}

async function getPromptContent(prompt) {
    if (!prompt || !prompt.path || !prompt.repoUrl) {
        throw new Error('Invalid prompt data for fetching content');
    }
    const { repositories } = await chrome.storage.local.get(['repositories']);
    const repoConfig = (repositories || []).find(r => r.url === prompt.repoUrl);
    const repoInfo = parseGitHubUrl(prompt.repoUrl);
    if (!repoInfo) throw new Error('Could not parse repo URL from prompt');
    const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${prompt.path}`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    
    if (repoConfig && repoConfig.pat) {
        let token = repoConfig.pat;
        if (repoConfig.isEncrypted) {
            try {
                token = await getDecryptedToken(repoConfig.pat);
            } catch (error) {
                throw error;
            }
        }
        headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(apiUrl, { headers });
    if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
    const fileData = await response.json();
    if (fileData.encoding !== 'base64' || !fileData.content) throw new Error('Invalid content encoding from API');
    const binaryString = atob(fileData.content.replace(/\s/g, ''));
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
}

// --- Event Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPrompts') {
        chrome.storage.local.get(['prompts', 'fetchError'], data => sendResponse(data));
        return true;
    }
    if (request.action === 'getPromptContent') {
        getPromptContent(request.prompt)
            .then(content => sendResponse({ content: SecurityManager.sanitizeContent(content) }))
            .catch(error => {
                sendResponse({ error: error.message });
            });
        return true;
    }
    if (request.action === 'fetchData') {
        fetchAllPrompts(request.force).then(sendResponse);
        return true;
    }
});

chrome.alarms.create('fetchData', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(() => fetchAllPrompts());
chrome.runtime.onInstalled.addListener(() => fetchAllPrompts(true));

// ** FIX: Added back the onClicked listener **
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'options.html' });
});
