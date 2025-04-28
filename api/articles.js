// Article persistence logic: load/save/upsert articles
import { getFeedNameByUrl } from './subscriptions.js';
import { connectDB } from './db.js'; // Uses DB_URI from .env

// Upsert an article by link
export async function upsertArticle(article) {
  const db = await connectDB();
  // Add feedName from subscriptions if not present or outdated
  if (article.feedUrl) {
    const feedName = getFeedNameByUrl(article.feedUrl);
    if (feedName) article.feedName = feedName;
  }
  await db.collection('articles').updateOne(
    { link: article.link },
    { $set: article },
    { upsert: true }
  );
}

// Get all articles
export async function getAllArticles() {
  const db = await connectDB();
  return db.collection('articles').find().toArray();
}

// Get articles by feedUrl
export async function getArticlesByFeedUrl(feedUrl) {
  const db = await connectDB();
  return db.collection('articles').find({ feedUrl }).toArray();
}
