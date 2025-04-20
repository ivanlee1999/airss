// API server (port 3001)
import express from "express";
import cors from "cors";


import { startFeedJob, fetchAllFeeds } from './feeds.js';

const apiApp = express();
const API_PORT = 3001;

// Enable CORS for all origins (or restrict to http://localhost:3000 if you prefer)
apiApp.use(cors());

apiApp.use(express.json());

import Parser from 'rss-parser';
const rssParser = new Parser();

import { getAllSubscriptions, subscribeToFeed, getFeedNameByUrl } from './subscriptions.js';
import { getAllArticles, getArticlesByFeedUrl, upsertArticle } from './articles.js';

apiApp.get("/subscriptions", async (req, res) => {
  const subscriptions = await getAllSubscriptions();
  res.json({ subscriptions });
});

apiApp.post("/subscribe", async (req, res) => {
  const { url, name } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing RSS feed URL" });
  }
  let feedName = name;
  if (!feedName) {
    try {
      const feed = await rssParser.parseURL(url);
      feedName = feed.title || url;
    } catch (e) {
      feedName = url;
    }
  }
  await subscribeToFeed(url, feedName);
  await fetchAllFeeds();
  res.json({ message: `Subscribed to ${feedName} (${url})` });
});

import { Feed } from 'feed';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${API_PORT}`;
const UI_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:3000';

// Publish subscriptions as an RSS feed
apiApp.get('/subscriptions-rss', async (req, res) => {
  const subscriptionsList = await getAllSubscriptions();

  const feed = new Feed({
    title: 'My Subscribed RSS Feeds',
    description: 'A list of feeds I am subscribed to',
    id: `${API_BASE_URL}/subscriptions-rss`,
    link: `${API_BASE_URL}/subscriptions-rss`,
    language: 'en',
    updated: new Date(),
    generator: 'airss',
    feedLinks: { rss2: `${API_BASE_URL}/subscriptions-rss` },
    author: { name: 'RSS Publisher' },
  });

  subscriptionsList.forEach(sub => {
    feed.addItem({
      title: sub.name || sub.url,
      id: sub.url,
      link: sub.url,
      description: `Subscribed feed: ${sub.name || sub.url}`,
      date: new Date(),
    });
  });

  res.type('application/rss+xml');
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(feed.rss2());
});

// Return an RSS feed where each item is a time-bucketed aggregation of article summaries and links
apiApp.get('/articles-rss', async (req, res) => {
  let articles = [];
  const { feedUrl } = req.query;
  if (feedUrl) {
    articles = await getArticlesByFeedUrl(feedUrl);
  } else {
    articles = await getAllArticles();
  }

  // Helper to convert date to PST (America/Los_Angeles)
  function toPST(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  }

  // Define intervals in PST
  const intervals = [
    { label: '21:00-12:00', startHour: 21, startMin: 0, endHour: 12, endMin: 0 },
    { label: '12:00-17:00', startHour: 12, startMin: 0, endHour: 17, endMin: 0 },
    { label: '17:00-21:00', startHour: 17, startMin: 0, endHour: 21, endMin: 0 }
  ];

  // Get current PST time
  const nowUtc = new Date();
  const nowPst = toPST(nowUtc);
  const currentHour = nowPst.getHours();
  const currentMin = nowPst.getMinutes();

  // Decide which intervals to include based on current PST time
  let included = [];
  if (currentHour >= 12) included.push('21:00-12:00');
  if (currentHour >= 17) included.push('12:00-17:00');
  if (currentHour >= 21) included.push('17:00-21:00');

  // Build interval boundaries for today
  function getIntervalBounds(label) {
    const today = new Date(nowPst.getFullYear(), nowPst.getMonth(), nowPst.getDate());
    if (label === '21:00-12:00') {
      // 21:00 prev day to 12:00 today
      const start = new Date(today);
      start.setDate(start.getDate() - 1);
      start.setHours(21, 0, 0, 0);
      const end = new Date(today);
      end.setHours(12, 0, 0, 0);
      return { start, end };
    } else if (label === '12:00-17:00') {
      const start = new Date(today);
      start.setHours(12, 0, 0, 0);
      const end = new Date(today);
      end.setHours(17, 0, 0, 0);
      return { start, end };
    } else if (label === '17:00-21:00') {
      const start = new Date(today);
      start.setHours(17, 0, 0, 0);
      const end = new Date(today);
      end.setHours(21, 0, 0, 0);
      return { start, end };
    }
    return null;
  }

  const feed = new Feed({
    title: feedUrl ? `Aggregated Daily Articles for ${feedUrl}` : 'Aggregated Daily Articles',
    description: feedUrl ? `Daily RSS article digests for ${feedUrl}` : 'Daily digests of all articles from all feeds',
    id: `${API_BASE_URL}/articles-rss`,
    link: `${API_BASE_URL}/articles-rss`,
    language: 'en',
    updated: new Date(),
    generator: 'airss',
    feedLinks: { rss2: `${API_BASE_URL}/articles-rss` },
    author: { name: 'RSS Publisher' },
  });

  included.forEach(label => {
    const { start, end } = getIntervalBounds(label);
    // Bucket articles by interval
    const bucket = articles.filter(article => {
      if (!article.pubDate) return false;
      const pstDate = toPST(new Date(article.pubDate));
      return pstDate >= start && pstDate < end;
    });
    if (bucket.length > 0) {
      const htmlList = bucket.map(a => {
        const safeSummary = a.summary ? a.summary.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        return `<li><a href="${a.link}" target="_blank">${a.title || a.link}</a>: ${safeSummary}</li>`;
      }).join('\n');
      feed.addItem({
        title: `Digest for ${label} PST (${start.toLocaleDateString('en-US')})`,
        id: `${start.toISOString()}_${label}`,
        link: `${API_BASE_URL}/articles-rss?interval=${encodeURIComponent(label)}&date=${start.toISOString()}`,
        description: `Articles from ${start.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} to ${end.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST`,
        content: `<ul>${htmlList}</ul>`,
        date: end
      });
    }
  });

  res.type('application/rss+xml');
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(feed.rss2());
});

apiApp.listen(API_PORT, () => {
  console.log(`API running at ${process.env.API_BASE_URL || 'http://localhost:' + API_PORT}`);
});


