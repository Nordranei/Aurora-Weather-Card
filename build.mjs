import { build } from 'esbuild';
const result = await build({
  entryPoints: ['src/aurora-weather-card.js'],
  outfile: 'dist/aurora-weather-card.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  legalComments: 'inline',
  metafile: true,
});
if (Object.values(result.metafile.outputs).some(output => output.imports.length)) {
  throw new Error('Distribution must have no external imports');
}
console.log('Built self-contained Aurora distribution (no external imports).');
