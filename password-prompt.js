document.getElementById('password-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('master-password-input').value;
    // Send the password back to the background script
    chrome.runtime.sendMessage({ type: 'masterPasswordSubmit', password: password });
    // The background script will close this window automatically
});
