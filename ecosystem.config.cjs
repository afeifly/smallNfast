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
      script: 'npx',
      args: 'serve -s dist -l tcp://127.0.0.1:9016',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'timesheet-lite-backend',
      cwd: './timesheet-lite/backend',
      script: './.venv/bin/python',
      args: 'run.py',
      env: {
        NODE_ENV: 'production',
        PORT: 8003
      }
    },
    {
      name: 'timesheet-lite-frontend',
      cwd: './timesheet-lite/frontend',
      script: 'npm',
      args: 'run dev -- --port 9021 --host 127.0.0.1',
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'creatorcenter-backend',
      cwd: './creatorcenter',
      script: './.venv/bin/python',
      args: '-m uvicorn backend.main:app --host 127.0.0.1 --port 8000',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'creatorcenter-frontend',
      cwd: './creatorcenter/frontend',
      script: 'npm',
      args: 'run dev -- --port 9022 --host 127.0.0.1',
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 's4c-lab-backend',
      cwd: './s4c-lab-server/server',
      script: 'node',
      args: 'index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '127.0.0.1',
        DATABASE_URL: `file:${path.resolve(__dirname, 's4c-lab-server/server/prisma/dev.db')}`,
        JWT_SECRET: 's4c-lab-secret-key-keep-it-secret'
      }
    },
    {
      name: 's4c-lab-frontend',
      cwd: './s4c-lab-server/client',
      script: 'npm',
      args: 'run dev -- --port 9017 --host 127.0.0.1',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}
