// Subscription logic: in-memory store and subscribeToFeed

const subscriptions = [];

function subscribeToFeed(url) {
  if (!subscriptions.includes(url)) {
    subscriptions.push(url);
    console.log(`Subscribed to: ${url}`);
  } else {
    console.log(`Already subscribed to: ${url}`);
  }
}

export { subscriptions, subscribeToFeed };

