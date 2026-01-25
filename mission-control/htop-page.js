// htop Page HTML Generator
module.exports = function generateHtopPage() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>htop - System Monitor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
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
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .header {
            height: 60px;
            background: var(--panel);
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 1.5rem;
            flex-shrink: 0;
          }
          .logo {
            font-size: 1.25rem;
            font-weight: 800;
            letter-spacing: -0.025em;
            background: linear-gradient(to right, #10b981, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          .btn-return {
            background: var(--accent);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            transition: filter 0.2s;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .btn-return:hover {
            filter: brightness(1.1);
          }
          .terminal-container {
            flex: 1;
            padding: 1rem;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          #htop-output {
            flex: 1;
            background: #000;
            color: #e2e8f0;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            padding: 1rem;
            border-radius: 8px;
            border: 1px solid var(--border);
            overflow-y: auto;
            white-space: pre;
            line-height: 1.4;
          }
          .status-bar {
            margin-top: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--panel);
            border-radius: 6px;
            border: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.8rem;
          }
          .status-dot {
            width: 8px;
            height: 8px;
            background: var(--success);
            border-radius: 50%;
            box-shadow: 0 0 12px var(--success);
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
            <span>📊</span>
            htop - System Monitor
          </div>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <a href="/" class="btn-return">
              <span>←</span> Return to Mission Control
            </a>
            <a href="/settings" style="text-decoration:none; color:var(--text-dim); margin: 0 10px;" title="Settings">
              <span style="font-size: 1.2rem; cursor: pointer; vertical-align: middle;">⚙️</span>
            </a>
            <div id="clock" style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim); font-size: 0.9rem;">--:--:--</div>
          </div>
        </div>

        <div class="terminal-container">
          <div id="htop-output">Loading htop...</div>
          <div class="status-bar">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="status-dot"></span>
              <span>Live Update</span>
            </div>
            <div id="update-time" style="color: var(--text-dim);">--:--:--</div>
          </div>
        </div>

        <script>
          async function updateHtop() {
            try {
              const res = await fetch('/api/htop');
              const data = await res.json();
              
              if (data.success) {
                document.getElementById('htop-output').textContent = data.output;
              } else {
                document.getElementById('htop-output').textContent = 'Error: ' + (data.error || 'Failed to fetch htop');
              }
              
              // Update timestamp
              const now = new Date();
              document.getElementById('update-time').textContent = now.toLocaleTimeString();
            } catch (e) {
              document.getElementById('htop-output').textContent = 'Connection failed: ' + e.message;
            }
          }

          // Update every 2 seconds
          updateHtop();
          setInterval(updateHtop, 2000);

          // Clock
          setInterval(() => {
            const clockEl = document.getElementById('clock');
            if (clockEl) {
              clockEl.innerText = new Date().toLocaleTimeString();
            }
          }, 1000);
        </script>
      </body>
    </html>
  `;
};
