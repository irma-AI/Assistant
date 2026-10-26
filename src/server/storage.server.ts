import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

// The one place files are read and written, so a move to S3 changes no caller. Keys are made by the server
// (`<organisation>/<document>`), never from user input. Nothing deletes: retention is BFL 7 kap. 2 §.
const path = (key: string) => join(process.env.STORAGE_DIR ?? '', key)

export const storage = {
  // 'wx' refuses to overwrite: stored bytes never change.
  put: async (key: string, bytes: Uint8Array) => {
    if (!process.env.STORAGE_DIR) throw new Error('STORAGE_DIR is not set')
    await mkdir(dirname(path(key)), { recursive: true })
    await writeFile(path(key), bytes, { flag: 'wx' })
  },
  // shortcut: the whole file is read into memory (20 MB at most), stream from disk or S3 when files grow.
  get: (key: string) => readFile(path(key)),
}
