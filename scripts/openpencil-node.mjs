import { readFile, writeFile } from 'node:fs/promises'

// OpenPencil CLI 0.14.0 uses Bun.file/Bun.write for import I/O even when
// launched through its npm-installed Node entrypoint. Provide the two small
// APIs it needs so Windows can run the CLI without selecting Bun-only exports.
globalThis.Bun = {
  file(path) {
    return {
      text: () => readFile(path, 'utf8'),
    }
  },
  write(path, data) {
    return writeFile(path, data)
  },
}

await import('@open-pencil/cli/bin/openpencil.js')
