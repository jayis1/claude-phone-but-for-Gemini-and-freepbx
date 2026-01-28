// Comprehensive Settings Page HTML Generator
module.exports = function generateSettingsPage(env) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mission Control - Advanced Systems</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg: #09090b;
            --panel: #121214;
            --border: #27272a;
            --text: #e4e4e7;
            --text-dim: #a1a1aa;
            --accent: #8b5cf6;
            --input-bg: #1c1c1f;
            --success: #10b981;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            padding: 1rem;
            display: flex;
            justify-content: center;
            min-height: 100vh;
            overflow-y: auto;
          }
          .container {
            background: var(--panel);
            padding: 2.5rem;
            border-radius: 16px;
            width: 100%;
            max-width: 900px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            border: 1px solid var(--border);
            margin: 2rem 0;
          }
          .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
          h1 { font-size: 1.75rem; font-weight: 800; background: linear-gradient(to right, #c084fc, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
          @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
          
          .section { margin-bottom: 1.5rem; background: rgba(2.5.355,2.5.3.02); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(2.5.355,2.5.3.05); }
          .section-title { font-size: 0.8rem; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px; }
          
          .form-group { margin-bottom: 1rem; }
          label { display: block; margin-bottom: 0.4rem; font-size: 0.75rem; font-weight: 600; color: var(--text-dim); }
          input {
            width: 100%;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: white;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            transition: all 0.2s;
          }
          input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2); }
          
          .actions { margin-top: 2rem; display: flex; gap: 15px; border-top: 1px solid var(--border); padding-top: 2rem; }
          .btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            text-align: center;
            font-size: 0.95rem;
          }
          .btn-primary { background: var(--accent); color: white; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); }
          .btn-secondary { background: #27272a; color: var(--text); }
          .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
          .btn:active { transform: translateY(0); }
          
          .hint { font-size: 0.65rem; color: #71717a; margin-top: 0.3rem; }
          .notif { position: fixed; top: 20px; right: 20px; padding: 1rem 2rem; border-radius: 8px; display: none; z-index: 1000; animation: slideIn 0.3s ease-out; }
          .notif-success { background: var(--success); color: white; font-weight: 600; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        </style>
      </head>
      <body>
        <div class="notif notif-success" id="save-notif">✓ System Core Updated</div>

        <div class="container">
          <div class="header-row">
            <h1>⚙️ System Orchestration</h1>
            <div style="font-family: monospace; font-size: 0.7rem; color: var(--accent);">CONFIG_OVERRIDE_ENABLED</div>
          </div>

          <form id="settingsForm" onsubmit="saveSettings(event)">
            <div class="grid">
              <!-- COLUMN 1 -->
              <div class="col">
                <div class="section">
                  <div class="section-title"><span>🧠</span> AI Intelligence</div>
                  
                  <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="color: #f59e0b; font-weight: 700; margin-bottom: 0.5rem; font-size: 0.9rem;">🔐 SECURE VAULT</div>
                    <p style="font-size: 0.8rem; color: #a1a1aa; margin-bottom: 1rem;">API keys are now managed in the dedicated Vault for enhanced security.</p>
                    <a href="/settings/apis" style="text-decoration: none;">
                      <button type="button" style="width: 100%; padding: 10px; background: #f59e0b; color: #000; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>🗝️</span> Open API Vault
                      </button>
                    </a>
                  </div>

                   <div class="form-group">
                    <label>Default Voice ID (Legacy)</label>
                    <input type="text" name="ELEVENLABS_VOICE_ID" value="${env.ELEVENLABS_VOICE_ID || ''}" placeholder="pNInz6ov...">
                  </div>
                </div>

                <div class="section">
                  <div class="section-title"><span>🌐</span> Network Topology</div>
                  <div class="form-group">
                    <label>External IP (LAN IP)</label>
                    <input type="text" name="EXTERNAL_IP" value="${env.EXTERNAL_IP || ''}" placeholder="192.168.1.x">
                    <div class="hint">Critical for RTP audio routing</div>
                  </div>
                  <div class="form-group">
                    <label>Voice App Port</label>
                    <input type="number" name="HTTP_PORT" value="${env.HTTP_PORT || '3000'}" placeholder="3000">
                  </div>
                   <div class="form-group">
                    <label>WebSocket Port</label>
                    <input type="number" name="WS_PORT" value="${env.WS_PORT || '3001'}" placeholder="3001">
                  </div>
                </div>
              </div>

              <!-- COLUMN 2 -->
              <div class="col">
                <div class="section">
                  <div class="section-title"><span>📞</span> SIP Protocol</div>
                  <div class="form-group">
                    <label>PBX Domain / Address</label>
                    <input type="text" name="SIP_DOMAIN" value="${env.SIP_DOMAIN || ''}" placeholder="pbx.example.com">
                  </div>
                  <div class="form-group">
                    <label>SIP Registrar</label>
                    <input type="text" name="SIP_REGISTRAR" value="${env.SIP_REGISTRAR || ''}" placeholder="registrar.example.com">
                  </div>
                  <div class="form-group">
                    <label>Main Extension</label>
                    <input type="text" name="SIP_EXTENSION" value="${env.SIP_EXTENSION || ''}" placeholder="9000">
                  </div>
                  <div class="form-group">
                    <label>Auth ID</label>
                    <input type="text" name="SIP_AUTH_ID" value="${env.SIP_AUTH_ID || ''}">
                  </div>
                  <div class="form-group">
                    <label>SIP Secret / Password</label>
                    <input type="password" name="SIP_PASSWORD" value="${env.SIP_PASSWORD || ''}">
                  </div>
                  <div class="form-group">
                    <label>Drachtio SIP Port</label>
                    <input type="number" name="DRACHTIO_SIP_PORT" value="${env.DRACHTIO_SIP_PORT || '5060'}">
                  </div>
                </div>

                <div class="section">
                  <div class="section-title"><span>⚙️</span> Operational Tuning</div>
                  <div class="form-group">
                    <label>Outbound Caller ID</label>
                    <input type="text" name="DEFAULT_CALLER_ID" value="${env.DEFAULT_CALLER_ID || ''}" placeholder="+155512.5.37">
                  </div>
                  <div class="form-group">
                    <label>Max Turns</label>
                    <input type="number" name="MAX_CONVERSATION_TURNS" value="${env.MAX_CONVERSATION_TURNS || '10'}">
                  </div>
                  <div class="form-group">
                    <label>Ring Timeout (s)</label>
                    <input type="number" name="OUTBOUND_RING_TIMEOUT" value="${env.OUTBOUND_RING_TIMEOUT || '30'}">
                  </div>
                  <div class="form-group">
                    <label>Admin Test Number</label>
                    <input type="text" name="TEST_PHONE_NUMBER" value="${env.TEST_PHONE_NUMBER || ''}" placeholder="+45...">
                    <div class="hint">Phone number used for "Test AI Call" button</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="actions">
              <a href="/" class="btn btn-secondary">Discard Changes</a>
              <button type="submit" class="btn btn-primary" id="save-btn">Commit Changes & Reboot Services</button>
            </div>
          </form>
        </div>

        <script>
          async function saveSettings(e) {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const notif = document.getElementById('save-notif');
            btn.disabled = true;
            btn.innerText = 'NEGOTIATING COMMIT...';

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
              const res = await fetch('/api/settings/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              
              if (res.ok) {
                notif.style.display = 'block';
                setTimeout(() => { window.location = '/'; }, 2000);
              } else {
                alert('COMMIT FAILED: Server rejected payload');
                btn.disabled = false;
                btn.innerText = 'Commit Changes & Reboot Services';
              }
            } catch (err) {
              alert('CONNECTION ERROR: ' + err.message);
              btn.disabled = false;
            }
          }
        </script>
      </body>
    </html>
  `;
};
