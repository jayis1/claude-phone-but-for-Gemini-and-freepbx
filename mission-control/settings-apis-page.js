// API Vault - Advanced API Key Management (Page 2)
module.exports = function generateApiVaultPage(env) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>API Vault - Mission Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg: #09090b;
            --panel: #121214;
            --border: #27272a;
            --text: #e4e4e7;
            --text-dim: #a1a1aa;
            --accent: #f59e0b; /* Amber/Gold for Vault */
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
            position: relative;
            overflow: hidden;
          }
          /* Vault aesthetics */
          .container::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 4px;
            background: linear-gradient(90deg, #f59e0b, #d97706);
          }

          .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
          h1 { font-size: 1.75rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 12px; }
          
          .grid { display: grid; grid-template-columns: 1fr; gap: 2rem; }
          
          .section { margin-bottom: 1.5rem; background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); transition: border-color 0.2s; }
          .section:focus-within { border-color: var(--accent); }
          
          .section-title { font-size: 0.9rem; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 10px; }
          
          .form-group { margin-bottom: 1.2rem; }
          label { display: block; margin-bottom: 0.5rem; font-size: 0.8rem; font-weight: 600; color: var(--text-dim); }
          .input-wrapper { position: relative; }
          input {
            width: 100%;
            padding: 14px;
            padding-right: 40px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: #fbbf24;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            transition: all 0.2s;
          }
          input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); }
          
          .eye-icon {
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            cursor: pointer; opacity: 0.5; transition: opacity 0.2s;
          }
          .eye-icon:hover { opacity: 1; }

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
            display: flex; align-items: center; justify-content: center; gap: 8px;
          }
          .btn-primary { background: var(--accent); color: #000; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
          .btn-secondary { background: #27272a; color: var(--text); }
          .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
          
          .hint { font-size: 0.7rem; color: #52525b; margin-top: 0.5rem; line-height: 1.4; }
          .notif { position: fixed; top: 20px; right: 20px; padding: 1rem 2rem; border-radius: 8px; display: none; z-index: 1000; animation: slideIn 0.3s ease-out; }
          .notif-success { background: var(--success); color: white; font-weight: 600; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

          /* Stack Selector */
          .stack-select-row { margin-bottom: 1.5rem; display: flex; gap: 10px; flex-wrap: wrap; }
          .stack-btn { 
            padding: 8px 16px; 
            background: #27272a; 
            border: 1px solid var(--border); 
            border-radius: 8px; 
            color: var(--text-dim); 
            cursor: pointer;
            font-weight: 600;
            font-size: 0.85rem;
            transition: all 0.2s;
          }
          .stack-btn:hover { background: #3f3f46; color: #fff; }
          .stack-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

        </style>
      </head>
      <body>
        <div class="notif notif-success" id="save-notif">✓ Vault Secured</div>

        <div class="container">
          <div class="header-row">
            <h1>🔐 API Vault <span style="font-size: 0.8rem; background: #27272a; padding: 4px 8px; border-radius: 4px; color: #a1a1aa; font-weight: 600;">LEVEL 2 SECURITY</span></h1>
            <a href="/settings" style="color: var(--text-dim); text-decoration: none; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;">
              <span>←</span> General Settings
            </a>
          </div>

          <div class="stack-select-row">
            <button class="stack-btn active" onclick="selectStack(0)" id="btn-stack-0">Global Defaults</button>
            <button class="stack-btn" onclick="selectStack(1)" id="btn-stack-1">Stack 1</button>
            <button class="stack-btn" onclick="selectStack(2)" id="btn-stack-2">Stack 2</button>
            <button class="stack-btn" onclick="selectStack(3)" id="btn-stack-3">Stack 3</button>
            <button class="stack-btn" onclick="selectStack(4)" id="btn-stack-4">Stack 4</button>
          </div>

          <form id="vaultForm" onsubmit="saveVault(event)">
            <!-- Hidden inputs to track what we are editing -->
            <input type="hidden" id="currentStackId" value="0">
            
            <div class="grid">
              
              <!-- GEMINI -->
              <div class="section">
                <div class="section-title"><span>🧠</span> Gemini Intelligence</div>
                
                <div class="form-group">
                  <label>Primary Gemini Key (Flash/Pro)</label>
                  <div class="input-wrapper">
                    <input type="password" id="GEMINI_API_KEY" name="GEMINI_API_KEY" value="${env.GEMINI_API_KEY || ''}" placeholder="AIzaSy...">
                    <span class="eye-icon" onclick="toggleVis(this)">👁️</span>
                  </div>
                  <div class="hint">Main key used for voice conversations and complex reasoning.</div>
                </div>

                <div class="form-group">
                  <label>Mission Control Gemini Key (Flash - Optional)</label>
                  <div class="input-wrapper">
                    <input type="password" id="MISSION_CONTROL_GEMINI_KEY" name="MISSION_CONTROL_GEMINI_KEY" value="${env.MISSION_CONTROL_GEMINI_KEY || ''}" placeholder="AIzaSy...">
                    <span class="eye-icon" onclick="toggleVis(this)">👁️</span>
                  </div>
                  <div class="hint">Dedicated key for dashboard widgets (Dirty Joke, Fortune) to avoid rate limiting your main key.</div>
                </div>
              </div>

              <!-- OPENAI & ELEVENLABS -->
              <div class="section">
                <div class="section-title"><span>🗣️</span> Speech Synthesis & Recognition</div>
                
                <div class="form-group">
                  <label>OpenAI API Key (Whisper STT)</label>
                  <div class="input-wrapper">
                    <input type="password" id="OPENAI_API_KEY" name="OPENAI_API_KEY" value="${env.OPENAI_API_KEY || ''}" placeholder="sk-...">
                    <span class="eye-icon" onclick="toggleVis(this)">👁️</span>
                  </div>
                  <div class="hint">Required for high-accuracy Speech-to-Text via Whisper.</div>
                </div>

                <div class="form-group">
                  <label>ElevenLabs API Key (TTS)</label>
                  <div class="input-wrapper">
                    <input type="password" id="ELEVENLABS_API_KEY" name="ELEVENLABS_API_KEY" value="${env.ELEVENLABS_API_KEY || ''}" placeholder="...">
                    <span class="eye-icon" onclick="toggleVis(this)">👁️</span>
                  </div>
                  <div class="hint">Required for realistic AI voice generation.</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title"><span>⚡</span> n8n Automation (Optional)</div>
                
                <div class="form-group">
                  <label>n8n Webhook URL (Specific to this Stack)</label>
                  <div class="input-wrapper">
                    <input type="text" id="N8N_WEBHOOK_URL" name="N8N_WEBHOOK_URL" value="${env.N8N_WEBHOOK_URL || ''}" placeholder="https://n8n.yourdom.com/webhook/...">
                  </div>
                  <div class="hint">Different stacks can trigger different n8n workflows (e.g. Sales vs Support).</div>
                </div>

                <div class="form-group">
                  <label>n8n API Key (Global Server Access)</label>
                  <div class="input-wrapper">
                    <input type="password" id="N8N_API_KEY" name="N8N_API_KEY" value="${env.N8N_API_KEY || ''}" placeholder="api_key_...">
                    <span class="eye-icon" onclick="toggleVis(this)">👁️</span>
                  </div>
                </div>
              </div>

            </div>

            <div class="actions">
              <a href="/settings" class="btn btn-secondary">Cancel</a>
              <button type="submit" class="btn btn-primary" id="save-btn">🔒 Encrypt & Save Keys</button>
            </div>
          </form>
        </div>

        <script>
          // Store initial global values
          const globalEnv = {
            GEMINI_API_KEY: "${env.GEMINI_API_KEY || ''}",
            MISSION_CONTROL_GEMINI_KEY: "${env.MISSION_CONTROL_GEMINI_KEY || ''}",
            OPENAI_API_KEY: "${env.OPENAI_API_KEY || ''}",
            ELEVENLABS_API_KEY: "${env.ELEVENLABS_API_KEY || ''}",
            ELEVENLABS_API_KEY: "${env.ELEVENLABS_API_KEY || ''}",
            N8N_API_KEY: "${env.N8N_API_KEY || ''}",
            N8N_WEBHOOK_URL: "${env.N8N_WEBHOOK_URL || ''}"
          };

          function toggleVis(el) {
            const input = el.previousElementSibling;
            if (input.type === 'password') {
              input.type = 'text';
              el.style.opacity = '1';
            } else {
              input.type = 'password';
              el.style.opacity = '0.5';
            }
          }

          async function selectStack(id) {
            document.querySelectorAll('.stack-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('btn-stack-' + id).classList.add('active');
            document.getElementById('currentStackId').value = id;

            if (id === 0) {
              // Restore global defaults
              Object.keys(globalEnv).forEach(key => {
                const el = document.getElementById(key);
                if(el) el.value = globalEnv[key];
              });
              document.getElementById('save-btn').innerText = '🔒 Encrypt & Save Global Keys';
            } else {
              // Fetch stack specific config
              document.getElementById('save-btn').innerText = '⏳ Loading Stack ' + id + '...';
              document.getElementById('save-btn').disabled = true;
              
              try {
                const res = await fetch('/api/settings/stack-config/' + id);
                const data = await res.json();
                
                if (data.success && data.rawStackApi) {
                  // Populate fields
                  const map = {
                    GEMINI_API_KEY: data.rawStackApi.gemini?.apiKey || '',
                    MISSION_CONTROL_GEMINI_KEY: '', // Stack likely doesn't have its own Mission Control key usually
                    OPENAI_API_KEY: data.rawStackApi.openai?.apiKey || '',
                    ELEVENLABS_API_KEY: data.rawStackApi.elevenlabs?.apiKey || '',
                    OPENAI_API_KEY: data.rawStackApi.openai?.apiKey || '',
                    ELEVENLABS_API_KEY: data.rawStackApi.elevenlabs?.apiKey || '',
                    N8N_API_KEY: (data.rawStackApi.n8n && data.rawStackApi.n8n.apiKey) || '',
                    N8N_WEBHOOK_URL: (data.rawStackApi.n8n && data.rawStackApi.n8n.webhookUrl) || ''
                  };

                  Object.keys(map).forEach(key => {
                     const el = document.getElementById(key);
                     if(el) el.value = map[key];
                  });

                  document.getElementById('save-btn').disabled = false;
                  document.getElementById('save-btn').innerText = '🔒 Save Stack ' + id + ' Keys';
                }
              } catch(e) {
                console.error(e);
                alert('Failed to load stack config');
              }
            }
          }

          async function saveVault(e) {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const notif = document.getElementById('save-notif');
            btn.disabled = true;
            const originalText = btn.innerText;
            btn.innerText = 'ENCRYPTING...';

            const stackId = parseInt(document.getElementById('currentStackId').value);
            const formData = new FormData(e.target);
            const entries = Object.fromEntries(formData.entries());

            try {
              if (stackId === 0) {
                // Save Global
                const res = await fetch('/api/settings/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(entries)
                });
                 if (res.ok) {
                  // Update local global cache
                  Object.assign(globalEnv, entries);
                  notif.style.display = 'block';
                  setTimeout(() => { notif.style.display = 'none'; }, 2000);
                  btn.disabled = false;
                  btn.innerText = originalText;
                } else throw new Error('Failed to save global keys');

              } else {
                // Save Stack Specific
                const apiPayload = {
                  gemini: { apiKey: entries.GEMINI_API_KEY },
                  openai: { apiKey: entries.OPENAI_API_KEY },
                  elevenlabs: { apiKey: entries.ELEVENLABS_API_KEY },
                  elevenlabs: { apiKey: entries.ELEVENLABS_API_KEY },
                  n8n: { 
                    apiKey: entries.N8N_API_KEY,
                    webhookUrl: entries.N8N_WEBHOOK_URL 
                  }
                };
                
                const res = await fetch('/api/settings/stack-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ stackId, api: apiPayload })
                });

                if (res.ok) {
                   notif.innerHTML = '✓ Stack ' + stackId + ' Keys Saved';
                   notif.style.display = 'block';
                   setTimeout(() => { notif.style.display = 'none'; }, 2000);
                   btn.disabled = false;
                   btn.innerText = '🔒 Save Stack ' + stackId + ' Keys';
                } else throw new Error('Failed to save stack keys');
              }

            } catch (err) {
              alert('CONNECTION ERROR: ' + err.message);
              btn.disabled = false;
              btn.innerText = originalText;
            }
          }
        </script>
      </body>
    </html>
  `;
};
