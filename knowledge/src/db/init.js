#!/usr/bin/env node
const path = require('path');
const { initDb, initSqlEngine } = require('./db');

async function main() {
  await initSqlEngine();

  const personalDbPath = process.env.KNOWLEDGE_DB_PATH ||
    path.join(__dirname, '../../db/personal.db');
  const orgDbPath = path.join(__dirname, '../../db/organization.db');

  console.log('개인 DB 초기화 중...');
  initDb(personalDbPath);

  console.log('조직 DB 초기화 중...');
  initDb(orgDbPath);

  console.log('모든 DB 초기화 완료!');
}

main().catch(err => {
  console.error('DB 초기화 실패:', err);
  process.exit(1);
});
