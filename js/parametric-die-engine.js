/* ============================================================
   PARAMETRIC DIE-CUT & MATHEMATICAL PACKAGING FORMULA ENGINE
   Automated packaging feature extraction, symmetrical line binding,
   algebraic formula synthesis and real-time bidirectional editing.
   ============================================================ */

window.ParametricDieEngine = {
  // Current active parsed model
  model: {
    name: 'جعبه دارویی / استاندارد',
    type: 'tuck_end', // tuck_end, mailer_0427, lock_bottom, custom
    params: {
      length: 120,      // L: طول بدنه
      width: 80,        // W: عرض پهلو
      height: 150,      // H: ارتفاع بدنه
      glueFlap: 15,     // G: لبه چسب
      topTuck: 18,      // T_top: زبانه درپوش بالا
      bottomTuck: 18,   // T_bot: زبانه درپوش پایین
      dustFlap: 15,     // D: گوشواره / زبانه‌های گردگیر
      lockNotch: 4,     // N: قفل / لقط درپوش
      creaseGap: 2      // gap: بادخور خط تا
    },
    // Calculated Flat & 3D Dimensions
    calculated: {
      boxDimensions: { l: 120, w: 80, h: 150 },
      flatDimensions: { width: 415, height: 266 },
      totalBladeLengthMm: 1840,
      totalCreaseLengthMm: 1120,
      areaCm2: 1103.9
    },
    // Identified packaging components with formulas and bound lines
    features: [],
    // Raw & reconstructed vector lines
    segments: [],
    // Formulas list in algebraic format
    formulas: []
  },

  // State
  selectedFeatureId: null,
  hoveredFeatureId: null,
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },

  init() {
    this.synthesizeModelFromParams();
  },

  /* ============================================================
     1. PARSING & ANALYSIS OF IMPORTED SVG / VECTOR FILES
     ============================================================ */
  parseSvgString(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      throw new Error('فایل SVG معتبر نیست');
    }

    // Extract paths and elements
    const elements = doc.querySelectorAll('path, line, rect, polyline, polygon');
    const rawSegments = [];
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

    const parsePoints = (pts) => {
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i];
        const y = pts[i+1];
        if (!isNaN(x) && !isNaN(y)) {
          if (x < bounds.minX) bounds.minX = x;
          if (x > bounds.maxX) bounds.maxX = x;
          if (y < bounds.minY) bounds.minY = y;
          if (y > bounds.maxY) bounds.maxY = y;
        }
      }
    };

    elements.forEach((el, idx) => {
      const tag = el.tagName.toLowerCase();
      let stroke = el.getAttribute('stroke') || (el.style && el.style.stroke) || '#000000';
      let strokeDash = el.getAttribute('stroke-dasharray') || (el.style && el.style.strokeDasharray) || '';
      let isCrease = (strokeDash && strokeDash !== 'none') || stroke.includes('blue') || stroke.includes('cyan') || stroke.includes('0000ff') || stroke.includes('2563eb');
      
      if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || 0);
        const y1 = parseFloat(el.getAttribute('y1') || 0);
        const x2 = parseFloat(el.getAttribute('x2') || 0);
        const y2 = parseFloat(el.getAttribute('y2') || 0);
        rawSegments.push({ id: idx + 1, x1, y1, x2, y2, isCrease, stroke, tag: 'line' });
        parsePoints([x1, y1, x2, y2]);
      } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || 0);
        const y = parseFloat(el.getAttribute('y') || 0);
        const w = parseFloat(el.getAttribute('width') || 0);
        const h = parseFloat(el.getAttribute('height') || 0);
        rawSegments.push({ id: idx + 1, x1: x, y1: y, x2: x + w, y2: y + h, isCrease, stroke, tag: 'rect', w, h });
        parsePoints([x, y, x + w, y + h]);
      } else if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const nums = (d.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
        if (nums.length >= 4) {
          parsePoints(nums);
          rawSegments.push({ id: idx + 1, d, isCrease, stroke, tag: 'path', nums });
        }
      }
    });

    if (bounds.minX === Infinity) {
      bounds.minX = 0; bounds.minY = 0; bounds.maxX = 310; bounds.maxY = 220;
    }
    bounds.width = Math.max(1, bounds.maxX - bounds.minX);
    bounds.height = Math.max(1, bounds.maxY - bounds.minY);

    // Analyze extracted geometry to extract box dimensions & features
    this.extractPackagingFeaturesFromBoundsAndSegments(bounds, rawSegments);
    this.render();
    if (window.toast) {
      window.toast(`قالب SVG با موفقیت تحلیل و به مدل پارامتریک تبدیل شد (${rawSegments.length} خط شناسایی شد) ✓`);
    }
  },

  /* ============================================================
     2. AUTOMATIC FEATURE CLASSIFICATION & RECOGNITION
     ============================================================ */
  extractPackagingFeaturesFromBoundsAndSegments(bounds, rawSegments) {
    const W_total = Math.round(bounds.width);
    const H_total = Math.round(bounds.height);

    // Heuristic analysis of standard folding carton ratios:
    // W_total = 2L + 2W + GlueFlap => L + W approx (W_total - 15) / 2
    let estimatedL = Math.round(W_total * 0.28);
    let estimatedW = Math.round(W_total * 0.19);
    let estimatedGlue = Math.round(Math.max(12, W_total - (2 * estimatedL + 2 * estimatedW)));
    if (estimatedGlue <= 0 || estimatedGlue > 30) {
      estimatedGlue = 15;
      const rem = (W_total - estimatedGlue) / 2;
      estimatedL = Math.round(rem * 0.6);
      estimatedW = Math.round(rem * 0.4);
    }

    // Height analysis: H_total = H + 2*W (or Tuck) + ...
    let estimatedH = Math.round(H_total * 0.55);
    let estimatedTuck = Math.round(Math.max(14, (H_total - estimatedH - (2 * estimatedW)) / 2));
    if (estimatedTuck < 10 || estimatedTuck > 50) estimatedTuck = 18;
    let estimatedDust = Math.round(estimatedW * 0.7);

    this.model.params = {
      length: Math.max(20, estimatedL),
      width: Math.max(15, estimatedW),
      height: Math.max(20, estimatedH),
      glueFlap: Math.max(8, estimatedGlue),
      topTuck: Math.max(10, estimatedTuck),
      bottomTuck: Math.max(10, estimatedTuck),
      dustFlap: Math.max(8, estimatedDust),
      lockNotch: 4,
      creaseGap: 2
    };

    this.synthesizeModelFromParams();
  },

  /* ============================================================
     3. MATHEMATICAL SYNTHESIS & PARAMETRIC BLUEPRINT GENERATOR
     Constructs all interconnected segments and formulas from parameters
     ============================================================ */
  synthesizeModelFromParams() {
    const p = this.model.params;
    const L = Number(p.length) || 120;
    const W = Number(p.width) || 80;
    const H = Number(p.height) || 150;
    const G = Number(p.glueFlap) || 15;
    const T_top = Number(p.topTuck) || 18;
    const T_bot = Number(p.bottomTuck) || 18;
    const D = Number(p.dustFlap) || 15;
    const N = Number(p.lockNotch) || 4;
    const gap = Number(p.creaseGap) || 2;

    // Calculate total Flat Blueprint Dimensions
    const flatWidth = Math.round(G + W + L + W + L);
    const flatHeight = Math.round(T_top + W + H + W + T_bot);

    this.model.calculated = {
      boxDimensions: { l: L, w: W, h: H },
      flatDimensions: { width: flatWidth, height: flatHeight },
      totalBladeLengthMm: Math.round((2 * flatWidth + 2 * flatHeight) + (4 * D) + (2 * T_top) + (2 * T_bot) + G),
      totalCreaseLengthMm: Math.round((4 * H) + (2 * flatWidth)),
      areaCm2: parseFloat(((flatWidth * flatHeight) / 100).toFixed(1))
    };

    // Build features hierarchy with symmetrical associations and formulas
    this.model.features = [
      {
        id: 'param_length',
        key: 'length',
        name: 'طول بدنه جعبه (Length - L)',
        category: 'body',
        value: L,
        unit: 'mm',
        formula: 'L',
        instances: 2,
        description: 'عرض پنل‌های اصلی پشت و رو (۲ پنل متقارن)',
        color: '#3B82F6',
        role: 'ابعاد اصلی ۳بعدی جعبه'
      },
      {
        id: 'param_width',
        key: 'width',
        name: 'عرض پهلوی جعبه (Width - W)',
        category: 'body',
        value: W,
        unit: 'mm',
        formula: 'W',
        instances: 2,
        description: 'عرض پنل‌های پهلوی چپ و راست (۲ پنل متقارن)',
        color: '#6366F1',
        role: 'ابعاد اصلی ۳بعدی جعبه'
      },
      {
        id: 'param_height',
        key: 'height',
        name: 'ارتفاع بدنه جعبه (Height - H)',
        category: 'body',
        value: H,
        unit: 'mm',
        formula: 'H',
        instances: 4,
        description: 'ارتفاع عمودی خط تا از کف تا درپوش',
        color: '#8B5CF6',
        role: 'ابعاد اصلی ۳بعدی جعبه'
      },
      {
        id: 'param_glue',
        key: 'glueFlap',
        name: 'لبه چسب کناری (Glue Flap - G)',
        category: 'flaps',
        value: G,
        unit: 'mm',
        formula: 'G',
        instances: 1,
        description: 'نوار چسب‌خوری اتصال بدنه با زاویه ۱۵ درجه',
        color: '#10B981',
        role: 'چسبانی و استحکام'
      },
      {
        id: 'param_top_tuck',
        key: 'topTuck',
        name: 'زبانه درپوش بالا (Top Tuck - T₁)',
        category: 'tucks',
        value: T_top,
        unit: 'mm',
        formula: 'T_{top}',
        instances: 1,
        description: 'زبانه قفل‌شونده درپوش بالایی جعبه با لبه منحنی',
        color: '#F59E0B',
        role: 'بست و قفل درپوش'
      },
      {
        id: 'param_bot_tuck',
        key: 'bottomTuck',
        name: 'زبانه درپوش پایین (Bottom Tuck - T₂)',
        category: 'tucks',
        value: T_bot,
        unit: 'mm',
        formula: 'T_{bot}',
        instances: 1,
        description: 'زبانه قفل‌شونده درب زیرین جعبه',
        color: '#D97706',
        role: 'بست و قفل کف'
      },
      {
        id: 'param_dust',
        key: 'dustFlap',
        name: 'گوشواره‌ها / زبانه‌های گردگیر (Dust Flaps - D)',
        category: 'ears',
        value: D,
        unit: 'mm',
        formula: 'D = 0.7W',
        instances: 4,
        description: '۴ عدد گوشواره جانبی جهت جلوگیری از ورود گرد و غبار',
        color: '#EC4899',
        role: 'محافظت و فرم‌دهی لبه‌ها'
      },
      {
        id: 'param_lock',
        key: 'lockNotch',
        name: 'لقط / شکاف قفل زبانه (Lock Slit - N)',
        category: 'locks',
        value: N,
        unit: 'mm',
        formula: 'N',
        instances: 2,
        description: 'شکاف‌های اصطکاکی قفل شدن زبانه در بدنه',
        color: '#EF4444',
        role: 'چفت شدن زبانه در شیار'
      }
    ];

    // Mathematical Formulas synthesis
    this.model.formulas = [
      {
        title: 'فرمول عرض کل گسترده (Total Flat Width)',
        latex: 'W_{flat} = G + 2W + 2L',
        substituted: `${G} + (2 × ${W}) + (2 × ${L}) = ${flatWidth} \\text{ mm}`,
        result: flatWidth,
        unit: 'mm'
      },
      {
        title: 'فرمول طول/ارتفاع کل گسترده (Total Flat Height)',
        latex: 'H_{flat} = H + 2W + T_{top} + T_{bot}',
        substituted: `${H} + (2 × ${W}) + ${T_top} + ${T_bot} = ${flatHeight} \\text{ mm}`,
        result: flatHeight,
        unit: 'mm'
      },
      {
        title: 'مساحت کل مقوای مصرفی',
        latex: 'A = W_{flat} \\times H_{flat} / 100',
        substituted: `${flatWidth} \\times ${flatHeight} / 100 = ${this.model.calculated.areaCm2} \\text{ cm}^2`,
        result: this.model.calculated.areaCm2,
        unit: 'cm²'
      }
    ];

    // Generate accurate SVG Paths & coordinate nodes
    this.generateSvgPathsFromModel();

    // Propagate to global state
    this.syncWithGlobalLemonPack();
  },

  /* ============================================================
     4. COORDINATE MAPPING & DYNAMIC SVG BLUEPRINT RECONSTRUCTION
     ============================================================ */
  generateSvgPathsFromModel() {
    const p = this.model.params;
    const L = Number(p.length);
    const W = Number(p.width);
    const H = Number(p.height);
    const G = Number(p.glueFlap);
    const T_top = Number(p.topTuck);
    const T_bot = Number(p.bottomTuck);
    const D = Number(p.dustFlap);
    const N = Number(p.lockNotch);

    const x0 = 0;
    const x1 = G;
    const x2 = G + W;
    const x3 = G + W + L;
    const x4 = G + W + L + W;
    const x5 = G + W + L + W + L;

    const y0 = 0;
    const y1 = T_top;
    const y2 = T_top + W;
    const y3 = T_top + W + H;
    const y4 = T_top + W + H + W;
    const y5 = T_top + W + H + W + T_bot;

    const paths = [];

    // 1. MAIN OUTER CUT BLADE (🔴 تیغ برش بیرونی)
    let outerCutD = `M ${x1} ${y2} `;
    
    // Left Glue Flap
    outerCutD += `L ${x0 + 3} ${y2 + 4} L ${x0} ${y2 + 10} L ${x0} ${y3 - 10} L ${x0 + 3} ${y3 - 4} L ${x1} ${y3} `;

    // Bottom Dust Flap 1 (under Side 1)
    outerCutD += `L ${x1 + 3} ${y3 + D} L ${x2 - 5} ${y3 + D} L ${x2} ${y3} `;

    // Bottom Panel Closure (under Front Panel)
    outerCutD += `L ${x2} ${y4} L ${x2 + 8} ${y5} L ${x3 - 8} ${y5} L ${x3} ${y4} L ${x3} ${y3} `;

    // Bottom Dust Flap 2 (under Side 2)
    outerCutD += `L ${x3 + 5} ${y3 + D} L ${x4 - 3} ${y3 + D} L ${x4} ${y3} `;

    // Bottom Tuck / Closure of Back Panel
    outerCutD += `L ${x4} ${y3 + W * 0.6} L ${x5} ${y3 + W * 0.6} L ${x5} ${y3} `;

    // Right Edge of Back Panel
    outerCutD += `L ${x5} ${y2} `;

    // Top Dust Flap 2 (above Back Panel / Side 2)
    outerCutD += `L ${x5} ${y2 - W * 0.6} L ${x4} ${y2 - W * 0.6} L ${x4} ${y2} `;

    // Top Dust Flap 1 (above Side 2)
    outerCutD += `L ${x4 - 3} ${y2 - D} L ${x3 + 5} ${y2 - D} L ${x3} ${y2} `;

    // Top Main Cover Flap & Tuck Flap (above Front Panel)
    outerCutD += `L ${x3} ${y1} L ${x3 - 8} ${y0} L ${x2 + 8} ${y0} L ${x2} ${y1} L ${x2} ${y2} `;

    // Top Dust Flap 0 (above Side 1)
    outerCutD += `L ${x2 - 5} ${y2 - D} L ${x1 + 3} ${y2 - D} L ${x1} ${y2} Z`;

    paths.push({
      id: 'path_outer_cut',
      featureId: 'all',
      name: 'خط تیغ پیرامونی (Outer Cut Blade)',
      type: 'cut',
      color: '#DC2626',
      strokeWidth: 1.8,
      isCrease: false,
      d: outerCutD
    });

    // 2. MAIN BODY CREASES (🔵 خطوط تای عمودی و افقی)
    paths.push({
      id: 'crease_horiz_top',
      featureId: 'param_height',
      name: 'خط تای افقی بالایی (Top Horizontal Crease)',
      type: 'crease',
      color: '#2563EB',
      strokeWidth: 1.4,
      isCrease: true,
      d: `M ${x1} ${y2} H ${x5}`
    });

    paths.push({
      id: 'crease_horiz_bot',
      featureId: 'param_height',
      name: 'خط تای افقی پایینی (Bottom Horizontal Crease)',
      type: 'crease',
      color: '#2563EB',
      strokeWidth: 1.4,
      isCrease: true,
      d: `M ${x1} ${y3} H ${x5}`
    });

    // Vertical body creases
    paths.push({
      id: 'crease_vert_glue',
      featureId: 'param_glue',
      name: 'خط تای لبه چسب (Glue Flap Crease)',
      type: 'crease',
      color: '#059669',
      strokeWidth: 1.4,
      isCrease: true,
      d: `M ${x1} ${y2} V ${y3}`
    });

    paths.push({
      id: 'crease_vert_1',
      featureId: 'param_width',
      name: 'خط تای دیواره ۱ (Side 1 Crease)',
      type: 'crease',
      color: '#2563EB',
      strokeWidth: 1.4,
      isCrease: true,
      d: `M ${x2} ${y2} V ${y3}`
    });

    paths.push({
      id: 'crease_vert_2',
      featureId: 'param_length',
      name: 'خط تای دیواره ۲ (Front Panel Crease)',
      type: 'crease',
      color: '#2563EB',
      strokeWidth: 1.4,
      isCrease: true,
      d: `M ${x3} ${y2} V ${y3}`
    });

    paths.push({
      id: 'crease_vert_3',
      featureId: 'param_width',
      name: 'خط تای دیواره ۳ (Side 2 Crease)',
      type: 'crease',
      color: '#2563EB',
      strokeWidth: 1.4,
      isCrease: true,
      d: `M ${x4} ${y2} V ${y3}`
    });

    // Flap tuck crease lines
    paths.push({
      id: 'crease_top_tuck',
      featureId: 'param_top_tuck',
      name: 'خط تای زبانه بالا (Top Tuck Crease)',
      type: 'crease',
      color: '#F59E0B',
      strokeWidth: 1.4,
      isCrease: true,
      d: `M ${x2} ${y1} H ${x3}`
    });

    paths.push({
      id: 'crease_bot_tuck',
      featureId: 'param_bot_tuck',
      name: 'خط تای زبانه پایین (Bottom Tuck Crease)',
      type: 'crease',
      color: '#D97706',
      strokeWidth: 1.4,
      isCrease: true,
      d: `M ${x2} ${y4} H ${x3}`
    });

    // 3. LOCK NOTCHES (لقط و شکاف‌ها)
    if (N > 0) {
      paths.push({
        id: 'notch_top_left',
        featureId: 'param_lock',
        name: 'لقط قفل زبانه چپ (Lock Notch Left)',
        type: 'cut',
        color: '#EF4444',
        strokeWidth: 1.6,
        isCrease: false,
        d: `M ${x2 + 4} ${y1} v ${-N} h 3`
      });
      paths.push({
        id: 'notch_top_right',
        featureId: 'param_lock',
        name: 'لقط قفل زبانه راست (Lock Notch Right)',
        type: 'cut',
        color: '#EF4444',
        strokeWidth: 1.6,
        isCrease: false,
        d: `M ${x3 - 4} ${y1} v ${-N} h -3`
      });
    }

    this.model.segments = paths;
    this.model.coordinates = { x0, x1, x2, x3, x4, x5, y0, y1, y2, y3, y4, y5 };
  },

  /* ============================================================
     5. SYNCHRONIZATION WITH GLOBAL CAD & PACKAGING APP
     ============================================================ */
  syncWithGlobalLemonPack() {
    if (!window.LemonPack) return;
    const cad = window.LemonPack.cad;
    const p = this.model.params;

    cad.length = p.length;
    cad.width = p.width;
    cad.height = p.height;
    cad.glueFlap = p.glueFlap;
    cad.tuckFlap = p.topTuck;
    cad.dustFlap = p.dustFlap;
    cad.flatL = this.model.calculated.flatDimensions.width;
    cad.flatW = this.model.calculated.flatDimensions.height;

    // Set customDie representation
    cad.customDie = {
      active: true,
      widthMm: cad.flatL,
      heightMm: cad.flatW,
      paths: this.model.segments.map(s => ({
        id: s.id,
        d: s.d,
        originalStroke: s.color,
        strokeDash: s.isCrease ? '4,3' : '',
        type: s.type,
        visible: true
      })),
      bounds: {
        minX: 0,
        minY: 0,
        maxX: cad.flatL,
        maxY: cad.flatW,
        width: cad.flatL,
        height: cad.flatW
      }
    };

    // Update form inputs if present on screen
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = val;
    };
    setVal('inp-length', p.length);
    setVal('inp-width', p.width);
    setVal('inp-height', p.height);
    setVal('inp-glue-flap', p.glueFlap);
    setVal('inp-tuck-flap', p.topTuck);
    setVal('inp-flat-l', cad.flatL);
    setVal('inp-flat-w', cad.flatW);
  },

  /* ============================================================
     6. LIVE PARAMETER EDITING & PROPAGATION
     ============================================================ */
  updateParam(key, value) {
    const num = Math.max(1, parseFloat(value) || 0);
    this.model.params[key] = num;
    this.synthesizeModelFromParams();
    this.render();
    if (window.App && window.App.recalculate) {
      window.App.recalculate();
    }
  },

  selectFeature(featureId) {
    this.selectedFeatureId = (this.selectedFeatureId === featureId) ? null : featureId;
    this.render();
  },

  hoverFeature(featureId) {
    this.hoveredFeatureId = featureId;
    this.renderCanvas();
  },

  /* ============================================================
     7. RENDERING: CANVAS VISUALIZER WITH INTERACTIVE DIMENSIONS
     ============================================================ */
  render() {
    this.renderCanvas();
    this.renderFeaturesTable();
    this.renderFormulasList();
    this.renderSummaryCards();
  },

  renderSummaryCards() {
    const boxEl = document.getElementById('diecut-3d-box-dims');
    const flatEl = document.getElementById('diecut-flat-dims');
    const bladeEl = document.getElementById('diecut-blade-len');
    const areaEl = document.getElementById('diecut-card-area');

    const p = this.model.params;
    const calc = this.model.calculated;
    const pUtils = window.PersianUtils || { e2p: v => v };

    if (boxEl) boxEl.innerHTML = `<strong>${pUtils.e2p(p.length)}</strong> × <strong>${pUtils.e2p(p.width)}</strong> × <strong>${pUtils.e2p(p.height)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">mm</span>`;
    if (flatEl) flatEl.innerHTML = `<strong>${pUtils.e2p(calc.flatDimensions.width)}</strong> × <strong>${pUtils.e2p(calc.flatDimensions.height)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">mm</span>`;
    if (bladeEl) bladeEl.textContent = `${pUtils.e2p(calc.totalBladeLengthMm)} mm تیغ / ${pUtils.e2p(calc.totalCreaseLengthMm)} mm تا`;
    if (areaEl) areaEl.textContent = `${pUtils.e2p(calc.areaCm2)} cm²`;
  },

  renderFeaturesTable() {
    const tbody = document.getElementById('diecut-features-tbody');
    if (!tbody) return;

    const pUtils = window.PersianUtils || { e2p: v => v };
    let html = '';

    this.model.features.forEach(f => {
      const isSelected = this.selectedFeatureId === f.id;
      html += `
        <tr class="feature-row ${isSelected ? 'selected' : ''}" 
            onmouseenter="ParametricDieEngine.hoverFeature('${f.id}')" 
            onmouseleave="ParametricDieEngine.hoverFeature(null)"
            onclick="ParametricDieEngine.selectFeature('${f.id}')"
            style="cursor:pointer; transition:background 0.15s; ${isSelected ? 'background:rgba(217, 119, 6, 0.12);' : ''}">
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="display:inline-block; width:12px; height:12px; border-radius:3px; background:${f.color};"></span>
              <div>
                <strong style="font-size:0.82rem;">${f.name}</strong>
                <div style="font-size:0.7rem; color:var(--text-muted);">${f.description}</div>
              </div>
            </div>
          </td>
          <td class="tabular-nums" style="font-family:monospace; direction:ltr; font-weight:700; color:var(--brand-primary); font-size:0.85rem;">
            ${f.formula}
          </td>
          <td style="width:130px;" onclick="event.stopPropagation()">
            <div class="input-wrap" style="height:32px;">
              <input type="number" step="0.5" class="input-box" style="height:32px; font-weight:800; font-size:0.85rem; padding:0 8px;"
                     value="${f.value}"
                     oninput="ParametricDieEngine.updateParam('${f.key}', this.value)">
              <span class="input-unit" style="font-size:0.7rem;">${f.unit}</span>
            </div>
          </td>
          <td class="tabular-nums" style="text-align:center;">
            <span class="badge" style="background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; font-size:0.72rem;">
              ${pUtils.e2p(f.instances)} خط یکسان
            </span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderFormulasList() {
    const container = document.getElementById('diecut-formulas-container');
    if (!container) return;

    let html = '';
    this.model.formulas.forEach(fm => {
      html += `
        <div style="background:rgba(15,23,42,0.6); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:10px 14px; margin-bottom:8px;">
          <div style="font-size:0.78rem; font-weight:800; color:var(--graphite-text); margin-bottom:4px;">${fm.title}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <code style="direction:ltr; font-size:0.85rem; color:var(--brand-primary); background:rgba(0,0,0,0.3); padding:3px 8px; border-radius:4px;">
              ${fm.latex}
            </code>
            <div style="direction:ltr; font-family:monospace; font-size:0.8rem; color:#94A3B8;">
              ${fm.substituted}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderCanvas() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Dark sleek blueprint background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    // Draw Subtle Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const flat = this.model.calculated.flatDimensions;
    const padding = 45;
    const scale = Math.min((w - padding * 2) / flat.width, (h - padding * 2) / flat.height) * this.zoomLevel;

    ctx.save();
    ctx.translate(w / 2 + this.panOffset.x, h / 2 + this.panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-flat.width / 2, -flat.height / 2);

    // 1. Draw Cardboard paper fill silhouette
    const outerCut = this.model.segments.find(s => s.id === 'path_outer_cut');
    if (outerCut) {
      try {
        const path2d = new Path2D(outerCut.d);
        ctx.fillStyle = 'rgba(248, 250, 252, 0.05)';
        ctx.fill(path2d);
      } catch (e) {}
    }

    // 2. Render all vector paths
    this.model.segments.forEach(seg => {
      ctx.save();
      const isSelected = this.selectedFeatureId && (seg.featureId === this.selectedFeatureId || this.selectedFeatureId === 'all');
      const isHovered = this.hoveredFeatureId && seg.featureId === this.hoveredFeatureId;

      if (isSelected || isHovered) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = (seg.strokeWidth + 2) / scale;
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 8;
      } else {
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = seg.strokeWidth / scale;
      }

      if (seg.isCrease) {
        ctx.setLineDash([5 / scale, 4 / scale]);
      } else {
        ctx.setLineDash([]);
      }

      try {
        const path2d = new Path2D(seg.d);
        ctx.stroke(path2d);
      } catch (e) {}
      ctx.restore();
    });

    // 3. Render Dimension Callout Annotations & Badges
    this.renderDimensionBadges(ctx, scale);

    ctx.restore();
  },

  renderDimensionBadges(ctx, scale) {
    const coords = this.model.coordinates;
    if (!coords) return;
    const p = this.model.params;
    const pUtils = window.PersianUtils || { e2p: v => v };

    ctx.save();
    ctx.font = `bold ${Math.max(10, 11 / scale)}px 'Peyda', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const drawCallout = (x, y, text, color = '#F59E0B', isSelected = false) => {
      const txt = pUtils.e2p(text);
      const metrics = ctx.measureText(txt);
      const boxW = metrics.width + (12 / scale);
      const boxH = 18 / scale;

      ctx.fillStyle = isSelected ? '#F59E0B' : '#1E293B';
      ctx.strokeStyle = isSelected ? '#FFFFFF' : color;
      ctx.lineWidth = 1.2 / scale;

      ctx.beginPath();
      ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 4 / scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#000000' : '#FFFFFF';
      ctx.fillText(txt, x, y);
    };

    const yMid = (coords.y2 + coords.y3) / 2;

    // Callout: Glue Flap
    drawCallout(coords.x0 + (coords.x1 - coords.x0) / 2, yMid, `${p.glueFlap} mm (چسب)`, '#10B981', this.selectedFeatureId === 'param_glue');
    // Callout: Width 1
    drawCallout(coords.x1 + (coords.x2 - coords.x1) / 2, yMid, `W: ${p.width}`, '#6366F1', this.selectedFeatureId === 'param_width');
    // Callout: Length 1
    drawCallout(coords.x2 + (coords.x3 - coords.x2) / 2, yMid, `L: ${p.length}`, '#3B82F6', this.selectedFeatureId === 'param_length');
    // Callout: Width 2
    drawCallout(coords.x3 + (coords.x4 - coords.x3) / 2, yMid, `W: ${p.width}`, '#6366F1', this.selectedFeatureId === 'param_width');
    // Callout: Length 2
    drawCallout(coords.x4 + (coords.x5 - coords.x4) / 2, yMid, `L: ${p.length}`, '#3B82F6', this.selectedFeatureId === 'param_length');

    // Callout: Height H
    const xMid = (coords.x2 + coords.x3) / 2;
    drawCallout(xMid, coords.y2 + 25, `H: ${p.height} mm`, '#8B5CF6', this.selectedFeatureId === 'param_height');

    // Callout: Top Tuck
    drawCallout(xMid, coords.y0 + (coords.y1 - coords.y0) / 2, `زبانه: ${p.topTuck}`, '#F59E0B', this.selectedFeatureId === 'param_top_tuck');

    ctx.restore();
  },

  /* ============================================================
     8. PRESET PACKAGING TEMPLATES
     ============================================================ */
  loadTemplate(modelType) {
    if (modelType === 'tuck_end') {
      this.model.name = 'جعبه دارویی Tuck-End';
      this.model.type = 'tuck_end';
      this.model.params = { length: 120, width: 80, height: 150, glueFlap: 15, topTuck: 18, bottomTuck: 18, dustFlap: 15, lockNotch: 4, creaseGap: 2 };
    } else if (modelType === 'mailer_0427') {
      this.model.name = 'جعبه کیبوردی استانداردی 0427';
      this.model.type = 'mailer_0427';
      this.model.params = { length: 200, width: 150, height: 60, glueFlap: 0, topTuck: 22, bottomTuck: 22, dustFlap: 25, lockNotch: 6, creaseGap: 2 };
    } else if (modelType === 'lock_bottom') {
      this.model.name = 'جعبه ته‌قفلی اتوماتیک (Crash Lock Bottom)';
      this.model.type = 'lock_bottom';
      this.model.params = { length: 140, width: 90, height: 180, glueFlap: 16, topTuck: 18, bottomTuck: 25, dustFlap: 16, lockNotch: 4, creaseGap: 2 };
    }
    this.synthesizeModelFromParams();
    this.render();
    if (window.toast) window.toast(`قالب «${this.model.name}» بارگذاری شد ✓`);
  },

  /* ============================================================
     9. EXPORT & DOWNLOAD (CLEAN SVG / JSON)
     ============================================================ */
  exportCleanSvg() {
    const flat = this.model.calculated.flatDimensions;
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${flat.width} ${flat.height}" width="${flat.width}mm" height="${flat.height}mm">\n`;
    svg += `  <!-- Generated by LemonPack Parametric Packaging Engine -->\n`;
    svg += `  <g id="crease-lines" stroke="#2563EB" stroke-width="0.5" stroke-dasharray="2,2" fill="none">\n`;
    this.model.segments.filter(s => s.isCrease).forEach(s => {
      svg += `    <path d="${s.d}" />\n`;
    });
    svg += `  </g>\n`;
    svg += `  <g id="cut-lines" stroke="#DC2626" stroke-width="0.7" fill="none">\n`;
    this.model.segments.filter(s => !s.isCrease).forEach(s => {
      svg += `    <path d="${s.d}" />\n`;
    });
    svg += `  </g>\n`;
    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diecut_${this.model.type}_${flat.width}x${flat.height}mm.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.toast) window.toast('فایل SVG خط تیغ با موفقیت دانلود شد ✓');
  }
};
