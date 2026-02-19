module.exports = {
    apps: [
        {
            name: 'barcode-label-maker-dev',
            script: 'npx',
            args: 'vite --port 5173',
            cwd: __dirname,
            env: {
                NODE_ENV: 'development',
            },
        },
        {
            name: 'barcode-label-maker-prod',
            script: 'server.js',
            cwd: __dirname,
            args: '3000',
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};