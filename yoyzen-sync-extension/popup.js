// State
let currentTab = null;

const UI = {
  dot: document.getElementById('status-dot'),
  text: document.getElementById('status-text'),
  managed: document.getElementById('managed-count'),
  closed: document.getElementById('closed-count'),
  btn: document.getElementById('sync-btn'),
  footer: document.getElementById('last-sync'),
  userId: document.getElementById('user-id-input')
};

// Check if we are on Yoyzen
async function checkStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (tab?.url?.includes('yoyzen.com') || tab?.url?.includes('ysocial.net')) {
    UI.dot.classList.add('online');
    UI.text.innerText = 'Conectado a Yoyzen (Portal Agentic)';
    UI.btn.disabled = false;
    
    // Auto-request data from content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_DATA' });
      if (response) updateUI(response);
    } catch (e) {
      console.log('Content script not ready yet');
      UI.text.innerText = 'Cargando datos de Yoyzen...';
    }
  } else {
    UI.dot.classList.remove('online');
    UI.text.innerText = 'Abre la pestaña de Yoyzen';
    UI.btn.disabled = true;
  }
}

function updateUI(data) {
  UI.managed.innerText = data.managed || '0';
  UI.closed.innerText = data.closed || '0';
  if (data.lastSync) {
    UI.footer.innerText = `Sincronización: ${new Date(data.lastSync).toLocaleTimeString()}`;
  }
}

// Handle User ID Change
UI.userId.addEventListener('change', () => {
    chrome.storage.local.set({ userId: UI.userId.value });
    UI.text.innerText = 'Configuración guardada';
    setTimeout(checkStatus, 1500);
});

// Handle Manual Sync
UI.btn.addEventListener('click', async () => {
    if (!UI.userId.value) {
        alert('Por favor, ingresa tu ID de usuario primero.');
        return;
    }
    
    UI.btn.innerText = 'Sincronizando...';
    UI.btn.disabled = true;

    try {
        const data = await chrome.tabs.sendMessage(currentTab.id, { action: 'SYNC_NOW' });
        if (data) {
            updateUI(data);
            UI.btn.innerText = '¡Sincronizado!';
            setTimeout(() => {
                UI.btn.innerText = 'Sincronizar Ahora';
                UI.btn.disabled = false;
            }, 2000);
        }
    } catch (e) {
        alert('Error al sincronizar. Asegúrate de que Yoyzen esté cargado.');
        UI.btn.innerText = 'Sincronizar Ahora';
        UI.btn.disabled = false;
    }
});

// Load User ID on startup
chrome.storage.local.get(['userId'], (data) => {
    if (data.userId) UI.userId.value = data.userId;
});

// Initialize
checkStatus();
setInterval(checkStatus, 5000);
