// ─── Card Management Screen ─────────────────────────────────────

const Cards = {
  async render() {
    const cards = await getAllCards();
    const genres = await getGenres();

    return `
      <button class="nav-back" onclick="App.navigate('top')">← トップに戻る</button>
      <div class="section-title"><span class="icon">✏️</span> カード作成</div>

      <div class="card-flat">
        <div class="form-group">
          <label class="form-label">日本語</label>
          <input type="text" id="inp-jp" class="form-input" placeholder="例：私は昨日映画を見ました。">
        </div>
        <div class="form-group">
          <label class="form-label">英語</label>
          <input type="text" id="inp-en" class="form-input" placeholder="例：I watched a movie yesterday.">
        </div>
        <div class="form-group">
          <label class="form-label">ジャンル <span style="font-weight:400;color:var(--text-muted)">カンマ区切りで複数可</span></label>
          <input type="text" id="inp-genre" class="form-input" placeholder="例：日常, ビジネス" list="genre-list">
          <datalist id="genre-list">
            ${genres.map(g => `<option value="${g}">`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">メモ <span style="font-weight:400;color:var(--text-muted)">任意</span></label>
          <textarea id="inp-memo" class="form-input" rows="2" placeholder="例：時制に注意" style="resize:vertical"></textarea>
        </div>
        <button class="btn btn-primary btn-block" onclick="Cards.addCard()">💾 カードを保存</button>
      </div>

      <div class="io-bar">
        <button class="btn btn-ghost btn-sm" onclick="Cards.exportData()">📤 エクスポート</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('import-file').click()">📥 インポート</button>
        <button class="btn btn-ghost btn-sm" onclick="Cards.importFromServer()">☁️ サーバーから読込</button>
        <input type="file" id="import-file" class="hidden-input" accept=".json" onchange="Cards.importData(event)">
      </div>

      <div class="section-title"><span class="icon">📚</span> カード一覧 <span style="color:var(--text-muted);font-weight:400;font-size:0.82rem">(${cards.length}枚)</span></div>

      <div id="card-list">
        ${cards.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📝</div>
            <p>まだカードがありません。<br>上のフォームから作成しましょう！</p>
          </div>
        ` : cards.map((c, i) => `
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
              <button class="btn-fav ${c.favorite ? 'active' : ''}" onclick="Cards.toggleFav('${c.id}')" title="お気に入り">${c.favorite ? '★' : '☆'}</button>
              <button class="btn btn-ghost btn-icon" onclick="Cards.edit('${c.id}')" title="編集">✏️</button>
              <button class="btn btn-ghost btn-icon" onclick="Cards.remove('${c.id}')" title="削除">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async addCard() {
    const jp = document.getElementById('inp-jp').value.trim();
    const en = document.getElementById('inp-en').value.trim();
    const genre = document.getElementById('inp-genre').value.trim();
    const memo = document.getElementById('inp-memo').value.trim();

    if (!jp || !en || !genre) {
      App.toast('日本語・英語・ジャンルを入力してください');
      return;
    }

    await addCard(jp, en, genre, memo);
    App.toast('カードを保存しました ✅');
    App.navigate('cards');
  },

  async edit(id, returnRoute) {
    this._editReturnRoute = returnRoute || 'cards';
    const card = await getCard(id);
    if (!card) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'edit-modal';
    overlay.innerHTML = `
      <div class="modal-content">
        <h3>✏️ カード編集</h3>
        <div class="form-group">
          <label class="form-label">日本語</label>
          <input type="text" id="edit-jp" class="form-input" value="${escapeHtml(card.japanese)}">
        </div>
        <div class="form-group">
          <label class="form-label">英語</label>
          <input type="text" id="edit-en" class="form-input" value="${escapeHtml(card.english)}">
        </div>
        <div class="form-group">
          <label class="form-label">ジャンル <span style="font-weight:400;color:var(--text-muted)">カンマ区切りで複数可</span></label>
          <input type="text" id="edit-genre" class="form-input" value="${escapeHtml(card.genre)}">
        </div>
        <div class="form-group">
          <label class="form-label">メモ</label>
          <textarea id="edit-memo" class="form-input" rows="2" style="resize:vertical">${escapeHtml(card.memo || '')}</textarea>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" onclick="Cards.saveEdit('${id}')">保存</button>
          <button class="btn btn-ghost" onclick="document.getElementById('edit-modal').remove()">キャンセル</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  },

  async saveEdit(id) {
    const card = await getCard(id);
    card.japanese = document.getElementById('edit-jp').value.trim();
    card.english = document.getElementById('edit-en').value.trim();
    card.genre = document.getElementById('edit-genre').value.trim();
    card.memo = document.getElementById('edit-memo').value.trim();

    if (!card.japanese || !card.english || !card.genre) {
      App.toast('日本語・英語・ジャンルを入力してください');
      return;
    }

    await updateCard(card);
    document.getElementById('edit-modal').remove();
    App.toast('カードを更新しました ✅');
    // If editing from quiz, update the session card too
    if (Quiz.session && Quiz.session.currentCard && Quiz.session.currentCard.id === id) {
      Quiz.session.currentCard = card;
    }
    App.navigate(this._editReturnRoute || 'cards');
  },

  async toggleFav(id) {
    const card = await toggleFavorite(id);
    if (card) {
      App.toast(card.favorite ? '⭐ お気に入りに追加' : 'お気に入りを解除');
      // Update quiz session card if applicable
      if (Quiz.session && Quiz.session.currentCard && Quiz.session.currentCard.id === id) {
        Quiz.session.currentCard.favorite = card.favorite;
      }
      App.navigate(window.location.hash.replace('#', '') || 'cards');
    }
  },

  async remove(id) {
    if (!confirm('このカードを削除しますか？')) return;
    await deleteCard(id);
    App.toast('カードを削除しました');
    App.navigate('cards');
  },

  async exportData() {
    const json = await exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashcards_export.json';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('エクスポートしました 📤');
  },

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const count = await importJSON(text);
      App.toast(`${count}枚のカードをインポートしました 📥`);
      App.navigate('cards');
    } catch (e) {
      App.toast('インポートに失敗しました ❌');
    }
    event.target.value = '';
  },

  async importFromServer() {
    const ok = confirm('⚠️ サーバーから読み込むと、お気に入りや学習記録（不正解回数など）がリセットされます。\n\n続行しますか？');
    if (!ok) return;
    try {
      App.toast('読み込み中...');
      const res = await fetch('data/cards_updated.json');
      if (!res.ok) throw new Error('fetch failed');
      const text = await res.text();
      const count = await importJSON(text);
      App.toast(`${count}枚のカードを読み込みました ☁️`);
      App.navigate('cards');
    } catch (e) {
      App.toast('サーバーからの読み込みに失敗しました ❌');
    }
  }
};

// ─── Utility ──────────────────────────────────────────────────
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
