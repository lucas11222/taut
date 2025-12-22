#!/usr/bin/env bun

import path from 'path'

if (!('Bun' in globalThis)) {
  console.error('This script must be run with Bun.')
  process.exit(1)
}

console.log('[build] Starting build...')

console.log('[build-main] Bundling main dependencies...')
const mainResult = await Bun.build({
  entrypoints: [path.join(import.meta.dir, '..', 'core', 'main', 'deps.ts')],
  outdir: path.join(import.meta.dir, '..', 'core', 'main', 'deps'),
  naming: 'deps.bundle.js',
  target: 'node',
  format: 'cjs',
  external: ['electron'],
})

if (!mainResult.success) {
  console.error('[build-main] Build failed:', mainResult.logs)
  process.exit(1)
}

console.log('[build-main] Copying esbuild.wasm...')
try {
  const wasmSrc = path.join(
    import.meta.dir,
    '..',
    'node_modules',
    'esbuild-wasm',
    'esbuild.wasm'
  )
  const wasmDest = path.join(
    import.meta.dir,
    '..',
    'core',
    'main',
    'deps',
    'esbuild.wasm'
  )
  await Bun.write(wasmDest, Bun.file(wasmSrc))
} catch (e) {
  console.error('[build-main] Failed to copy esbuild.wasm:', e)
  process.exit(1)
}

console.log('[build-renderer] Starting build...')

// Bundle workers into strings
const WORKERS = [
  {
    name: 'editorWorker',
    entry: 'monaco-editor/esm/vs/editor/editor.worker.js',
    define: '__EDITOR_WORKER_CODE__',
  },
  {
    name: 'jsonWorker',
    entry: 'monaco-editor/esm/vs/language/json/json.worker.js',
    define: '__JSON_WORKER_CODE__',
  },
  {
    name: 'cssWorker',
    entry: 'monaco-editor/esm/vs/language/css/css.worker.js',
    define: '__CSS_WORKER_CODE__',
  },
]

const workerDefines: Record<string, string> = {}

for (const worker of WORKERS) {
  console.log(`[build-renderer] Bundling ${worker.name}...`)
  const entryPath = require.resolve(worker.entry)
  const result = await Bun.build({
    entrypoints: [entryPath],
    target: 'browser',
    format: 'iife',
    minify: true,
  })

  if (!result.success) {
    console.error(
      `[build-renderer] Failed to bundle ${worker.name}:`,
      result.logs
    )
    process.exit(1)
  }

  const code = await result.outputs[0].text()
  workerDefines[worker.define] = JSON.stringify(code)
}

// Bundle main renderer deps with injected workers
console.log('[build-renderer] Bundling renderer dependencies...')

const rendererResult = await Bun.build({
  entrypoints: [
    path.join(import.meta.dir, '..', 'core', 'renderer', 'deps.ts'),
  ],
  outdir: path.join(import.meta.dir, '..', 'core', 'renderer', 'deps'),
  naming: 'deps.bundle.[ext]',
  target: 'browser',
  format: 'esm',
  minify: true,
  define: {
    'import.meta.url': 'self.location.href',
    'process': 'undefined',
    ...workerDefines,
  },
})

if (!rendererResult.success) {
  console.error('[build-renderer] Build failed:', rendererResult.logs)
  process.exit(1)
}

console.log('[build] Done!')
