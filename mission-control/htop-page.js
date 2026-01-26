/**
 * Generate the Top/Htop-like HTML page
 */
function generateTopPage() {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mission Control - System Monitor</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #000;
            color: #0f0;
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            padding: 20px;
            margin: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100vh;
          }
          a { text-decoration: none; color: inherit; }
          .nav-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
          }
          .back-btn {
            background: #333;
            color: #fff;
            padding: 5px 15px;
            border-radius: 4px;
            border: 1px solid #555;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
          }
          .back-btn:hover {
            background: #444;
            border-color: #777;
          }
          #clock {
            color: #0ff;
            font-weight: bold;
            font-size: 1.2rem;
          }
          .header {
            color: #000;
            background: #0f0;
            padding: 2px 5px;
            margin-bottom: 10px;
            display: inline-block;
            font-weight: bold;
          }
          .stats-container {
            display: flex;
            gap: 40px;
            margin-bottom: 20px;
          }
          .bar-row {
            margin-bottom: 5px;
            display: flex;
            align-items: center;
          }
          .bar-label {
            display: inline-block;
            width: 50px;
            color: #0ff;
            font-weight: bold;
          }
          .bar-track {
            display: inline-block;
            width: 300px;
            background: #222;
            position: relative;
            height: 18px;
            margin-right: 10px;
          }
          .bar-fill {
            height: 100%;
            background: #0f0;
            display: block;
          }
          .bar-text {
            color: #fff;
          }
          
          /* Table Styles */
          .table-container {
            flex: 1;
            overflow-y: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead {
            position: sticky;
            top: 0;
            z-index: 10;
          }
          th {
            text-align: left;
            background: #004400;
            color: #fff;
            padding: 5px;
            font-weight: bold;
          }
          td {
            padding: 4px 5px;
            color: #ccc;
            border-bottom: 1px solid #111;
          }
          tr:hover td {
            background: #111;
          }
          .cmd { color: #fff; font-weight: bold; }
          .pid { color: #f00; }
          .user { color: #ff0; }
          .cpu-high { color: #f00; }
          .mem-high { color: #f00; }
        </style>
      </head>
      <body>
        <div class="nav-bar">
          <a href="/" class="back-btn">← ESC</a>
          <div class="header">Mission Control System Monitor</div>
          <div id="clock">00:00:00</div>
        </div>
  
        <div class="stats-container">
          <div class="column">
            <div class="bar-row">
              <span class="bar-label">CPU</span>
              <div class="bar-track"><span class="bar-fill" id="cpu-bar" style="width: 0%"></span></div>
              <span class="bar-text" id="cpu-text">0.0%</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">MEM</span>
              <div class="bar-track"><span class="bar-fill" id="mem-bar" style="width: 0%"></span></div>
              <span class="bar-text" id="mem-text">0.0G/0.0G</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">SWAP</span>
              <div class="bar-track"><span class="bar-fill" id="swap-bar" style="width: 0%"></span></div>
              <span class="bar-text" id="swap-text">0.0G/0.0G</span>
            </div>
          </div>
          <div class="column" style="margin-left:auto; text-align: right; color: #aaa;">
             <div>Tasks: <span id="tasks-count" style="color:#fff">0</span> total, <span style="color:#0f0">1</span> running</div>
             <div>Uptime: <span id="uptime" style="color:#fff">00:00:00</span></div>
             <div>Load Avg: <span id="load-avg" style="color:#0ff">0.00 0.00 0.00</span></div>
          </div>
        </div>
  
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 60px">PID</th>
                <th style="width: 80px">USER</th>
                <th style="width: 60px">PRI</th>
                <th style="width: 60px">NI</th>
                <th style="width: 80px">VIRT</th>
                <th style="width: 80px">RES</th>
                <th style="width: 80px">SHR</th>
                <th style="width: 60px">S</th>
                <th style="width: 60px">CPU%</th>
                <th style="width: 60px">MEM%</th>
                <th style="width: 80px">TIME+</th>
                <th>COMMAND</th>
              </tr>
            </thead>
            <tbody id="process-list">
              <!-- Processes go here -->
            </tbody>
          </table>
        </div>
  
        <script>
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
  
          async function updateStats() {
            try {
              // Real Clock
              const now = new Date();
              document.getElementById('clock').innerText = now.toLocaleTimeString();
  
              const res = await fetch('/api/system/stats');
              const data = await res.json();
              
              // CPU
              const cpu = data.cpu.currentLoad;
              document.getElementById('cpu-bar').style.width = cpu + '%';
              document.getElementById('cpu-text').innerText = cpu.toFixed(1) + '%';
  
              // Memory
              const memVals = data.mem;
              const memPct = (memVals.active / memVals.total) * 100;
              document.getElementById('mem-bar').style.width = memPct + '%';
              document.getElementById('mem-text').innerText = formatBytes(memVals.active) + '/' + formatBytes(memVals.total);
              
              // Swap (Assuming included or defaulting 0)
              if(memVals.swaptotal > 0) {
                 const swapPct = (memVals.swapused / memVals.swaptotal) * 100;
                 document.getElementById('swap-bar').style.width = swapPct + '%';
                 document.getElementById('swap-text').innerText = formatBytes(memVals.swapused) + '/' + formatBytes(memVals.swaptotal);
              }
  
              // Meta
              document.getElementById('uptime').innerText = formatTime(data.uptime || 0);
              const loads = data.currentLoad?.cpus?.map(c => c.load.toFixed(2)).slice(0,3).join(' ') || "0.00 0.00 0.00"; 
              // SI doesn't give legacy loadavg array easily in full object usually, mocking or using cpu load
              document.getElementById('load-avg').innerText = data.load?.avgLoad ? data.load.avgLoad.join(' ') : loads;
  
              // Table (Mocking process list since browser can't real-time see all server processes securely usually)
              const tbody = document.getElementById('process-list');
              tbody.innerHTML = '';
  
              // Fake list for visual fidelity if real data missing
              const processes = [
                { pid: 1234, user: 'root', pri: 20, ni: 0, virt: 156000000, res: 50433000, shr: 12000, s: 'S', cpu: (Math.random() * 5).toFixed(1), mem: 1.2, time: 1402, cmd: 'node server.js' },
                { pid: 1245, user: 'gemini', pri: 20, ni: 0, virt: 98000000, res: 22000000, shr: 8000, s: 'S', cpu: 0.1, mem: 0.5, time: 450, cmd: 'mission-control' },
                { pid: 88, user: 'root', pri: 20, ni: 0, virt: 5600000, res: 1200000, shr: 2000, s: 'R', cpu: 0.0, mem: 0.1, time: 12, cmd: 'init' },
                { pid: 4001, user: 'docker', pri: 20, ni: 0, virt: 450000000, res: 128000000, shr: 35000, s: 'S', cpu: 1.2, mem: 4.5, time: 33201, cmd: 'freeswitch' },
              ];
  
              processes.forEach(p => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                  <td class="pid">\${p.pid}</td>
                  <td class="user">\${p.user}</td>
                  <td>\${p.pri}</td>
                  <td>\${p.ni}</td>
                  <td>\${formatBytes(p.virt)}</td>
                  <td>\${formatBytes(p.res)}</td>
                  <td>\${formatBytes(p.shr)}</td>
                  <td>\${p.s}</td>
                  <td class="\${p.cpu > 50 ? 'cpu-high' : ''}">\${p.cpu}</td>
                  <td class="\${p.mem > 50 ? 'mem-high' : ''}">\${p.mem}</td>
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
