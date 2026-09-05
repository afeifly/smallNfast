const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const constants = require('./config/constants');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(session({
    secret: 'recommand 128 bytes random string',
    cookie: { maxAge: 600 * 1000 },
    resave: false,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views')); // Ensure views folder is accessible

app.use(express.static(constants.BUILD_PATH));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routes
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const licenseRoutes = require('./routes/licenses');
const productRoutes = require('./routes/products');
const eventRoutes = require('./routes/events');

app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/api/users', userRoutes);
app.use('/', licenseRoutes);
app.use('/', productRoutes);
app.use('/', eventRoutes);

// Fallback for React router
app.get('*', (req, res) => {
    res.sendFile(path.join(constants.BUILD_PATH, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const IP = process.env.IP || "0.0.0.0";

server.listen(PORT, IP, () => {
    const addr = server.address();
    console.log("License server listening at", addr.address + ":" + addr.port);
});
