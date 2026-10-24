// Read-only syntax-tree inventory of every tracked JS/TS file at an exact git ref.
// Usage: node scripts/contracts/rpc-source-inventory.mjs REF OUTPUT.json
// Requires the repository's locked TypeScript dev dependency. No network or DB access.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const ts = createRequire(import.meta.url)('typescript');
const [ref = 'HEAD', output] = process.argv.slice(2);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const commit = git('rev-parse', '--verify', `${ref}^{commit}`).trim();
const files = git('ls-tree', '-r', '--name-only', '-z', commit).split('\0').filter(Boolean);
const calls = [], references = [], textReferences = [], parseErrors = [];
const terms = /get_entitlements|get_paywall_state|start_purchase|restore_purchase|entitlementService|service_role|functions\s*(?:\?\.)?\s*\.\s*invoke|\/rest\/v1\/rpc|\/rpc\//g;
const sourceFiles = files.filter(p => /\.(?:[cm]?[jt]sx?)$/.test(p));
const context = path => /(?:^|\/)(?:__tests__|fixtures?)(?:\/)|(?:\.test\.|\.spec\.)/.test(path)
  ? 'test' : path.startsWith('scripts/') ? 'operator_script' : 'runtime';
function unwrap(node) {
  while (node && (ts.isNonNullExpression(node) || ts.isParenthesizedExpression(node)
    || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))) node = node.expression;
  return node;
}
function property(node) {
  node = unwrap(node);
  if (node && ts.isPropertyAccessExpression(node)) return node.name.text;
  if (node && ts.isElementAccessExpression(node) && node.argumentExpression
    && ts.isStringLiteralLike(node.argumentExpression)) return node.argumentExpression.text;
  return null;
}
for (const path of files.filter(p => /\.(?:[cm]?[jt]sx?|sql|html|ya?ml|json|toml|py|sh)$/.test(p))) {
  const text = git('show', `${commit}:${path}`);
  for (const match of text.matchAll(terms)) textReferences.push({ path, line: text.slice(0, match.index).split('\n').length, term: match[0], context: context(path) });
  if (!sourceFiles.includes(path)) continue;
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  for (const error of sf.parseDiagnostics) parseErrors.push({ path, line: sf.getLineAndCharacterOfPosition(error.start ?? 0).line + 1, code: error.code });
  function visit(node) {
    const member = property(node);
    if (member === 'rpc' || member === 'invoke') references.push({ path, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, member, context: context(path) });
    if (ts.isCallExpression(node)) {
      const target = unwrap(node.expression);
      const prop = property(target);
      const wrapper = target && ts.isIdentifier(target) && target.text === 'rpc';
      if (prop === 'rpc' || prop === 'invoke' || wrapper) {
        const argument = node.arguments[wrapper ? 1 : 0];
        const name = argument && ts.isStringLiteralLike(argument) ? argument.text : null;
        calls.push({ path, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          kind: wrapper ? 'rpc_wrapper' : prop, name,
          argument: name === null ? argument?.getText(sf) ?? '(missing)' : null,
          context: context(path) });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}
assert.equal(parseErrors.length, 0, 'Inventory cannot be complete with source parse errors');
const summary = { trackedFiles: files.length, parsedSourceFiles: sourceFiles.length,
  calls: calls.length, runtimeCalls: calls.filter(c => c.context === 'runtime').length,
  dynamicRuntimeCalls: calls.filter(c => c.context === 'runtime' && c.name === null).length,
  runtimeNames: [...new Set(calls.filter(c => c.context === 'runtime' && c.name).map(c => c.name))].sort(),
  parseErrors: parseErrors.length };
const result = { commit, summary, calls, references, textReferences, parseErrors,
  limitations: ['Static tracked-source inventory; no proof of deployed bundle identity or external callers.',
    'Dynamic names and extracted rpc references require manual review; no arbitrary expression evaluation.',
    'Text references include SQL/YAML/HTML/Python/shell; definitions are not proof of execution.'] };
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ commit, ...summary }, null, 2));
