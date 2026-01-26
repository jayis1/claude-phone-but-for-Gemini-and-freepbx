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
          .header-badge { color: #000; background: #0f0; padding: 2px 5px; font-weight: bold; }
          #clock { color: #0ff; font-weight: bold; font-size: 1.2rem; }
  
          .stats-container { display: flex; gap: 40px; margin-bottom: 10px; font-size: 12px; }
          .bar-row { margin-bottom: 2px; display: flex; align-items: center; }
          .bar-label { display: inline-block; width: 40px; color: #0ff; font-weight: bold; }
          .bar-track { display: inline-block; width: 250px; background: #222; position: relative; height: 14px; margin-right: 17px; }
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
          function formatBytes(bytes) { if (bytes===0) return '0K'; const k=1024, sizes=['K','M','G','T'], i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+sizes[i]; }
          function formatTime(s) { const h=Math.floor(s/3600).toString().padStart(2,'0'), m=Math.floor((s%3600)/60).toString().padStart(2,'0'), sec=Math.floor(s%60).toString().padStart(2,'0'); return \`\${h}:\${m}:\${sec}\`; }
  
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
  
          /* SYSTEM MONITOR LOGIC */
          async function updateStats() {
            try {
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
              document.getElementById('swap-bar').style.width = '0%';
              document.getElementById('swap-text').innerText = '0/0';
  
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
