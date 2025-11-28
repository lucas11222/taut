// Dependencies that will be bundled into deps/ and imported in js/inject.js

import * as esbuild from 'esbuild-wasm/lib/browser.js'
import path from 'node:path'
import fs from 'node:fs'

/** @type {Record<string, esbuild.Loader?>} */
const defaultLoader = {
  '.js': 'js',
  '.cjs': 'js',
  '.mjs': 'js',
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.json': 'json',
  '.txt': 'text',
}

/**
 * Initialize esbuild-wasm with the given wasm file path
 * @param {string} wasmPath - path to the esbuild.wasm file
 */
export async function initEsbuild(wasmPath) {
  const wasmFile = await fs.promises.readFile(wasmPath)
  await esbuild.initialize({
    wasmModule: new WebAssembly.Module(new Uint8Array(wasmFile)),
    worker: false,
  })
}

/**
 * Bundle an entry file and return an IIFE expression
 * Uses esbuild-wasm
 *
 * @param {string} entryPath - path to the entry file (ts or js)
 * @returns {Promise<string>} - the generated IIFE expression
 */
export async function bundle(entryPath) {
  const absEntry = path.resolve(entryPath)

  const result = await esbuild.build({
    entryPoints: [absEntry],
    bundle: true,
    format: 'iife',
    write: false,
    sourcemap: false,
    treeShaking: true,
    legalComments: 'none',
    platform: 'browser',
    plugins: [
      {
        name: 'load-plugin',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const resolvedPath = path.isAbsolute(args.path)
              ? args.path
              : path.join(path.dirname(args.importer), args.path)
            return { path: resolvedPath }
          })

          build.onLoad({ filter: /.*/ }, async (args) => {
            const contents = await fs.promises.readFile(args.path, 'utf-8')
            return {
              contents,
              loader: defaultLoader[path.extname(args.path)] || 'text',
            }
          })
        },
      },
    ],
  })

  if (!result.outputFiles || result.outputFiles.length === 0) {
    throw new Error('no output produced')
  }

  const code = result.outputFiles[0].text.replace(/;?\s*$/, '').trim()

  return code
}

/** Stop the esbuild service */
export async function stopEsbuild() {
  await esbuild.stop()
}
