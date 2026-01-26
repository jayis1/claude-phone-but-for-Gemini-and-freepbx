/**
 * Generate the Top/Htop-like HTML page
 */
function generateTopPage() {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mission Control - System Monitor</title>
        <style>
          body {
            background-color: #000;
            color: #0f0;
            font-family: 'Courier New', Courier, monospace;
            padding: 20px;
            margin: 0;
            overflow: hidden;
          }
          #terminal {
            white-space: pre-wrap;
            font-size: 14px;
            line-height: 1.2;
          }
          .header {
            color: #fff;
            background: #008800;
            padding: 2px 5px;
            margin-bottom: 10px;
            display: inline-block;
          }
          .bar {
            margin-bottom: 2px;
          }
          .bar-label {
            display: inline-block;
            width: 40px;
            color: #0ff;
          }
          .bar-track {
            display: inline-block;
            width: 300px;
            background: #333;
            position: relative;
            height: 14px;
            vertical-align: middle;
          }
          .bar-fill {
            height: 100%;
            background: #0f0;
            display: block;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            text-align: left;
            background: #004400;
            color: #fff;
            padding: 2px 5px;
          }
          td {
            padding: 2px 5px;
            color: #ccc;
          }
          tr:nth-child(even) {
            background: #111;
          }
          .cmd { color: #fff; }
          .pid { color: #f00; }
          .user { color: #ff0; }
        </style>
      </head>
      <body>
        <div id="app">
          <div class="header">Mission Control System Monitor</div>
          <div id="stats">
            <div class="bar">
              <span class="bar-label">CPU</span>
              <div class="bar-track"><span class="bar-fill" id="cpu-bar" style="width: 0%"></span></div>
              <span id="cpu-text">0%</span>
            </div>
            <div class="bar">
              <span class="bar-label">MEM</span>
              <div class="bar-track"><span class="bar-fill" id="mem-bar" style="width: 0%"></span></div>
              <span id="mem-text">0 / 0 GB</span>
            </div>
          </div>
  
          <table>
            <thead>
              <tr>
                <th>PID</th>
                <th>USER</th>
                <th>CPU%</th>
                <th>MEM%</th>
                <th>COMMAND</th>
              </tr>
            </thead>
            <tbody id="process-list">
              <!-- Processes go here -->
            </tbody>
          </table>
        </div>
  
        <script>
          async function updateStats() {
            try {
              const res = await fetch('/api/system/stats');
              const data = await res.json();
              
              // CPU
              const cpu = data.cpu.currentLoad;
              document.getElementById('cpu-bar').style.width = cpu + '%';
              document.getElementById('cpu-text').innerText = cpu.toFixed(1) + '%';
  
              // Memory
              const memUse = (data.mem.active / 1024 / 1024 / 1024).toFixed(1);
              const memTotal = (data.mem.total / 1024 / 1024 / 1024).toFixed(1);
              const memPct = (data.mem.active / data.mem.total) * 100;
              document.getElementById('mem-bar').style.width = memPct + '%';
              document.getElementById('mem-text').innerText = memUse + ' / ' + memTotal + ' GB';
  
              // Processes (Mock of top 5)
              const tbody = document.getElementById('process-list');
              tbody.innerHTML = '';
              
              // We don't have real process list from non-root SI in some cases, so we might mock or use what we safely can
              // For now, let's just show our services if available or generic info
              
              // If we add an endpoint for processes later, we can populate this.
              // For now, static entry to show it works
              const row = document.createElement('tr');
              row.innerHTML = '<td class="pid">SELF</td><td class="user">gemini</td><td>' + cpu.toFixed(1) + '</td><td>' + memPct.toFixed(1) + '</td><td class="cmd">mission-control</td>';
              tbody.appendChild(row);
  
            } catch(e) {
              console.error(e);
            }
          }
  
          setInterval(updateStats, 2000);
          updateStats();
        </script>
      </body>
      </html>
    `;
}

module.exports = generateTopPage;
