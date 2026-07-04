import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import milestoneRoutes from './routes/milestones.js';
import authRoutes from './routes/auth.js';
import { seedDatabase } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api', milestoneRoutes);

// Serve static files in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Seed on first run
seedDatabase();

app.listen(PORT, HOST, () => {
  console.log(`  projshow server running at http://${HOST}:${PORT}`);
});
