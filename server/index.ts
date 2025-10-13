// =============================================================================
// Express Server Entry Point
// =============================================================================

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from dist/public (production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist/public')));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve React app (production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/public/index.html'));
  });
} else {
  // In development, Vite handles the frontend
  app.get('*', (req, res) => {
    res.json({ 
      message: 'Development mode - Frontend served by Vite on port 5173',
      backend: `http://localhost:${PORT}`,
      frontend: 'http://localhost:5173'
    });
  });
}

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🚀 Frontend: http://localhost:5173`);
    console.log(`🔧 Backend:  http://localhost:${PORT}`);
  }
});