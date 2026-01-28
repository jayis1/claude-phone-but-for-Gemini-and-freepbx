/**
 * Stacks Management Page
 * Allows deploying and managing multiple telephony stacks
 */
function generateStacksPage() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mission Control - Stacks</title>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #09090b;
          --panel: #18181b;
          --border: #27272a;
          --text: #e4e4e7;
          --text-dim: #a1a1aa;
          --accent: #8b5cf6;
          --success: #10b981;
          --error: #ef4444;
          --warning: #f59e0b;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', system-ui, sans-serif;
          background-color: var(--bg);
          color: var(--text);
          height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .header {
          height: 60px;
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 1.5rem;
          gap: 1rem;
        }
        .back-btn {
          color: var(--text-dim);
          text-decoration: none;
          font-weight: 600;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .back-btn:hover { background: #27272a; color: white; }
        .title { font-size: 1.1rem; font-weight: 800; }
        
        .container {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .stacks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stack-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s;
        }
        .stack-card:hover { border-color: var(--accent); transform: translateY(-2px); }
        
        .stack-header {
          padding: 1rem;
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stack-title { font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
        .stack-badge {
            background: #27272a;
            color: var(--text-dim);
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
        }

        .stack-content {
          padding: 1rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85rem;
          color: var(--text-dim);
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        .info-label { color: #666; }
        .info-val { color: var(--text); }
        .info-val.highlight { color: var(--accent); }

        .stack-actions {
          padding: 1rem;
          border-top: 1px solid var(--border);
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .btn {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .btn-primary { background: var(--accent); color: white; }
        .btn-primary:hover { filter: brightness(1.1); }
        
        .btn-danger { background: rgba(239, 68, 68, 0.1); color: var(--error); border-color: rgba(239, 68, 68, 0.2); }
        .btn-danger:hover { background: var(--error); color: white; }

        .btn-new {
          background: rgba(16, 185, 129, 0.1); 
          color: var(--success); 
          border: 2px dashed rgba(16, 185, 129, 0.3);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-new:hover { background: rgba(16, 185, 129, 0.2); border-color: var(--success); }
        .btn-new span { font-size: 2rem; margin-bottom: 0.5rem; }
        
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-dim); display: inline-block; }
        .status-dot.online { background: var(--success); box-shadow: 0 0 8px var(--success); }
        .status-dot.offline { background: var(--error); }

        /* Loader */
        .loader {
            border: 2px solid rgba(255,255,255,0.1);
            border-left-color: var(--accent);
            border-radius: 50%;
            width: 16px;
            height: 16px;
            animation: spin 1s linear infinite;
            display: inline-block;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        #toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: var(--panel);
            border: 1px solid var(--border);
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
            transform: translateY(150%);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 100;
        }
        #toast.show { transform: translateY(0); }
      </style>
    </head>
    <body>
      <div class="header">
        <a href="/" class="back-btn">← Dashboard</a>
        <div class="title">Multi-Stack Orchestration</div>
      </div>

      <div class="container">
        <div style="margin-bottom: 2rem; color: var(--text-dim);">
          Manage separate telephony stacks (Drachtio, FreeSWITCH, Voice App) running in parallel. 
          Each stack has its own unique SIP port range and trunk configuration.
        </div>

        <div id="stacks-grid" class="stacks-grid">
           <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-dim);">
             <span class="loader"></span> Loading stacks...
           </div>
        </div>
      </div>

      <div id="toast"></div>

      <script>
        async function fetchStacks() {
          try {
            const res = await fetch('/api/stacks/list');
            const data = await res.json();
            renderStacks(data.stacks || []);
          } catch(e) {
            console.error(e);
            showToast('Failed to load stacks', 'error');
          }
        }

        async function createSwitchboard() {
          if (!confirm('This will create Ring Group 600 and route ALL incoming calls to it. Continue?')) return;
          
          const btn = document.querySelector('button[title*="Switchboard"]');
          const oldText = btn.innerText;
          btn.innerText = '⏳ Provisioning...';
          btn.disabled = true;

          try {
            const res = await fetch('/api/proxy/voice/api/pbx/provision-switchboard', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
              showToast('Success! ' + data.message, 'success');
            } else {
              throw new Error(data.error || 'Unknown error');
            }
          } catch (err) {
            showToast('Failed: ' + err.message, 'error');
          } finally {
            btn.innerText = oldText;
            btn.disabled = false;
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
             
             const html = \`
               <div class="stack-card">
                 <div class="stack-header">
                   <div class="stack-title">
                     <span class="status-dot \${dotClass}"></span>
                     Stack #\${stack.id}
                   </div>
                   <div class="stack-badge">\${statusText}</div>
                 </div>
                 <div class="stack-content">
                   <div class="info-row">
                     <span class="info-label">SIP Port</span>
                     <span class="info-val highlight">\${stack.sipPort}</span>
                   </div>
                   <div class="info-row">
                     <span class="info-label">RTP Range</span>
                     <span class="info-val">\${stack.rtpRange}</span>
                   </div>
                   <div class="info-row">
                     <span class="info-label">Voice App</span>
                     <span class="info-val">:\${stack.voicePort}</span>
                   </div>
                   <div class="info-row status-cnt" style="margin-top:0.5rem; justify-content: flex-start; gap: 0.5rem;">
                      \${stack.containers.map(c => \`<span title="\${c}" style="width:8px; height:8px; background:\${isOnline ? 'var(--success)' : '#3f3f46'}; border-radius:50%; display:inline-block"></span>\`).join('')}
                   </div>
                 </div>
                  <div class="stack-actions">
                    <button class="btn btn-primary" onclick="addStack()">+ Add Stack</button>
                  <button class="btn btn-secondary" onclick="createSwitchboard()" title="Create AI Switchboard (Group 600)">📞 Create Switchboard</button>
                  <button class="btn btn-danger" onclick="stopAllStacks()">Stop All</button>
                  <button class="btn btn-danger" onclick="removeStack(\${stack.id})">Remove</button>
                  <button class="btn btn-primary" onclick="redeployStack(\${stack.id})">Redeploy</button>
                    \${stack.id > 1 ? \`<button class="btn" style="background:#0f0; color:#000" onclick="provisionStack(\${stack.id})">Synx PBX</button>\` : ''}
                  </div>
               </div>
             \`;
             grid.innerHTML += html;
          });

          // "Deploy New" Button
          const newBtn = document.createElement('div');
          newBtn.className = 'btn-new';
          newBtn.onclick = () => deployStack(nextId);
          newBtn.innerHTML = `
        < span > +</span >
            <div>Deploy Stack #${nextId}</div>
    `;
          grid.appendChild(newBtn);

          // Header Actions
          const actionsDiv = document.getElementById('header-actions');
          if (actionsDiv) {
            actionsDiv.innerHTML = `
        < button class="btn btn-secondary" onclick = "createSwitchboard()" title = "Create AI Switchboard (Group 600)" >📞 Create Switchboard</button >
              <button class="btn btn-primary" onclick="addStack()">+ Add Stack</button>
              <button class="btn btn-danger" onclick="stopAllStacks()">Stop All</button>
    `;
          }
        }
        }

        async function deployStack(id) {
           if(!confirm(`Deploy new Stack #${ id }? This will start Drachtio, FreeSWITCH and Voice App on new ports.`)) return;
           
           showToast(`Deploying Stack #${ id }... this may take a minute`, 'info');
           try {
             const res = await fetch('/api/stacks/deploy', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ id })
             });
             const data = await res.json();
             if(data.success) {
               showToast(\`Stack #\${id} deployed successfully!\`, 'success');
               fetchStacks();
             } else {
               showToast('Deploy failed: ' + data.error, 'error');
             }
           } catch(e) { showToast('Request failed', 'error'); }
        }

        async function redeployStack(id) {
           if(!confirm(\`Redeploy Stack #\${id}? This will rebuild and restart containers.\`)) return;
           deployStack(id);
        }

        async function provisionStack(id) {
           const ext = 9000 + (id - 1);
           const name = 'Gemini-Stack-' + id;
           
           if(!confirm(\`Auto-create Extension \${ext} (\${name}) in FreePBX?\\nThis ensures the PBX knows about this stack.\`)) return;

           showToast(\`Provisioning Extension \${ext}...\`, 'info');
           try {
             // We use the existing voice-app API. We assume Voice App 1 (port 3000) is the controller.
             const res = await fetch('/api/proxy/voice/api/pbx/provision-extension', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ extension: ext.toString(), name: name })
             });
             const data = await res.json();
             
             if(data.success) {
               showToast(\`Extension \${ext} created! Reloading PBX...\`, 'success');
             } else {
               showToast('Provisioning failed: ' + (data.error || 'Unknown error'), 'error');
             }
           } catch(e) {
             showToast('Request failed. Is Voice App 1 running?', 'error');
           }
        }

        async function removeStack(id) {
           if(!confirm(\`Are you sure you want to remove Stack #\${id}? This will stop all calls on this stack.\`)) return;
           
           showToast(\`Removing Stack #\${id}...\`, 'info');
           try {
             const res = await fetch('/api/stacks/remove', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ id })
             });
             const data = await res.json();
             if(data.success) {
               showToast(\`Stack #\${id} removed.\`, 'success');
               fetchStacks();
             } else {
               showToast('Remove failed: ' + data.error, 'error');
             }
           } catch(e) { showToast('Request failed', 'error'); }
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
        fetchStacks();
        setInterval(fetchStacks, 5000);
      </script>
    </body>
    </html>
  `;
}

module.exports = generateStacksPage;
