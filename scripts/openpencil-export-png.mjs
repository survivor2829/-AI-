import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import CanvasKitInit from 'canvaskit-wasm/full'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { populateLazyFigImportRoots } from '@open-pencil/core/kiwi'

const { values, positionals } = parseArgs({
  options: {
    output: { type: 'string', short: 'o' },
    page: { type: 'string' },
    scale: { type: 'string', short: 's', default: '1' },
  },
  allowPositionals: true,
})

const inputArg = positionals[0]
if (!inputArg) {
  throw new Error('Usage: node scripts/openpencil-export-png.mjs input.fig -o output.png')
}

const input = resolve(inputArg)
const scale = Number(values.scale)
if (!Number.isFinite(scale) || scale <= 0) throw new Error('--scale must be positive')

const output = resolve(
  values.output ?? `${basename(input, extname(input))}@${scale}x.png`,
)

const io = new IORegistry(BUILTIN_IO_FORMATS)
const bytes = new Uint8Array(await readFile(input))
const { graph } = await io.readDocument({ name: input, data: bytes })

computeAllLayouts(graph)

const pages = graph.getPages()
const page = values.page
  ? pages.find((candidate) => candidate.name === values.page)
  : pages[0]

if (!page) throw new Error(`Page not found: ${values.page ?? '(first page)'}`)

if (populateLazyFigImportRoots(graph, [page.id])) computeAllLayouts(graph, page.id)

const ckEntry = import.meta.resolve('canvaskit-wasm/full')
const ckDir = dirname(fileURLToPath(ckEntry))
const ck = await CanvasKitInit({ locateFile: (file) => join(ckDir, file) })

const surface = ck.MakeSurface(1, 1)
if (!surface) throw new Error('Failed to create CanvasKit surface')

const renderer = new SkiaRenderer(ck, surface)
renderer.viewportWidth = 1
renderer.viewportHeight = 1
renderer.dpr = 1

let restoreTextMeasurer
try {
  await renderer.loadFonts()
  renderer.invalidateAllPictures()
  restoreTextMeasurer = await renderer.prepareForExport(graph, page.id, page.childIds)

  const result = await io.exportContent(
    'png',
    { graph, target: { scope: 'page', pageId: page.id } },
    { format: 'PNG', scale },
    { canvasKit: ck, renderer },
  )

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, result.data)
  console.log(`Exported ${output} (${result.data.length} bytes)`)
} finally {
  restoreTextMeasurer?.()
  renderer.destroy()
}
