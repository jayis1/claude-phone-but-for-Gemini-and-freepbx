/**
 * Generate the Top/Htop-like HTML page
 */
function generateTopPage() {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mission Control - Command Center</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
          /* Core Layout */
          body {
            background-color: #000;
            color: #0f0;
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            padding: 0;
            margin: 0;
            overflow: hidden;
            display: grid;
            grid-template-rows: 60% 40%;
            height: 100vh;
            width: 100vw;
          }
          * { box-sizing: border-box; }
          a { text-decoration: none; color: inherit; }
  
          /* === SECTIONS === */
          #top-panel {
            padding: 15px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border-bottom: 2px solid #00f; /* BLUE SEPARATOR asked by user */
            position: relative;
          }
          
          #bottom-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            overflow: hidden;
          }
  
          #bottom-left {
            border-right: 2px solid #333;
            padding: 10px;
            border: 2px solid #f00; /* RED BOX asked by user */
            margin: 5px;
            overflow-y: auto;
          }
  
          #bottom-right {
            display: grid;
            grid-template-rows: 1fr auto; /* Playlist takes space, Input takes auto */
            border: 2px solid #0f0; /* GREEN BOX asked by user */
            margin: 5px;
            overflow: hidden;
          }
  
          #playlist-area {
            padding: 10px;
            overflow-y: auto;
          }
  
          #input-area {
            background: #222; /* GRAY BOX asked by user */
            padding: 10px;
            border-top: 1px solid #0f0;
            display: flex;
            align-items: center;
          }
  
          /* === TOP PANEL (HTOP STYLE) === */
          .nav-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
          .back-btn {
            background: #333; color: #fff; padding: 2px 8px; border: 1px solid #555; cursor: pointer; font-size: 12px;
          }
          .header-badge { color: #000; background: #0f0; padding: 2px 5px; font-weight: bold; }
          #clock { color: #0ff; font-weight: bold; font-size: 1.2rem; }
  
          .stats-container { display: flex; gap: 40px; margin-bottom: 10px; font-size: 12px; }
          .bar-row { margin-bottom: 2px; display: flex; align-items: center; }
          .bar-label { display: inline-block; width: 40px; color: #0ff; font-weight: bold; }
          .bar-track { display: inline-block; width: 250px; background: #222; position: relative; height: 14px; margin-right: 10px; }
          .bar-fill { height: 100%; background: #0f0; display: block; }
          .bar-text { color: #fff; }
  
          .table-container { flex: 1; overflow-y: hidden; position: relative; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          thead { position: sticky; top: 0; z-index: 10; background: #000; }
          th { text-align: left; background: #004400; color: #fff; padding: 2px 5px; }
          td { padding: 2px 5px; color: #ccc; }
          tr:hover td { background: #111; }
          .pid { color: #f00; } .user { color: #ff0; } .cmd { color: #fff; font-weight: bold; }
  
          /* === BOTTOM SECTIONS CONTENT === */
          .section-title { font-size: 1.2rem; margin-bottom: 10px; border-bottom: 1px dashed #555; padding-bottom: 5px; color: #fff; }
          
          /* Playlist Items */
          .playlist-item { display: flex; gap: 10px; margin-bottom: 5px; padding: 5px; border-bottom: 1px solid #111; }
          .song-thumb { width: 50px; height: 40px; background: #444; }
          .song-info { display: flex; flex-direction: column; justify-content: center; }
          .song-title { color: #fff; font-weight: bold; }
          .song-meta { font-size: 0.8rem; color: #888; }
  
          /* Input Form */
          input[type="text"] {
            flex: 1; background: #000; border: 1px solid #444; color: #fff; padding: 8px; font-family: inherit; font-size: 1rem;
          }
          button.add-btn {
            background: #004400; color: #fff; border: none; padding: 8px 15px; margin-left: 5px; cursor: pointer; font-weight: bold;
          }
          button.add-btn:hover { background: #006600; }
  
          /* Ideas Area */
          .idea-card { background: #111; border: 1px solid #333; padding: 10px; margin-bottom: 10px; color: #ddd; font-family: sans-serif; }
          .idea-title { color: #f00; font-weight: bold; margin-bottom: 5px; }
  
        </style>
      </head>
      <body>
        <!-- TOP: SYSTEM MONITOR -->
        <div id="top-panel">
          <div class="nav-bar">
            <a href="/" class="back-btn">← ESC</a>
            <div class="header-badge">Mission Control System Monitor</div>
            <div id="clock">00:00:00</div>
          </div>
  
          <div class="stats-container">
            <div class="column">
              <div class="bar-row"><span class="bar-label">CPU</span><div class="bar-track"><span class="bar-fill" id="cpu-bar" style="width: 0%"></span></div><span class="bar-text" id="cpu-text">0.0%</span></div>
              <div class="bar-row"><span class="bar-label">MEM</span><div class="bar-track"><span class="bar-fill" id="mem-bar" style="width: 0%"></span></div><span class="bar-text" id="mem-text">0/0</span></div>
              <div class="bar-row"><span class="bar-label">SWP</span><div class="bar-track"><span class="bar-fill" id="swap-bar" style="width: 0%"></span></div><span class="bar-text" id="swap-text">0/0</span></div>
            </div>
            <div class="column" style="margin-left:auto; text-align: right; color: #aaa;">
               <div>Tasks: <span style="color:#fff">24</span>, <span style="color:#0f0">1</span> run</div>
               <div>Up: <span id="uptime" style="color:#fff">00:00:00</span></div>
               <div id="load-avg" style="color:#0ff">0.00 0.00 0.00</div>
            </div>
          </div>
  
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="width:50px">PID</th><th style="width:60px">USER</th><th style="width:40px">PRI</th><th style="width:40px">NI</th><th style="width:60px">VIRT</th><th style="width:60px">RES</th><th style="width:40px">S</th><th style="width:50px">CPU%</th><th style="width:50px">MEM%</th><th style="width:70px">TIME+</th><th>COMMAND</th>
                </tr>
              </thead>
              <tbody id="process-list"></tbody>
            </table>
          </div>
        </div>
  
        <!-- BOTTOM PANEL -->
        <div id="bottom-panel">
          
          <!-- LEFT: IDEAS (RED BOX) -->
          <div id="bottom-left">
            <!-- Reserved for future use -->
          </div>
  
          <!-- RIGHT: PLAYLIST & INPUT (GREEN & GRAY BOXES) -->
          <div id="bottom-right">
            <!-- GREEN BOX: Playlist -->
            <div id="playlist-area">
              <div class="section-title">BRAIN PLAYLIST</div>
              <div id="queue">
                 <div class="playlist-item">
                    <div class="song-thumb" style="background:#cc0000"></div>
                    <div class="song-info"><div class="song-title">Lofi Hip Hop Radio</div><div class="song-meta">ChilledCow • Live</div></div>
                 </div>
                 <div class="playlist-item">
                    <div class="song-thumb" style="background:#0044cc"></div>
                    <div class="song-info"><div class="song-title">Synthwave Mix 2024</div><div class="song-meta">ThePrimeThanatos • 1:04:20</div></div>
                 </div>
                 <div class="playlist-item">
                    <div class="song-thumb" style="background:#cc6600"></div>
                    <div class="song-info"><div class="song-title">Hackers Soundtrack</div><div class="song-meta">OST • 44:02</div></div>
                 </div>
              </div>
            </div>
            
            <!-- GRAY BOX: Input -->
            <div id="input-area">
              <input type="text" placeholder="Add song URL..." id="song-input">
              <button class="add-btn">ADD</button>
            </div>
          </div>
  
        </div>
  
        <!-- SCRIPTS -->
        <script>
          /* UTILS */
          function formatBytes(bytes) {
            if (bytes === 0) return '0K';
            const k = 1024;
            const sizes = ['K', 'M', 'G', 'T'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
          }
          function formatTime(seconds) {
            const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(seconds % 60).toString().padStart(2, '0');
            return \`\${h}:\${m}:\${s}\`;
          }
  
          /* UPDATE LOGIC */
          async function updateStats() {
            try {
              // Real Clock
              document.getElementById('clock').innerText = new Date().toLocaleTimeString();
  
              const res = await fetch('/api/system/stats');
              const data = await res.json();
              
              const cpu = data.cpu.currentLoad;
              document.getElementById('cpu-bar').style.width = cpu + '%';
              document.getElementById('cpu-text').innerText = cpu.toFixed(1) + '%';
  
              const memVals = data.mem;
              const memPct = (memVals.active / memVals.total) * 100;
              document.getElementById('mem-bar').style.width = memPct + '%';
              document.getElementById('mem-text').innerText = formatBytes(memVals.active) + '/' + formatBytes(memVals.total);
              
              document.getElementById('uptime').innerText = formatTime(data.uptime || 0);
              const loads = data.currentLoad?.cpus?.map(c => c.load.toFixed(2)).slice(0,3).join(' ') || "0.00 0.00 0.00"; 
              document.getElementById('load-avg').innerText = loads;
  
              const tbody = document.getElementById('process-list');
              tbody.innerHTML = '';
              const processes = [
                { pid: 1234, user: 'root', pri: 20, ni: 0, virt: 156000000, res: 50433000, s: 'S', cpu: (Math.random() * 2).toFixed(1), mem: 1.2, time: 1402, cmd: 'node server.js' },
                { pid: 1245, user: 'gemini', pri: 20, ni: 0, virt: 98000000, res: 22000000, s: 'S', cpu: 0.1, mem: 0.5, time: 450, cmd: 'mission-control' },
                { pid: 4001, user: 'docker', pri: 20, ni: 0, virt: 450000000, res: 128000000, s: 'S', cpu: 1.2, mem: 4.5, time: 33201, cmd: 'freeswitch' },
              ];
              // Add filler rows
              for(let i=0; i<15; i++) {
                 processes.push({ pid: 5000+i, user: 'root', pri: 20, ni: 0, virt: 10000, res: 2000, s: 'S', cpu: 0.0, mem: 0.0, time: 0, cmd: 'kworker/u'+i });
              }
  
              processes.forEach(p => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                  <td class="pid">\${p.pid}</td>
                  <td class="user">\${p.user}</td>
                  <td>\${p.pri}</td>
                  <td>\${p.ni}</td>
                  <td>\${formatBytes(p.virt)}</td>
                  <td>\${formatBytes(p.res)}</td>
                  <td>\${p.s}</td>
                  <td>\${p.cpu}</td>
                  <td>\${p.mem}</td>
                  <td>\${formatTime(p.time)}</td>
                  <td class="cmd">\${p.cmd}</td>
                \`;
                tbody.appendChild(row);
              });
  
            } catch(e) { console.error(e); }
          }
  
          setInterval(updateStats, 2000);
          updateStats();
        </script>
      </body>
      </html>
    `;
}

module.exports = generateTopPage;
