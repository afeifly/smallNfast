/**
 * Production server for Barcode Label Maker
 * Serves the built static files + password API
 * 
 * Usage: node server.js [port]
 * Default port: 3000
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.argv[2] || 3000
const DIST_DIR = path.join(__dirname, 'dist')
const DATA_DIR = path.join(__dirname, 'data')
const PASSWORD_FILE = path.join(DATA_DIR, 'password.json')

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
}

function ensurePasswordFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(PASSWORD_FILE)) {
        fs.writeFileSync(PASSWORD_FILE, JSON.stringify({ password: 'SUTOuser1234' }, null, 2))
    }
}

function readPassword() {
    ensurePasswordFile()
    try {
        const data = JSON.parse(fs.readFileSync(PASSWORD_FILE, 'utf-8'))
        return data.password || ''
    } catch (e) {
        return 'SUTOuser1234'
    }
}

function writePassword(newPassword) {
    ensurePasswordFile()
    fs.writeFileSync(PASSWORD_FILE, JSON.stringify({ password: newPassword }, null, 2))
}

function serveStaticFile(filePath, res) {
    const ext = path.extname(filePath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    fs.readFile(filePath, (err, data) => {
        if (err) {
            // SPA fallback: serve index.html for any non-file route
            fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, html) => {
                if (err2) {
                    res.writeHead(404)
                    res.end('Not found')
                    return
                }
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(html)
            })
            return
        }
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(data)
    })
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`)

    // API: GET /api/password
    if (url.pathname === '/api/password' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ password: readPassword() }))
        return
    }

    // API: POST /api/password
    if (url.pathname === '/api/password' && req.method === 'POST') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
            try {
                const { newPassword } = JSON.parse(body)
                if (!newPassword || newPassword.length < 4) {
                    res.writeHead(400, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'Password must be at least 4 characters' }))
                    return
                }
                writePassword(newPassword)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true }))
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Invalid request' }))
            }
        })
        return
    }

    // Static files
    let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname)
    serveStaticFile(filePath, res)
})

server.listen(PORT, () => {
    console.log(`Barcode Label Maker running at http://localhost:${PORT}`)
})
