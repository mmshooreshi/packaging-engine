/* ============================================================
   GUIDED DIE-CUT IMPORT & MEASUREMENT WIZARD ENGINE v7.0
   Interactive step-by-step verification wizard for packaging diecuts.
   Drops SVG -> Asks step-by-step -> Confirms & builds exact measures.
   ============================================================ */

window.ParametricDieEngine = {
  // Wizard Steps:
  // 0: Upload & Preset Picker
  // 1: Cuts & Creases Verification (تیغ و تا)
  // 2: Length (L) Confirmation (طول بدنه)
  // 3: Width (W) Confirmation (عرض پهلو)
  // 4: Height (H) Confirmation (ارتفاع جعبه)
  // 5: Flaps (G & T) Confirmation (لب‌چسب و درب)
  // 6: Final Review & Apply to Studio (ساخت کامل اندازه‌ها)
  currentStep: 0,
  isCustomImport: false,
  rawSvgString: null,

  // Core Packaging Parametric Dimensions (in mm)
  params: {
    length: 120,    // L: طول بدنه
    width: 80,      // W: عرض پهلو
    height: 150,    // H: ارتفاع بدنه
    glueFlap: 15,   // G: لب‌چسب
    topTuck: 25,    // T: زبانه درپوش بالا
    dustFlap: 15    // D: گوشواره
  },

  // Calculated Metrics
  calculated: {
    flatWidth: 415,
    flatHeight: 266,
    totalBladeLengthMm: 1840,
    totalCreaseLengthMm: 1120,
    areaCm2: 1103.9
  },

  // Atomic Segments Repository
  segments: [],
  hoveredSegmentId: null,
  selectedSegmentId: null,

  // Canvas Viewport Controls
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
  scalePxPerMm: 1.5,

  init() {
    this.synthesizeModel();
    this.setupCanvasEvents();
    this.render();
  },

  /* ============================================================
     1. GEOMETRY SYNTHESIS (Piecewise CAD Model)
     ============================================================ */
  synthesizeModel() {
    const p = this.params;
    const L = Math.max(10, Number(p.length) || 120);
    const W = Math.max(10, Number(p.width) || 80);
    const H = Math.max(10, Number(p.height) || 150);
    const G = Math.max(5, Number(p.glueFlap) || 15);
    const T = Math.max(8, Number(p.topTuck) || 25);
    const D = Math.max(5, Number(p.dustFlap) || 15);

    p.length = L; p.width = W; p.height = H;
    p.glueFlap = G; p.topTuck = T; p.dustFlap = D;

    const x0 = 0;
    const x1 = G;
    const x2 = G + W;
    const x3 = G + W + L;
    const x4 = G + W + L + W;
    const x5 = G + W + L + W + L;

    const y0 = 0;
    const y1 = T;
    const y2 = T + W;
    const y3 = T + W + H;
    const y4 = T + W + H + W;
    const y5 = T + W + H + W + T;

    this.calculated.flatWidth = Math.round(x5);
    this.calculated.flatHeight = Math.round(y5);

    const segs = [];
    let nextId = 1;
    const add = (type, px1, py1, px2, py2, partKey, label) => {
      const x1n = Number(px1) || 0, y1n = Number(py1) || 0;
      const x2n = Number(px2) || 0, y2n = Number(py2) || 0;
      const len = Math.hypot(x2n - x1n, y2n - y1n);
      segs.push({
        id: `seg_${nextId++}`,
        type: type, // 'cut' | 'crease' | 'glue'
        x1: x1n, y1: y1n, x2: x2n, y2: y2n,
        d: `M ${x1n.toFixed(2)} ${y1n.toFixed(2)} L ${x2n.toFixed(2)} ${y2n.toFixed(2)}`,
        lengthMm: Number(len.toFixed(1)),
        partKey: partKey, // 'L' | 'W' | 'H' | 'G' | 'T' | 'body'
        label: label
      });
    };

    // Main horizontal creases (Body top & bottom score lines)
    add('crease', x1, y2, x5, y2, 'H', 'خط‌تا افقی بالای بدنه');
    add('crease', x1, y3, x5, y3, 'H', 'خط‌تا افقی پایین بدنه');

    // Main vertical creases (Body panel division lines)
    add('crease', x1, y2, x1, y3, 'G', 'خط‌تا عمودی لب‌چسب');
    add('crease', x2, y2, x2, y3, 'W', 'خط‌تا عمودی پهلو چپ / جلو');
    add('crease', x3, y2, x3, y3, 'L', 'خط‌تا عمودی جلو / پهلو راست');
    add('crease', x4, y2, x4, y3, 'W', 'خط‌تا عمودی پهلو راست / پشت');

    // Glue flap outline
    add('cut', x0, y2 + 4, x0, y3 - 4, 'G', 'لبه خارجی لب‌چسب');
    add('cut', x0, y2 + 4, x1, y2, 'G', 'پخ بالای لب‌چسب');
    add('cut', x0, y3 - 4, x1, y3, 'G', 'پخ پایین لب‌چسب');

    // Outer boundary cuts - Body right edge
    add('cut', x5, y2, x5, y3, 'L', 'لبه انتهایی بدنه پشت');

    // Top Dust Flaps (Panel 1: x1 to x2) & (Panel 3: x3 to x4)
    add('cut', x1, y2 - D, x2, y2 - D, 'W', 'لبه بالایی گوشواره ۱');
    add('cut', x1, y2, x1, y2 - D, 'W', 'برش کناری گوشواره ۱');
    add('cut', x2, y2, x2, y2 - D, 'W', 'برش کناری گوشواره ۱');

    add('cut', x3, y2 - D, x4, y2 - D, 'W', 'لبه بالایی گوشواره ۲');
    add('cut', x3, y2, x3, y2 - D, 'W', 'برش کناری گوشواره ۲');
    add('cut', x4, y2, x4, y2 - D, 'W', 'برش کناری گوشواره ۲');

    // Top Tuck Flap (Panel 2: x2 to x3)
    add('crease', x2, y1, x3, y1, 'T', 'خط‌تا درپوش بالا');
    add('cut', x2 + 4, y0, x3 - 4, y0, 'T', 'لبه زبانه درپوش بالا');
    add('cut', x2, y1, x2 + 4, y0, 'T', 'پخ چپ زبانه درپوش بالا');
    add('cut', x3, y1, x3 - 4, y0, 'T', 'پخ راست زبانه درپوش بالا');
    add('cut', x2, y1, x2, y2, 'T', 'برش کناری درپوش بالا');
    add('cut', x3, y1, x3, y2, 'T', 'برش کناری درپوش بالا');

    // Bottom Dust Flaps
    add('cut', x1, y3 + D, x2, y3 + D, 'W', 'لبه پایینی گوشواره پایین ۱');
    add('cut', x1, y3, x1, y3 + D, 'W', 'برش کناری گوشواره پایین ۱');
    add('cut', x2, y3, x2, y3 + D, 'W', 'برش کناری گوشواره پایین ۱');

    add('cut', x3, y3 + D, x4, y3 + D, 'W', 'لبه پایینی گوشواره پایین ۲');
    add('cut', x3, y3, x3, y3 + D, 'W', 'برش کناری گوشواره پایین ۲');
    add('cut', x4, y3, x4, y3 + D, 'W', 'برش کناری گوشواره پایین ۲');

    // Bottom Tuck Flap (Panel 4: x4 to x5)
    add('crease', x4, y4, x5, y4, 'T', 'خط‌تا درپوش پایین');
    add('cut', x4 + 4, y5, x5 - 4, y5, 'T', 'لبه زبانه درپوش پایین');
    add('cut', x4, y4, x4 + 4, y5, 'T', 'پخ چپ درپوش پایین');
    add('cut', x5, y4, x5 - 4, y5, 'T', 'پخ راست درپوش پایین');
    add('cut', x4, y3, x4, y4, 'T', 'برش کناری درپوش پایین');
    add('cut', x5, y3, x5, y4, 'T', 'برش کناری درپوش پایین');

    // Top/Bottom edge cuts on panels with no flaps
    add('cut', x4, y2, x5, y2, 'L', 'لبه بالایی بدنه پشت');
    add('cut', x2, y3, x3, y3, 'L', 'لبه پایینی بدنه جلو');

    this.segments = segs;
    this.recalculateTotals();
  },

  recalculateTotals() {
    let blade = 0;
    let crease = 0;
    this.segments.forEach(s => {
      if (s.type === 'crease') crease += s.lengthMm;
      else blade += s.lengthMm;
    });
    this.calculated.totalBladeLengthMm = Math.round(blade);
    this.calculated.totalCreaseLengthMm = Math.round(crease);
    this.calculated.areaCm2 = Number(((this.calculated.flatWidth * this.calculated.flatHeight) / 100).toFixed(1));
  },

  /* ============================================================
     2. SVG PARSER & PACKAGING TOPOLOGY DETECTOR
     ============================================================ */
  handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    this.processFile(file);
  },

  handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    this.processFile(file);
  },

  processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this.parseSvgString(text);
    };
    reader.readAsText(file);
  },

  parseSvgString(svgText) {
    if (!svgText || !svgText.includes('<svg')) return;
    this.rawSvgString = svgText;
    this.isCustomImport = true;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const elements = doc.querySelectorAll('path, line, rect, polyline, polygon');
    const detectedSegs = [];
    let segId = 1;

    elements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      const stroke = (el.getAttribute('stroke') || el.style.stroke || '#DC2626').toLowerCase();
      const dash = el.getAttribute('stroke-dasharray') || el.style.strokeDasharray || '';
      const isCrease = !!dash || stroke.includes('blue') || stroke.includes('cyan') || stroke.includes('2563eb') || stroke.includes('0000ff');

      if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || 0);
        const y1 = parseFloat(el.getAttribute('y1') || 0);
        const x2 = parseFloat(el.getAttribute('x2') || 0);
        const y2 = parseFloat(el.getAttribute('y2') || 0);
        minX = Math.min(minX, x1, x2); maxX = Math.max(maxX, x1, x2);
        minY = Math.min(minY, y1, y2); maxY = Math.max(maxY, y1, y2);
        detectedSegs.push({
          id: `seg_${segId++}`,
          type: isCrease ? 'crease' : 'cut',
          x1, y1, x2, y2,
          lengthMm: Number(Math.hypot(x2 - x1, y2 - y1).toFixed(1)),
          isHoriz: Math.abs(y2 - y1) < 1.5,
          isVert: Math.abs(x2 - x1) < 1.5
        });
      } else if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const subCommands = d.match(/[MLHV][^MLHV]*/gi) || [];
        let cx = 0, cy = 0;
        subCommands.forEach(cmd => {
          const type = cmd[0].toUpperCase();
          const nums = (cmd.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
          if (type === 'M' && nums.length >= 2) {
            cx = nums[0]; cy = nums[1];
          } else if (type === 'L' && nums.length >= 2) {
            const nx = nums[0], ny = nums[1];
            minX = Math.min(minX, cx, nx); maxX = Math.max(maxX, cx, nx);
            minY = Math.min(minY, cy, ny); maxY = Math.max(maxY, cy, ny);
            detectedSegs.push({
              id: `seg_${segId++}`,
              type: isCrease ? 'crease' : 'cut',
              x1: cx, y1: cy, x2: nx, y2: ny,
              lengthMm: Number(Math.hypot(nx - cx, ny - cy).toFixed(1)),
              isHoriz: Math.abs(ny - cy) < 1.5,
              isVert: Math.abs(nx - cx) < 1.5
            });
            cx = nx; cy = ny;
          }
        });
      }
    });

    if (minX !== Infinity && maxX !== -Infinity) {
      const totalW = maxX - minX;
      const totalH = maxY - minY;

      // Detect creases clustering
      const vertCreases = detectedSegs.filter(s => s.type === 'crease' && s.isVert && s.lengthMm > 15);
      const horizCreases = detectedSegs.filter(s => s.type === 'crease' && s.isHoriz && s.lengthMm > 15);

      const rawX = vertCreases.map(s => (s.x1 + s.x2) / 2);
      const clustersX = [];
      rawX.forEach(x => {
        const match = clustersX.find(c => Math.abs(c.x - x) < 6);
        if (match) match.count++; else clustersX.push({ x: x, count: 1 });
      });
      clustersX.sort((a, b) => a.x - b.x);

      const rawY = horizCreases.map(s => (s.y1 + s.y2) / 2);
      const clustersY = [];
      rawY.forEach(y => {
        const match = clustersY.find(c => Math.abs(c.y - y) < 6);
        if (match) match.count++; else clustersY.push({ y: y, count: 1 });
      });
      clustersY.sort((a, b) => a.y - b.y);

      if (clustersY.length >= 2) {
        this.params.height = Math.max(20, Math.round(clustersY[clustersY.length - 1].y - clustersY[0].y));
        this.params.topTuck = Math.max(12, Math.round(clustersY[0].y - minY));
      } else {
        this.params.height = Math.round(totalH * 0.55);
        this.params.topTuck = 25;
      }

      if (clustersX.length >= 4) {
        const g = Math.round(clustersX[0].x - minX);
        const w1 = Math.round(clustersX[1].x - clustersX[0].x);
        const l1 = Math.round(clustersX[2].x - clustersX[1].x);
        const w2 = Math.round(clustersX[3].x - clustersX[2].x);
        const l2 = Math.round(maxX - clustersX[3].x);
        this.params.glueFlap = Math.max(8, g);
        this.params.length = Math.max(20, Math.round((Math.max(w1, l1) + Math.max(w2, l2)) / 2));
        this.params.width = Math.max(15, Math.round((Math.min(w1, l1) + Math.min(w2, l2)) / 2));
      } else {
        this.params.glueFlap = 15;
        this.params.length = Math.round((totalW - 15) * 0.32);
        this.params.width = Math.round(((totalW - 15) - 2 * this.params.length) / 2);
      }
    }

    this.synthesizeModel();
    this.goToStep(1); // Advance to verification step!
    if (window.SoundEngine) window.SoundEngine.playClick();
    if (window.toast) window.toast('فایل قالب بارگذاری شد. لطفاً مراحل تأیید ابعاد را دنبال کنید ✓');
  },

  loadTemplate(type) {
    this.isCustomImport = false;
    if (type === 'tuck_end') {
      this.params = { length: 120, width: 80, height: 150, glueFlap: 15, topTuck: 25, dustFlap: 15 };
    } else if (type === 'mailer_0427') {
      this.params = { length: 200, width: 150, height: 60, glueFlap: 0, topTuck: 22, dustFlap: 25 };
    } else if (type === 'lock_bottom') {
      this.params = { length: 140, width: 90, height: 180, glueFlap: 16, topTuck: 25, dustFlap: 16 };
    }
    this.synthesizeModel();
    this.goToStep(1);
    if (window.SoundEngine) window.SoundEngine.playClick();
    if (window.toast) window.toast('الگوی آماده بارگذاری شد ✓');
  },

  /* ============================================================
     3. WIZARD STEP NAVIGATION & PARAMETER CONTROLS
     ============================================================ */
  goToStep(stepIndex) {
    this.currentStep = Math.max(0, Math.min(6, stepIndex));
    this.render();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  nextStep() {
    this.goToStep(this.currentStep + 1);
  },

  prevStep() {
    this.goToStep(this.currentStep - 1);
  },

  updateParam(key, val) {
    const num = Math.max(5, parseFloat(val) || 0);
    this.params[key] = num;
    this.synthesizeModel();
    this.renderCanvas();
    this.renderWizardCard();
  },

  stepParam(key, delta) {
    const cur = Number(this.params[key]) || 0;
    const minVal = (key === 'glueFlap' || key === 'topTuck') ? 5 : 15;
    this.params[key] = Math.max(minVal, cur + delta);
    this.synthesizeModel();
    this.renderCanvas();
    this.renderWizardCard();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  toggleSegmentType(segId) {
    const s = this.segments.find(seg => seg.id === segId);
    if (s) {
      s.type = s.type === 'crease' ? 'cut' : 'crease';
      this.recalculateTotals();
      this.render();
      if (window.SoundEngine) window.SoundEngine.playClick();
    }
  },

  applyToStudio() {
    if (!window.LemonPack) return;
    const cad = window.LemonPack.cad;
    const p = this.params;

    cad.length = p.length;
    cad.width = p.width;
    cad.height = p.height;
    cad.glueFlap = p.glueFlap;
    cad.tuckFlap = p.topTuck;
    cad.flatL = this.calculated.flatWidth;
    cad.flatW = this.calculated.flatHeight;

    cad.customDie = {
      active: true,
      widthMm: cad.flatL,
      heightMm: cad.flatW,
      paths: this.segments.map(s => ({
        id: s.id,
        d: s.d,
        originalStroke: s.type === 'crease' ? '#2563EB' : '#DC2626',
        strokeDash: s.type === 'crease' ? '4,3' : '',
        type: s.type,
        visible: true
      })),
      bounds: { minX: 0, minY: 0, width: cad.flatL, height: cad.flatW }
    };

    // Update form inputs if present
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('inp-length', p.length);
    setVal('inp-width', p.width);
    setVal('inp-height', p.height);
    setVal('inp-glue-flap', p.glueFlap);
    setVal('inp-tuck-flap', p.topTuck);
    setVal('inp-flat-l', cad.flatL);
    setVal('inp-flat-w', cad.flatW);

    if (window.App && window.App.recalculate) {
      window.App.recalculate();
    }
    if (window.go) {
      window.go('studio');
    }
    if (window.toast) {
      window.toast('اندازه‌های قالب با موفقیت در استودیو و شیت‌بندی اعمال شد ✓');
    }
  },

  exportCleanSvg() {
    const flatW = this.calculated.flatWidth;
    const flatH = this.calculated.flatHeight;
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${flatW} ${flatH}" width="${flatW}mm" height="${flatH}mm">\n`;
    svg += `  <g id="crease-matrix" stroke="#2563EB" stroke-width="0.6" stroke-dasharray="3,2" fill="none">\n`;
    this.segments.filter(s => s.type === 'crease').forEach(s => {
      svg += `    <path d="${s.d}" />\n`;
    });
    svg += `  </g>\n`;
    svg += `  <g id="cut-blades" stroke="#DC2626" stroke-width="0.8" fill="none">\n`;
    this.segments.filter(s => s.type !== 'crease').forEach(s => {
      svg += `    <path d="${s.d}" />\n`;
    });
    svg += `  </g>\n`;
    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LemonPack_Die_${flatW}x${flatH}mm.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.toast) window.toast('فایل SVG تمیز دانلود شد ✓');
  },

  /* ============================================================
     4. WIZARD UI CARD RENDERING
     ============================================================ */
  render() {
    this.renderStepperBar();
    this.renderWizardCard();
    this.renderCanvas();
  },

  renderStepperBar() {
    const container = document.getElementById('diecut-stepper-bar');
    if (!container) return;
    const pUtils = window.PersianUtils || { fmtNum: (v) => String(v) };

    const steps = [
      { num: 1, title: 'بارگذاری' },
      { num: 2, title: 'تیغ و تا' },
      { num: 3, title: 'طول (L)' },
      { num: 4, title: 'عرض (W)' },
      { num: 5, title: 'ارتفاع (H)' },
      { num: 6, title: 'لبچسب و درب' },
      { num: 7, title: 'تأیید نهایی' }
    ];

    let html = '';
    steps.forEach((st, idx) => {
      const isCompleted = idx < this.currentStep;
      const isActive = idx === this.currentStep;
      html += `
        <div class="wizard-step-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}" onclick="ParametricDieEngine.goToStep(${idx})">
          <div class="wizard-step-circle">
            ${isCompleted ? '<i class="ph ph-check font-bold"></i>' : pUtils.fmtNum(st.num)}
          </div>
          <div class="wizard-step-title">${st.title}</div>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  renderWizardCard() {
    const container = document.getElementById('diecut-wizard-card');
    if (!container) return;
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: s => String(s) };
    const p = this.params;

    let html = '';

    // Step 0: Upload / Dropzone
    if (this.currentStep === 0) {
      html = `
        <div class="wizard-card-hdr">
          <span class="wizard-step-badge">مرحله ۱ از ۷</span>
          <span style="font-size:0.75rem; color:var(--text-muted);"><i class="ph ph-upload-simple"></i> گام آغازین</span>
        </div>
        <div>
          <div class="wizard-question-title">فایل قالب (.svg یا .ai) را وارد کنید</div>
          <div class="wizard-question-desc">
            فایل خط‌تیغ گسترده جعبه خود را بکشید و رها کنید تا سیستم به صورت خودکار اجزای آن را تشخیص دهد و در چند گام ساده با شما چک کند:
          </div>
        </div>

        <div id="diecut-dropzone-wizard" style="
          border: 2px dashed var(--border-color);
          border-radius: var(--radius-sm);
          padding: 28px 16px;
          text-align: center;
          cursor: pointer;
          background: var(--surface-base);
          transition: all 0.2s;
        "
        onclick="document.getElementById('file-diecut-main').click()"
        ondragover="event.preventDefault(); this.style.borderColor='var(--brand-primary)'; this.style.background='rgba(217,119,6,0.06)'"
        ondragleave="this.style.borderColor='var(--border-color)'; this.style.background='var(--surface-base)'"
        ondrop="ParametricDieEngine.handleDrop(event); this.style.borderColor='var(--border-color)'; this.style.background='var(--surface-base)'">
          <i class="ph ph-file-arrow-up" style="font-size:2.8rem; color:var(--brand-primary); margin-bottom:8px; display:inline-block;"></i>
          <div style="font-weight:800; font-size:0.95rem; color:var(--graphite-text);">فایل SVG یا AI را اینجا رها کنید</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">یا برای انتخاب از کامپیوتر کلیک کنید</div>
        </div>
        <input type="file" id="file-diecut-main" accept=".svg,.ai,.eps,.pdf" style="display:none;" onchange="ParametricDieEngine.handleFileSelect(event)">

        <div style="margin-top:10px;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:8px;">یا یکی از الگوهای استاندارد زیر را انتخاب کنید:</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <button class="btn btn-outline btn-block" style="text-align:right; justify-content:space-between; padding:10px 14px;" onclick="ParametricDieEngine.loadTemplate('tuck_end')">
              <span style="font-weight:700;"><i class="ph ph-package"></i> جعبه دارویی و آرایشی (Tuck-End)</span>
              <span style="font-size:0.72rem; color:var(--brand-primary);">${pUtils.fmtNum(120)} × ${pUtils.fmtNum(80)} × ${pUtils.fmtNum(150)} mm</span>
            </button>
            <button class="btn btn-outline btn-block" style="text-align:right; justify-content:space-between; padding:10px 14px;" onclick="ParametricDieEngine.loadTemplate('mailer_0427')">
              <span style="font-weight:700;"><i class="ph ph-envelope"></i> جعبه کیبوردی پستی (FEFCO 0427)</span>
              <span style="font-size:0.72rem; color:var(--brand-primary);">${pUtils.fmtNum(200)} × ${pUtils.fmtNum(150)} × ${pUtils.fmtNum(60)} mm</span>
            </button>
            <button class="btn btn-outline btn-block" style="text-align:right; justify-content:space-between; padding:10px 14px;" onclick="ParametricDieEngine.loadTemplate('lock_bottom')">
              <span style="font-weight:700;"><i class="ph ph-lock-key"></i> جعبه ته‌قفلی خودکار (Crash Lock)</span>
              <span style="font-size:0.72rem; color:var(--brand-primary);">${pUtils.fmtNum(140)} × ${pUtils.fmtNum(90)} × ${pUtils.fmtNum(180)} mm</span>
            </button>
          </div>
        </div>
      `;
    }

    // Step 1: Cuts vs Creases
    else if (this.currentStep === 1) {
      const cutCount = this.segments.filter(s => s.type !== 'crease').length;
      const creaseCount = this.segments.filter(s => s.type === 'crease').length;
      html = `
        <div class="wizard-card-hdr">
          <span class="wizard-step-badge">مرحله ۲ از ۷</span>
          <span style="font-size:0.75rem; color:var(--text-muted);"><i class="ph ph-scissors"></i> تفکیک خطوط تیغ و تا</span>
        </div>
        <div>
          <div class="wizard-question-title">آیا خطوط تیغ (قرمز) و خط‌تا (آبی) درست تفکیک شده‌اند؟</div>
          <div class="wizard-question-desc">
            سیستم خطوط قالب را شناسایی کرد. برای تغییر نوع هر خط، کافیست روی آن در تصویر کلیک کنید:
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0;">
          <div style="background:rgba(220,38,38,0.08); border:1px solid rgba(220,38,38,0.25); border-radius:var(--radius-sm); padding:14px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:#DC2626;">${pUtils.fmtNum(cutCount)}</div>
            <div style="font-size:0.75rem; font-weight:700; color:#DC2626; margin-top:2px;">مسیر تیغ برش (Cut)</div>
          </div>
          <div style="background:rgba(37,99,235,0.08); border:1px solid rgba(37,99,235,0.25); border-radius:var(--radius-sm); padding:14px; text-align:center;">
            <div style="font-size:1.4rem; font-weight:900; color:#2563EB;">${pUtils.fmtNum(creaseCount)}</div>
            <div style="font-size:0.75rem; font-weight:700; color:#2563EB; margin-top:2px;">مسیر خط‌تا (Crease)</div>
          </div>
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted); background:var(--surface-base); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
          <i class="ph ph-info" style="color:var(--brand-primary);"></i>
          با زدن دکمه تأیید، ابعاد طول و عرض را به ترتیب بررسی خواهیم کرد.
        </div>

        <div class="wizard-footer-actions">
          <button class="btn btn-outline btn-sm" onclick="ParametricDieEngine.prevStep()">
            <i class="ph ph-arrow-right"></i> بازگشت
          </button>
          <button class="btn btn-primary btn-sm" onclick="ParametricDieEngine.nextStep()">
            تأیید و مرحله بعد (طول L) <i class="ph ph-arrow-left"></i>
          </button>
        </div>
      `;
    }

    // Step 2: Length L
    else if (this.currentStep === 2) {
      html = `
        <div class="wizard-card-hdr">
          <span class="wizard-step-badge">مرحله ۳ از ۷</span>
          <span style="font-size:0.75rem; color:var(--text-muted);"><i class="ph ph-arrows-left-right"></i> طول اصلی جعبه</span>
        </div>
        <div>
          <div class="wizard-question-title">طول بدنه اصلی جعبه (L) چقدر است؟</div>
          <div class="wizard-question-desc">
            در نقشه روبرو، پنل‌های روبرو و پشت با رنگ طلایی و فلش اندازه مشخص شده‌اند:
          </div>
        </div>

        <div class="wizard-input-box-big">
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('length', -5)">-۵</button>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('length', -1)">-</button>
          <input type="number" class="wizard-inp-num" id="inp-wizard-L" value="${p.length}" oninput="ParametricDieEngine.updateParam('length', this.value)">
          <span class="wizard-unit-tag">میلی‌متر (mm)</span>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('length', 1)">+</button>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('length', 5)">+۵</button>
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted); background:var(--surface-base); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
          <i class="ph ph-arrows-left-right" style="color:var(--brand-primary);"></i>
          فاصله افقی پنل‌های روبرو و پشت جعبه (Front & Back).
        </div>

        <div class="wizard-footer-actions">
          <button class="btn btn-outline btn-sm" onclick="ParametricDieEngine.prevStep()">
            <i class="ph ph-arrow-right"></i> بازگشت
          </button>
          <button class="btn btn-primary btn-sm" onclick="ParametricDieEngine.nextStep()">
            تأیید طول و مرحله بعد (عرض W) <i class="ph ph-arrow-left"></i>
          </button>
        </div>
      `;
    }

    // Step 3: Width W
    else if (this.currentStep === 3) {
      html = `
        <div class="wizard-card-hdr">
          <span class="wizard-step-badge">مرحله ۴ از ۷</span>
          <span style="font-size:0.75rem; color:var(--text-muted);"><i class="ph ph-arrows-left-right"></i> عرض پهلوهای جعبه</span>
        </div>
        <div>
          <div class="wizard-question-title">عرض پهلوهای جعبه (W) چقدر است؟</div>
          <div class="wizard-question-desc">
            در نقشه روبرو، پنل‌های پهلو راست و چپ مشخص شده‌اند:
          </div>
        </div>

        <div class="wizard-input-box-big">
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('width', -5)">-۵</button>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('width', -1)">-</button>
          <input type="number" class="wizard-inp-num" id="inp-wizard-W" value="${p.width}" oninput="ParametricDieEngine.updateParam('width', this.value)">
          <span class="wizard-unit-tag">میلی‌متر (mm)</span>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('width', 1)">+</button>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('width', 5)">+۵</button>
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted); background:var(--surface-base); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
          <i class="ph ph-info" style="color:var(--brand-primary);"></i>
          عرض دو پنل فرعی چپ و راست جعبه (Side Panels).
        </div>

        <div class="wizard-footer-actions">
          <button class="btn btn-outline btn-sm" onclick="ParametricDieEngine.prevStep()">
            <i class="ph ph-arrow-right"></i> بازگشت
          </button>
          <button class="btn btn-primary btn-sm" onclick="ParametricDieEngine.nextStep()">
            تأیید عرض و مرحله بعد (ارتفاع H) <i class="ph ph-arrow-left"></i>
          </button>
        </div>
      `;
    }

    // Step 4: Height H
    else if (this.currentStep === 4) {
      html = `
        <div class="wizard-card-hdr">
          <span class="wizard-step-badge">مرحله ۵ از ۷</span>
          <span style="font-size:0.75rem; color:var(--text-muted);"><i class="ph ph-arrows-down-up"></i> ارتفاع ستون بدنه</span>
        </div>
        <div>
          <div class="wizard-question-title">ارتفاع بدنه جعبه (H) چقدر است؟</div>
          <div class="wizard-question-desc">
            فاصله عمودی بین خط‌تاهای افقی بالا و پایین جعبه:
          </div>
        </div>

        <div class="wizard-input-box-big">
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('height', -5)">-۵</button>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('height', -1)">-</button>
          <input type="number" class="wizard-inp-num" id="inp-wizard-H" value="${p.height}" oninput="ParametricDieEngine.updateParam('height', this.value)">
          <span class="wizard-unit-tag">میلی‌متر (mm)</span>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('height', 1)">+</button>
          <button class="wizard-btn-step" onclick="ParametricDieEngine.stepParam('height', 5)">+۵</button>
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted); background:var(--surface-base); padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
          <i class="ph ph-info" style="color:var(--brand-primary);"></i>
          ارتفاع مفید داخلی بسته‌بندی را تعیین می‌کند.
        </div>

        <div class="wizard-footer-actions">
          <button class="btn btn-outline btn-sm" onclick="ParametricDieEngine.prevStep()">
            <i class="ph ph-arrow-right"></i> بازگشت
          </button>
          <button class="btn btn-primary btn-sm" onclick="ParametricDieEngine.nextStep()">
            تأیید ارتفاع و مرحله بعد (درب و لبچسب) <i class="ph ph-arrow-left"></i>
          </button>
        </div>
      `;
    }

    // Step 5: Flaps (G & T)
    else if (this.currentStep === 5) {
      html = `
        <div class="wizard-card-hdr">
          <span class="wizard-step-badge">مرحله ۶ از ۷</span>
          <span style="font-size:0.75rem; color:var(--text-muted);"><i class="ph ph-seal-check"></i> لب‌چسب و زبانه درپوش</span>
        </div>
        <div>
          <div class="wizard-question-title">ابعاد لب‌چسب (G) و زبانه درپوش (T)</div>
          <div class="wizard-question-desc">
            مقادیر لبه چسب اتصال جعبه و زبانه‌های درپوش بالا و پایین:
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; margin:8px 0;">
          <div style="background:var(--surface-base); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <strong style="font-size:0.82rem; color:var(--graphite-text);">عرض لبه چسب (G):</strong>
              <span class="tabular-nums font-bold" style="color:var(--brand-primary);">${pUtils.fmtNum(p.glueFlap)} mm</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="wizard-btn-step" style="width:30px; height:30px;" onclick="ParametricDieEngine.stepParam('glueFlap', -1)">-</button>
              <input type="number" class="input-box" style="text-align:center; height:30px; font-weight:800;" value="${p.glueFlap}" oninput="ParametricDieEngine.updateParam('glueFlap', this.value)">
              <button class="wizard-btn-step" style="width:30px; height:30px;" onclick="ParametricDieEngine.stepParam('glueFlap', 1)">+</button>
            </div>
          </div>

          <div style="background:var(--surface-base); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <strong style="font-size:0.82rem; color:var(--graphite-text);">ارتفاع زبانه درپوش (T):</strong>
              <span class="tabular-nums font-bold" style="color:var(--brand-primary);">${pUtils.fmtNum(p.topTuck)} mm</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <button class="wizard-btn-step" style="width:30px; height:30px;" onclick="ParametricDieEngine.stepParam('topTuck', -1)">-</button>
              <input type="number" class="input-box" style="text-align:center; height:30px; font-weight:800;" value="${p.topTuck}" oninput="ParametricDieEngine.updateParam('topTuck', this.value)">
              <button class="wizard-btn-step" style="width:30px; height:30px;" onclick="ParametricDieEngine.stepParam('topTuck', 1)">+</button>
            </div>
          </div>
        </div>

        <div class="wizard-footer-actions">
          <button class="btn btn-outline btn-sm" onclick="ParametricDieEngine.prevStep()">
            <i class="ph ph-arrow-right"></i> بازگشت
          </button>
          <button class="btn btn-primary btn-sm" onclick="ParametricDieEngine.nextStep()">
            محاسبه و ساخت کامل اندازه‌ها ✓ <i class="ph ph-check"></i>
          </button>
        </div>
      `;
    }

    // Step 6: Final Review & Apply
    else if (this.currentStep === 6) {
      html = `
        <div class="wizard-card-hdr">
          <span class="wizard-step-badge" style="background:#10B981; color:#fff;">✓ آماده اعمال</span>
          <span style="font-size:0.75rem; color:#059669; font-weight:800;"><i class="ph ph-check-circle"></i> اندازه‌ها با موفقیت ساخته شدند</span>
        </div>
        <div>
          <div class="wizard-question-title">خلاصه مشخصات فنی قالب تولیدشده</div>
          <div class="wizard-question-desc">
            تمام ابعاد، خطوط تیغ و تا و گسترده شیت آماده اعمال به استودیوی شیت‌بندی هستند:
          </div>
        </div>

        <div style="background:var(--surface-base); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
            <span>ابعاد ۳بعدی جعبه (L × W × H):</span>
            <strong class="tabular-nums" style="color:var(--brand-primary);">${pUtils.fmtNum(p.length)} × ${pUtils.fmtNum(p.width)} × ${pUtils.fmtNum(p.height)} mm</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
            <span>ابعاد شیت گسترده (Flat Size):</span>
            <strong class="tabular-nums" style="color:#10B981;">${pUtils.fmtNum(this.calculated.flatWidth)} × ${pUtils.fmtNum(this.calculated.flatHeight)} mm</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
            <span>متراژ تیغ برش لیزری:</span>
            <strong class="tabular-nums" style="color:#DC2626;">${pUtils.fmtNum(this.calculated.totalBladeLengthMm)} mm</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
            <span>متراژ خط‌تا لترپرس:</span>
            <strong class="tabular-nums" style="color:#2563EB;">${pUtils.fmtNum(this.calculated.totalCreaseLengthMm)} mm</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
            <span>مساحت مقوای مصرفی:</span>
            <strong class="tabular-nums">${pUtils.fmtNum(this.calculated.areaCm2, 1)} cm²</strong>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          <button class="btn btn-primary btn-block" style="padding:12px; font-size:0.92rem; font-weight:900;" onclick="ParametricDieEngine.applyToStudio()">
            <i class="ph ph-check-circle font-bold"></i> تأیید نهایی و ارسال به شیت‌بندی و استودیو
          </button>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline btn-block" style="font-size:0.75rem;" onclick="ParametricDieEngine.exportCleanSvg()">
              <i class="ph ph-download-simple"></i> دانلود SVG تمیز
            </button>
            <button class="btn btn-outline btn-block" style="font-size:0.75rem;" onclick="ParametricDieEngine.goToStep(0)">
              <i class="ph ph-arrow-counter-clockwise"></i> فایل جدید
            </button>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  /* ============================================================
     5. CAD BLUEPRINT CANVAS RENDERING
     ============================================================ */
  setupCanvasEvents() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const pt = this.canvasPxToMm(clientX, clientY);

      let closest = null;
      let minDist = 8; // mm
      this.segments.forEach(s => {
        const d = this.distToSegment(pt.x, pt.y, s.x1, s.y1, s.x2, s.y2);
        if (d < minDist) {
          minDist = d;
          closest = s;
        }
      });

      const hoverTag = document.getElementById('canvas-hover-tag');
      const hoverText = document.getElementById('canvas-hover-text');
      const pUtils = window.PersianUtils || { fmtNum: (v) => String(v) };

      if (closest) {
        this.hoveredSegmentId = closest.id;
        if (hoverTag && hoverText) {
          hoverTag.style.display = 'block';
          hoverText.textContent = `${closest.label || closest.id} (${pUtils.fmtNum(closest.lengthMm, 1)} mm) - کلیک برای تغییر`;
        }
      } else {
        this.hoveredSegmentId = null;
        if (hoverTag) hoverTag.style.display = 'none';
      }
      this.renderCanvas();
    });

    canvas.addEventListener('mouseleave', () => {
      this.hoveredSegmentId = null;
      const hoverTag = document.getElementById('canvas-hover-tag');
      if (hoverTag) hoverTag.style.display = 'none';
      this.renderCanvas();
    });

    canvas.addEventListener('click', () => {
      if (this.hoveredSegmentId && this.currentStep === 1) {
        this.toggleSegmentType(this.hoveredSegmentId);
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      this.zoomLevel = Math.max(0.4, Math.min(4.0, this.zoomLevel * zoomFactor));
      this.renderCanvas();
    }, { passive: false });
  },

  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  },

  canvasPxToMm(px, py) {
    const canvas = document.getElementById('diecut-preview-canvas');
    const w = canvas ? canvas.width : 650;
    const h = canvas ? canvas.height : 420;
    const flatW = this.calculated.flatWidth || 415;
    const flatH = this.calculated.flatHeight || 266;
    const paddingMm = 40;
    const baseScale = Math.min((w - 70) / (flatW + paddingMm * 2), (h - 70) / (flatH + paddingMm * 2));
    const effectiveScale = baseScale * this.zoomLevel;
    const centerX = w / 2 + this.panOffset.x;
    const centerY = h / 2 + this.panOffset.y;
    return {
      x: (px - centerX) / effectiveScale + flatW / 2,
      y: (py - centerY) / effectiveScale + flatH / 2
    };
  },

  resetView() {
    this.zoomLevel = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.renderCanvas();
  },

  renderCanvas() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const pUtils = window.PersianUtils || { fmtNum: (v) => String(v), e2p: s => String(s) };

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, w, h);

    const flatW = this.calculated.flatWidth;
    const flatH = this.calculated.flatHeight;
    const paddingMm = 40;
    const baseScale = Math.min((w - 70) / (flatW + paddingMm * 2), (h - 70) / (flatH + paddingMm * 2));
    const scale = baseScale * this.zoomLevel;

    ctx.save();
    ctx.translate(w / 2 + this.panOffset.x, h / 2 + this.panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-flatW / 2, -flatH / 2);

    // Subtle background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 0.5 / scale;
    for (let x = -30; x <= flatW + 30; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x, flatH + 30); ctx.stroke();
    }
    for (let y = -30; y <= flatH + 30; y += 20) {
      ctx.beginPath(); ctx.moveTo(-30, y); ctx.lineTo(flatW + 30, y); ctx.stroke();
    }

    const p = this.params;
    const x1 = p.glueFlap;
    const x2 = p.glueFlap + p.width;
    const x3 = p.glueFlap + p.width + p.length;
    const x4 = p.glueFlap + p.width + p.length + p.width;
    const x5 = p.glueFlap + p.width + p.length + p.width + p.length;
    const y2 = p.topTuck + p.width;
    const y3 = p.topTuck + p.width + p.height;

    // Highlight zones based on current wizard step
    const highlightStep = this.currentStep;

    const drawPanel = (px, py, pw, ph, label, isHighlight) => {
      ctx.save();
      ctx.fillStyle = isHighlight ? 'rgba(217, 119, 6, 0.18)' : 'rgba(255, 255, 255, 0.025)';
      ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
      ctx.font = `bold ${Math.max(9, Math.min(13, pw * 0.14))}px Peyda, sans-serif`;
      ctx.fillStyle = isHighlight ? '#F59E0B' : 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px + pw / 2, py + ph / 2);
      ctx.restore();
    };

    drawPanel(0, y2, x1, p.height, 'لبچسب G', highlightStep === 5);
    drawPanel(x1, y2, p.width, p.height, 'پهلو چپ (W)', highlightStep === 3);
    drawPanel(x2, y2, p.length, p.height, 'بدنه جلو (L)', highlightStep === 2);
    drawPanel(x3, y2, p.width, p.height, 'پهلو راست (W)', highlightStep === 3);
    drawPanel(x4, y2, p.length, p.height, 'بدنه پشت (L)', highlightStep === 2);
    drawPanel(x2, 0, p.length, p.topTuck, 'درب بالا (T)', highlightStep === 5);
    drawPanel(x4, y3 + p.width, p.length, p.topTuck, 'درب پایین (T)', highlightStep === 5);

    // Draw Line Segments
    this.segments.forEach(s => {
      ctx.save();
      const isHovered = this.hoveredSegmentId === s.id;
      const isStepTarget = (highlightStep === 2 && s.partKey === 'L') ||
                           (highlightStep === 3 && s.partKey === 'W') ||
                           (highlightStep === 4 && s.partKey === 'H') ||
                           (highlightStep === 5 && (s.partKey === 'G' || s.partKey === 'T'));

      if (isStepTarget || isHovered) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 6 / scale;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      }

      if (s.type === 'cut') {
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1.8 / scale;
        ctx.setLineDash([]);
      } else if (s.type === 'crease') {
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.4 / scale;
        ctx.setLineDash([4 / scale, 3 / scale]);
      } else {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.6 / scale;
        ctx.setLineDash([]);
      }

      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.restore();
    });

    // Dimension lines
    this.drawDimension(ctx, x2, y3 + 12, x3, y3 + 12, `L: ${pUtils.fmtNum(p.length)} mm`, highlightStep === 2 ? '#F59E0B' : '#94A3B8', scale);
    this.drawDimension(ctx, x1, y3 + 24, x2, y3 + 24, `W: ${pUtils.fmtNum(p.width)} mm`, highlightStep === 3 ? '#F59E0B' : '#94A3B8', scale);
    this.drawDimension(ctx, x5 + 12, y2, x5 + 12, y3, `H: ${pUtils.fmtNum(p.height)} mm`, highlightStep === 4 ? '#F59E0B' : '#94A3B8', scale);

    ctx.restore();
  },

  drawDimension(ctx, x1, y1, x2, y2, text, color, scale) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.0 / scale;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    const isHoriz = Math.abs(y2 - y1) < 0.2;
    const sz = 3.5 / scale;
    if (isHoriz) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + sz, y1 - sz * 0.7); ctx.lineTo(x1 + sz, y1 + sz * 0.7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - sz, y2 - sz * 0.7); ctx.lineTo(x2 - sz, y2 + sz * 0.7); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - sz * 0.7, y1 + sz); ctx.lineTo(x1 + sz * 0.7, y1 + sz); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - sz, y2 - sz * 0.7); ctx.lineTo(x2 + sz * 0.7, y2 - sz); ctx.fill();
    }

    ctx.font = `bold ${10 / scale}px Peyda, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = isHoriz ? 'bottom' : 'middle';
    ctx.fillText(text, (x1 + x2) / 2, (y1 + y2) / 2 - (isHoriz ? 2 / scale : 0));
    ctx.restore();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.ParametricDieEngine) {
    window.ParametricDieEngine.init();
  }
});
