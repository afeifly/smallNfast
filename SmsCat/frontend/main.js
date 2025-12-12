
// Wails usually exposes the runtime as window.runtime or requires importing
// Since we are handwriting this without the wails generate capability, we'll assume
// standard Wails v2/v3 bindings are available in window.go.app.App or similar
// For this strict requirement, we'll try to use the `window.runtime` interactions if v3
// or just standard `window.go.main.App` if v2 style. 
// Given the ambiguity of "Wails v3" (which is alpha), I'll write defensive JS.

const logContainer = document.getElementById('log-container');
const recipientList = document.getElementById('recipient-list');

// Helper to append log
function appendLog(msg) {
    const div = document.createElement('div');
    div.className = 'log-line';
    const time = new Date().toLocaleTimeString();
    div.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Initial Load
window.onload = async () => {
    try {
        await loadRecipients();
        await updateStatus();

        // Setup Event Listener for Logs
        // Wails v3 uses Events.On usually
        if (window.wails && window.wails.Events) {
            window.wails.Events.On("log", (msg) => appendLog(msg.data || msg));
        } else if (window.runtime && window.runtime.EventsOn) {
            // v2 style just in case
            window.runtime.EventsOn("log", appendLog);
        }

        // Poll status every 5s
        setInterval(updateStatus, 5000);

        // Check Auto Start
        const isAuto = await callBackend('GetAutoStart');
        document.getElementById('chk-autostart').checked = isAuto;

    } catch (e) {
        console.error("Wails not ready maybe?", e);
        appendLog("System: Frontend loaded. Waiting for backend connection...");
    }
};

async function callBackend(method, ...args) {
    // This is the tricky part without generated bindings.
    // Usually it's window.go.app.App.MethodName(args)
    if (window.go && window.go.app && window.go.app.App && window.go.app.App[method]) {
        return await window.go.app.App[method](...args);
    }
    console.warn(`Backend method ${method} not found`);
    return null;
}

async function loadRecipients() {
    const list = await callBackend('GetRecipients');
    if (!list) return;

    recipientList.innerHTML = '';
    list.forEach(r => {
        const li = document.createElement('li');
        li.className = 'recipient-item';
        li.innerHTML = `
            <div>
                <strong>${r.PortName || 'User'}</strong><br>
                <small>${r.Recipient}</small>
            </div>
            <button class="btn-danger" onclick="deleteRecipient(${r.SmsID})">X</button>
        `;
        recipientList.appendChild(li);
    });
}

async function addRecipient() {
    const name = document.getElementById('input-name').value;
    const number = document.getElementById('input-number').value;

    if (!name || !number) {
        alert("Please fill all fields");
        return;
    }

    try {
        await callBackend('AddRecipient', name, number);
        document.getElementById('input-name').value = '';
        document.getElementById('input-number').value = '';
        loadRecipients();
    } catch (e) {
        alert("Failed to add: " + e);
    }
}

async function deleteRecipient(id) {
    if (!confirm("Delete this recipient?")) return;
    try {
        await callBackend('DeleteRecipient', id);
        loadRecipients();
    } catch (e) {
        alert("Failed to delete: " + e);
    }
}

async function updateStatus() {
    const status = await callBackend('GetStatus');
    if (status) {
        const el = document.getElementById('service-status');
        const txt = document.getElementById('status-text');
        const port = document.getElementById('port-text');

        if (status.running) {
            el.classList.add('status-active');
            txt.innerText = "Running";
        } else {
            el.classList.remove('status-active');
            txt.innerText = "Stopped";
        }
        port.innerText = status.port || "None";
    }
}

async function toggleAutoStart(checkbox) {
    try {
        await callBackend('SetAutoStart', checkbox.checked);
    } catch (e) {
        alert("Failed to set auto-start: " + e);
        checkbox.checked = !checkbox.checked; // Revert
    }
}

// Make functions global for onclick
window.addRecipient = addRecipient;
window.deleteRecipient = deleteRecipient;
window.toggleAutoStart = toggleAutoStart;
