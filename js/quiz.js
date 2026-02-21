// ─── Quiz Module ────────────────────────────────────────────────

const Quiz = {
  // Session state
  session: null,

  // ─── Genre Selection ──────────────────────────────────────────
  async renderGenreSelect() {
    const cards = await getAllCards();
    const genreMap = {};
    cards.forEach(c => {
      genreMap[c.genre] = (genreMap[c.genre] || 0) + 1;
    });
    const genres = Object.keys(genreMap).sort();

    if (genres.length === 0) {
      return `
        <button class="nav-back" onclick="App.navigate('top')">← トップに戻る</button>
        <div class="section-title"><span class="icon">📖</span> 問題に答える</div>
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>カードが登録されていません。<br>まずカードを作成しましょう！</p>
          <button class="btn btn-primary" style="margin-top:16px" onclick="App.navigate('cards')">カード作成へ</button>
        </div>
      `;
    }

    // Add favorite count
    const favCount = cards.filter(c => c.favorite).length;

    return `
      <button class="nav-back" onclick="App.navigate('top')">← トップに戻る</button>
      <div class="section-title"><span class="icon">📖</span> ジャンルを選択</div>
      ${favCount > 0 ? `
        <div class="genre-card fav-genre" style="margin-bottom:16px" onclick="Quiz.selectGenre('⭐お気に入り')">
          <div class="genre-name">⭐ お気に入り</div>
          <div class="genre-count">${favCount}枚</div>
        </div>
      ` : ''}
      <div class="genre-grid">
        ${genres.map((g, i) => `
          <div class="genre-card" style="animation-delay:${i * 0.06}s" onclick="Quiz.selectGenre('${escapeHtml(g)}')">
            <div class="genre-name">${escapeHtml(g)}</div>
            <div class="genre-count">${genreMap[g]}枚</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // ─── Genre → Start Quiz directly ──────────────────────────────
  selectedGenre: null,

  selectGenre(genre) {
    this.selectedGenre = genre;
    this.startQuiz();
  },

  // ─── Start Quiz ───────────────────────────────────────────────
  async startQuiz() {
    let cards;
    if (this.selectedGenre === '⭐お気に入り') {
      cards = await getFavoriteCards();
    } else {
      cards = await getCardsByGenre(this.selectedGenre);
    }
    if (cards.length === 0) {
      App.toast('このジャンルにカードがありません');
      return;
    }

    this.session = {
      genre: this.selectedGenre,
      cards,
      totalCount: 0,
      correctCount: 0,
      wrongCards: [],
      currentCard: null,
      clozeRevealed: false,
      answerRevealed: false,
      memoRevealed: false,
      _clozeCache: null
    };

    this.nextQuestion();
  },

  // ─── Weighted Random Selection ────────────────────────────────
  pickWeightedRandom(cards) {
    const weights = cards.map(c => 1 + (c.wrongCount || 0) * 2);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < cards.length; i++) {
      rand -= weights[i];
      if (rand <= 0) return cards[i];
    }
    return cards[cards.length - 1];
  },

  // ─── Next Question ────────────────────────────────────────────
  nextQuestion() {
    const s = this.session;
    s.currentCard = this.pickWeightedRandom(s.cards);
    s.clozeRevealed = false;
    s.answerRevealed = false;
    s.memoRevealed = false;
    s._scoring = false;
    s._clozeCache = null;
    s.totalCount++;
    App.navigate('quiz-question');
  },

  // ─── Create Cloze Text ───────────────────────────────────────
  createCloze(english) {
    const words = english.split(/\s+/);
    if (words.length <= 1) {
      return { display: '<span class="blank">______</span>' };
    }

    // Hide 30-40% of words (at least 1)
    const ratio = 0.3 + Math.random() * 0.1; // 0.30 ~ 0.40
    const hideCount = Math.max(1, Math.round(words.length * ratio));

    // Build candidates: prefer words with 3+ letters
    const indices = words.map((w, i) => i);
    const longIndices = indices.filter(i => words[i].replace(/[^a-zA-Z]/g, '').length >= 3);
    const pool = longIndices.length >= hideCount ? longIndices : indices;

    // Shuffle and pick
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const hiddenSet = new Set(shuffled.slice(0, hideCount));

    const blanked = words.map((w, i) => {
      if (hiddenSet.has(i)) {
        const underscores = '_'.repeat(Math.max(w.replace(/[^a-zA-Z]/g, '').length, 4));
        const trailing = w.match(/[^a-zA-Z']+$/);
        return `<span class="blank">${underscores}</span>${trailing ? trailing[0] : ''}`;
      }
      return escapeHtml(w);
    }).join(' ');

    return { display: blanked };
  },

  // ─── Render Question ──────────────────────────────────────────
  renderQuestion() {
    const s = this.session;
    if (!s || !s.currentCard) return '<p>エラー</p>';

    const card = s.currentCard;

    // Cache cloze so it doesn't change on re-render
    if (!s._clozeCache) {
      s._clozeCache = this.createCloze(card.english);
    }

    // English area content
    let englishArea = '';
    if (s.answerRevealed) {
      // Full answer revealed with copy button
      englishArea = `
        <div class="quiz-answer-reveal">
          ${escapeHtml(card.english)}
          <button class="btn-copy" onclick="Quiz.copyEnglish()" title="コピー">📋</button>
        </div>
      `;
    } else if (s.clozeRevealed) {
      // Cloze hint shown
      englishArea = `<div class="quiz-english">${s._clozeCache.display}</div>`;
    } else {
      // Nothing shown yet
      englishArea = `
        <div class="quiz-english" style="color:var(--text-muted);font-style:italic">
          下のボタンでヒント・正解を表示
        </div>
      `;
    }

    // Buttons
    let actionButtons = '';
    if (s.answerRevealed) {
      actionButtons = `
        <div class="btn-group">
          <button class="btn btn-success" onclick="Quiz.markCorrect()">⭕ 正解</button>
          <button class="btn btn-danger" onclick="Quiz.markWrong()">❌ 不正解</button>
        </div>
        <div class="btn-group">
          <button class="btn-fav quiz-fav ${card.favorite ? 'active' : ''}" onclick="Cards.toggleFav('${card.id}')">${card.favorite ? '★ お気に入り' : '☆ お気に入り'}</button>
          <button class="btn btn-ghost btn-sm" onclick="Cards.edit('${card.id}', 'quiz-question')">✏️ 編集</button>
        </div>
      `;
    } else {
      actionButtons = `
        ${!s.clozeRevealed ? `
          <button class="btn btn-ghost btn-block" onclick="Quiz.showClozeHint()">
            🧩 穴埋めを見る
          </button>
        ` : ''}
        <button class="btn btn-primary btn-block" onclick="Quiz.revealAnswer()">
          👁️ 正解を見る
        </button>
      `;
    }

    // Memo area
    let memoArea = '';
    const hasMemo = card.memo && card.memo.trim();
    if (s.answerRevealed && hasMemo) {
      // Auto-show memo on answer reveal
      memoArea = `<div class="quiz-memo">📝 ${escapeHtml(card.memo)}</div>`;
    } else if (s.memoRevealed && hasMemo) {
      memoArea = `<div class="quiz-memo">📝 ${escapeHtml(card.memo)}</div>`;
    }

    return `
      <button class="nav-back" onclick="Quiz.confirmExit()">← 終了する</button>
      <div class="quiz-card">
        <div class="quiz-progress">
          問題 ${s.totalCount} 問目 ・ ジャンル: ${escapeHtml(s.genre)}
        </div>
        <div class="quiz-japanese">${escapeHtml(card.japanese)}</div>
        ${englishArea}
        ${memoArea}
      </div>

      <div class="btn-stack">
        ${actionButtons}
        <button class="btn btn-purple btn-block" onclick="Speech.speak(\`${card.english.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)">
          🔊 音声を聞く
        </button>
        ${hasMemo && !s.answerRevealed && !s.memoRevealed ? `
          <button class="btn btn-ghost btn-block" onclick="Quiz.showMemo()">
            📝 メモを見る
          </button>
        ` : ''}
        <div class="btn-group">
          <button class="btn btn-warning btn-sm" onclick="Quiz.showResult()">📊 結果を見る</button>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('quiz')">↩️ ジャンル選択</button>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('top')">🏠 トップ</button>
        </div>
      </div>
    `;
  },

  showMemo() {
    this.session.memoRevealed = true;
    App.navigate('quiz-question');
  },

  showClozeHint() {
    this.session.clozeRevealed = true;
    App.navigate('quiz-question');
  },

  copyEnglish() {
    const text = this.session?.currentCard?.english;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      App.toast('コピーしました 📋');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      App.toast('コピーしました 📋');
    });
  },

  revealAnswer() {
    this.session.answerRevealed = true;
    App.navigate('quiz-question');
  },

  async markCorrect() {
    if (this.session._scoring) return;
    this.session._scoring = true;
    const card = this.session.currentCard;
    card.lastAnswered = new Date().toISOString();
    await updateCard(card);
    this.session.correctCount++;
    this.nextQuestion();
  },

  async markWrong() {
    if (this.session._scoring) return;
    this.session._scoring = true;
    const card = this.session.currentCard;
    card.wrongCount = (card.wrongCount || 0) + 1;
    card.lastAnswered = new Date().toISOString();
    await updateCard(card);
    this.session.wrongCards.push({ ...card });
    this.nextQuestion();
  },

  confirmExit() {
    if (this.session && this.session.totalCount > 1) {
      if (confirm('セッションを終了して結果を表示しますか？')) {
        this.showResult();
      }
    } else {
      App.navigate('quiz');
    }
  },

  // ─── Result Screen ────────────────────────────────────────────
  showResult() {
    App.navigate('quiz-result');
  },

  renderResult() {
    const s = this.session;
    if (!s) return '<p>セッションがありません</p>';

    const answered = s.totalCount - 1;
    const wrong = s.wrongCards.length;
    const correct = s.correctCount;
    const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;

    let emoji = '🎉';
    let message = 'すばらしい！';
    if (rate < 50) { emoji = '💪'; message = '次はもっと頑張ろう！'; }
    else if (rate < 80) { emoji = '👍'; message = 'いい調子です！'; }
    else if (rate < 100) { emoji = '✨'; message = 'あと少しで完璧！'; }

    return `
      <div class="result-header">
        <div class="result-emoji">${emoji}</div>
        <h2>${message}</h2>
      </div>

      <div class="result-stats">
        <div class="result-stat">
          <div class="val">${answered}</div>
          <div class="label">出題数</div>
        </div>
        <div class="result-stat">
          <div class="val correct">${correct}</div>
          <div class="label">正解</div>
        </div>
        <div class="result-stat">
          <div class="val wrong">${wrong}</div>
          <div class="label">不正解</div>
        </div>
        <div class="result-stat">
          <div class="val" style="color:var(--accent)">${rate}%</div>
          <div class="label">正答率</div>
        </div>
      </div>

      ${wrong > 0 ? `
        <div class="section-title"><span class="icon">📋</span> 不正解カード</div>
        <div class="wrong-list" id="wrong-list">
          ${s.wrongCards.map((c, i) => `
            <div class="wrong-list-item" style="animation-delay:${i * 0.05}s">
              <div class="jp">${escapeHtml(c.japanese)}</div>
              <div class="en">${escapeHtml(c.english)}</div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="Quiz.copyWrongCards()">
          📋 不正解カードをコピー
        </button>
      ` : `
        <div class="empty-state" style="padding:24px">
          <div class="empty-icon">🏆</div>
          <p>全問正解おめでとうございます！</p>
        </div>
      `}

      <div class="btn-stack" style="margin-top:20px">
        <button class="btn btn-success btn-block" onclick="Quiz.startQuiz()">🔄 同じジャンルでもう一度</button>
        <button class="btn btn-ghost btn-block" onclick="App.navigate('quiz')">↩️ ジャンル選択へ</button>
        <button class="btn btn-ghost btn-block" onclick="App.navigate('top')">🏠 トップへ</button>
      </div>
    `;
  },

  copyWrongCards() {
    const s = this.session;
    if (!s) return;
    const text = s.wrongCards.map(c => `${c.japanese}\n${c.english}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      App.toast('コピーしました 📋');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      App.toast('コピーしました 📋');
    });
  }
};
