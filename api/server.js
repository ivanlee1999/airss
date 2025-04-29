// API server (port 3001)
import express from "express";
import cors from "cors";


import { startFeedJob, fetchAllFeeds } from './feeds.js';

const apiApp = express();
const API_PORT = 3001;

// Enable CORS for all origins (or restrict to UI_BASE_URL if you prefer)
apiApp.use(cors());

apiApp.use(express.json());

import Parser from 'rss-parser';
const rssParser = new Parser();

import { getAllSubscriptions, subscribeToFeed } from './subscriptions.js';
import { getAllArticles, getArticlesByFeedId, getFeedById } from './articles.js';

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
      return res.status(400).json({ error: "Failed to parse RSS feed" });
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

if (!process.env.API_BASE_URL) throw new Error('API_BASE_URL env variable is required');
const API_BASE_URL = process.env.API_BASE_URL;
if (!process.env.UI_BASE_URL) throw new Error('UI_BASE_URL env variable is required');
const UI_BASE_URL = process.env.UI_BASE_URL;

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
  res.send(newFeed.rss2());
});

// Return an RSS feed where each item is a time-bucketed aggregation of article summaries and links
apiApp.get('/articles-rss', async (req, res) => {
  let articles = [];
  const { feedId } = req.query;
  if (feedId) {
    articles = await getArticlesByFeedId(feedId);
  } else {
    articles = await getAllArticles();
  }
  const feed = await getFeedById(feedId);

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

  // Generate intervals for the past 10 days
  let intervalList = [];
  let refDate = new Date(nowPst.getFullYear(), nowPst.getMonth(), nowPst.getDate());
  
  // Generate intervals for today and the past 9 days (10 days total)
  for (let dayOffset = 0; dayOffset < 10; dayOffset++) {
    const currentDate = new Date(refDate);
    currentDate.setDate(currentDate.getDate() - dayOffset);
    
    // Add each interval type for this day
    for (const interval of intervals) {
      let start, end, displayDate;
      
      if (interval.label === '21:00-12:00') {
        // Special case for overnight interval
        end = new Date(currentDate);
        end.setHours(12, 0, 0, 0);
        start = new Date(currentDate);
        start.setDate(start.getDate() - 1);  // Previous day
        start.setHours(21, 0, 0, 0);
        displayDate = new Date(end);
      } else if (interval.label === '12:00-17:00') {
        end = new Date(currentDate);
        end.setHours(17, 0, 0, 0);
        start = new Date(currentDate);
        start.setHours(12, 0, 0, 0);
        displayDate = new Date(end);
      } else if (interval.label === '17:00-21:00') {
        end = new Date(currentDate);
        end.setHours(21, 0, 0, 0);
        start = new Date(currentDate);
        start.setHours(17, 0, 0, 0);
        displayDate = new Date(end);
      }
      
      intervalList.push({
        label: interval.label,
        start,
        end,
        displayDate
      });
    }
  }

  const newFeed = new Feed({
    title: feed ? `Aggregated Daily Articles for ${feed.name}` : 'Aggregated Daily Articles',
    description: feed ? `Daily RSS article digests for ${feed.name}` : 'Daily digests of all articles from all feeds',
    id: `${API_BASE_URL}/articles-rss`,
    link: `${API_BASE_URL}/articles-rss`,
    language: 'en',
    updated: new Date(),
    generator: 'airss',
    feedLinks: { rss2: `${API_BASE_URL}/articles-rss` },
    author: { name: 'RSS Publisher' },
  });

  // Debug: Print out all articles
  console.log(`Total articles found: ${articles.length}`);
  if (articles.length > 0) {
    console.log(`Sample article pubDate: ${articles[0].pubDate}`);
  }

  // Debug: Print out interval information
  console.log(`Generated ${intervalList.length} intervals`);
  if (intervalList.length > 0) {
    const sample = intervalList[0];
    console.log(`Sample interval: ${sample.label}, start: ${sample.start.toISOString()}, end: ${sample.end.toISOString()}`);
  }

  intervalList.forEach(({ label, start, end, displayDate }) => {
    // Bucket articles by interval
    const bucket = articles.filter(article => {
      if (!article.pubDate) {
        console.log(`Article without pubDate: ${article.id}`);
        return false;
      }
      const pstDate = toPST(new Date(article.pubDate));
      const isInInterval = pstDate >= start && pstDate < end;
      if (isInInterval) {
        console.log(`Article in interval ${label}: ${article.id}, pubDate: ${article.pubDate}, pstDate: ${pstDate.toISOString()}`);
      }
      return isInInterval;
    });
    console.log(`Interval ${label} (${start.toISOString()} - ${end.toISOString()}) has ${bucket.length} articles`);
    if (bucket.length > 0) {
      const htmlList = bucket.map((a, idx) => {
        const safeSummary = a.summary ? a.summary.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        let item = `<li><a href="${a.link}" target="_blank">${a.title || a.link}</a>: ${safeSummary}</li>`;
        // Add <hr> after each item except the last
        if (idx < bucket.length - 1) item += '<hr style="border:1px solid #ccc; margin:1em 0;">';
        return item;
      }).join('');
      newFeed.addItem({
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
  res.send(newFeed.rss2());
});

apiApp.listen(API_PORT, () => {
  console.log(`API running at ${process.env.API_BASE_URL}`);
});


