// Backfill script to update articles with feedId and feedName
import { MongoClient, ObjectId } from 'mongodb';

// Function to connect to MongoDB
async function connectToMongoDB(mongoUrl) {
  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('Connected to MongoDB successfully');
    return client;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Main function to backfill feedId and feedName
async function backfillFeedData(mongoUrl) {
  let client;
  try {
    client = await connectToMongoDB(mongoUrl);
    const db = client.db();
    
    // Get all subscriptions to create a lookup map
    const subscriptions = await db.collection('subscriptions').find({}).toArray();
    console.log(`Found ${subscriptions.length} subscriptions`);
    
    // Create a map of feedUrl to subscription data
    const feedUrlMap = {};
    subscriptions.forEach(sub => {
      feedUrlMap[sub.url] = {
        _id: sub._id,
        name: sub.name
      };
    });
    
    // Get all articles to ensure complete update
    const articles = await db.collection('articles').find({}).toArray();
    console.log(`Found ${articles.length} articles that need updating`);
    
    // Update articles with feedId and feedName
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const article of articles) {
      const feedUrl = article.feedUrl;
      if (feedUrl && feedUrlMap[feedUrl]) {
        const subscription = feedUrlMap[feedUrl];
        
        // Update the article
        await db.collection('articles').updateOne(
          { _id: article._id },
          { $set: {
              feedId: subscription._id,
              feedName: subscription.name
            }
          }
        );
        
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount} articles so far...`);
        }
      } else {
        console.log(`Skipping article ${article._id}: No matching subscription found for feedUrl ${feedUrl}`);
        skippedCount++;
      }
    }
    
    console.log(`\nBackfill complete!`);
    console.log(`Updated ${updatedCount} articles`);
    console.log(`Skipped ${skippedCount} articles`);
    
  } catch (error) {
    console.error('Error during backfill:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Check command line arguments
if (process.argv.length < 3) {
  console.log('Usage: node backfill_feed_data.js <mongodb_url>');
  process.exit(1);
}

const mongoUrl = process.argv[2];
backfillFeedData(mongoUrl).catch(console.error);
