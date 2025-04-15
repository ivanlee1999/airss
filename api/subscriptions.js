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

function subscribeToFeed(url, name) {
  if (!subscriptions.some(sub => sub.url === url)) {
    subscriptions.push({ url, name });
    saveSubscriptions();
    console.log(`Subscribed to: ${name} (${url})`);
  } else {
    console.log(`Already subscribed to: ${url}`);
  }
}

function getFeedNameByUrl(url) {
  const sub = subscriptions.find(sub => sub.url === url);
  return sub ? sub.name : undefined;
}

export { subscriptions, subscribeToFeed, getFeedNameByUrl, saveSubscriptions };

