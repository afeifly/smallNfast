
// Wails usually exposes the runtime as window.runtime or requires importing
// Since we are handwriting this without the wails generate capability, we'll assume
// standard Wails v2/v3 bindings are available in window.go.app.App or similar
// For this strict requirement, we'll try to use the `window.runtime` interactions if v3
// or just standard `window.go.main.App` if v2 style. 
// Given the ambiguity of "Wails v3" (which is alpha), I'll write defensive JS.

const logContainer = document.getElementById('log-container');
const recipientList = document.getElementById('recipient-list');

// Translation Dictionary
const i18n = {
    en: {
        monitorService: "Monitor Service:",
        running: "Running",
        stopped: "Stopped",
        port: "Port:",
        autoStart: "Auto-Start on OS Bootup",
        restart: "Restart Service",
        exit: "Exit Application",
        logs: "Runtime Logs",
        recipients: "Recipients",
        addRecipient: "Add Recipient",
        phonePlaceholder: "Phone Number",
        langBtn: "中文"
    },
    cn: {
        monitorService: "监控服务:",
        running: "运行中",
        stopped: "已停止",
        port: "端口:",
        autoStart: "开机自动启动",
        restart: "重启服务",
        exit: "退出程序",
        logs: "运行日志",
        recipients: "接收人列表",
        addRecipient: "添加接收人",
        phonePlaceholder: "手机号码",
        langBtn: "English"
    }
};
let currentLang = "en";

// Helper to detect if message is an error
function isError(msg) {
    const lowerMsg = msg.toLowerCase();
    return lowerMsg.includes('error') ||
        lowerMsg.includes('failed') ||
        lowerMsg.includes('not found') ||
        lowerMsg.includes('no connect') ||
        lowerMsg.includes('connection') && (lowerMsg.includes('fail') || lowerMsg.includes('error')) ||
        lowerMsg.includes('com port') && lowerMsg.includes('not');
}

// Helper to prepend log (Latest on Top)
function appendLog(msg) {
    const div = document.createElement('div');
    const isErr = isError(msg);
    div.className = isErr ? 'log-line error' : 'log-line';
    const time = new Date().toLocaleTimeString();
    div.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;

    // Prepend to make latest appear on top
    logContainer.insertBefore(div, logContainer.firstChild);

    // Limit to 300 items
    if (logContainer.children.length > 300) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

// Track last log count to only show new logs
let lastLogCount = 0;

// Poll logs from backend
async function pollLogs() {
    try {
        const logs = await callBackend('GetLogs');
        if (logs && Array.isArray(logs)) {
            // Only append new logs
            if (logs.length > lastLogCount) {
                const newLogs = logs.slice(lastLogCount);
                newLogs.forEach(msg => appendLog(msg));
                lastLogCount = logs.length;
            }
        }
    } catch (e) {
        console.error("Failed to get logs:", e);
    }
}

// Initial Load
window.onload = async () => {
    try {
        await loadRecipients();
        await updateStatus();

        // Poll logs every 1 second to show runtime logs in UI
        setInterval(pollLogs, 1000);
        pollLogs(); // Initial load

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
    // Wails v2 exposes methods via window.go.main.App
    try {
        if (window.go && window.go.main && window.go.main.App && window.go.main.App[method]) {
            return await window.go.main.App[method](...args);
        }
        // Fallback: try window.go.app.App
        if (window.go && window.go.app && window.go.app.App && window.go.app.App[method]) {
            return await window.go.app.App[method](...args);
        }
        console.warn(`Backend method ${method} not found`);
        return null;
    } catch (e) {
        console.error(`Error calling ${method}:`, e);
        return null;
    }
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
                <strong>${r.Recipient}</strong>
            </div>
            <button class="btn-danger" onclick="deleteRecipient(${r.SmsID})">X</button>
        `;
        recipientList.appendChild(li);
    });
}

async function addRecipient() {
    const number = document.getElementById('input-number').value.trim();

    if (!number) {
        alert("Please enter a phone number");
        return;
    }

    try {
        // Pass empty string for name since we don't need it
        await callBackend('AddRecipient', '', number);
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
            txt.innerText = i18n[currentLang].running;
        } else {
            el.classList.remove('status-active');
            txt.innerText = i18n[currentLang].stopped;
        }
        port.innerText = status.port || "None";
    }
}

async function toggleAutoStart(checkbox) {
    const wasChecked = !checkbox.checked; // Store previous state
    try {
        const result = await callBackend('SetAutoStart', checkbox.checked);
        // The backend will log the result, but we can also show immediate feedback
        if (result === null || result === undefined) {
            // Success - backend logged it, just wait for log polling
            // No need to show alert, the log will show the result
        }
    } catch (e) {
        // Error occurred
        appendLog(`ERROR: Failed to set auto-start: ${e}`);
        checkbox.checked = wasChecked; // Revert to previous state
    }
}

async function exitApp() {
    if (confirm("Are you sure you want to exit SMSCat?")) {
        try {
            await callBackend('ExitApp');
        } catch (e) {
            console.error("Failed to exit:", e);
            // Force exit even if backend call fails
            window.close();
        }
    }
}

async function restartService() {
    const msg = currentLang === 'cn' ? "确认重启服务?\n将停止监控, 重连数据库, 并重新检测Modem." : "Restart Service?\nThis will stop monitoring, reconnect database, and re-detect modem.";
    if (!confirm(msg)) return;
    try {
        await callBackend('RestartService');
        // Status update check will reflect changes
    } catch (e) {
        alert("Failed to restart service: " + e);
        appendLog(`ERROR: Failed to restart service: ${e}`);
    }
}

// Language Toggle
async function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'cn' : 'en';
    updateLanguageUI();
    try {
        await callBackend('SetLanguage', currentLang);
    } catch (e) {
        console.error("Failed to sync language:", e);
    }
}

function updateLanguageUI() {
    const t = i18n[currentLang];

    // Status
    document.querySelector('#service-status span').childNodes[0].textContent = t.monitorService + " ";
    // Running/Stopped is dynamic, handled in updateStatus, but we update the text logic there too

    document.querySelectorAll('.status-item span')[1].childNodes[0].textContent = t.port + " "; // Port label

    document.querySelector('label[for="chk-autostart"]').innerText = t.autoStart;
    document.getElementById('btn-lang').innerText = t.langBtn;
    document.getElementById('btn-restart').innerText = t.restart;
    document.getElementById('btn-exit').innerText = t.exit;

    // Cards
    document.querySelector('.card h2').innerText = t.logs;
    document.querySelectorAll('.card h2')[1].innerText = t.recipients;

    document.getElementById('input-number').placeholder = t.phonePlaceholder;
    document.querySelector('button[onclick="addRecipient()"]').innerText = t.addRecipient;

    // Refresh status text immediately
    const statusTxt = document.getElementById('status-text');
    if (statusTxt.innerText === "Running" || statusTxt.innerText === "运行中") {
        statusTxt.innerText = t.running;
    } else {
        statusTxt.innerText = t.stopped;
    }
}


// Make functions global for onclick
window.addRecipient = addRecipient;
window.deleteRecipient = deleteRecipient;
window.toggleAutoStart = toggleAutoStart;
window.exitApp = exitApp;
window.restartService = restartService;
window.toggleLanguage = toggleLanguage;
