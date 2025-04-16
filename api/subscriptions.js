// Subscription logic: MongoDB store and subscribeToFeed

import { connectDB, getDB } from './db.js'; // Uses DB_URI from .env

// Subscribe to a feed (insert if not present)
export async function subscribeToFeed(url, name) {
  const db = await connectDB();
  await db.collection('subscriptions').updateOne(
    { url },
    { $set: { url, name } },
    { upsert: true }
  );
}

// Get all subscriptions
export async function getAllSubscriptions() {
  const db = await connectDB();
  return db.collection('subscriptions').find().toArray();
}

// Get feed name by URL
export async function getFeedNameByUrl(url) {
  const db = await connectDB();
  const sub = await db.collection('subscriptions').findOne({ url });
  return sub ? sub.name : url;
}
