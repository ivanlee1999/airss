// RSS Feed Background Worker
import dotenv from 'dotenv';
dotenv.config();

import { startFeedJob, startSummarizeJob } from './feeds.js';

const FEED_FREQ = process.env.FEED_FETCH_FREQ_MS ? parseInt(process.env.FEED_FETCH_FREQ_MS) : 10 * 60 * 1000; // 5 min default
const SUMMARIZE_FREQ = process.env.SUMMARIZE_FREQ_MS ? parseInt(process.env.SUMMARIZE_FREQ_MS) : 10 * 60 * 1000; // 1 min default
console.log('Running RSS fetch job immediately');
import { fetchAllFeeds, summarizeAllArticles } from './feeds.js';
fetchAllFeeds();

console.log('Starting RSS fetch job (interval:', FEED_FREQ, 'ms)');
startFeedJob(FEED_FREQ);

console.log('Running summarizer job immediately');
summarizeAllArticles();

console.log('Starting summarizer job (interval:', SUMMARIZE_FREQ, 'ms)');
startSummarizeJob(SUMMARIZE_FREQ);
