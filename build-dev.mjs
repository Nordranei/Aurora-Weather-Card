import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

// Isolated test resource: never register the stable card or editor element.
const source = (await readFile('src/aurora-weather-card.js', 'utf8'))
  .replaceAll("'aurora-weather-card-editor-v1-3-1'", "'aurora-weather-card-i18n-dev-editor'")
  .replaceAll("'aurora-weather-card'", "'aurora-weather-card-i18n-dev'")
  .replaceAll("'custom:aurora-weather-card'", "'custom:aurora-weather-card-i18n-dev'")
  .replace("name: 'Aurora Weather Card v1.3.1-i18n-dev.2'", "name: 'Aurora Weather Card — I18N TEST'");
const result = await build({
  stdin: { contents: source, resolveDir: 'src', sourcefile: 'aurora-weather-card-i18n-dev.js' },
  outfile: 'dist/aurora-weather-card-i18n-dev.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
  legalComments: 'inline', metafile: true,
});
if (Object.values(result.metafile.outputs).some(output => output.imports.length)) {
  throw new Error('Development distribution must have no external imports');
}
console.log('Built isolated test card: custom:aurora-weather-card-i18n-dev');
