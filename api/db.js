import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.DB_URI || 'mongodb://localhost:27017/airss';
const client = new MongoClient(uri);

let db = null;

export async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db();
  }
  return db;
}

export function getDB() {
  if (!db) throw new Error('MongoDB not connected! Call connectDB() first.');
  return db;
}
