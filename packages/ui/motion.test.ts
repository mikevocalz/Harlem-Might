/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

for (const platform of ['web', 'native'] as const) {
  test(`motion preserves the component and Legend prop contracts on ${platform}`, () => {
    const program = ts.createProgram({
      rootNames: [fileURLToPath(new URL('./__typechecks__/motion-props.tsx', import.meta.url))],
      options: {
        strict: true, noEmit: true, skipLibCheck: true, types: [],
        jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022,
        moduleSuffixes: [`.${platform}`, ''], allowImportingTsExtensions: true,
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
    });
    assert.equal(diagnostics.length, 0, formatted);
  });
}
