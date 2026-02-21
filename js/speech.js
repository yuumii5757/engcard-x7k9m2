// ─── Web Speech API Wrapper ─────────────────────────────────────
const Speech = {
    _selectedVoice: null,
    _voices: [],
    _rate: 0.85,

    init() {
        if (!('speechSynthesis' in window)) return;

        // Load voices (may be async)
        const loadVoices = () => {
            this._voices = window.speechSynthesis.getVoices()
                .filter(v => v.lang.startsWith('en'));
            // Auto-select the best voice
            if (!this._selectedVoice && this._voices.length > 0) {
                this._selectedVoice = this._pickBestVoice();
            }
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        // Load saved preference
        const saved = localStorage.getItem('flashcard-voice');
        if (saved) this._selectedVoiceName = saved;
        const savedRate = localStorage.getItem('flashcard-rate');
        if (savedRate) this._rate = parseFloat(savedRate);
    },

    // Prefer natural/premium voices
    _pickBestVoice() {
        const voices = this._voices;
        // Check saved preference first
        if (this._selectedVoiceName) {
            const found = voices.find(v => v.name === this._selectedVoiceName);
            if (found) return found;
        }

        // Priority: premium/enhanced voices > default voices
        const premium = voices.find(v =>
            v.name.includes('Premium') || v.name.includes('Enhanced') ||
            v.name.includes('Natural') || v.name.includes('Samantha') ||
            v.name.includes('Karen') || v.name.includes('Daniel')
        );
        if (premium) return premium;

        // Prefer en-US voices
        const enUS = voices.find(v => v.lang === 'en-US');
        if (enUS) return enUS;

        return voices[0];
    },

    speak(text) {
        if (!('speechSynthesis' in window)) {
            console.warn('Speech Synthesis not supported');
            return;
        }
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = 'en-US';
        utt.rate = this._rate;
        utt.pitch = 1.0;

        if (this._selectedVoice) {
            utt.voice = this._selectedVoice;
        }

        window.speechSynthesis.speak(utt);
    },

    stop() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    },

    setVoice(voiceName) {
        const v = this._voices.find(v => v.name === voiceName);
        if (v) {
            this._selectedVoice = v;
            this._selectedVoiceName = voiceName;
            localStorage.setItem('flashcard-voice', voiceName);
        }
    },

    setRate(rate) {
        this._rate = rate;
        localStorage.setItem('flashcard-rate', String(rate));
    },

    getVoices() {
        return this._voices;
    },

    // Render voice settings UI
    renderSettings() {
        const voices = this.getVoices();
        const currentName = this._selectedVoice ? this._selectedVoice.name : '';

        return `
            <div class="section-title"><span class="icon">🔊</span> 音声設定</div>
            <div class="card-flat">
                <div class="form-group">
                    <label class="form-label">音声を選択</label>
                    <select id="voice-select" class="form-input" onchange="Speech.setVoice(this.value); Speech.speak('Hello, how are you?')">
                        ${voices.length === 0 ? '<option>音声を読み込み中...</option>' : ''}
                        ${voices.map(v => `
                            <option value="${v.name}" ${v.name === currentName ? 'selected' : ''}>
                                ${v.name} (${v.lang})
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">速度: <span id="rate-val">${this._rate.toFixed(2)}</span></label>
                    <input type="range" id="voice-rate" class="form-input" 
                           min="0.5" max="1.5" step="0.05" value="${this._rate}"
                           oninput="Speech.setRate(parseFloat(this.value)); document.getElementById('rate-val').textContent = this.value"
                           style="padding: 8px 4px;">
                </div>
                <button class="btn btn-purple btn-sm" onclick="Speech.speak('I watched a movie yesterday.')">
                    🔊 テスト再生
                </button>
            </div>
        `;
    }
};
