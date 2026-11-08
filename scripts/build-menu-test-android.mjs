import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

// No remote database, deployment, auth, or generator activation is performed.
const catalogPath = process.argv[2];
if (!catalogPath) throw Error('Usage: node scripts/build-menu-test-android.mjs AUTHORING_CATALOG.json [--apk]');
const raw = readFileSync(catalogPath);
if (raw.length > 2_000_000) throw Error('Catalog exceeds viewer bound');
const {decodeAuthoringRecipeCatalog} = await import('../src/dev/authoringRecipeCatalog.ts');
const catalog = decodeAuthoringRecipeCatalog(JSON.parse(raw));
const env = {...process.env, POTOK_MANUAL_TEST: '1'};
const run = (cmd, args, cwd = process.cwd()) => execFileSync(cmd, args, {cwd, env, stdio: 'inherit'});
run('node', ['node_modules/typescript/bin/tsc', '--noEmit']);
run('node', ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.manual-test.config.ts']);
for (const file of readdirSync('dist-manual-test/assets').filter(f => f.endsWith('.js'))) {
  if (/supabase\.co|service_role|adaptive-nutrition-generate-v2/.test(readFileSync('dist-manual-test/assets/' + file, 'utf8'))) throw Error('Remote runtime leaked into isolated bundle');
}
const entry = readFileSync('dist-manual-test/authoring-week-preview.html', 'utf8');
writeFileSync('dist-manual-test/index.html', entry.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'self\'; object-src \'none\'; base-uri \'self\'">'));
copyFileSync(catalogPath, 'dist-manual-test/manual-test-catalog.json');
writeFileSync('dist-manual-test/build-info.json', JSON.stringify({
  kind: 'OFFLINE_AUTHORING_ANDROID_MANUAL_TEST', sourceHash: catalog.sourceHash,
  catalogSha256: createHash('sha256').update(raw).digest('hex'), recipes: catalog.recipes.size,
  databaseConnected: false, trustedGeneratorActive: false, productionEligible: false,
}, null, 2));
if (!existsSync('android-manual-test')) run('node', ['node_modules/@capacitor/cli/bin/capacitor', 'add', 'android']);
run('node', ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
const manifest = 'android-manual-test/app/src/main/AndroidManifest.xml';
writeFileSync(manifest, readFileSync(manifest, 'utf8')
  .replace(/\s*<uses-permission android:name="android.permission.INTERNET"\s*\/>/g, '')
  .replace('android:allowBackup="true"', 'android:allowBackup="false"'));
if (process.argv.includes('--apk')) run('./gradlew', ['assembleDebug', '--no-daemon'], 'android-manual-test');
