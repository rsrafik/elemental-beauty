// Gets GMAIL_REFRESH_TOKEN, the setting that lets the server send as the
// club's Gmail through the Gmail API (see src/email.js). Run it once on your
// own computer, after putting the OAuth client's ID and secret from Google
// Cloud in .env as GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET:
//
//   npm run gmail-token
//
// It prints a link. Open it, sign in as the club's Gmail account (not your
// own), and allow sending. Google sends the browser back here and the token
// is saved into .env as GMAIL_REFRESH_TOKEN (not printed, so it doesn't sit
// in a terminal's scrollback): copy it from there into the server's settings
// (Render's Environment page) and .env.production. It only ever asks for
// permission to send, not to read the inbox.
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

// sets KEY=value in .env, replacing the line if it's there already
function saveToEnv(key, value) {
    let text = ''
    try { text = readFileSync('.env', 'utf8') } catch { /* no .env yet */ }
    const line = `${key}=${value}`
    const pattern = new RegExp(`^${key}=.*$`, 'm')
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\n?$/, '\n')}${line}\n`
    writeFileSync('.env', text)
}

const clientId = process.env.GMAIL_CLIENT_ID
const clientSecret = process.env.GMAIL_CLIENT_SECRET
if (!clientId || !clientSecret) {
    console.error('Put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first (from the OAuth client in Google Cloud)')
    process.exit(1)
}

const state = randomBytes(16).toString('hex')
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname !== '/') { res.writeHead(404).end(); return }

    const finish = (message, code = 0) => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message)
        server.close()
        process.exitCode = code
    }
    if (url.searchParams.get('state') !== state) { return finish('That link is out of date. Run npm run gmail-token again.', 1) }
    if (url.searchParams.get('error')) { return finish(`Google said: ${url.searchParams.get('error')}`, 1) }

    const tokens = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code: url.searchParams.get('code'),
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri(),
            grant_type: 'authorization_code'
        })
    }).then((r) => r.json())

    if (!tokens.refresh_token) {
        console.error('No refresh token came back:', tokens)
        return finish('Something went wrong. Check the terminal.', 1)
    }
    saveToEnv('GMAIL_REFRESH_TOKEN', tokens.refresh_token)
    console.log('\nSaved GMAIL_REFRESH_TOKEN in .env. Copy it from there into Render (Environment) and .env.production.')
    finish('Done. The token is saved in .env. You can close this tab.')
})

const redirectUri = () => `http://127.0.0.1:${server.address().port}`

server.listen(0, '127.0.0.1', () => {
    const link = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    link.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri(),
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/gmail.send',
        // offline + consent: always hand back a refresh token
        access_type: 'offline',
        prompt: 'consent',
        state,
        ...(process.env.GMAIL_USER ? { login_hint: process.env.GMAIL_USER } : {})
    })
    console.log('Open this link, sign in as the club\'s Gmail, and allow sending:\n')
    console.log(link.toString() + '\n')
    console.log('Waiting for Google...')
})
