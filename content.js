// content.js - v1.4.0 - Color Indicator

let promptMenu = null;
let prompts = [];
let activeElement = null;
let triggerInfo = null;
let isProcessingReplacement = false; // Prevent infinite loops

// --- Dynamic Modal for Multiple Placeholders ---
function createModal() {
    if (document.getElementById('placeholder-modal-custom')) return;

    const modalHtml = `
        <div id="placeholder-modal-custom" style="display: none; position: fixed; z-index: 999999; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <div style="background-color: #ffffff; color: #111827; margin: 10% auto; padding: 24px; border: 1px solid #e5e7eb; width: 90%; max-width: 500px; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); animation: modal-appear 0.3s ease-out;">
                <h3 id="modal-title-custom" style="margin-top: 0; font-size: 1.25rem; font-weight: 600; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px;">Complete Prompt Fields</h3>
                <div id="modal-form-fields"></div>
                <div style="text-align: right; margin-top: 24px;">
                    <button id="modal-cancel-custom" style="padding: 10px 18px; border-radius: 8px; border: 1px solid #d1d5db; background-color: #ffffff; color: #374151; cursor: pointer; margin-right: 8px; font-weight: 500;">Cancel</button>
                    <button id="modal-submit-custom" style="padding: 10px 18px; border-radius: 8px; border: none; background-color: #2563eb; color: white; cursor: pointer; font-weight: 500;">Submit</button>
                </div>
            </div>
        </div>
        <style> @keyframes modal-appear { from { opacity: 0; transform: translateY(-20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } } </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showMultiPlaceholderModal(placeholders) {
    return new Promise((resolve) => {
        createModal();
        const modal = document.getElementById('placeholder-modal-custom');
        const formFields = document.getElementById('modal-form-fields');
        const cancelBtn = document.getElementById('modal-cancel-custom');
        const submitBtn = document.getElementById('modal-submit-custom');

        formFields.innerHTML = '';
        placeholders.forEach((placeholder, index) => {
            const fieldGroup = document.createElement('div');
            fieldGroup.style.marginBottom = '16px';
            const label = document.createElement('label');
            label.textContent = placeholder.charAt(0).toUpperCase() + placeholder.slice(1).replace(/-/g, ' ');
            label.style.cssText = 'display: block; margin-bottom: 8px; font-weight: 500; font-size: 0.875rem; color: #374151;';
            const input = document.createElement('input');
            input.type = 'text';
            input.dataset.placeholder = placeholder;
            input.style.cssText = 'width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; box-sizing: border-box; font-size: 1rem; color: #111827; background-color: #ffffff;';
            fieldGroup.appendChild(label);
            fieldGroup.appendChild(input);
            formFields.appendChild(fieldGroup);
            if (index === 0) input.focus();
        });

        modal.style.display = 'block';

        const close = (value) => {
            modal.style.display = 'none';
            cancelBtn.onclick = null;
            submitBtn.onclick = null;
            resolve(value);
        };

        cancelBtn.onclick = () => close(null);
        submitBtn.onclick = () => {
            const values = {};
            formFields.querySelectorAll('input').forEach(input => {
                values[`{${input.dataset.placeholder}}`] = input.value;
            });
            close(values);
        };
    });
}

function isGeminiSite() {
    return window.location.hostname.includes('gemini.google.com') || 
           window.location.hostname.includes('bard.google.com');
}

function showTemporaryNotification(message, type = 'info') {
    const existingNotification = document.getElementById('prompt-notification');
    if (existingNotification) existingNotification.remove();
    
    const notification = document.createElement('div');
    notification.id = 'prompt-notification';
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 12px 16px; border-radius: 8px; color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;
        z-index: 999999; max-width: 350px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        ${type === 'error' ? 'background: linear-gradient(135deg, #ff6b6b, #ee5a52);' : 'background: linear-gradient(135deg, #4facfe, #00f2fe);'}
        animation: slideIn 0.3s ease-out;
    `;
    notification.innerHTML = `<div style="display: flex; align-items: center;"><span style="margin-right: 8px;">${type === 'error' ? '❌' : '✅'}</span><span>${message}</span></div>`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) notification.remove();
    }, 4000);
}

function storeTriggerInfo(element, trigger = '::prompt::') {
    const text = element.isContentEditable ? (element.textContent || element.innerText) : element.value;
    const triggerIndex = text.lastIndexOf(trigger);
    
    if (triggerIndex === -1) return null;
    
    triggerInfo = {
        element: element,
        trigger: trigger,
        textBefore: text.substring(0, triggerIndex),
        textAfter: text.substring(triggerIndex + trigger.length),
    };
    return triggerInfo;
}

function showPromptMenu(element) {
    if (isProcessingReplacement) return;
    if (promptMenu) hidePromptMenu();

    if (!storeTriggerInfo(element)) return;

    activeElement = element;
    
    promptMenu = document.createElement('div');
    promptMenu.id = 'prompt-menu';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search prompts...';
    searchInput.addEventListener('input', (e) => filterPrompts(e.target.value));
    
    promptMenu.appendChild(searchInput);

    const listContainer = document.createElement('ul');
    listContainer.id = 'prompt-list';
    promptMenu.appendChild(listContainer);
    
    document.body.appendChild(promptMenu);

    positionMenu(element);
    loadPrompts();
    
    setTimeout(() => searchInput.focus(), 100);
}

function positionMenu(element) {
    if (!promptMenu) return;
    const rect = element.getBoundingClientRect();
    const menuHeight = 200;
    
    let top = (rect.bottom + menuHeight < window.innerHeight) 
        ? window.scrollY + rect.bottom + 5 
        : window.scrollY + rect.top - menuHeight - 5;

    promptMenu.style.top = `${Math.max(0, top)}px`;
    promptMenu.style.left = `${window.scrollX + rect.left}px`;
}

function loadPrompts() {
    chrome.runtime.sendMessage({ action: 'getPrompts' }, (response) => {
        prompts = (response && response.prompts) ? response.prompts : [];
        filterPrompts('');
    });
}

function filterPrompts(searchTerm) {
    const listContainer = document.getElementById('prompt-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';

    const filtered = prompts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (filtered.length === 0) {
        const li = document.createElement('li');
        li.style.cssText = 'font-style: italic; color: #666;';
        li.textContent = prompts.length === 0 ? 'No prompts available' : 'No matching prompts';
        listContainer.appendChild(li);
        return;
    }

    filtered.forEach((prompt) => {
        const li = document.createElement('li');
        li.title = `From: ${prompt.repoName || 'Default'}`;
        li.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        li.innerHTML = `
            <span>${prompt.name.replace(/{/g, '<span style="color: #2563eb; font-weight: 500;">{').replace(/}/g, '}</span>')}</span>
            <span style="height: 10px; width: 10px; border-radius: 50%; background-color: ${prompt.repoColor || '#ccc'}; margin-left: 12px; flex-shrink: 0;"></span>
        `;
        li.addEventListener('click', () => selectPrompt(prompt));
        listContainer.appendChild(li);
    });
}

async function selectPrompt(prompt) {
    hidePromptMenu();

    if (!prompt.path || !prompt.repoUrl) {
        showTemporaryNotification('Outdated prompt data. Please "Clear Cache" and "Refresh Data" in options.', 'error');
        return;
    }
    
    const placeholders = (prompt.name.match(/{([^}]+)}/g) || []).map(p => p.slice(1, -1));
    let placeholderValues = {};

    if (placeholders.length > 0) {
        placeholderValues = await showMultiPlaceholderModal(placeholders);
        if (placeholderValues === null) {
            console.log("🚫 Placeholder input cancelled.");
            return; 
        }
    }

    chrome.runtime.sendMessage({ action: 'getPromptContent', prompt: prompt }, (response) => {
        if (response && response.content) {
            let content = response.content;
            for (const [key, value] of Object.entries(placeholderValues)) {
                content = content.replace(new RegExp(key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), value);
            }
            replaceTriggerWithContent(content);
        } else {
            showTemporaryNotification(`Error loading prompt: ${response?.error || 'Unknown error'}`, 'error');
        }
    });
}

async function replaceTriggerWithContent(content) {
    isProcessingReplacement = true;
    
    try {
        if (!triggerInfo) throw new Error('No trigger info');
        
        let targetElement = triggerInfo.element;
        if (!targetElement || !document.contains(targetElement)) {
            targetElement = document.activeElement;
        }
        if (!targetElement) throw new Error('Could not find target element');
        
        targetElement.focus();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const newText = triggerInfo.textBefore + content + triggerInfo.textAfter;

        if (isGeminiSite() && targetElement.isContentEditable) {
            document.execCommand('selectAll', false, null);
            await new Promise(resolve => setTimeout(resolve, 50));
            document.execCommand('insertText', false, newText);
        } else if (targetElement.isContentEditable) {
            targetElement.textContent = newText;
        }
        else {
            targetElement.value = newText;
        }
        
        showTemporaryNotification("Prompt inserted successfully!", 'success');
        
    } catch (error) {
        showTemporaryNotification(`Error: ${error.message}`, 'error');
    } finally {
        setTimeout(() => { isProcessingReplacement = false; triggerInfo = null; }, 1000);
    }
}

function hidePromptMenu() {
    if (promptMenu) {
        promptMenu.remove();
        promptMenu = null;
    }
}

document.addEventListener('keyup', (e) => {
    if (isProcessingReplacement) return;
    
    const element = e.target;
    if (!element || (!element.isContentEditable && element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA')) {
        return;
    }
    
    const text = element.isContentEditable ? element.textContent : element.value;
    
    if (text && text.includes('::prompt::')) {
        showPromptMenu(element);
    }
});

document.addEventListener('click', (e) => {
    if (promptMenu && !promptMenu.contains(e.target) && e.target !== activeElement) {
        hidePromptMenu();
    }
});

console.log("✅ Content script with color indicator loaded!");
