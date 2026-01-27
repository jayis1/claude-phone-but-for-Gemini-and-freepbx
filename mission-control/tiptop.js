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
          }
  
          #bottom-left {
            border-right: 2px solid #333;
            padding: 10px;
            border: 2px solid #f00; /* RED BOX requested by user */
            margin: 5px;
            overflow-y: hidden; /* Controlled by internal sections */
            display: flex;
            flex-direction: column;
          }
  
          #bottom-right {
            display: grid;
            grid-template-rows: 1fr auto; /* Playlist takes space, Input takes auto */
            border: 2px solid #0f0; /* GREEN BOX requested by user */
            margin: 5px;
            overflow: hidden;
          }
  
          #playlist-area {
            padding: 10px;
            overflow-y: auto;
          }
  
          #input-area {
            background: #222; /* GRAY BOX requested by user */
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
  
          /* === NOTES UI (RED BOX) === */
          .btn-sm { background: #333; color: #fff; border: 1px solid #555; padding: 2px 8px; cursor: pointer; font-size: 0.8rem; }
          .btn-sm:hover { background: #555; }
          
          #notes-list-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
          #notes-list { flex: 1; overflow-y: auto; padding-right: 5px; }
          
          .note-card { background: #111; border: 1px solid #333; padding: 8px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s; }
          .note-card:hover { background: #1a1a1a; border-color: #555; }
          .note-card-title { color: #f00; font-weight: bold; margin-bottom: 4px; display: flex; justify-content: space-between; }
          .note-card-prev { color: #aaa; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          
          #note-editor { display: none; flex-direction: column; height: 100%; }
          #edit-title { background: #000; color: #f00; border: 1px solid #333; padding: 5px; margin-bottom: 5px; font-weight: bold; width: 100%; }
          #edit-content { flex: 1; background: #000; color: #ddd; border: 1px solid #333; padding: 5px; resize: none; margin-bottom: 5px; font-family: inherit; }
          .editor-actions { display: flex; gap: 5px; justify-content: flex-end; }
  
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
            <div id="clock">00:00:00</div>
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
                 <span>MY NOTES</span>
                 <button class="btn-sm" onclick="newNote()">+ New Note</button>
               </div>
               <div id="notes-list">
                 <div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">Loading notes...</div>
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
  
          <!-- RIGHT: PLAYLIST & INPUT (GREEN & GRAY BOXES) -->
          <div id="bottom-right">
            <!-- GREEN BOX: Playlist -->
            <div id="playlist-area">
              <div class="section-title">
                <span>BRAIN PLAYLIST</span>
                <span style="font-size:0.8rem" id="playlist-count">0 items</span>
              </div>
              <div id="queue">
                 <div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">Loading...</div>
              </div>
            </div>
            
            <!-- GRAY BOX: Input -->
            <div id="input-area">
              <input type="text" placeholder="Add song URL..." id="song-input" onkeypress="if(event.key==='Enter') addSong()">
              <button class="add-btn" onclick="addSong()">ADD</button>
            </div>
          </div>
  
        </div>
  
        <!-- SCRIPTS -->
        <script>
          /* UTILS */
          function formatBytes(bytes) { if (bytes===0) return '0K'; const k=1024, sizes=['K','M','G','T'], i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+sizes[i]; }
          function formatTime(s) { const h=Math.floor(s/3600).toString().padStart(2,'0'), m=Math.floor((s%3600)/60).toString().padStart(2,'0'), sec=Math.floor(s%60).toString().padStart(2,'0'); return \`\${h}:\${m}:\${sec}\`; }
  
          /* TIPTOP LOGIC */
          let currentProcesses = [];
          
          // State
          let sortBy = 'cpu';
          let sortDesc = true;
          let selectedPid = null;

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
             if(!confirm('KILL process ' + selectedPid + '?')) return;
             
             try {
                const res = await fetch('/api/process/kill', {
                   method: 'POST',
                   headers: {'Content-Type': 'application/json'},
                   body: JSON.stringify({ pid: selectedPid })
                });
                const d = await res.json();
                if(d.success) {
                   // Optimistic remove
                   currentProcesses = currentProcesses.filter(p => p.pid != selectedPid);
                   selectedPid = null;
                   updateTable();
                } else {
                   alert('Error: ' + d.error);
                }
             } catch(e) { alert('Request failed'); }
          }

          async function updateStats() {
            try {
              document.getElementById('clock').innerText = new Date().toLocaleTimeString();
              const res = await fetch('/api/system/stats');
              const data = await res.json();
              
              // Update Bars
              const cpu = data.cpu.currentLoad;
              document.getElementById('cpu-bar').style.width = cpu + '%';
              document.getElementById('cpu-text').innerText = cpu.toFixed(1) + '%';
  
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
                  if(th.innerText.toLowerCase().includes(sortBy) || 
                    (sortBy === 'time' && th.innerText.includes('TIME')) ||
                    (sortBy === 'virt' && th.innerText.includes('VIRT'))) {
                     th.className = sortDesc ? 'sorted-desc' : 'sorted-asc';
                  }
              });

              currentProcesses.forEach(p => {
                const row = document.createElement('tr');
                if(p.pid === selectedPid) row.className = 'selected';
                row.onclick = () => selectRow(p.pid);
                
                row.innerHTML = \`
                  <td class="pid">\${p.pid}</td>
                  <td class="user">\${p.user}</td>
                  <td>\${p.pri}</td>
                  <td>\${p.ni}</td>
                  <td>\${formatBytes(p.virt || 0)}</td>
                  <td>\${formatBytes(p.res || 0)}</td>
                  <td>\${p.s}</td>
                  <td>\${p.cpu}%</td>
                  <td>\${p.mem}%</td>
                  <td>\${formatTime(p.time || 0)}</td>
                  <td class="cmd">\${p.cmd}</td>
                \`;
                tbody.appendChild(row);
              });
          }

          setInterval(updateStats, 2000);
          updateStats();
          
          /* NOTES LOGIC */
          let currentNotes = [];
  
          async function fetchNotes() {
            try {
              const res = await fetch('/api/notes');
              currentNotes = await res.json();
              renderNotes();
            } catch(e) { console.error('Failed to load notes', e); }
          }
  
          function renderNotes() {
            const list = document.getElementById('notes-list');
            list.innerHTML = '';
            if(currentNotes.length === 0) {
              list.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">No notes yet.</div>';
              return;
            }
            currentNotes.forEach(note => {
               const div = document.createElement('div');
               div.className = 'note-card';
               div.onclick = () => editNote(note.id);
               div.innerHTML = \`
                 <div class="note-card-title">
                    <span>\${note.title || '(Untitled)'}</span>
                    <span style="font-weight:normal; color:#666; font-size:0.8em">\${new Date(note.timestamp).toLocaleDateString()}</span>
                 </div>
                 <div class="note-card-prev">\${note.content || ''}</div>
               \`;
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
  
          // Initial Load
          fetchNotes();
          fetchPlaylist();
  
          /* PLAYLIST LOGIC */
          let currentPlaylist = [];
  
          async function fetchPlaylist() {
            try {
              const res = await fetch('/api/playlist');
              currentPlaylist = await res.json();
              renderPlaylist();
            } catch(e) { console.error('Failed to load playlist', e); }
          }
  
          function renderPlaylist() {
            const list = document.getElementById('queue');
            document.getElementById('playlist-count').innerText = currentPlaylist.length + ' items';
            
            list.innerHTML = '';
            if(currentPlaylist.length === 0) {
              list.innerHTML = '<div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">Queue empty. Add URLs below.</div>';
              return;
            }
            
            currentPlaylist.forEach(item => {
               const div = document.createElement('div');
               div.className = 'playlist-item';
               div.innerHTML = \`
                  <div class="song-thumb" style="background:\${item.color}"></div>
                  <div class="song-info" style="flex:1; overflow:hidden;">
                    <div class="song-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">\${item.title}</div>
                    <div class="song-meta"><a href="\${item.url}" target="_blank" style="color:#888; text-decoration:underline;">\${item.url}</a></div>
                  </div>
                  <button class="btn-sm" style="background:#300; border:1px solid #500; color:#f00;" onclick="removeSong('\${item.id}')">X</button>
               \`;
               list.appendChild(div);
            });
          }
  
          async function addSong() {
            const input = document.getElementById('song-input');
            const url = input.value.trim();
            if(!url) return;
            
            // Simple title extraction or placeholder
            const title = "Track " + (currentPlaylist.length + 1);
  
            try {
              await fetch('/api/playlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, title })
              });
              input.value = '';
              fetchPlaylist();
            } catch(e) { alert('Failed to add song'); }
          }
  
          async function removeSong(id) {
            if(!confirm('Remove this track?')) return;
            try {
              await fetch('/api/playlist/' + id, { method: 'DELETE' });
              fetchPlaylist();
            } catch(e) { alert('Failed to remove song'); }
          }
        </script>
      </body>
      </html>
    `;
}

module.exports = generateTopPage;
