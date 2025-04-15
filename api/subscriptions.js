// Subscription logic: in-memory store and subscribeToFeed

import fs from 'fs';
const SUBS_FILE = './data/subscriptions.json';

let subscriptions = [];
if (fs.existsSync(SUBS_FILE)) {
  subscriptions = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
}

function saveSubscriptions() {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
}

function subscribeToFeed(url) {
  if (!subscriptions.includes(url)) {
    subscriptions.push(url);
    saveSubscriptions();
    console.log(`Subscribed to: ${url}`);
  } else {
    console.log(`Already subscribed to: ${url}`);
  }
}

export { subscriptions, subscribeToFeed };

