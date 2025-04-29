// UI server (port 3000)
/* global process */  // Tell ESLint that process is a global variable
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uiApp = express();
const UI_PORT = 3000;

// Serve static files except index.html
uiApp.use(express.static(join(__dirname, '../public'), {
  index: false
}));

// Serve index.html with injected environment variables
uiApp.get('/', (req, res) => {
  const indexPath = join(__dirname, '../public/index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Inject environment variables as meta tags in the head
  const apiBaseUrl = process.env.API_BASE_URL || '';
  const uiBaseUrl = process.env.UI_BASE_URL || '';
  
  const metaTags = `
  <meta name="api-base-url" content="${apiBaseUrl}">
  <meta name="ui-base-url" content="${uiBaseUrl}">
  `;
  
  html = html.replace('<head>', `<head>${metaTags}`);
  
  res.send(html);
});

uiApp.listen(UI_PORT, () => {
  if (!process.env.UI_BASE_URL) throw new Error('UI_BASE_URL env variable is required');
  console.log(`UI running at ${process.env.UI_BASE_URL}`);
});
