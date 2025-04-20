// UI server (port 3000)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uiApp = express();
const UI_PORT = 3000;
uiApp.use(express.static(join(__dirname, '../public')));

uiApp.listen(UI_PORT, () => {
  if (!process.env.UI_BASE_URL) throw new Error('UI_BASE_URL env variable is required');
  console.log(`UI running at ${process.env.UI_BASE_URL}`);
});
