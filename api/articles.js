// Article persistence logic: load/save/upsert articles
import fs from 'fs';
const DATA_FILE = './data/articles.json';

let articles = [];
if (fs.existsSync(DATA_FILE)) {
  articles = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveArticles() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(articles, null, 2));
}

function upsertArticle(article) {
  const idx = articles.findIndex(a => a.link === article.link);
  if (idx === -1) {
    articles.push(article);
  } else {
    articles[idx] = article;
  }
  saveArticles();
}

export { articles, upsertArticle, saveArticles };

