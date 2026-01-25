// Settings Page HTML Generator
module.exports = function generateSettingsPage(env) {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mission Control - Settings</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg: #09090b;
            --panel: #18181b;
            --border: #27272a;
            --text: #e4e4e7;
            --text-dim: #a1a1aa;
            --accent: #8b5cf6;
            --input-bg: #27272a;
            --success: #10b981;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            padding: 2rem;
            display: flex;
            justify-content: center;
          }
          .container {
            background: var(--panel);
            padding: 2rem;
            border-radius: 12px;
            width: 100%;
            max-width: 600px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            border: 1px solid var(--border);
          }
          h1 { margin-bottom: 2rem; font-size: 1.5rem; display: flex; align-items: center; gap: 10px; }
          .section { margin-bottom: 2rem; }
          .section-title { font-size: 0.9rem; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
          .form-group { margin-bottom: 1.25rem; }
          label { display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-dim); }
          input {
            width: 100%;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid var(--border);
            background: var(--input-bg);
            color: white;
            font-family: inherit;
          }
          input:focus { outline: none; border-color: var(--accent); }
          .actions { margin-top: 3rem; display: flex; gap: 10px; }
          .btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            text-align: center;
          }
          .btn-primary { background: var(--accent); color: white; }
          .btn-secondary { background: var(--border); color: var(--text); }
          .btn:hover { filter: brightness(1.1); }
          .btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .notif {
            padding: 1rem;
            margin-bottom: 1rem;
            border-radius: 6px;
            display: none;
            font-size: 0.9rem;
          }
          .notif-success { background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid var(--success); }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚙️ System Settings</h1>
          
          <div id="save-notif" class="notif notif-success">Settings saved successfully! Restarting services...</div>

          <form id="settingsForm" onsubmit="saveSettings(event)">
            <div class="section">
              <div class="section-title">AI API Keys</div>
              <div class="form-group">
                <label>Gemini API Key</label>
                <input type="password" name="GEMINI_API_KEY" value="${env.GEMINI_API_KEY || ''}" placeholder="AIzaSy...">
              </div>
              <div class="form-group">
                <label>OpenAI API Key (Whisper STT)</label>
                <input type="password" name="OPENAI_API_KEY" value="${env.OPENAI_API_KEY || ''}" placeholder="sk-...">
              </div>
              <div class="form-group">
                <label>ElevenLabs API Key (TTS)</label>
                <input type="password" name="ELEVENLABS_API_KEY" value="${env.ELEVENLABS_API_KEY || ''}" placeholder="...">
              </div>
            </div>

            <div class="section">
              <div class="section-title">Network & Server</div>
              <div class="form-group">
                <label>External IP (Server LAN IP)</label>
                <input type="text" name="EXTERNAL_IP" value="${env.EXTERNAL_IP || ''}" placeholder="e.g. 192.168.1.100">
              </div>
              <div class="form-group">
                <label>Voice App Port</label>
                <input type="number" name="HTTP_PORT" value="${env.HTTP_PORT || '3000'}" placeholder="3000">
              </div>
            </div>

             <div class="section">
              <div class="section-title">SIP Settings</div>
              <div class="form-group">
                <label>SIP Domain / PBX Address</label>
                <input type="text" name="SIP_DOMAIN" value="${env.SIP_DOMAIN || ''}" placeholder="mypbx.3cx.us">
              </div>
              <div class="form-group">
                <label>SIP Registrar (Leave blank if same as domain)</label>
                <input type="text" name="SIP_REGISTRAR" value="${env.SIP_REGISTRAR || ''}" placeholder="voice.3cx.us">
              </div>
            </div>

            <div class="actions">
              <a href="/" class="btn btn-secondary">Cancel</a>
              <button type="submit" class="btn btn-primary" id="save-btn">Save & Apply Changes</button>
            </div>
          </form>
        </div>

        <script>
          async function saveSettings(e) {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const notif = document.getElementById('save-notif');
            btn.disabled = true;
            btn.innerText = 'Saving...';

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
                setTimeout(() => { window.location = '/'; }, 3000);
              } else {
                alert('Error saving settings');
                btn.disabled = false;
                btn.innerText = 'Save & Apply Changes';
              }
            } catch (err) {
              alert('Connection failed: ' + err.message);
              btn.disabled = false;
              btn.innerText = 'Save & Apply Changes';
            }
          }
        </script>
      </body>
    </html>
  `;
};
