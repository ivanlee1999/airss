// Article persistence logic: load/save/upsert articles
import { getFeedNameByUrl } from './subscriptions.js';
import { connectDB } from './db.js'; // Uses DB_URI from .env

// Upsert an article by link
export async function upsertArticle(article) {
  const db = await connectDB();
  // Add feedName from subscriptions if not present or outdated
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


// Get articles by feedId
export async function getArticlesByFeedId(feedId) {
  const db = await connectDB();
  let query = { feedId };
  
  // Try to convert feedId to ObjectId if it's a valid ObjectId string
  try {
    const { ObjectId } = await import('mongodb');
    if (ObjectId.isValid(feedId)) {
      query = { feedId: new ObjectId(feedId) };
    }
  } catch (error) {
    console.error('Error converting feedId to ObjectId:', error);
  }
  
  return db.collection('articles').find(query).toArray();
}

// get feed by feedId
export async function getFeedById(feedId) {
  const db = await connectDB();
  let query = { _id: feedId };
  
  // Try to convert feedId to ObjectId if it's a valid ObjectId string
  try {
    const { ObjectId } = await import('mongodb');
    if (ObjectId.isValid(feedId)) {
      query = { _id: new ObjectId(feedId) };
    }
  } catch (error) {
    console.error('Error converting feedId to ObjectId:', error);
  }
  
  return db.collection('subscriptions').findOne(query);
}
