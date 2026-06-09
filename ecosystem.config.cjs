module.exports = {
  apps: [
    {
      name: 's4c-web',
      cwd: './s4c-web',
      script: 'npx',
      args: 'serve -s dist',
      env: {
        NODE_ENV: 'production',
        PORT: 9018
      }
    },
    {
      name: 's4a-web',
      cwd: './s4a-web',
      script: 'npm',
      args: 'run dev:csd -- --port 9019 --host',
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'acbarcode',
      cwd: './acbarcode',
      script: 'npx',
      args: 'serve -s dist',
      env: {
        NODE_ENV: 'production',
        PORT: 9016
      }
    },
    {
      name: 'timesheet-lite-backend',
      cwd: './timesheet-lite/backend',
      script: './.venv/bin/python',
      args: 'run.py',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'timesheet-lite-frontend',
      cwd: './timesheet-lite/frontend',
      script: 'npm',
      args: 'run dev -- --port 9021 --host',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}
