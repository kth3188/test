// ==================== 상태 관리 ====================
let currentNoteId = null;
let currentView = 'notes';
let graphNetwork = null;

const API = '/api';

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
  loadNoteList();
  loadStats();
});

// ==================== API 호출 헬퍼 ====================
async function api(path, options = {}) {
  const { method = 'GET', body } = options;
  const config = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(API + path, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '요청 실패' }));
    throw new Error(err.error || '요청 실패');
  }
  return res.json();
}

function setStatus(text) {
  document.getElementById('status-text').textContent = text;
}

// ==================== 뷰 전환 ====================
function showView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.getElementById(`btn-${view}`).classList.add('active');

  // 사이드바 표시/숨김
  document.getElementById('sidebar').style.display =
    (view === 'notes' || view === 'search') ? 'flex' : 'none';

  if (view === 'graph') loadGraph();
  if (view === 'entities') loadEntities();
  if (view === 'questions') loadQuestions();
}

// ==================== 노트 목록 ====================
async function loadNoteList() {
  try {
    const data = await api('/notes');
    const list = document.getElementById('note-list');
    list.innerHTML = '';

    if (data.notes.length === 0) {
      list.innerHTML = '<div class="text-gray-500 text-sm p-2">노트가 없습니다. 새 노트를 만들어보세요.</div>';
      return;
    }

    for (const note of data.notes) {
      const el = document.createElement('div');
      el.className = `note-item ${note.id === currentNoteId ? 'active' : ''}`;
      el.innerHTML = `
        <div class="text-sm font-medium truncate">${escHtml(note.title)}</div>
        <div class="text-xs text-gray-500 flex gap-2 mt-1">
          <span>${note.domain || '미분류'}</span>
          <span class="badge-${note.confidence} px-1 rounded text-xs">${note.confidence}</span>
        </div>
      `;
      el.onclick = () => loadNote(note.id);
      list.appendChild(el);
    }
  } catch (err) {
    setStatus('노트 목록 로드 실패: ' + err.message);
  }
}

// ==================== 노트 편집 ====================
async function loadNote(id) {
  try {
    const note = await api(`/notes/${id}`);
    currentNoteId = id;
    document.getElementById('markdown-editor').value = note.content;
    setEditorMode('edit');
    loadNoteList(); // 활성 상태 업데이트
    setStatus(`노트 로드: ${note.title}`);
  } catch (err) {
    setStatus('노트 로드 실패: ' + err.message);
  }
}

function createNewNote() {
  currentNoteId = null;
  const template = `---
title: 새 노트
domain:
created: ${new Date().toISOString().split('T')[0]}
tags: []
confidence: medium
---

# 새 노트

## 정의
여기에 설명을 작성하세요.

## 관련 개체
- **[개체명]**: 설명 (관계: 관련)

## 속성
- 키: 값

## 출처/근거
-

## 미해결 질문
- `;

  document.getElementById('markdown-editor').value = template;
  setEditorMode('edit');
  showView('notes');
  setStatus('새 노트 작성 중');
}

async function saveCurrentNote() {
  const content = document.getElementById('markdown-editor').value;
  if (!content.trim()) {
    setStatus('내용이 비어있습니다.');
    return;
  }

  try {
    setStatus('저장 중...');

    if (currentNoteId) {
      // 기존 노트 수정
      await api(`/notes/${currentNoteId}`, { method: 'PUT', body: { content } });
      setStatus('노트 수정 완료');
    } else {
      // 새 노트 생성
      const result = await api('/notes', { method: 'POST', body: { content } });
      currentNoteId = result.noteId;
      setStatus(`노트 저장 완료 (엔티티 ${result.entityCount}개, 관계 ${result.relationCount}개 추출)`);
    }

    loadNoteList();
    loadStats();
  } catch (err) {
    setStatus('저장 실패: ' + err.message);
  }
}

async function deleteCurrentNote() {
  if (!currentNoteId) return;
  if (!confirm('이 노트를 삭제하시겠습니까?')) return;

  try {
    await api(`/notes/${currentNoteId}`, { method: 'DELETE' });
    currentNoteId = null;
    document.getElementById('markdown-editor').value = '';
    loadNoteList();
    loadStats();
    setStatus('노트 삭제 완료');
  } catch (err) {
    setStatus('삭제 실패: ' + err.message);
  }
}

// ==================== 에디터 모드 ====================
function setEditorMode(mode) {
  const editorArea = document.getElementById('editor-area');
  const previewArea = document.getElementById('preview-area');

  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  if (mode === 'edit') {
    editorArea.classList.remove('hidden');
    previewArea.classList.add('hidden');
    document.getElementById('btn-edit').classList.add('active');
  } else {
    editorArea.classList.add('hidden');
    previewArea.classList.remove('hidden');
    document.getElementById('btn-preview').classList.add('active');

    // 간단한 마크다운 → HTML 변환
    const md = document.getElementById('markdown-editor').value;
    document.getElementById('preview-content').innerHTML = renderMarkdown(md);
  }
}

// 간단한 마크다운 렌더러
function renderMarkdown(md) {
  // frontmatter 제거
  let text = md.replace(/^---[\s\S]*?---\n*/m, '');

  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\[([^\]]+)\]\*\*/g, '<strong style="color:#fbbf24">[$1]</strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '<p>')
    .replace(/<p><\/p>/g, '');
}

// ==================== 그래프 시각화 ====================
async function loadGraph() {
  try {
    setStatus('그래프 로드 중...');
    const data = await api('/graph');

    const container = document.getElementById('graph-container');

    // vis.js 데이터 변환
    const nodes = new vis.DataSet(data.nodes.map(n => ({
      id: n.id,
      label: n.name,
      title: `${n.name}\n유형: ${n.type || '미분류'}`,
      color: getTypeColor(n.type),
      font: { color: '#e5e7eb', size: 12 },
    })));

    const edges = new vis.DataSet(data.edges.map(e => ({
      id: e.id,
      from: e.source,
      to: e.target,
      label: e.label,
      font: { color: '#9ca3af', size: 10, strokeWidth: 0 },
      color: { color: '#4b5563', highlight: '#60a5fa' },
      arrows: 'to',
      width: Math.max(1, e.confidence * 3),
    })));

    const options = {
      physics: {
        stabilization: { iterations: 150 },
        barnesHut: { gravitationalConstant: -3000, springLength: 150 },
      },
      interaction: { hover: true, tooltipDelay: 200 },
      nodes: {
        shape: 'dot',
        size: 16,
        borderWidth: 2,
      },
      edges: {
        smooth: { type: 'continuous' },
      },
    };

    if (graphNetwork) graphNetwork.destroy();
    graphNetwork = new vis.Network(container, { nodes, edges }, options);

    // 노드 클릭 시 엔티티 상세
    graphNetwork.on('click', async (params) => {
      if (params.nodes.length > 0) {
        const entityId = params.nodes[0];
        await showEntityDetail(entityId);
      }
    });

    setStatus(`그래프 로드 완료 (노드 ${data.nodes.length}개, 엣지 ${data.edges.length}개)`);
  } catch (err) {
    setStatus('그래프 로드 실패: ' + err.message);
  }
}

function getTypeColor(type) {
  const colors = {
    '개념': '#3b82f6',
    '사물': '#10b981',
    '장소': '#f59e0b',
    '인물': '#ef4444',
    '조직': '#8b5cf6',
    '사건': '#ec4899',
    '기술': '#06b6d4',
    '장비': '#10b981',
  };
  return { background: colors[type] || '#6b7280', border: '#374151' };
}

// ==================== 엔티티 목록 ====================
async function loadEntities() {
  try {
    const data = await api('/entities');
    const container = document.getElementById('entities-content');
    container.innerHTML = '';

    if (data.entities.length === 0) {
      container.innerHTML = '<div class="text-gray-500">엔티티가 없습니다.</div>';
      return;
    }

    for (const entity of data.entities) {
      const el = document.createElement('div');
      el.className = 'entity-card cursor-pointer';
      el.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <span class="font-medium text-blue-400">${escHtml(entity.name)}</span>
            <span class="text-xs text-gray-500 ml-2">${entity.type || '미분류'}</span>
          </div>
          <button onclick="event.stopPropagation(); exportEntityMarkdown(${entity.id})"
                  class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">MD 변환</button>
        </div>
        <div class="text-sm text-gray-400 mt-1">${escHtml(entity.description || '')}</div>
      `;
      el.onclick = () => showEntityDetail(entity.id);
      container.appendChild(el);
    }

    setStatus(`엔티티 ${data.entities.length}개`);
  } catch (err) {
    setStatus('엔티티 로드 실패: ' + err.message);
  }
}

async function showEntityDetail(id) {
  try {
    const entity = await api(`/entities/${id}`);
    const container = document.getElementById('entities-content');

    let html = `
      <div class="entity-card border-blue-500">
        <h3 class="text-lg font-bold text-blue-400">${escHtml(entity.name)}</h3>
        <div class="text-sm text-gray-400 mt-1">유형: ${entity.type || '미분류'}</div>
        <div class="text-sm mt-2">${escHtml(entity.description || '설명 없음')}</div>

        <h4 class="text-sm font-semibold text-gray-300 mt-4 mb-2">관계</h4>
        <div class="space-y-1">
    `;

    for (const rel of entity.relations) {
      const isSubject = rel.subject_id === entity.id;
      const otherName = isSubject ? rel.object_name : rel.subject_name;
      const arrow = isSubject ? '→' : '←';
      html += `<div class="text-sm text-gray-400">
        ${arrow} <span class="text-yellow-400">${escHtml(rel.predicate)}</span>
        <span class="text-blue-300 cursor-pointer" onclick="showEntityDetail(${isSubject ? rel.object_id : rel.subject_id})">${escHtml(otherName)}</span>
        <span class="text-gray-600">(${(rel.confidence * 100).toFixed(0)}%)</span>
      </div>`;
    }

    html += '</div>';

    if (entity.attributes.length > 0) {
      html += '<h4 class="text-sm font-semibold text-gray-300 mt-4 mb-2">속성</h4>';
      for (const attr of entity.attributes) {
        html += `<div class="text-sm text-gray-400">
          <span class="text-gray-300">${escHtml(attr.key)}</span>: ${escHtml(attr.value)}
        </div>`;
      }
    }

    html += `
        <div class="mt-4 flex gap-2">
          <button onclick="exportEntityMarkdown(${entity.id})" class="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm">마크다운으로 변환</button>
          <button onclick="loadEntities()" class="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm">목록으로</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (err) {
    setStatus('엔티티 로드 실패: ' + err.message);
  }
}

async function exportEntityMarkdown(id) {
  try {
    const data = await api(`/entities/${id}/markdown`);
    // 새 노트로 열기
    currentNoteId = null;
    document.getElementById('markdown-editor').value = data.markdown;
    showView('notes');
    setEditorMode('edit');
    setStatus('엔티티를 마크다운 노트로 변환했습니다. 저장하면 새 노트로 생성됩니다.');
  } catch (err) {
    setStatus('변환 실패: ' + err.message);
  }
}

// ==================== 질문 관리 ====================
async function loadQuestions() {
  try {
    const data = await api('/questions');
    const container = document.getElementById('questions-content');
    container.innerHTML = '';

    if (data.questions.length === 0) {
      container.innerHTML = '<div class="text-gray-500">미해결 질문이 없습니다.</div>';
      return;
    }

    for (const q of data.questions) {
      const el = document.createElement('div');
      el.className = 'question-card';
      el.innerHTML = `
        <div class="text-sm">${escHtml(q.question)}</div>
        <div class="text-xs text-gray-500 mt-1">
          ${q.entity_name ? `관련: ${escHtml(q.entity_name)}` : ''}
          <span class="ml-2">${q.created_at}</span>
        </div>
        <div class="mt-2 flex gap-2">
          <input type="text" placeholder="답변 입력..."
                 class="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                 id="answer-${q.id}">
          <button onclick="answerQuestion(${q.id})" class="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs">답변</button>
          <button onclick="dismissQuestion(${q.id})" class="bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded text-xs">무시</button>
        </div>
      `;
      container.appendChild(el);
    }

    setStatus(`미해결 질문 ${data.questions.length}개`);
  } catch (err) {
    setStatus('질문 로드 실패: ' + err.message);
  }
}

async function answerQuestion(id) {
  const input = document.getElementById(`answer-${id}`);
  const answer = input.value.trim();
  if (!answer) return;

  try {
    await api(`/questions/${id}/answer`, { method: 'POST', body: { answer } });
    loadQuestions();
    setStatus('질문에 답변했습니다.');
  } catch (err) {
    setStatus('답변 실패: ' + err.message);
  }
}

async function dismissQuestion(id) {
  try {
    await api(`/questions/${id}/dismiss`, { method: 'POST' });
    loadQuestions();
  } catch (err) {
    setStatus('처리 실패: ' + err.message);
  }
}

async function generateNewQuestions() {
  try {
    setStatus('AI가 탐구 질문을 생성하는 중...');
    const result = await api('/questions/generate', { method: 'POST', body: { limit: 5 } });
    loadQuestions();
    setStatus(`새 질문 ${result.questions?.length || 0}개 생성 완료`);
  } catch (err) {
    setStatus('질문 생성 실패: ' + err.message);
  }
}

// ==================== 검색 ====================
async function doSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;

  try {
    setStatus('검색 중...');
    showView('notes'); // 노트 뷰에서 검색 결과 표시

    const data = await api(`/search?q=${encodeURIComponent(query)}`);
    const list = document.getElementById('note-list');
    list.innerHTML = '';

    // 노트 결과
    if (data.notes.length > 0) {
      const header = document.createElement('div');
      header.className = 'text-xs text-gray-500 p-1 font-semibold';
      header.textContent = `노트 (${data.notes.length})`;
      list.appendChild(header);

      for (const note of data.notes) {
        const el = document.createElement('div');
        el.className = 'note-item';
        el.innerHTML = `
          <div class="text-sm font-medium truncate">${escHtml(note.title)}</div>
          <div class="text-xs text-gray-500">${note.snippet || ''}</div>
        `;
        el.onclick = () => loadNote(note.id);
        list.appendChild(el);
      }
    }

    // 엔티티 결과
    if (data.entities.length > 0) {
      const header = document.createElement('div');
      header.className = 'text-xs text-gray-500 p-1 font-semibold mt-2';
      header.textContent = `엔티티 (${data.entities.length})`;
      list.appendChild(header);

      for (const entity of data.entities) {
        const el = document.createElement('div');
        el.className = 'note-item';
        el.innerHTML = `
          <div class="text-sm font-medium truncate text-blue-400">${escHtml(entity.name)}</div>
          <div class="text-xs text-gray-500">${entity.type || '미분류'}</div>
        `;
        el.onclick = () => { showView('entities'); showEntityDetail(entity.id); };
        list.appendChild(el);
      }
    }

    if (data.notes.length === 0 && data.entities.length === 0) {
      list.innerHTML = '<div class="text-gray-500 text-sm p-2">검색 결과가 없습니다.</div>';
    }

    setStatus(`검색 완료: 노트 ${data.notes.length}개, 엔티티 ${data.entities.length}개`);
  } catch (err) {
    setStatus('검색 실패: ' + err.message);
  }
}

// ==================== 통계 ====================
async function loadStats() {
  try {
    const [notes, entities] = await Promise.all([
      api('/notes?limit=1'),
      api('/entities?limit=1'),
    ]);
    // 간이 통계 (목록 길이로 추정)
    document.getElementById('stats-text').textContent =
      `노트: ${notes.notes.length}+ | 엔티티: ${entities.entities.length}+`;
  } catch {
    // 무시
  }
}

// ==================== 유틸리티 ====================
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
