/**
 * Mission Control - Stacks Client
 * Handles client-side logic for Multi-Stack Orchestration
 */

async function fetchStacks() {
    try {
        const res = await fetch('/api/stacks/list');
        const data = await res.json();
        renderStacks(data.stacks || []);
    } catch (e) {
        console.error(e);
        showToast('Failed to load stacks', 'error');
    }
}



async function applyConfig() {
    if (!confirm('Apply FreePBX Configuration? This will reload the PBX core.')) return;

    const btn = document.querySelector('button[title*="Reload"]');
    const oldText = btn ? btn.innerText : 'Apply Config';
    if (btn) {
        btn.innerText = 'Applying...';
        btn.disabled = true;
    }

    try {
        // Use the voice-app proxy
        const res = await fetch('/api/proxy/voice/api/pbx/reload', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            showToast('✅ Configuration Applied!', 'success');
        } else {
            showToast('❌ Failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('❌ Network Error: ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    }
}

function renderStacks(stacks) {
    const grid = document.getElementById('stacks-grid');
    grid.innerHTML = '';

    // Find max ID to determine next available ID
    const maxId = stacks.length > 0 ? Math.max(...stacks.map(s => s.id)) : 0;
    const nextId = maxId + 1;

    // Render existing stacks
    stacks.forEach(stack => {
        const isOnline = stack.status === 'online';
        const dotClass = isOnline ? 'online' : 'offline';
        const statusText = isOnline ? 'Running' : 'Stopped';

        // Generate containers HTML safely
        const containerDots = stack.containers.map(c =>
            `<span title="${c}" style="width:8px; height:8px; background:${isOnline ? 'var(--success)' : '#3f3f46'}; border-radius:50%; display:inline-block"></span>`
        ).join('');

        // Synx PBX button for non-primary stacks
        const synxBtn = stack.id > 1 ?
            `<button class="btn" style="background:#0f0; color:#000" onclick="provisionStack(${stack.id})">Synx PBX</button>` : '';

        // Matrix Naming
        const matrixNames = [
            'Morpheus', 'Trinity', 'Neo', 'Tank', 'Dozer',
            'Cypher', 'Switch', 'Apoc', 'Mouse', 'Oracle'
        ];
        const stackName = matrixNames[(stack.id - 1) % matrixNames.length] || `Agent ${stack.id}`;

        const html = `
       <div class="stack-card">
         <div class="stack-header">
           <div class="stack-title">
             <span class="status-dot ${dotClass}"></span>
             Stack #${stack.id}: ${stackName}
           </div>
           <div class="stack-badge">${statusText}</div>
         </div>
         <div class="stack-content">
           <div class="info-row">
             <span class="info-label">SIP Port</span>
             <span class="info-val highlight">${stack.sipPort}</span>
           </div>
           <div class="info-row">
             <span class="info-label">RTP Range</span>
             <span class="info-val">${stack.rtpRange}</span>
           </div>
           <div class="info-row">
             <span class="info-label">Voice App</span>
             <span class="info-val">:${stack.voicePort}</span>
           </div>
           <div class="info-row status-cnt" style="margin-top:0.5rem; justify-content: flex-start; gap: 0.5rem;">
              ${containerDots}
           </div>
         </div>
          <div class="stack-actions">
            <button class="btn btn-primary" onclick="addStack()">+ Add Stack</button>

            <button class="btn btn-danger" onclick="stopAllStacks()">Stop All</button>
            <button class="btn btn-danger" onclick="removeStack(${stack.id})">Remove</button>
            <button class="btn btn-primary" onclick="redeployStack(${stack.id})">Redeploy</button>
            ${synxBtn}
          </div>
       </div>
     `;
        grid.innerHTML += html;
    });

    // "Deploy New" Button
    const newBtn = document.createElement('div');
    newBtn.className = 'btn-new';
    newBtn.onclick = () => deployStack(nextId);
    newBtn.innerHTML = `
    <span>+</span>
    <div>Deploy Stack #${nextId}</div>
  `;
    grid.appendChild(newBtn);

    // Header Actions
    const actionsDiv = document.getElementById('header-actions');
    if (actionsDiv) {
        actionsDiv.innerHTML = `
      <button class="btn btn-primary" onclick="addStack()">+ Add Stack</button>
      <button class="btn btn-warning" onclick="applyConfig()" title="Reload FreePBX Configuration">↻ Apply Config</button>
      <button class="btn btn-danger" onclick="stopAllStacks()">Stop All</button>
    `;
    }
}

// Wrapper for addStack to match UI calls
function addStack() {
    // Determine next ID from current grid or fetch
    // Simple implementation: trigger fetch which will render the "New" button, 
    // but the user actually clicks the "New" button to deploy.
    // If this btn is clicked, we can just find the "New" button and click it, 
    // or calculate nextId.
    // Ideally, we just scroll to the new button.
    const newBtn = document.querySelector('.btn-new');
    if (newBtn) newBtn.click();
}

function stopAllStacks() {
    if (!confirm("Are you sure you want to STOP ALL stacks? Calls will drop.")) return;
    // Implementation for stop all would go here, currently strictly manual per stack in UI
    showToast("Stop All not yet implemented in UI - please remove individually or use CLI", "warning");
}

async function deployStack(id) {
    if (!confirm(`Deploy new Stack #${id}? This will start Drachtio, FreeSWITCH and Voice App on new ports.`)) return;

    showToast(`Deploying Stack #${id}... this may take a minute`, 'info');
    try {
        const res = await fetch('/api/stacks/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Stack #${id} deployed successfully!`, 'success');
            fetchStacks();
        } else {
            showToast('Deploy failed: ' + data.error, 'error');
        }
    } catch (e) { showToast('Request failed', 'error'); }
}

async function redeployStack(id) {
    if (!confirm(`Redeploy Stack #${id}? This will rebuild and restart containers.`)) return;
    deployStack(id);
}

async function provisionStack(id) {
    const ext = 9000 + (id - 1);
    const name = 'Gemini-Stack-' + id;

    if (!confirm(`Auto-create Extension ${ext} (${name}) in FreePBX?\nThis ensures the PBX knows about this stack.`)) return;

    showToast(`Provisioning Extension ${ext}...`, 'info');
    try {
        // We use the existing voice-app API. We assume Voice App 1 (port 3000) is the controller.
        const res = await fetch('/api/proxy/voice/api/pbx/provision-extension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extension: ext.toString(), name: name })
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Extension ${ext} created! Reloading PBX...`, 'success');
        } else {
            showToast('Provisioning failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Request failed. Is Voice App 1 running?', 'error');
    }
}

async function removeStack(id) {
    if (!confirm(`Are you sure you want to remove Stack #${id}? This will stop all calls on this stack.`)) return;

    showToast(`Removing Stack #${id}...`, 'info');
    try {
        const res = await fetch('/api/stacks/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`Stack #${id} removed.`, 'success');
            fetchStacks();
        } else {
            showToast('Remove failed: ' + data.error, 'error');
        }
    } catch (e) { showToast('Request failed', 'error'); }
}

function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.borderColor = type === 'error' ? 'var(--error)' : 'var(--accent)';
    toast.style.color = type === 'error' ? 'var(--error)' : 'var(--text)';
    toast.className = 'show';
    setTimeout(() => toast.className = '', 4000);
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchStacks();
    setInterval(fetchStacks, 5000);
});
