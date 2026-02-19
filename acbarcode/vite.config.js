import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

// Simple API middleware for password management (dev mode)
function passwordApiPlugin() {
  const dataDir = path.resolve(__dirname, 'data')
  const passwordFile = path.join(dataDir, 'password.json')

  function ensurePasswordFile() {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    if (!fs.existsSync(passwordFile)) {
      fs.writeFileSync(passwordFile, JSON.stringify({ password: 'SUTOuser1234' }, null, 2))
    }
  }

  function readPassword() {
    ensurePasswordFile()
    try {
      const data = JSON.parse(fs.readFileSync(passwordFile, 'utf-8'))
      return data.password || ''
    } catch (e) {
      return 'SUTOuser1234'
    }
  }

  function writePassword(newPassword) {
    ensurePasswordFile()
    fs.writeFileSync(passwordFile, JSON.stringify({ password: newPassword }, null, 2))
  }

  return {
    name: 'password-api',
    configureServer(server) {
      // GET /api/password — read the current user password
      server.middlewares.use('/api/password', (req, res, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ password: readPassword() }))
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { newPassword } = JSON.parse(body)
              if (!newPassword || newPassword.length < 4) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Password must be at least 4 characters' }))
                return
              }
              writePassword(newPassword)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (e) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid request' }))
            }
          })
          return
        }

        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), passwordApiPlugin()],
})