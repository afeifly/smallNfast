const path = require('path');

module.exports = {
  apps: [
    {
      name: 's4c-web',
      cwd: './s4c-web',
      script: 'npx',
      args: 'serve -s dist -l tcp://127.0.0.1:9018',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 's4c-web-ac',
      cwd: './s4c-web',
      script: 'npx',
      args: 'serve -s dist-ac -l tcp://127.0.0.1:9024',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 's4a-web',
      cwd: './s4a-web',
      script: 'npm',
      args: 'run dev:csd -- --port 9019 --host 127.0.0.1',
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'acbarcode',
      cwd: './acbarcode',
      script: 'server/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 9016
      }
    },
    {
      name: 'timesheet-lite',
      cwd: './timesheet-lite/backend',
      script: './.venv/bin/python',
      args: 'run.py',
      env: {
        NODE_ENV: 'production',
        PORT: 9021
      }
    },
    {
      name: 'creatorcenter',
      cwd: './creatorcenter',
      script: './.venv/bin/python',
      args: '-m uvicorn backend.main:app --host 127.0.0.1 --port 9022',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 's4c-lab',
      cwd: './s4c-lab-server/server',
      script: 'node',
      args: 'index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 9017,
        HOST: '127.0.0.1',
        DATABASE_URL: `file:${path.resolve(__dirname, 's4c-lab-server/server/prisma/dev.db')}`,
        JWT_SECRET: 's4c-lab-secret-key-keep-it-secret'
      }
    },
    {
      name: 'projshow',
      cwd: './projshow/server',
      script: 'node',
      args: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 9023,
        HOST: '127.0.0.1'
      }
    },
    {
      name: 'voiceover',
      cwd: './voiceover/server',
      script: 'node',
      args: 'src/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 9025
      }
    },
    {
      name: '1zlicense',
      cwd: './1zlicense',
      script: 'node',
      args: 'server/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 9026,
        IP: '127.0.0.1'
      }
    },
    {
      name: 'cpms',
      cwd: './cpms',
      script: 'node',
      args: 'server.js',
      env: {
        NODE_ENV: 'production',
        STATUS: 'production',
        PROD_PORT: 9027,
        HOST: '127.0.0.1'
      }
    }
  ]
}
