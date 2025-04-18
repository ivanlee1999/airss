// RSS Feed Background Worker
import dotenv from 'dotenv';
dotenv.config();

import { startFeedJob } from './feeds.js';

console.log('Starting RSS background worker...');
startFeedJob();
