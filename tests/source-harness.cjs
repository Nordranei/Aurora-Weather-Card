const fs = require('node:fs');
const path = require('node:path');
// The existing regression tests execute the real source in a minimal Lit VM.
// Inline only the JSON imports; keep all production localization logic intact.
function sourceForVm() {
  const root = path.join(__dirname, '../src');
  const localization = fs.readFileSync(path.join(root, 'localize.js'), 'utf8')
    .replace(/^import (\w+) from '([^']+)' with \{ type: 'json' \};$/gm,
      (_, name, file) => 'const ' + name + ' = ' + fs.readFileSync(path.join(root, file), 'utf8') + ';')
    .replace(/^export /gm, '');
  return localization + '\n' + fs.readFileSync(path.join(root, 'aurora-weather-card.js'), 'utf8')
    .replace(/^import .*;$/gm, '');
}
module.exports = { sourceForVm };
