const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db/db');

// DB 초기화
const dbPath = process.env.KNOWLEDGE_DB_PATH || path.join(__dirname, '../db/personal.db');
initDb(dbPath);

const app = express();
const PORT = process.env.KNOWLEDGE_PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 일관된 에러 응답 형식
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({ success: false, error: err.message });
});

// 정적 파일 (프론트엔드)
app.use(express.static(path.join(__dirname, '../frontend')));

// API 라우트
const apiRoutes = require('./api/routes');
app.use('/api', apiRoutes);

// SPA 폴백 - 프론트엔드 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 정상 종료 처리
const { closeDb } = require('./db/db');
process.on('SIGTERM', () => { closeDb(); process.exit(0); });
process.on('SIGINT', () => { closeDb(); process.exit(0); });

app.listen(PORT, () => {
  console.log(`온톨로지 지식 시스템 서버 시작: http://localhost:${PORT}`);
  console.log(`DB 경로: ${dbPath}`);
});
