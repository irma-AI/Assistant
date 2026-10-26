import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'

const mail = z.object({ to: z.string(), text: z.string() })

// A just-enough SMTP server for the app's mail: it files each message under mailDir for the tests to read.
export const mailDir = join(tmpdir(), 'e2e-mail')
export const smtpPort = 2525

export function startMailServer() {
  rmSync(mailDir, { recursive: true, force: true })
  mkdirSync(mailDir, { recursive: true })
  let count = 0
  const server = createServer((socket) => {
    let to = ''
    let data: string[] | null = null
    let buffer = ''
    socket.write('220 localhost ESMTP\r\n')
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      for (let i = buffer.indexOf('\r\n'); i >= 0; i = buffer.indexOf('\r\n')) {
        const line = buffer.slice(0, i)
        buffer = buffer.slice(i + 2)
        if (data) {
          if (line !== '.') data.push(line)
          else {
            writeFileSync(
              join(mailDir, `${String(++count)}.json`),
              JSON.stringify({ to, text: data.join('\r\n') }),
            )
            data = null
            socket.write('250 ok\r\n')
          }
        } else if (/^DATA/i.test(line)) {
          data = []
          socket.write('354 go\r\n')
        } else if (/^RCPT TO:/i.test(line)) {
          to = /<([^>]+)>/.exec(line)?.[1] ?? ''
          socket.write('250 ok\r\n')
        } else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n')
        else if (/^EHLO/i.test(line)) socket.write('250 localhost\r\n')
        else socket.write('250 ok\r\n')
      }
    })
    socket.on('error', () => undefined)
  })
  return new Promise<() => Promise<void>>((resolve) => {
    server.listen(smtpPort, '127.0.0.1', () => {
      resolve(
        () =>
          new Promise((done) => {
            server.close(() => {
              done()
            })
          }),
      )
    })
  })
}

const unquote = (s: string) =>
  s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16)),
    )

// The text of every mail sent to this address so far.
export const mailsTo = (address: string) =>
  readdirSync(mailDir).flatMap((f) => {
    const m = mail.parse(JSON.parse(readFileSync(join(mailDir, f), 'utf8')))
    return m.to === address ? [unquote(m.text)] : []
  })
