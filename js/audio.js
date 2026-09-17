/* ============================================================
   WEB AUDIO TACTILE CLICK SYNTHESIZER
   ============================================================ */

window.SoundEngine = {
  ctx: null,
  enabled: true,

  init() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  },

  playClick() {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch (e) {}
  },

  toggleSound() {
    this.enabled = !this.enabled;
    localStorage.setItem('lemonpack_sound_fx', this.enabled ? '1' : '0');
    const btn = document.getElementById('btn-sound-toggle');
    if (btn) {
      btn.innerHTML = this.enabled ? '<i class="ph ph-speaker-high"></i>' : '<i class="ph ph-speaker-slash"></i>';
      btn.title = this.enabled ? 'صدای کلیک: روشن' : 'صدای کلیک: خاموش';
    }
  }
};
