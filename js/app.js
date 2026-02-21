// ─── SPA Router & App Controller ────────────────────────────────

const App = {
  async init() {
    this.appEl = document.getElementById('app');
    // Theme setup
    this.initTheme();
    // Speech setup
    Speech.init();
    // Handle hash changes
    window.addEventListener('hashchange', () => this.route());
    // Initial route
    this.route();
  },

  // ─── Theme Management ───────────────────────────────────────
  initTheme() {
    const saved = localStorage.getItem('flashcard-theme') || 'dark';
    this.setTheme(saved);
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
  },

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('flashcard-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  },

  toggleTheme() {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  },

  async navigate(page) {
    const current = window.location.hash.replace('#', '');
    if (current === page) {
      // Same hash — hashchange won't fire, so re-render manually
      this.route();
    } else {
      window.location.hash = page;
    }
  },

  async route() {
    const hash = window.location.hash.replace('#', '') || 'top';
    const app = this.appEl;

    // Scroll to top on route change
    window.scrollTo(0, 0);

    let html = '';

    switch (hash) {
      case 'top':
        html = await this.renderTop();
        break;
      case 'cards':
        html = await Cards.render();
        break;
      case 'quiz':
        html = await Quiz.renderGenreSelect();
        break;
      case 'quiz-question':
        html = Quiz.renderQuestion();
        break;
      case 'quiz-result':
        html = Quiz.renderResult();
        break;
      case 'settings':
        html = this.renderSettings();
        break;
      case 'miss-list':
        html = await this.renderMissList();
        break;
      case 'favorites':
        html = await this.renderFavorites();
        break;
      default:
        html = await this.renderTop();
    }

    app.innerHTML = html;
  },

  async renderTop() {
    const cards = await getAllCards();
    const genres = await getGenres();
    const totalWrong = cards.reduce((acc, c) => acc + (c.wrongCount || 0), 0);

    return `
      <div class="app-header">
        <h1>⚡ 瞬間英作文フラッシュカード</h1>
        <div class="subtitle">Instant English Sentence Making</div>
      </div>

      <div class="stats-bar">
        <div class="stat-item stat-clickable" onclick="App.navigate('cards')">
          <div class="stat-value">${cards.length}</div>
          <div class="stat-label">カード数</div>
        </div>
        <div class="stat-item stat-clickable" onclick="App.navigate('quiz')">
          <div class="stat-value">${genres.length}</div>
          <div class="stat-label">ジャンル数</div>
        </div>
        <div class="stat-item stat-clickable" onclick="App.navigate('miss-list')">
          <div class="stat-value">${totalWrong}</div>
          <div class="stat-label">累計ミス</div>
        </div>
      </div>

      <div class="menu-item" onclick="App.navigate('cards')">
        <div class="menu-icon create">✏️</div>
        <div class="menu-info">
          <h3>カード作成モード</h3>
          <p>新しいカードの作成・編集・管理</p>
        </div>
      </div>

      <div class="menu-item" onclick="App.navigate('quiz')">
        <div class="menu-icon quiz">📖</div>
        <div class="menu-info">
          <h3>問題に答えるモード</h3>
          <p>穴埋め・全文モードでトレーニング</p>
        </div>
      </div>

      <div class="menu-item" onclick="App.navigate('favorites')">
        <div class="menu-icon" style="background:linear-gradient(135deg,rgba(255,193,7,0.15),rgba(255,193,7,0.05));color:var(--warning)">⭐</div>
        <div class="menu-info">
          <h3>お気に入り</h3>
          <p>お気に入りカードの一覧</p>
        </div>
      </div>

      <div class="menu-item" onclick="App.navigate('settings')">
        <div class="menu-icon" style="background:linear-gradient(135deg,rgba(179,136,255,0.15),rgba(179,136,255,0.05));color:var(--purple)">⚙️</div>
        <div class="menu-info">
          <h3>設定</h3>
          <p>音声・テーマの設定</p>
        </div>
      </div>
    `;
  },

  renderSettings() {
    return `
      <button class="nav-back" onclick="App.navigate('top')">← トップに戻る</button>
      ${Speech.renderSettings()}
    `;
  },

  async renderMissList() {
    const cards = await getAllCards();
    const missCards = cards.filter(c => (c.wrongCount || 0) > 0)
      .sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));

    return `
      <button class="nav-back" onclick="App.navigate('top')">← トップに戻る</button>
      <div class="section-title"><span class="icon">❌</span> ミスが多いカード <span style="color:var(--text-muted);font-weight:400;font-size:0.82rem">(${missCards.length}枚)</span></div>

      ${missCards.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <p>ミスしたカードはありません。<br>素晴らしい！</p>
        </div>
      ` : missCards.map((c, i) => `
        <div class="card-list-item" style="animation-delay:${i * 0.04}s">
          <div class="card-list-text">
            <div class="jp">${escapeHtml(c.japanese)}</div>
            <div class="en">${escapeHtml(c.english)}</div>
          </div>
          <span class="genre-tag">${escapeHtml(c.genre)}</span>
          <span class="miss-badge">×${c.wrongCount}</span>
        </div>
      `).join('')}
    `;
  },

  async renderFavorites() {
    const favCards = await getFavoriteCards();

    return `
      <button class="nav-back" onclick="App.navigate('top')">← トップに戻る</button>
      <div class="section-title"><span class="icon">⭐</span> お気に入りカード <span style="color:var(--text-muted);font-weight:400;font-size:0.82rem">(${favCards.length}枚)</span></div>

      ${favCards.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">☆</div>
          <p>お気に入りカードはまだありません。<br>カード一覧やクイズ画面から追加できます。</p>
        </div>
      ` : favCards.map((c, i) => `
        <div class="card-list-item" style="animation-delay:${i * 0.04}s">
          <div class="card-list-text">
            <div class="jp">${escapeHtml(c.japanese)}</div>
            <div class="en">${escapeHtml(c.english)}</div>
            ${c.memo ? `<div class="memo-preview">📝 ${escapeHtml(c.memo)}</div>` : ''}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${c.genre.split(/[,、]/).map(g => g.trim()).filter(Boolean).map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}
          </div>
          <div class="card-list-actions">
            <button class="btn-fav active" onclick="Cards.toggleFav('${c.id}')" title="お気に入り解除">★</button>
            <button class="btn btn-ghost btn-icon" onclick="Cards.edit('${c.id}', 'favorites')" title="編集">✏️</button>
          </div>
        </div>
      `).join('')}

      ${favCards.length > 0 ? `
        <button class="btn btn-success btn-block" style="margin-top:16px" onclick="Quiz.selectedGenre='⭐お気に入り'; Quiz.startQuiz()">
          📖 お気に入りで問題を解く
        </button>
      ` : ''}
    `;
  },

  // ─── Toast Notification ───────────────────────────────────────
  toast(message) {
    let t = document.getElementById('app-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'app-toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      t.classList.remove('show');
    }, 2200);
  }
};

// ─── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
