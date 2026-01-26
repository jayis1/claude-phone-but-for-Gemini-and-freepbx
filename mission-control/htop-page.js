// htop Page HTML Generator with ANSI-to-HTML Support
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
            overflow: auto;
            white-space: pre;
            line-height: 1.2;
          }

          /* ANSI Color Mapping */
          .ansi-black { color: #4b5563; }
          .ansi-red { color: #ef4444; }
          .ansi-green { color: #22c55e; }
          .ansi-yellow { color: #eab308; }
          .ansi-blue { color: #3b82f6; }
          .ansi-magenta { color: #a855f7; }
          .ansi-cyan { color: #06b6d4; }
          .ansi-white { color: #ffffff; }
          .ansi-bright-black { color: #9ca3af; }
          .ansi-bright-red { color: #f87171; }
          .ansi-bright-green { color: #4ade80; }
          .ansi-bright-yellow { color: #facc15; }
          .ansi-bright-blue { color: #60a5fa; }
          .ansi-bright-magenta { color: #c084fc; }
          .ansi-bright-cyan { color: #22d3ee; }
          .ansi-bright-white { color: #ffffff; }
          
          .ansi-bg-black { background-color: #000000; }
          .ansi-bg-red { background-color: #ef4444; color: #fff; }
          .ansi-bg-green { background-color: #22c55e; color: #000; }
          .ansi-bg-yellow { background-color: #eab308; color: #000; }
          .ansi-bg-blue { background-color: #3b82f6; color: #fff; }
          .ansi-bg-magenta { background-color: #a855f7; color: #fff; }
          .ansi-bg-cyan { background-color: #06b6d4; color: #000; }
          .ansi-bg-white { background-color: #ffffff; color: #000; }
          
          .ansi-bold { font-weight: bold; }

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
            htop - High Performance System Monitor
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
          <div id="htop-output">Initializing Visual Core...</div>
          <div class="status-bar">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="status-dot"></span>
              <span>Visual Telemetry Active</span>
            </div>
            <div id="update-time" style="color: var(--text-dim);">--:--:--</div>
          </div>
        </div>

        <script>
          // Enhanced client-side ANSI to HTML converter
          function ansiToHtml(text) {
            if (!text) return "";
            
            // 1. Preserve character set sequences for layout (like lines/corners in htop)
            // But strip the pesky \x1b(B / \x1b(0 if they cause issues
            // text = text.replace(/\\u001b\\([B0]/g, '');

            // 2. Strip non-color/non-format terminal sequences
            // We ONLY strip cursor movements and clear-screens, NOT layout chars
            text = text.replace(/\\u001b\\[[0-9;?]*[A-KJK]/g, '');
            text = text.replace(/\\u001b\\[[0-9;]*[Hfr]/g, ''); 

            const colors = {
              30: 'ansi-black', 31: 'ansi-red', 32: 'ansi-green', 33: 'ansi-yellow',
              34: 'ansi-blue', 35: 'ansi-magenta', 36: 'ansi-cyan', 37: 'ansi-white',
              90: 'ansi-bright-black', 91: 'ansi-bright-red', 92: 'ansi-bright-green', 93: 'ansi-bright-yellow',
              94: 'ansi-bright-blue', 95: 'ansi-bright-magenta', 96: 'ansi-bright-cyan', 97: 'ansi-bright-white'
            };
            const bgColors = {
              40: 'ansi-bg-black', 41: 'ansi-bg-red', 42: 'ansi-bg-green', 43: 'ansi-bg-yellow',
              44: 'ansi-bg-blue', 45: 'ansi-bg-magenta', 46: 'ansi-bg-cyan', 47: 'ansi-bg-white'
            };

            let html = "";
            let currentClasses = new Set();
            
            // 3. Split by color escape sequences: \x1b[ (codes) m
            const parts = text.split(/\\u001b\\[([0-9;]*)m/);
            
            for (let i = 0; i < parts.length; i++) {
               if (i % 2 === 0) {
                 // Text part - Escape HTML entities
                 let part = parts[i]
                   .replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;');
                   
                 if (part) {
                   if (currentClasses.size > 0) {
                     html += '<span class="' + Array.from(currentClasses).join(' ') + '">' + part + '</span>';
                   } else {
                     html += part;
                   }
                 }
               } else {
                 // ANSI code part
                 const codeStr = parts[i];
                 if (!codeStr || codeStr === '0' || codeStr === '') {
                   currentClasses.clear();
                 } else {
                   const codes = codeStr.split(';');
                   codes.forEach(code => {
                     const c = parseInt(code);
                     if (c === 0) {
                       currentClasses.clear();
                     } else if (colors[c]) {
                       // Clear previous foreground colors
                       Object.values(colors).forEach(cls => currentClasses.delete(cls));
                       currentClasses.add(colors[c]);
                     } else if (bgColors[c]) {
                       // Clear previous background colors
                       Object.values(bgColors).forEach(cls => currentClasses.delete(cls));
                       currentClasses.add(bgColors[c]);
                     } else if (c === 1) {
                       currentClasses.add('ansi-bold');
                     }
                   });
                 }
               }
            }
            
            return html;
          }

          async function updateHtop() {
            try {
              const res = await fetch('/api/htop');
              const data = await res.json();
              
              if (data.success) {
                const container = document.getElementById('htop-output');
                container.innerHTML = ansiToHtml(data.output);
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
