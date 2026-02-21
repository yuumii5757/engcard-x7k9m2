// ─── Gist Sync with AES-GCM Encryption ─────────────────────────
const Sync = {
    STORAGE_KEY_TOKEN: 'flashcard-sync-token',
    STORAGE_KEY_GIST: 'flashcard-sync-gist-id',
    STORAGE_KEY_PASS: 'flashcard-sync-pass-check',

    // ─── Crypto Helpers ───────────────────────────────────────────

    async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    async encrypt(plainText, password) {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(password, salt);
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, key, enc.encode(plainText)
        );
        // Pack: salt(16) + iv(12) + ciphertext
        const buf = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        buf.set(salt, 0);
        buf.set(iv, salt.length);
        buf.set(new Uint8Array(encrypted), salt.length + iv.length);
        // Convert to Base64
        return btoa(String.fromCharCode(...buf));
    },

    async decrypt(base64, password) {
        const binary = atob(base64);
        const buf = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
        const salt = buf.slice(0, 16);
        const iv = buf.slice(16, 28);
        const ciphertext = buf.slice(28);
        const key = await this.deriveKey(password, salt);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv }, key, ciphertext
        );
        return new TextDecoder().decode(decrypted);
    },

    // ─── Gist API ─────────────────────────────────────────────────

    getToken() {
        return localStorage.getItem(this.STORAGE_KEY_TOKEN) || '';
    },

    getGistId() {
        return localStorage.getItem(this.STORAGE_KEY_GIST) || '';
    },

    getPassword() {
        // Password is entered each time for security; we only store a check hash
        return this._currentPassword || '';
    },

    async gistRequest(method, path, body) {
        const token = this.getToken();
        if (!token) throw new Error('GitHubトークンが設定されていません');
        const opts = {
            method,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`https://api.github.com${path}`, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `API error: ${res.status}`);
        }
        return res.json();
    },

    // ─── Upload ───────────────────────────────────────────────────

    async upload() {
        const password = this._currentPassword;
        if (!password) { App.toast('パスワードを入力してください ❌'); return; }
        if (!this.getToken()) { App.toast('GitHubトークンを設定してください ❌'); return; }

        try {
            App.toast('暗号化中...');
            const cards = await getAllCards();
            const json = JSON.stringify(cards);
            const encrypted = await this.encrypt(json, password);

            const fileContent = {
                'flashcards.enc': { content: encrypted }
            };

            let gistId = this.getGistId();

            if (gistId) {
                // Update existing Gist
                App.toast('アップロード中...');
                await this.gistRequest('PATCH', `/gists/${gistId}`, {
                    files: fileContent
                });
            } else {
                // Create new private Gist
                App.toast('新しいGistを作成中...');
                const result = await this.gistRequest('POST', '/gists', {
                    description: 'EngCard Sync Data (encrypted)',
                    public: false,
                    files: fileContent
                });
                gistId = result.id;
                localStorage.setItem(this.STORAGE_KEY_GIST, gistId);
            }

            App.toast(`${cards.length}枚のカードをアップロードしました ⬆️`);
            App.navigate('settings');
        } catch (e) {
            console.error('Upload failed:', e);
            App.toast(`アップロード失敗: ${e.message} ❌`);
        }
    },

    // ─── Download ─────────────────────────────────────────────────

    async download() {
        const password = this._currentPassword;
        if (!password) { App.toast('パスワードを入力してください ❌'); return; }

        const gistId = this.getGistId();
        if (!gistId) { App.toast('Gist IDが設定されていません ❌'); return; }
        if (!this.getToken()) { App.toast('GitHubトークンを設定してください ❌'); return; }

        try {
            App.toast('ダウンロード中...');
            const gist = await this.gistRequest('GET', `/gists/${gistId}`);
            const file = gist.files['flashcards.enc'];
            if (!file) throw new Error('データが見つかりません');

            App.toast('復号中...');
            let decrypted;
            try {
                decrypted = await this.decrypt(file.content, password);
            } catch (e) {
                App.toast('パスワードが違います ❌');
                return;
            }

            const count = await importJSON(decrypted);
            App.toast(`${count}枚のカードをダウンロードしました ⬇️`);
            App.navigate('settings');
        } catch (e) {
            console.error('Download failed:', e);
            App.toast(`ダウンロード失敗: ${e.message} ❌`);
        }
    },

    // ─── Settings UI ──────────────────────────────────────────────

    renderSettings() {
        const token = this.getToken();
        const gistId = this.getGistId();
        const hasToken = token.length > 0;
        const maskedToken = hasToken ? token.slice(0, 6) + '••••••' + token.slice(-4) : '';

        return `
      <div class="settings-section">
        <div class="section-title"><span class="icon">🔄</span> クラウド同期</div>
        <p class="settings-desc">端末間でカードデータを暗号化して同期します。<br>データは AES-256 で暗号化されるため、第三者には読めません。</p>

        <div class="sync-form">
          <label class="input-label">🔑 暗号化パスワード</label>
          <input type="password" id="sync-password" class="form-input" placeholder="暗号化・復号用のパスワード" autocomplete="off">

          <label class="input-label">🔐 GitHub Personal Access Token</label>
          <input type="password" id="sync-token" class="form-input" placeholder="${hasToken ? maskedToken : 'ghp_xxxx...'}" autocomplete="off">
          <p class="input-hint">GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) で作成。<br>スコープは <strong>gist のみ</strong> にチェック。</p>

          ${gistId ? `
            <label class="input-label">📎 Gist ID</label>
            <input type="text" id="sync-gist-id" class="form-input" value="${gistId}" placeholder="Gist ID">
            <p class="input-hint">別端末で同じGistを使う場合、このIDを入力してください。</p>
          ` : `
            <label class="input-label">📎 Gist ID（任意）</label>
            <input type="text" id="sync-gist-id" class="form-input" value="" placeholder="既存のGist IDがあれば入力">
            <p class="input-hint">空欄の場合、初回アップロード時に自動作成されます。</p>
          `}

          <button class="btn btn-primary btn-block" onclick="Sync.saveAndUpload()">⬆️ 保存 & アップロード</button>
          <button class="btn btn-ghost btn-block" onclick="Sync.saveAndDownload()">⬇️ 保存 & ダウンロード</button>
        </div>
      </div>
    `;
    },

    _saveSettings() {
        const tokenInput = document.getElementById('sync-token');
        const gistInput = document.getElementById('sync-gist-id');
        const passInput = document.getElementById('sync-password');

        if (!passInput || !passInput.value.trim()) {
            App.toast('パスワードを入力してください ❌');
            return false;
        }
        this._currentPassword = passInput.value.trim();

        // Only update token if user typed something new
        if (tokenInput && tokenInput.value.trim() && !tokenInput.value.includes('••')) {
            localStorage.setItem(this.STORAGE_KEY_TOKEN, tokenInput.value.trim());
        }

        if (gistInput && gistInput.value.trim()) {
            localStorage.setItem(this.STORAGE_KEY_GIST, gistInput.value.trim());
        }

        return true;
    },

    saveAndUpload() {
        if (this._saveSettings()) this.upload();
    },

    saveAndDownload() {
        if (this._saveSettings()) this.download();
    }
};
