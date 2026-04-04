// --- Sync Config (Identified from .env) ---
const SUPABASE_URL = "https://oyhlhdlubralrgjbgtqw.supabase.co";
const SUPABASE_KEY = "sb_publishable_8493GeAz4c4Iw_4byE16Mg_RHAS4jtw";

// --- Extraction Config (To be tuned by user when logged in Yoyzen) ---
const SELECTORS = {
    MANAGED: ".managed-count-selector", // TODO: Update with real ID/Class from Yoyzen
    CLOSED: ".closed-count-selector"    // TODO: Update with real ID/Class from Yoyzen
};

// --- Core Functions ---

function extractData() {
    // This is where the magic happens.
    // Since we don't have the real selectors yet, we use a mock for now.
    // When you are on Yoyzen, tell me the class or ID of the numbers.
    const managedElement = document.querySelector(SELECTORS.MANAGED);
    const closedElement = document.querySelector(SELECTORS.CLOSED);

    const managedCount = managedElement ? parseInt(managedElement.innerText.replace(/\D/g,'')) : 0;
    const closedCount = closedElement ? parseInt(closedElement.innerText.replace(/\D/g,'')) : 0;

    return {
        managed: managedCount,
        closed: closedCount,
        lastUpdate: new Date().toISOString()
    };
}

async function syncToSupabase(data) {
    // IMPORTANT: The extension needs to know WHICH user to update.
    // We'll store the userId in Chrome Storage (configured via the popup).
    const storage = await chrome.storage.local.get(['userId']);
    if (!storage.userId) {
        console.error("No se ha configurado el ID de usuario en la extensión.");
        return null;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // We update using Supabase's POST (upsert) via REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/daily_metrics`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
            user_id: storage.userId,
            date: today,
            cases_managed: data.managed,
            cases_closed: data.closed
            // Efficiency and other stats are calculated on the next manual save or via trigger
        })
    });

    if (response.ok) {
        console.log("¡Sincronización con Supabase exitosa!");
        return { ...data, lastSync: new Date().toISOString() };
    } else {
        const err = await response.json();
        console.error("Error sincronizando:", err);
        return null;
    }
}

// --- Message Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_DATA') {
        sendResponse(extractData());
    }
    
    if (request.action === 'SYNC_NOW') {
        const data = extractData();
        syncToSupabase(data).then(syncResult => {
            sendResponse(syncResult || data);
        });
        return true; // Keep channel open for async response
    }
});

console.log("Yoyzen Sync Content Script Cargado. Esperando comandos...");
