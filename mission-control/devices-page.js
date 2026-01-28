/**
 * Devices Management Page HTML Generator
 * Allows listing, adding, and removing AI phone assistants
 */
module.exports = function generateDevicesPage(devices) {
    const deviceRows = Object.entries(devices).map(([ext, device]) => `
    <tr data-extension="${ext}">
      <td class="px-4 py-3 font-mono text-sm">${ext}</td>
      <td class="px-4 py-3 font-semibold">${device.name}</td>
      <td class="px-4 py-3 text-xs text-dim font-mono">${device.voiceId || 'Default'}</td>
      <td class="px-4 py-3">
        <button onclick="editDevice('${ext}')" class="btn-icon" title="Edit">✏️</button>
        <button onclick="deleteDevice('${ext}')" class="btn-icon text-error" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('');

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mission Control - Device Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg: #09090b;
            --panel: #121214;
            --border: #27272a;
            --text: #e4e4e7;
            --text-dim: #a1a1aa;
            --accent: #8b5cf6;
            --input-bg: #1c1c1f;
            --success: #10b981;
            --error: #ef4444;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            padding: 2rem;
            display: flex;
            justify-content: center;
            min-height: 100vh;
          }
          .container {
            background: var(--panel);
            padding: 2rem;
            border-radius: 16px;
            width: 100%;
            max-width: 1000px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            border: 1px solid var(--border);
          }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
          h1 { font-size: 1.5rem; font-weight: 800; background: linear-gradient(to right, #c084fc, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          
          .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .btn-primary { background: var(--accent); color: white; }
          .btn-secondary { background: #27272a; color: var(--text); border: 1px solid var(--border); }
          .btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
          
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); color: var(--text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
          td { padding: 1rem; border-bottom: 1px solid var(--border); }
          .text-dim { color: var(--text-dim); }
          .font-mono { font-family: 'JetBrains Mono', monospace; }
          .btn-icon { background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 0.25rem; transition: transform 0.1s; }
          .btn-icon:hover { transform: scale(1.2); }

          /* Modal */
          .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; display: none; justify-content: center; align-items: center; backdrop-filter: blur(4px); }
          .modal { background: var(--panel); border: 1px solid var(--border); padding: 2rem; border-radius: 12px; width: 90%; max-width: 500px; }
          .modal-header { margin-bottom: 1.5rem; }
          .form-group { margin-bottom: 1rem; }
          label { display: block; margin-bottom: 0.4rem; font-size: 0.75rem; color: var(--text-dim); font-weight: 600; }
          input, textarea, select { width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border); background: var(--input-bg); color: white; font-family: inherit; font-size: 0.9rem; }
          .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <h1>📱 Assistant Devices</h1>
              <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.25rem;">Configure your AI extensions and voice profiles</p>
            </div>
            <div style="display: flex; gap: 1rem;">
              <a href="/" style="text-decoration: none;"><button class="btn btn-secondary">🏠 Back to Dashboard</button></a>
              <button class="btn btn-primary" onclick="showAddModal()">➕ Add New Device</button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Ext</th>
                <th>Name</th>
                <th>Voice ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${deviceRows || '<tr><td colspan="4" style="text-align:center; padding: 3rem; color: var(--text-dim);">No devices configured yet</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="modal-overlay" id="deviceModal">
          <div class="modal">
            <div class="modal-header">
              <h2 id="modalTitle">Add New Device</h2>
            </div>
            <form id="deviceForm" onsubmit="saveDevice(event)">
              <div class="form-group">
                <label>Extension Number</label>
                <input type="text" name="extension" id="formExt" placeholder="e.g. 9001" required>
              </div>
              <div class="form-group">
                <label>Assistant Name</label>
                <input type="text" name="name" id="formName" placeholder="e.g. Jarvis" required>
              </div>
              <div class="form-group">
                <label>SIP Auth ID (PBX Username)</label>
                <input type="text" name="authId" id="formAuth" placeholder="Username in FreePBX">
              </div>
              <div class="form-group">
                <label>SIP Password (PBX Secret)</label>
                <input type="password" name="password" id="formPass" placeholder="Secret in FreePBX">
              </div>
              <div class="form-group">
                <label>ElevenLabs Voice ID</label>
                <select name="voiceId" id="formVoice">
                  <option value="ErXwobaYiN019PkySvjV">Antoni</option>
                  <option value="21m00Tcm4TlvDq8ikWAM">Rachel</option>
                  <option value="MF3mGyEYCl7XYWbV9V6O">Elli</option>
                  <option value="TxGEqnHWrfWFTfGW9XjX">Josh</option>
                  <option value="pNInz6obpgDQGcFmaJgB">Adam</option>
                  <option value="yoZ06aMxZJJ28mfd3POQ">Sam</option>
                </select>
              </div>
              <div class="form-group">
                <label>System Prompt (Instructions)</label>
                <textarea name="prompt" id="formPrompt" style="width: 100%; height: 100px; padding: 0.75rem; background: var(--input-bg); border: 1px solid var(--border); color: white; border-radius: 6px;" placeholder="You are a helpful AI assistant..."></textarea>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" onclick="hideModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Device</button>
              </div>
            </form>
          </div>
        </div>

        <script>
          const devices = ${JSON.stringify(devices)};
          
          function showAddModal() {
            document.getElementById('modalTitle').innerText = 'Add New Device';
            document.getElementById('deviceForm').reset();
            document.getElementById('formExt').disabled = false;
            document.getElementById('deviceModal').style.display = 'flex';
          }

          function hideModal() {
            document.getElementById('deviceModal').style.display = 'none';
          }

          function editDevice(ext) {
            const device = devices[ext];
            if (!device) return;
            
            document.getElementById('modalTitle').innerText = 'Edit ' + device.name;
            document.getElementById('formExt').value = ext;
            document.getElementById('formExt').disabled = true; // Cannot change extension of existing
            document.getElementById('formName').value = device.name;
            document.getElementById('formAuth').value = device.authId || '';
            document.getElementById('formPass').value = device.password || '';
            document.getElementById('formVoice').value = device.voiceId || 'ErXwobaYiN019PkySvjV';
            document.getElementById('formPrompt').value = device.prompt || '';
            
            document.getElementById('deviceModal').style.display = 'flex';
          }

          async function deleteDevice(ext) {
            if (!confirm('Are you sure you want to remove device ' + ext + '?')) return;
            
            try {
              const res = await fetch('/api/devices/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ extension: ext })
              });
              if (res.ok) location.reload();
              else alert('Failed to delete device');
            } catch (err) { alert('Error: ' + err.message); }
          }

          async function saveDevice(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            const ext = document.getElementById('formExt').value; // Get even if disabled
            
            // Build the updated devices object
            const updatedDevices = { ...devices };
            updatedDevices[ext] = {
              ...data,
              extension: ext // Ensure extension matches key
            };
            
            try {
              const res = await fetch('/api/devices/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedDevices)
              });
              
              if (res.ok) {
                alert('Device configuration saved. Voice App will restart.');
                location.reload();
              } else {
                alert('Failed to save device');
              }
            } catch (err) {
              alert('Error: ' + err.message);
            }
          }
        </script>
      </body>
    </html>
  `;
};
