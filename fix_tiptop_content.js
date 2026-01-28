const fs = require('fs');
const path = '/home/jais/codings/networkschucks-phone-but-for-gemini/mission-control/tiptop.js';

let content = fs.readFileSync(path, 'utf8');

// Fix 1: renderNotes triple/septuple backslashes
// div.innerHTML = \\\` -> div.innerHTML = `
content = content.replace(/div\.innerHTML = \\{1,3}`/g, 'div.innerHTML = `');

// <span>\\\\\\\${note.title -> <span>${note.title
// This replaces 3 to 7 backslashes followed by ${ with just ${
content = content.replace(/\\{3,7}\${/g, '${');

// Fix 2: renderCalls actionHtml
// actionHtml = \`<button -> actionHtml = `<button
// Also fix the \${ inside it
// Since we might have replaced \${ above globally? No, the regex above matches 3-7 backslashes.
// The actionHtml line has 1 backslash: \${call.recordingUrl}
// Let's fix actionHtml line specifically if needed, or global single backslash replace?
// Single backslash \${ -> ${
// But wait, are there legitimate \${ ?
// In a template literal inside a string? No, this is a static file.
// So \${ is always an error if we want interpolation?
// Yes.
content = content.replace(/\\\${/g, '${');

// Fix 3: item.innerHTML = \` -> item.innerHTML = `
content = content.replace(/item\.innerHTML = \\`/g, 'item.innerHTML = `');

// Fix 4: actionHtml = \` -> actionHtml = ` (start of the line)
content = content.replace(/actionHtml = \\`/g, 'actionHtml = `');

// Fix 5: End of template literals?
// The end backtick `\`;` -> `;` ?
// Step 1181 line 595 ends with `</button>\`;`
// So we need to replace `\`;` with ``;`
content = content.replace(/\\`;/g, '`;');

// Also check for `actionHtml` having single backslash escaping for backticks if they are there?
// The previous replace removed `\` before backtick in `actionHtml = \``.

fs.writeFileSync(path, content);
console.log('Fixed tiptop.js content');
