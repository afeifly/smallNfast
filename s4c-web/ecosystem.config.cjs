module.exports = {
  apps: [
    {
      name: 's4c-web',
      script: 'npx',
      args: 'serve -s dist',
      env: {
        NODE_ENV: 'production',
        PORT: 9017
      }
    }
  ]
}
