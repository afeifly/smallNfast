module.exports = {
  apps: [
    {
      name: 's4a-web',
      script: 'npm',
      args: 'run dev:csd -- --port 9018 --host',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}
