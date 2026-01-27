// Mission Control - n8n Logic Engine Settings
module.exports = function generateN8nPage(env) {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mission Control - n8n Logic Engine</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg: #09090b;
            --panel: #121214;
            --border: #27272a;
            --text: #e4e4e7;
            --text-dim: #a1a1aa;
            --accent: #f59e0b; /* Amber for n8n */
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
            max-width: 600px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            border: 1px solid var(--border);
            margin: 2rem 0;
            height: fit-content;
          }
          .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
          h1 { font-size: 1.5rem; font-weight: 800; background: linear-gradient(to right, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          
          .section { margin-bottom: 1.5rem; background: rgba(245, 158, 11, 0.05); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.1); }
          .section-title { font-size: 0.8rem; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px; }
          
          .form-group { margin-bottom: 1.25rem; }
          label { display: block; margin-bottom: 0.5rem; font-size: 0.75rem; font-weight: 600; color: var(--text-dim); }
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
          input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); }
          
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
          .btn-primary { background: var(--accent); color: white; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
          .btn-secondary { background: #27272a; color: var(--text); }
          .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
          
          .hint { font-size: 0.65rem; color: #71717a; margin-top: 0.4rem; line-height: 1.4; }
          .notif { position: fixed; top: 20px; right: 20px; padding: 1rem 2rem; border-radius: 8px; display: none; z-index: 1000; animation: slideIn 0.3s ease-out; }
          .notif-success { background: var(--success); color: white; font-weight: 600; }
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.6rem;
            background: var(--accent);
            color: black;
            font-weight: 800;
            vertical-align: middle;
            margin-left: 8px;
          }
        </style>
      </head>
      <body>
        <div class="notif notif-success" id="save-notif">✓ Logic Core Reconfigured</div>

        <div class="container">
          <div class="header-row">
            <h1>🧠 Logic Engine Setup</h1>
            <span class="badge">N8N HYBRID</span>
          </div>

          <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 2rem;">
            Configure your n8n integration here. These values will be injected directly into the <code>.env</code> file and the Voice App will restart automatically.
          </p>

          <form id="n8nForm" onsubmit="saveN8nSettings(event)">
            <div class="section">
              <div class="section-title"><span>🔗</span> Voice Path</div>
              <div class="form-group">
                <label>N8N Webhook URL</label>
                <input type="text" name="N8N_WEBHOOK_URL" value="${env.N8N_WEBHOOK_URL || ''}" placeholder="http://n8n.local:5678/webhook/...">
                <div class="hint">The endpoint where the voice app sends prompts. Used for real-time conversation.</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title"><span>🛡️</span> Management Path</div>
              <div class="form-group">
                <label>N8N API Key</label>
                <input type="password" name="N8N_API_KEY" value="${env.N8N_API_KEY || ''}" placeholder="n8n_api_...">
                <div class="hint">Secret key used for secure health checks and execution auditing.</div>
              </div>
              <div class="form-group">
                <label>N8N Base URL</label>
                <input type="text" name="N8N_BASE_URL" value="${env.N8N_BASE_URL || ''}" placeholder="http://n8n.local:5678">
                <div class="hint">The root URL of your n8n instance (without /webhook).</div>
              </div>
            </div>

            <div class="actions">
              <a href="/" class="btn btn-secondary">Back to Dashboard</a>
              <button type="submit" class="btn btn-primary" id="save-btn">Inject Credentials</button>
            </div>
          </form>
        </div>

        <script>
          async function saveN8nSettings(e) {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const notif = document.getElementById('save-notif');
            btn.disabled = true;
            btn.innerText = 'INJECTING...';

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
                setTimeout(() => { window.location = '/'; }, 1500);
              } else {
                alert('INJECTION FAILED');
                btn.disabled = false;
                btn.innerText = 'Inject Credentials';
              }
            } catch (err) {
              alert('NETWORK ERROR: ' + err.message);
              btn.disabled = false;
            }
          }
        </script>
      </body>
    </html>
  `;
};
