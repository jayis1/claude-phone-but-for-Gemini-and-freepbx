/**
 * Generate the Top/Htop-like HTML page
 */
function generateTopPage() {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>TipTop - Mission Control</title>
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
            border-bottom: 2px solid #00f; /* BLUE SEPARATOR requested by user */
            position: relative;
          }
          
          #bottom-panel {
            display: grid;
            grid-template-columns: 1fr 1fr;
            overflow: hidden;
            padding: 5px;
            gap: 5px;
          }
  
          #bottom-left {
            border: 2px solid #f00; /* RED BOX requested by user */
            padding: 10px;
            overflow-y: hidden; /* Controlled by internal sections */
            display: flex;
            flex-direction: column;
          }

          #bottom-right {
            border: 2px solid #0f0; /* GREEN BOX requested by user */
            padding: 10px;
            overflow-y: hidden;
            display: flex;
            flex-direction: column;
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
          /* Control Buttons */
          .control-btn {
             background: #333; color: #fff; padding: 2px 8px; border: 1px solid #555; margin-left: 5px; cursor: pointer; font-size: 12px; font-weight: bold;
          }
          .control-btn:hover { background: #555; }
          .control-btn.kill { color: #f00; border-color: #f00; }
          .control-btn.kill:hover { background: #300; }
          .header-badge { color: #000; background: #0f0; padding: 2px 5px; font-weight: bold; }
          #clock { color: #0ff; font-weight: bold; font-size: 1.2rem; }
  
          .stats-container { display: flex; gap: 40px; margin-bottom: 10px; font-size: 12px; }
          .bar-row { margin-bottom: 2px; display: flex; align-items: center; }
          .bar-label { display: inline-block; width: 40px; color: #0ff; font-weight: bold; }
          .bar-track { display: inline-block; width: 250px; background: #222; position: relative; height: 14px; margin-right: 17px; }
          .bar-fill { height: 100%; background: #0f0; display: block; }
          .bar-text { color: #fff; }
  
          .table-container { flex: 1; overflow-y: scroll; position: relative; } /* Scrollable */
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          thead { position: sticky; top: 0; z-index: 10; background: #000; }
          th { text-align: left; background: #004400; color: #fff; padding: 2px 5px; cursor: pointer; user-select: none; }
          th:hover { background: #006600; }
          td { padding: 2px 5px; color: #ccc; cursor: pointer; }
          
          /* Sort Indicator */
          th.sorted-asc::after { content: " ▲"; color: #0f0; }
          th.sorted-desc::after { content: " ▼"; color: #0f0; }

          /* Row Selection */
          tr { border-bottom: 1px solid #111; }
          tr:hover td { background: #111; }
          tr.selected td { background: #004400; color: #fff !important; }
          tr.selected .pid { color: #fff !important; }
          
          .pid { color: #fff; font-weight: bold; } .user { color: #ff0; } .cmd { color: #fff; font-weight: bold; }

  
          /* === BOTTOM SECTIONS CONTENT === */
          .section-title { font-size: 1.1rem; margin-bottom: 5px; border-bottom: 1px dashed #555; padding-bottom: 5px; color: #fff; display: flex; justify-content: space-between; align-items: center;}
          
          /* === NOTES UI (RED BOX) === */
          .btn-sm { 
            background: #333; 
            color: #fff; 
            border: 1px solid #555; 
            padding: 5px 12px; 
            cursor: pointer; 
            font-size: 0.8rem; 
            border-radius: 4px; 
            z-index: 1000; 
            position: relative; 
            display: inline-block; 
            vertical-align: middle;
            transition: all 0.2s ease;
            pointer-events: auto;
            user-select: none;
          }
          .btn-sm:hover { 
            background: #004400; 
            border-color: #0f0; 
            color: #fff; 
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.4);
          }
          .btn-sm:active { 
            background: #0f0; 
            color: #000;
            transform: translateY(1px); 
          }
          
          #notes-list-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
          #notes-list { flex: 1; overflow-y: auto; padding-right: 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; align-content: start; }
          
          .note-card { background: #111; border: 1px solid #333; padding: 10px; cursor: pointer; transition: background 0.2s; height: 100px; display: flex; flex-direction: column; }
          .note-card:hover { background: #1a1a1a; border-color: #555; }
          .note-card-title { color: #f00; font-weight: bold; margin-bottom: 6px; display: flex; justify-content: space-between; font-size: 0.95rem; }
          .note-card-prev { color: #aaa; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; flex: 1; }
          
          #note-editor { display: none; flex-direction: column; height: 100%; }
          #edit-title { background: #000; color: #f00; border: 1px solid #333; padding: 5px; margin-bottom: 5px; font-weight: bold; width: 100%; font-family: inherit; font-size: 1rem; }
          #edit-content { flex: 1; background: #000; color: #ddd; border: 1px solid #333; padding: 10px; resize: none; margin-bottom: 5px; font-family: inherit; font-size: 0.9rem; line-height: 1.4; }
          .editor-actions { display: flex; gap: 5px; justify-content: flex-end; }

          /* === RECENT CALLS UI (GREEN BOX) === */
          #calls-list { flex: 1; overflow-y: auto; }
          .call-item { display: flex; align-items: center; padding: 5px; border-bottom: 1px solid #111; font-size: 0.9rem; }
          .call-item:hover { background: #111; }
          .call-icon { width: 24px; text-align: center; margin-right: 10px; font-size: 1.2rem; }
          .call-details { flex: 1; }
          .call-number { color: #fff; font-weight: bold; }
          .call-time { color: #666; font-size: 0.8rem; }
          .call-status { padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-left: 10px; }
          .status-completed { background: #0f0; color: #000; }
          .status-failed { background: #f00; color: #fff; }
  
        </style>
      </head>
      <body>
        <!-- TOP: SYSTEM MONITOR -->
        <div id="top-panel">
          <div class="nav-bar">
            <div>
               <a href="/" class="back-btn">← ESC</a>
               <button class="control-btn" onclick="toggleSort('cpu')">F6 SortBy</button>
               <button class="control-btn kill" onclick="killSelected()">F9 KILL</button>
            </div>
            <div class="header-badge">TipTop Task Manager</div>
            <div id="ai-pid-summary" style="color: #0f0; font-size: 11px; font-weight: bold; margin-left: 20px;">AI STACK PIDs: Loading...</div>
            <div id="clock" style="margin-left: auto;">00:00:00</div>
          </div>
  
          <div class="stats-container">
            <div class="column">
              <div class="bar-row"><span class="bar-label">CPU</span><div class="bar-track"><span class="bar-fill" id="cpu-bar" style="width: 0%"></span></div><span class="bar-text" id="cpu-text">0.0%</span></div>
              <div class="bar-row"><span class="bar-label">MEM</span><div class="bar-track"><span class="bar-fill" id="mem-bar" style="width: 0%"></span></div><span class="bar-text" id="mem-text">0/0</span></div>
              <div class="bar-row"><span class="bar-label">SWP</span><div class="bar-track"><span class="bar-fill" id="swap-bar" style="width: 0%"></span></div><span class="bar-text" id="swap-text">0/0</span></div>
            </div>
            <div class="column" style="margin-left:auto; text-align: right; color: #aaa;">
               <div>Tasks: <span style="color:#fff" id="tasks-total">0</span>, <span style="color:#0f0" id="tasks-run">0</span> run</div>
               <div>Up: <span id="uptime" style="color:#fff">00:00:00</span></div>
               <div id="load-avg" style="color:#0ff">0.00 0.00 0.00</div>
            </div>
          </div>
  
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th onclick="setSort('pid')">PID</th>
                  <th onclick="setSort('user')">USER</th>
                  <th onclick="setSort('pri')">PRI</th>
                  <th onclick="setSort('ni')">NI</th>
                  <th onclick="setSort('virt')">VIRT</th>
                  <th onclick="setSort('res')">RES</th>
                  <th onclick="setSort('s')">S</th>
                  <th onclick="setSort('cpu')">CPU%</th>
                  <th onclick="setSort('mem')">MEM%</th>
                  <th onclick="setSort('time')">TIME+</th>
                  <th onclick="setSort('cmd')">COMMAND</th>
                </tr>
              </thead>
              <tbody id="process-list"></tbody>
            </table>
          </div>
        </div>
  
        <!-- BOTTOM PANEL -->
        <div id="bottom-panel">
          
          <!-- LEFT: NOTES (RED BOX) -->
          <div id="bottom-left">
            <!-- List View -->
            <div id="notes-list-view">
               <div class="section-title">
                 <span>MY NOTES / SCRATCHPAD</span>
                 <button class="btn-sm" onclick="newNote()">+ New Note</button>
               </div>
               <div id="notes-list">
                 <div style="color: #666; font-style: italic; text-align: center; margin-top: 20px; width: 100%;">Loading notes...</div>
               </div>
            </div>
  
            <!-- Editor View ("Fane") -->
            <div id="note-editor">
               <input type="hidden" id="edit-id">
               <input type="text" id="edit-title" placeholder="Note Title...">
               <textarea id="edit-content" placeholder="Type your note here..."></textarea>
               <div class="editor-actions">
                 <button class="btn-sm" style="color:#f00; border-color:#f00" onclick="deleteNote()">Delete</button>
                 <button class="btn-sm" onclick="cancelEdit()">Cancel</button>
                 <button class="btn-sm" style="background:#004400; border-color:#0f0" onclick="saveNote()">SAVE</button>
               </div>
            </div>
          </div>

          <!-- RIGHT: RECENT CALLS (GREEN BOX) -->
          <div id="bottom-right">
              <div class="section-title">
                <span>RECENT CALLS</span>
                <button class="btn-sm" id="btn-refresh" onclick="console.log('Refresh Clicked'); fetchCalls()">Refresh</button>
              </div>
             <div id="calls-list">
                <div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">Loading calls...</div>
             </div>
          </div>
  
        </div>
  
        <!-- Persistent Audio Element -->
        <audio id="global-player" style="display:none"></audio>
  
        <!-- SCRIPTS -->
        <script>
          /* UTILS */
          function formatBytes(bytes) { if (bytes===0) return '0K'; const k=1024, sizes=['K','M','G','T'], i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+sizes[i]; }
          function formatTime(s) { const h=Math.floor(s/3600).toString().padStart(2,'0'), m=Math.floor((s%3600)/60).toString().padStart(2,'0'), sec=Math.floor(s%60).toString().padStart(2,'0'); return \`\${h}:\${m}:\${sec}\`; }
          function timeAgo(date) {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " years ago";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " months ago";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " days ago";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " hours ago";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " minutes ago";
            return "just now";
          }
  
          /* TIPTOP LOGIC */
          let currentProcesses = [];
          
          // State
          let sortBy = 'cpu';
          let sortDesc = true;
          let selectedPid = null;
          let currentAudio = null; // Track playing audio

          function playRecording(url) {
             console.log('[DEBUG] playRecording called for:', url);
             const player = document.getElementById('global-player');
             if(!player) {
                console.error('[ERROR] global-player element not found');
                return;
             }
             
             // Proxy through Mission Control
             const proxyUrl = '/api/proxy/voice' + url;
             console.log('[DEBUG] Playing through proxy:', proxyUrl);
             
             player.pause();
             player.src = proxyUrl;
             player.load();
             player.play().then(() => {
                console.log('[DEBUG] Playback started successfully');
             }).catch(e => {
                if (e.name === 'AbortError') return; // Ignore intentional interruptions
                console.error('[ERROR] Playback failed:', e);
                alert('Playback failed: ' + e.message + '\\nSource: ' + proxyUrl);
             });
          }

          function setSort(col) {
             if(sortBy === col) {
                sortDesc = !sortDesc;
             } else {
                sortBy = col;
                sortDesc = true; // Default desc for new col
                if(col === 'pid' || col === 'user' || col === 'cmd') sortDesc = false; // Asc for text/id
             }
             updateTable();
          }

          function toggleSort(col) { setSort(col); }

          function selectRow(pid) {
             selectedPid = (selectedPid === pid) ? null : pid;
             updateTableRendering(); // Just re-render dom, don't re-sort
          }

          async function killSelected() {
             if(!selectedPid) return alert('Select a process first!');
             const p = currentProcesses.find(proc => proc.pid === selectedPid);
             const name = p ? p.cmd : selectedPid;
             if(!confirm('KILL process ' + name + ' (PID: ' + selectedPid + ')?')) return;
             
             try {
                const res = await fetch('/api/process/kill', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pid: selectedPid })
                });
                const data = await res.json();
                if (data.success) {
                  alert('Kill signal sent to ' + selectedPid);
                  selectedPid = null;
                } else {
                  alert('Kill failed: ' + data.error);
                }
             } catch(e) { alert('Request failed: ' + e.message); }
          }

          async function updateStats() {
            try {
              document.getElementById('clock').innerText = new Date().toLocaleTimeString();
              const res = await fetch('/api/system/stats');
              const data = await res.json();
              
              // Update Bars
              const cpu = data.cpu.currentLoad;
              document.getElementById('cpu-bar').style.width = cpu + '%';
              document.getElementById('cpu-text').innerText = cpu + '%';
  
              const memVals = data.mem;
              const memPct = (memVals.active / memVals.total) * 100;
              document.getElementById('mem-bar').style.width = memPct + '%';
              document.getElementById('mem-text').innerText = formatBytes(memVals.active) + '/' + formatBytes(memVals.total);
              
              document.getElementById('uptime').innerText = formatTime(data.uptime || 0);
              const loads = data.load || "0.00";
              document.getElementById('load-avg').innerText = loads;
              
              if(data.tasks) {
                 document.getElementById('tasks-total').innerText = data.tasks.total;
                 document.getElementById('tasks-run').innerText = data.tasks.running;
              }
              
              // Store processes
              currentProcesses = data.processes || [];
              updateTable();
              
            } catch(e) { console.error(e); }
          }
          
          function updateTable() {
             // Soriting
             currentProcesses.sort((a, b) => {
                let valA = a[sortBy];
                let valB = b[sortBy];
                
                // Handle strings
                if(typeof valA === 'string') valA = valA.toLowerCase();
                if(typeof valB === 'string') valB = valB.toLowerCase();
                
                if (valA < valB) return sortDesc ? 1 : -1;
                if (valA > valB) return sortDesc ? -1 : 1;
                return 0;
             });
             
             updateTableRendering();
          }

          function updateTableRendering() {
              const tbody = document.getElementById('process-list');
              tbody.innerHTML = '';
              
              // Update Headers (Arrow)
              document.querySelectorAll('th').forEach(th => {
                  th.className = '';
                  const thText = th.innerText.toLowerCase();
                  if(thText.includes(sortBy) || 
                    (sortBy === 'time' && thText.includes('time')) ||
                    (sortBy === 'virt' && thText.includes('virt'))) {
                     th.className = sortDesc ? 'sorted-desc' : 'sorted-asc';
                  }
              });

              currentProcesses.forEach(p => {
                const row = document.createElement('tr');
                if(p.pid === selectedPid) row.className = 'selected';
                row.onclick = () => selectRow(p.pid);
                
                const dotStyle = p.isAi ? 'color: #0f0; font-weight: bold;' : '';
                
                row.innerHTML = \`
                  <td class="pid" style="\${dotStyle}">\${p.pid}</td>
                  <td class="user" style="\${dotStyle}">\${p.user}</td>
                  <td style="\${dotStyle}">\${p.pri}</td>
                  <td style="\${dotStyle}">\${p.ni}</td>
                  <td style="\${dotStyle}">\${p.virt}</td>
                  <td style="\${dotStyle}">\${p.res}</td>
                  <td style="\${dotStyle}">\${p.s}</td>
                  <td style="\${dotStyle}">\${p.cpu}%</td>
                  <td style="\${dotStyle}">\${p.mem}%</td>
                  <td style="\${dotStyle}">\${p.time}</td>
                  <td class="cmd" style="\${dotStyle}">\${p.cmd}</td>
                \`;
                tbody.appendChild(row);
              });

              // Update AI Summary
              const aiProcesses = currentProcesses.filter(p => p.isAi);
              const summaryText = aiProcesses.map(p => {
                const parts = p.cmd.split(/\\s+/);
                const name = parts[0].split('/').pop();
                return name + ':' + p.pid;
              }).join(' | ');
              const summaryEl = document.getElementById('ai-pid-summary');
              if (summaryEl) summaryEl.innerText = 'AI STACK PIDs: ' + (summaryText || 'None detected');
          }

          setInterval(updateStats, 2000);
          updateStats();
          
          /* NOTES LOGIC */
          let currentNotes = [];
  
          async function fetchNotes() {
            try {
              // Try local server path first since this is served by Mission Control
              const res = await fetch('/api/notes'); 
              if (!res.ok) throw new Error('Failed to load notes');
              currentNotes = await res.json();
              renderNotes();
            } catch(e) { 
               console.error('Failed to load notes', e); 
               // Fallback / Mock
               // currentNotes = [{id:1, title:'Welcome', content:'This is your scratchpad.', timestamp: Date.now()}];
               // renderNotes();
            }
          }
  
          function renderNotes() {
            const list = document.getElementById('notes-list');
            list.innerHTML = '';
            if(currentNotes.length === 0) {
              list.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; margin-top: 20px; width:100%">No notes yet. Start typing...</div>';
              return;
            }
            currentNotes.forEach(note => {
               const div = document.createElement('div');
               div.className = 'note-card';
               div.onclick = () => editNote(note.id);
               div.innerHTML = \\\`
                 <div class="note-card-title">
                    <span>\\\\\\\${note.title || '(Untitled)'}</span>
                    <span style="font-weight:normal; color:#666; font-size:0.8em">\\\\\\\${new Date(note.timestamp).toLocaleDateString()}</span>
                 </div>
                 <div class="note-card-prev">\\\\\\\${note.content || ''}</div>
               \\\`;
               list.appendChild(div);
            });
          }
  
          function newNote() {
            document.getElementById('edit-id').value = '';
            document.getElementById('edit-title').value = '';
            document.getElementById('edit-content').value = '';
            showEditor(true);
          }
  
          function editNote(id) {
            const note = currentNotes.find(n => n.id === id);
            if(!note) return;
            document.getElementById('edit-id').value = note.id;
            document.getElementById('edit-title').value = note.title || '';
            document.getElementById('edit-content').value = note.content || '';
            showEditor(true);
          }
  
          function showEditor(show) {
            document.getElementById('notes-list-view').style.display = show ? 'none' : 'flex';
            document.getElementById('note-editor').style.display = show ? 'flex' : 'none';
          }
  
          function cancelEdit() { showEditor(false); }
  
          async function saveNote() {
            const id = document.getElementById('edit-id').value;
            const title = document.getElementById('edit-title').value;
            const content = document.getElementById('edit-content').value;
            
            if(!title && !content) { alert('Writes something!'); return; }
  
            try {
              await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: id || null, title, content })
              });
              await fetchNotes(); // Reload
              showEditor(false);
            } catch(e) { alert('Save failed'); console.error(e); }
          }
  
          async function deleteNote() {
             const id = document.getElementById('edit-id').value;
             if(!id) { showEditor(false); return; }
             if(!confirm('Delete this note?')) return;
             
             try {
               await fetch('/api/notes/' + id, { method: 'DELETE' });
               await fetchNotes();
               showEditor(false);
             } catch(e) { alert('Delete failed'); }
          }

          /* RECENT CALLS LOGIC */
          async function fetchCalls() {
             console.log('[DEBUG] fetchCalls triggered');
             const list = document.getElementById('calls-list');
             try {
                // The Voice App is on port 3000, but Mission Control is on 3030.
                // We need to proxy through Mission Control -> Voice App
                // Assuming Mission Control has a proxy set up or we fetch directly if CORS allows.
                // Since Mission-Control's server isn't shown here, we assume it proxies /api/voice/history 
                // OR we assume user is hitting Voice App directly if this page is rendered by Voice App.
                // But this file seems to be rendered by Mission Control.
                // Let's assume there is a proxy at /api/proxy/voice/history or similar.
                // Wait, the user said "Mission Control Page 2". 
                // Let's try fetching from the voice app URL via client-side if possible, or assume proxy.
                // Voice App is usually http://localhost:3000.
                
const res = await fetch('/api/proxy/voice/api/history'); // Using Mission Control proxy
               if(!res.ok) throw new Error('API failed with ' + res.status);
               
               const data = await res.json();
               console.log('[DEBUG] Calls data received:', data.history?.length || 0, 'calls');
               if(data.history) renderCalls(data.history);
             } catch(e) {
               console.error('[ERROR] fetchCalls failed:', e);
               list.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">Failed to load calls.<br>Is Voice App running?</div>';
             }
          }

          function renderCalls(calls) {
             const list = document.getElementById('calls-list');
             list.innerHTML = '';
             
             if(!calls || calls.length === 0) {
                list.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">No recent calls.</div>';
                return;
             }
             
             calls.forEach(call => {
                const isInbound = call.type === 'inbound';
                const icon = isInbound ? '📞' : '📡';
                const color = isInbound ? '#0ff' : '#f0f';
                const number = isInbound ? call.from : call.to;
                const statusClass = call.status === 'completed' ? 'status-completed' : 'status-failed';
                let actionHtml = '';
                 if(call.recordingUrl) {
                    // Use single quotes for inner HTML to avoid nested backtick hell
                    actionHtml = '<button class="btn-sm" style="margin-left:auto; background:#222; border-color:#444;" onclick="event.stopPropagation(); playRecording(\\'' + call.recordingUrl + '\\')">▶️ Play</button>';
                 }

                const item = document.createElement('div');
                item.className = 'call-item';
                item.innerHTML = \`
                  <div class="call-icon" style="color:\${color}">\${icon}</div>
                  <div class="call-details">
                    <div class="call-number">\${number || 'Unknown'}</div>
                    <div class="call-time">\${timeAgo(call.timestamp)} • \${call.duration}s</div>
                  </div>
                  \${actionHtml}
                  <div class="call-status \${statusClass}">\${call.status}</div>
                \`;
                list.appendChild(item);
             });
          }
  
          // Initial Load
          fetchNotes();
          fetchCalls();
          setInterval(fetchCalls, 5000); // Poll calls
        </script>
      </body>
      </html>
    `;
}

module.exports = generateTopPage;
