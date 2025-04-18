// API server (port 3001)
import express from "express";
import cors from "cors";


import { startFeedJob, fetchAllFeeds } from './feeds.js';

const apiApp = express();
const API_PORT = 3001;

// Enable CORS for all origins (or restrict to http://localhost:3000 if you prefer)
apiApp.use(cors({ origin: "http://localhost:3000" }));
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

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
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

// Return an RSS feed where each item is a daily aggregation of article summaries and links
apiApp.get('/articles-rss', async (req, res) => {
  let articles = [];
  const { feedUrl } = req.query;
  if (feedUrl) {
    articles = await getArticlesByFeedUrl(feedUrl);
  } else {
    articles = await getAllArticles();
  }

  // Group articles by pubDate (YYYY-MM-DD)
  const byDay = {};
  articles.forEach(article => {
    if (!article.pubDate) return;
    const dateStr = new Date(article.pubDate).toISOString().slice(0, 10);
    if (!byDay[dateStr]) byDay[dateStr] = [];
    byDay[dateStr].push(article);
  });

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

  Object.entries(byDay).forEach(([date, articles]) => {
    const htmlList = articles.map(a => {
      const safeSummary = a.summary ? a.summary.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      return `<li><a href="${a.link}" target="_blank">${a.title || a.link}</a>: ${safeSummary}</li>`;
    }).join('\n');
    feed.addItem({
      title: `Digest for ${date}`,
      id: date,
      link: `${API_BASE_URL}/articles-rss?date=${date}`,
      description: `Daily digest for ${date}`,
      content: `<ul>${htmlList}</ul>`,
      date: new Date(date)
    });
  });

  res.type('application/rss+xml');
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(feed.rss2());
});

apiApp.listen(API_PORT, () => {
  console.log(`API running at http://localhost:${API_PORT}`);
});


