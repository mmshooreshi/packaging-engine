/* ============================================================
   SMART DIE-CUT INSPECTOR & PACKAGING CAD ENGINE v8.0
   Auto-detects packaging geometry, renders crisp dimensioned CAD blueprint,
   and synchronizes directly with Studio & Nesting with zero tedious forms.
   ============================================================ */

window.ParametricDieEngine = {
  isCustomImport: false,
  rawSvgString: null,

  // Core Packaging Dimensions (in mm)
  params: {
    length: 120,    // L: طول بدنه
    width: 80,      // W: عرض پهلو
    height: 150,    // H: ارتفاع بدنه
    glueFlap: 15,   // G: لب‌چسب
    topTuck: 25,    // T: زبانه درپوش بالا
    dustFlap: 15    // D: گوشواره
  },

  // Calculated Engineering Metrics
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
  activePanelHover: null,

  // Canvas Viewport Controls
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
  isDragging: false,
  dragStart: { x: 0, y: 0 },

  init() {
    this.synthesizeModel();
    this.setupCanvasEvents();
    this.render();
  },

  /* ============================================================
     1. GEOMETRY SYNTHESIS (Piecewise CAD Model)
     ============================================================ */
  synthesizeModelFromParams() {
    return this.synthesizeModel();
  },

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
        partKey: partKey,
        label: label
      });
    };

    // Main horizontal creases (Body score lines)
    add('crease', x1, y2, x5, y2, 'H', 'خط‌تا افقی بالای بدنه');
    add('crease', x1, y3, x5, y3, 'H', 'خط‌تا افقی پایین بدنه');

    // Main vertical creases (Body panel division lines)
    add('crease', x1, y2, x1, y3, 'G', 'خط‌تا عمودی لب‌چسب');
    add('crease', x2, y2, x2, y3, 'W', 'خط‌تا عمودی پهلو چپ / جلو');
    add('crease', x3, y2, x3, y3, 'L', 'خط‌تا عمودی جلو / پهلو راست');
    add('crease', x4, y2, x4, y3, 'W', 'خط‌تا عمودی پهلو راست / پشت');

    // Glue flap
    add('cut', x0, y2 + 4, x0, y3 - 4, 'G', 'لبه خارجی لب‌چسب');
    add('cut', x0, y2 + 4, x1, y2, 'G', 'پخ بالای لب‌چسب');
    add('cut', x0, y3 - 4, x1, y3, 'G', 'پخ پایین لب‌چسب');

    // Body right outer edge
    add('cut', x5, y2, x5, y3, 'L', 'لبه انتهایی بدنه پشت');

    // Top Dust Flaps
    add('cut', x1, y2 - D, x2, y2 - D, 'W', 'لبه بالایی گوشواره ۱');
    add('cut', x1, y2, x1, y2 - D, 'W', 'برش کناری گوشواره ۱');
    add('cut', x2, y2, x2, y2 - D, 'W', 'برش کناری گوشواره ۱');

    add('cut', x3, y2 - D, x4, y2 - D, 'W', 'لبه بالایی گوشواره ۲');
    add('cut', x3, y2, x3, y2 - D, 'W', 'برش کناری گوشواره ۲');
    add('cut', x4, y2, x4, y2 - D, 'W', 'برش کناری گوشواره ۲');

    // Top Tuck Flap
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

    // Bottom Tuck Flap
    add('crease', x4, y4, x5, y4, 'T', 'خط‌تا درپوش پایین');
    add('cut', x4 + 4, y5, x5 - 4, y5, 'T', 'لبه زبانه درپوش پایین');
    add('cut', x4, y4, x4 + 4, y5, 'T', 'پخ چپ درپوش پایین');
    add('cut', x5, y4, x5 - 4, y5, 'T', 'پخ راست درپوش پایین');
    add('cut', x4, y3, x4, y4, 'T', 'برش کناری درپوش پایین');
    add('cut', x5, y3, x5, y4, 'T', 'برش کناری درپوش پایین');

    // Top/Bottom flat edges
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

    // Update HUD metrics
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v) };
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('hud-box-dims', `${pUtils.fmtNum(this.params.length)} × ${pUtils.fmtNum(this.params.width)} × ${pUtils.fmtNum(this.params.height)} mm`);
    setVal('hud-flat-dims', `${pUtils.fmtNum(this.calculated.flatWidth)} × ${pUtils.fmtNum(this.calculated.flatHeight)} mm`);
    setVal('hud-blade-len', `${pUtils.fmtNum(this.calculated.totalBladeLengthMm)} mm`);
    setVal('hud-crease-len', `${pUtils.fmtNum(this.calculated.totalCreaseLengthMm)} mm`);
    setVal('hud-area', `${pUtils.fmtNum(this.calculated.areaCm2, 1)} cm²`);
  },

  /* ============================================================
     2. SVG UPLOAD, FULL PARSER & CAD ANALYSIS
     ============================================================ */
  handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    this.processFile(file);
    event.target.value = '';
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

  normalizeColor(colorStr) {
    if (!colorStr) return null;
    let s = colorStr.trim().toLowerCase();
    if (s === 'none' || s === 'transparent') return 'none';
    const named = {
      yellow: '#ffff00', gold: '#ffd700', red: '#dc2626', crimson: '#dc143c',
      blue: '#2563eb', navy: '#000080', green: '#059669', lime: '#00ff00',
      magenta: '#ff00ff', cyan: '#00ffff', black: '#000000', gray: '#6b7280',
      grey: '#6b7280', orange: '#ea580c'
    };
    if (named[s]) return named[s];
    if (s.startsWith('rgb')) {
      const nums = s.replace(/[^\d,]/g, '').split(',').map(Number);
      if (nums.length >= 3) {
        return '#' + nums.slice(0, 3).map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
      }
    }
    if (s.startsWith('#') && s.length === 4) {
      return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }
    return s;
  },

  extractCssRules(doc) {
    const cssMap = {};
    const styles = doc.querySelectorAll('style');
    styles.forEach(st => {
      const cssText = st.textContent || '';
      const regex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
      let match;
      while ((match = regex.exec(cssText)) !== null) {
        const className = match[1];
        const decls = match[2];
        cssMap[className] = cssMap[className] || {};
        const propRegex = /([a-zA-Z-]+)\s*:\s*([^;]+)/g;
        let propMatch;
        while ((propMatch = propRegex.exec(decls)) !== null) {
          const propName = propMatch[1].trim().toLowerCase();
          const propVal = propMatch[2].trim();
          cssMap[className][propName] = propVal;
        }
      }
    });
    return cssMap;
  },

  resolveStroke(el, cssMap) {
    if (el.style && el.style.stroke) {
      const norm = this.normalizeColor(el.style.stroke);
      if (norm && norm !== 'none') return norm;
    }
    const attrStroke = el.getAttribute('stroke');
    if (attrStroke) {
      const norm = this.normalizeColor(attrStroke);
      if (norm && norm !== 'none') return norm;
    }
    const classAttr = el.getAttribute('class');
    if (classAttr) {
      for (const cls of classAttr.split(/\s+/)) {
        if (cssMap[cls] && cssMap[cls]['stroke']) {
          const norm = this.normalizeColor(cssMap[cls]['stroke']);
          if (norm && norm !== 'none') return norm;
        }
      }
    }
    let p = el.parentElement;
    while (p && p.tagName.toLowerCase() !== 'svg') {
      if (p.style && p.style.stroke) {
        const norm = this.normalizeColor(p.style.stroke);
        if (norm && norm !== 'none') return norm;
      }
      const ps = p.getAttribute('stroke');
      if (ps) {
        const norm = this.normalizeColor(ps);
        if (norm && norm !== 'none') return norm;
      }
      p = p.parentElement;
    }
    return '#dc2626';
  },

  resolveDash(el, cssMap) {
    if (el.style && el.style.strokeDasharray) return el.style.strokeDasharray;
    if (el.getAttribute('stroke-dasharray')) return el.getAttribute('stroke-dasharray');
    const classAttr = el.getAttribute('class');
    if (classAttr) {
      for (const cls of classAttr.split(/\s+/)) {
        if (cssMap[cls] && cssMap[cls]['stroke-dasharray']) {
          return cssMap[cls]['stroke-dasharray'];
        }
      }
    }
    return '';
  },

  classifyType(stroke, dash, name) {
    const s = (stroke || '').toLowerCase();
    const isDash = !!dash && dash !== 'none' && dash !== '0';
    if (s.includes('yellow') || s.includes('ffff00') || s.includes('ffd700')) return 'guide';
    if (isDash || s.includes('blue') || s.includes('cyan') || s.includes('2563eb') || s.includes('0000ff') || (name && (name.includes('crease') || name.includes('fold') || name.includes('ta')))) {
      return 'crease';
    }
    if (s.includes('green') || s.includes('059669') || s.includes('10b981') || (name && (name.includes('glue') || name.includes('chasb')))) {
      return 'glue';
    }
    return 'cut';
  },

  parseSvgString(svgText) {
    if (!svgText || !svgText.includes('<svg')) return;
    this.rawSvgString = svgText;
    this.isCustomImport = true;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return;

    const cssMap = this.extractCssRules(doc);

    // Determine scale to millimeters
    let scaleToMm = 1.0;
    const widthAttr = svgEl.getAttribute('width') || '';
    const heightAttr = svgEl.getAttribute('height') || '';
    const viewBoxAttr = svgEl.getAttribute('viewBox') || '';

    let vbW = 0, vbH = 0;
    if (viewBoxAttr) {
      const vbParts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
      if (vbParts.length === 4) {
        vbW = vbParts[2];
        vbH = vbParts[3];
      }
    }

    const parseUnit = (str) => {
      if (!str) return null;
      const num = parseFloat(str);
      if (isNaN(num)) return null;
      if (str.endsWith('mm')) return num;
      if (str.endsWith('cm')) return num * 10;
      if (str.endsWith('in')) return num * 25.4;
      if (str.endsWith('pt')) return num * (25.4 / 72);
      if (str.endsWith('px')) return num * (25.4 / 96);
      return num;
    };

    const physicalW = parseUnit(widthAttr);
    if (physicalW && vbW > 0) {
      scaleToMm = physicalW / vbW;
    } else if (widthAttr.endsWith('pt') || (!physicalW && vbW > 1200)) {
      scaleToMm = 25.4 / 72;
    }

    // Extract all vector paths & geometry
    const elements = doc.querySelectorAll('path, line, rect, polyline, polygon, circle, ellipse');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const rawPaths = [];
    let pIdx = 1;

    elements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      let d = '';

      if (tag === 'path') {
        d = el.getAttribute('d') || '';
      } else if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || 0);
        const y1 = parseFloat(el.getAttribute('y1') || 0);
        const x2 = parseFloat(el.getAttribute('x2') || 0);
        const y2 = parseFloat(el.getAttribute('y2') || 0);
        d = `M ${x1} ${y1} L ${x2} ${y2}`;
      } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || 0);
        const y = parseFloat(el.getAttribute('y') || 0);
        const rw = parseFloat(el.getAttribute('width') || 0);
        const rh = parseFloat(el.getAttribute('height') || 0);
        d = `M ${x} ${y} H ${x + rw} V ${y + rh} H ${x} Z`;
      } else if (tag === 'polyline' || tag === 'polygon') {
        const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/);
        if (pts.length >= 2) {
          d = `M ${pts[0]} ${pts[1]}`;
          for (let i = 2; i < pts.length; i += 2) {
            d += ` L ${pts[i]} ${pts[i+1]}`;
          }
          if (tag === 'polygon') d += ' Z';
        }
      } else if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx') || 0);
        const cy = parseFloat(el.getAttribute('cy') || 0);
        const r = parseFloat(el.getAttribute('r') || 0);
        d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
      }

      if (!d.trim()) return;

      const nums = (d.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
      for (let i = 0; i < nums.length - 1; i += 2) {
        const x = nums[i];
        const y = nums[i+1];
        if (!isNaN(x) && !isNaN(y)) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }

      const stroke = this.resolveStroke(el, cssMap);
      const dash = this.resolveDash(el, cssMap);
      const name = el.getAttribute('id') || (el.parentElement ? el.parentElement.getAttribute('id') : '');
      const type = this.classifyType(stroke, dash, name);

      rawPaths.push({
        id: `custom_${pIdx++}`,
        dRaw: d,
        stroke,
        dash,
        type
      });
    });

    if (minX === Infinity || rawPaths.length === 0) {
      if (window.toast) window.toast('خطا: هیچ مسیر برداری معتبری در فایل یافت نشد.');
      return;
    }

    const rawW = maxX - minX;
    const rawH = maxY - minY;

    const normalizedPaths = [];
    let totalCutLen = 0;
    let totalCreaseLen = 0;
    const segs = [];
    let sIdx = 1;

    rawPaths.forEach(rp => {
      let approxLen = 0;
      let prevPt = null;
      const cmdRegex = /([a-df-z])([^a-df-z]*)/gi;
      let m;
      let newD = '';

      while ((m = cmdRegex.exec(rp.dRaw)) !== null) {
        const cmd = m[1];
        const coords = (m[2].match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
        newD += cmd + ' ';

        for (let i = 0; i < coords.length; i += 2) {
          if (i + 1 < coords.length) {
            let px = coords[i];
            let py = coords[i+1];
            if (cmd === cmd.toUpperCase()) {
              px = (px - minX) * scaleToMm;
              py = (py - minY) * scaleToMm;
            } else {
              px = px * scaleToMm;
              py = py * scaleToMm;
            }
            newD += `${px.toFixed(2)},${py.toFixed(2)} `;

            if (prevPt) {
              const dDist = Math.hypot(px - prevPt.x, py - prevPt.y);
              approxLen += dDist;
              segs.push({
                id: `seg_${sIdx++}`,
                x1: prevPt.x,
                y1: prevPt.y,
                x2: px,
                y2: py,
                d: `M ${prevPt.x.toFixed(2)} ${prevPt.y.toFixed(2)} L ${px.toFixed(2)} ${py.toFixed(2)}`,
                type: rp.type,
                lengthMm: Number(dDist.toFixed(1)),
                isHoriz: Math.abs(py - prevPt.y) < 1.0,
                isVert: Math.abs(px - prevPt.x) < 1.0
              });
            }
            prevPt = { x: px, y: py };
          } else {
            newD += `${(coords[i] * scaleToMm).toFixed(2)} `;
          }
        }
      }

      if (rp.type === 'crease') totalCreaseLen += approxLen;
      else totalCutLen += approxLen;

      normalizedPaths.push({
        id: rp.id,
        d: newD.trim() || rp.dRaw,
        type: rp.type,
        stroke: rp.type === 'crease' ? '#2563EB' : (rp.type === 'glue' ? '#10B981' : '#DC2626'),
        strokeDash: rp.type === 'crease' ? '4,3' : '',
        lengthMm: Number(approxLen.toFixed(1)),
        visible: true
      });
    });

    const flatW = Math.max(10, Math.round(rawW * scaleToMm));
    const flatH = Math.max(10, Math.round(rawH * scaleToMm));

    this.calculated.flatWidth = flatW;
    this.calculated.flatHeight = flatH;
    this.calculated.totalBladeLengthMm = Math.round(totalCutLen || flatW * 2 + flatH * 2);
    this.calculated.totalCreaseLengthMm = Math.round(totalCreaseLen || flatW);
    this.calculated.areaCm2 = Number(((flatW * flatH) / 100).toFixed(1));

    this.customPaths = normalizedPaths;
    this.segments = segs.length > 0 ? segs : normalizedPaths.map(p => ({
      id: p.id,
      x1: 0, y1: 0, x2: flatW, y2: flatH,
      d: p.d,
      type: p.type,
      lengthMm: p.lengthMm
    }));

    const vertCreases = segs.filter(s => s.type === 'crease' && s.isVert && s.lengthMm > 15);
    const horizCreases = segs.filter(s => s.type === 'crease' && s.isHoriz && s.lengthMm > 15);

    if (horizCreases.length >= 2) {
      const ys = horizCreases.map(s => s.y1).sort((a,b)=>a-b);
      this.params.height = Math.max(10, Math.round(ys[ys.length-1] - ys[0]));
      this.params.topTuck = Math.max(10, Math.round(ys[0]));
    } else {
      this.params.height = Math.round(flatH * 0.55);
      this.params.topTuck = 25;
    }

    if (vertCreases.length >= 4) {
      const xs = vertCreases.map(s => s.x1).sort((a,b)=>a-b);
      const w1 = Math.round(xs[1] - xs[0]);
      const l1 = Math.round(xs[2] - xs[1]);
      this.params.glueFlap = Math.max(8, Math.round(xs[0]));
      this.params.length = Math.max(20, Math.max(w1, l1));
      this.params.width = Math.max(15, Math.min(w1, l1));
    } else {
      this.params.glueFlap = 15;
      this.params.length = Math.round((flatW - 15) * 0.32);
      this.params.width = Math.round(((flatW - 15) - 2 * this.params.length) / 2);
    }

    document.querySelectorAll('[data-die-template]').forEach(btn => btn.classList.remove('active'));

    this.resetView();
    this.render();

    const pUtils = window.PersianUtils || { fmtNum: v => String(v) };
    if (window.SoundEngine) window.SoundEngine.playClick();
    if (window.toast) {
      window.toast(`قالب SVG با موفقیت تفکیک شد: ابعاد گسترده ${pUtils.fmtNum(flatW)} × ${pUtils.fmtNum(flatH)} mm ✓`);
    }
  },

  loadTemplate(type) {
    this.isCustomImport = false;
    this.customPaths = [];
    if (type === 'tuck_end') {
      this.params = { length: 120, width: 80, height: 150, glueFlap: 15, topTuck: 25, dustFlap: 15 };
    } else if (type === 'mailer_0427') {
      this.params = { length: 200, width: 150, height: 60, glueFlap: 0, topTuck: 22, dustFlap: 25 };
    } else if (type === 'lock_bottom') {
      this.params = { length: 140, width: 90, height: 180, glueFlap: 16, topTuck: 25, dustFlap: 16 };
    }
    this.synthesizeModel();
    this.resetView();
    this.render();

    document.querySelectorAll('[data-die-template]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.dieTemplate === type);
    });

    if (window.SoundEngine) window.SoundEngine.playClick();
    if (window.toast) window.toast('الگوی استاندارد بارگذاری شد ✓');
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

    const pathsToSend = this.isCustomImport && this.customPaths.length > 0 ? this.customPaths : this.segments.map(s => ({
      id: s.id,
      d: s.d,
      originalStroke: s.type === 'crease' ? '#2563EB' : '#DC2626',
      strokeDash: s.type === 'crease' ? '4,3' : '',
      type: s.type,
      visible: true
    }));

    cad.customDie = {
      active: true,
      widthMm: cad.flatL,
      heightMm: cad.flatW,
      paths: pathsToSend,
      bounds: { minX: 0, minY: 0, width: cad.flatL, height: cad.flatW }
    };

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
      window.toast('قالب به استودیو و شیت‌بندی ۲بعدی اعمال شد ✓');
    }
  },

  exportCleanSvg() {
    const flatW = this.calculated.flatWidth;
    const flatH = this.calculated.flatHeight;
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${flatW} ${flatH}" width="${flatW}mm" height="${flatH}mm">\n`;

    if (this.isCustomImport && this.customPaths.length > 0) {
      svg += `  <g id="crease-matrix" stroke="#2563EB" stroke-width="0.6" stroke-dasharray="3,2" fill="none">\n`;
      this.customPaths.filter(p => p.type === 'crease').forEach(p => {
        svg += `    <path d="${p.d}" />\n`;
      });
      svg += `  </g>\n`;
      svg += `  <g id="cut-blades" stroke="#DC2626" stroke-width="0.8" fill="none">\n`;
      this.customPaths.filter(p => p.type !== 'crease').forEach(p => {
        svg += `    <path d="${p.d}" />\n`;
      });
      svg += `  </g>\n`;
    } else {
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
    }
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
     3. INTERACTIVE CAD CANVAS VIEWPORT
     ============================================================ */
  setupCanvasEvents() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas) return;

    // Auto-fit canvas to container on resize
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth || 900;
        canvas.height = container.clientHeight || 560;
        this.renderCanvas();
      }
    };
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 50);

    canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      if (canvas) canvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (this.isDragging) {
        this.panOffset.x = e.clientX - this.dragStart.x;
        this.panOffset.y = e.clientY - this.dragStart.y;
        this.renderCanvas();
        return;
      }

      const pt = this.canvasPxToMm(clientX, clientY);
      const p = this.params;
      const pUtils = window.PersianUtils || { fmtNum: v => String(v) };

      // Identify panel under cursor
      const x1 = p.glueFlap;
      const x2 = p.glueFlap + p.width;
      const x3 = p.glueFlap + p.width + p.length;
      const x4 = p.glueFlap + p.width + p.length + p.width;
      const x5 = p.glueFlap + p.width + p.length + p.width + p.length;
      const y2 = p.topTuck + p.width;
      const y3 = p.topTuck + p.width + p.height;

      let hoverPanel = null;
      if (pt.y >= y2 && pt.y <= y3) {
        if (pt.x >= 0 && pt.x < x1) hoverPanel = `لبه چسب (G): ${pUtils.fmtNum(p.glueFlap)} mm`;
        else if (pt.x >= x1 && pt.x < x2) hoverPanel = `پهلو چپ (W): ${pUtils.fmtNum(p.width)} × ${pUtils.fmtNum(p.height)} mm`;
        else if (pt.x >= x2 && pt.x < x3) hoverPanel = `بدنه جلو (L): ${pUtils.fmtNum(p.length)} × ${pUtils.fmtNum(p.height)} mm`;
        else if (pt.x >= x3 && pt.x < x4) hoverPanel = `پهلو راست (W): ${pUtils.fmtNum(p.width)} × ${pUtils.fmtNum(p.height)} mm`;
        else if (pt.x >= x4 && pt.x <= x5) hoverPanel = `بدنه پشت (L): ${pUtils.fmtNum(p.length)} × ${pUtils.fmtNum(p.height)} mm`;
      } else if (pt.y < y2 && pt.x >= x2 && pt.x <= x3) {
        hoverPanel = `درب بالا (T): ارتفاع ${pUtils.fmtNum(p.topTuck)} mm`;
      } else if (pt.y > y3 && pt.x >= x4 && pt.x <= x5) {
        hoverPanel = `درب پایین (T): ارتفاع ${pUtils.fmtNum(p.topTuck)} mm`;
      }

      const hoverTag = document.getElementById('canvas-hover-tag');
      const hoverText = document.getElementById('canvas-hover-text');
      if (hoverPanel) {
        this.activePanelHover = hoverPanel;
        if (hoverTag && hoverText) {
          hoverTag.style.display = 'block';
          hoverText.textContent = hoverPanel;
        }
      } else {
        this.activePanelHover = null;
        if (hoverTag) hoverTag.style.display = 'none';
      }

      this.renderCanvas();
    });

    canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.activePanelHover = null;
      const hoverTag = document.getElementById('canvas-hover-tag');
      if (hoverTag) hoverTag.style.display = 'none';
      this.renderCanvas();
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      this.zoomLevel = Math.max(0.3, Math.min(4.5, this.zoomLevel * zoomFactor));
      this.renderCanvas();
    }, { passive: false });
  },

  canvasPxToMm(px, py) {
    const canvas = document.getElementById('diecut-preview-canvas');
    const w = canvas ? canvas.width : 800;
    const h = canvas ? canvas.height : 500;
    const flatW = this.calculated.flatWidth || 415;
    const flatH = this.calculated.flatHeight || 266;
    const paddingMm = 45;
    const baseScale = Math.min((w - 80) / (flatW + paddingMm * 2), (h - 80) / (flatH + paddingMm * 2));
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

  render() {
    this.recalculateTotals();
    this.renderCanvas();
  },

  renderCanvas() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: s => String(s) };

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0B1120';
    ctx.fillRect(0, 0, w, h);

    const flatW = this.calculated.flatWidth;
    const flatH = this.calculated.flatHeight;
    const paddingMm = 45;
    const baseScale = Math.min((w - 80) / (flatW + paddingMm * 2), (h - 80) / (flatH + paddingMm * 2));
    const scale = baseScale * this.zoomLevel;

    ctx.save();
    ctx.translate(w / 2 + this.panOffset.x, h / 2 + this.panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-flatW / 2, -flatH / 2);

    // Subtle background engineering grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 0.5 / scale;
    for (let x = -40; x <= flatW + 40; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, flatH + 40); ctx.stroke();
    }
    for (let y = -40; y <= flatH + 40; y += 20) {
      ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(flatW + 40, y); ctx.stroke();
    }

    if (!this.isCustomImport) {
      const p = this.params;
      const x1 = p.glueFlap;
      const x2 = p.glueFlap + p.width;
      const x3 = p.glueFlap + p.width + p.length;
      const x4 = p.glueFlap + p.width + p.length + p.width;
      const x5 = p.glueFlap + p.width + p.length + p.width + p.length;
      const y2 = p.topTuck + p.width;
      const y3 = p.topTuck + p.width + p.height;

      // Draw Panel Backgrounds & Persian Typography
      const drawPanel = (px, py, pw, ph, label, dimText) => {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

        ctx.font = `bold ${Math.max(10, Math.min(14, pw * 0.14))}px Peyda, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, px + pw / 2, py + ph / 2 - 6);

        ctx.font = `bold ${Math.max(9, Math.min(12, pw * 0.12))}px Peyda, sans-serif`;
        ctx.fillStyle = '#D97706';
        ctx.fillText(dimText, px + pw / 2, py + ph / 2 + 10);
        ctx.restore();
      };

      drawPanel(0, y2, x1, p.height, 'لبچسب G', `${pUtils.fmtNum(p.glueFlap)} mm`);
      drawPanel(x1, y2, p.width, p.height, 'پهلو چپ (W)', `${pUtils.fmtNum(p.width)} × ${pUtils.fmtNum(p.height)}`);
      drawPanel(x2, y2, p.length, p.height, 'بدنه جلو (L)', `${pUtils.fmtNum(p.length)} × ${pUtils.fmtNum(p.height)}`);
      drawPanel(x3, y2, p.width, p.height, 'پهلو راست (W)', `${pUtils.fmtNum(p.width)} × ${pUtils.fmtNum(p.height)}`);
      drawPanel(x4, y2, p.length, p.height, 'بدنه پشت (L)', `${pUtils.fmtNum(p.length)} × ${pUtils.fmtNum(p.height)}`);
      drawPanel(x2, 0, p.length, p.topTuck, 'درب بالا (T)', `${pUtils.fmtNum(p.topTuck)} mm`);
      drawPanel(x4, y3 + p.width, p.length, p.topTuck, 'درب پایین (T)', `${pUtils.fmtNum(p.topTuck)} mm`);

      // Draw Line Segments
      this.segments.forEach(s => {
        ctx.save();
        if (s.type === 'cut') {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 1.8 / scale;
          ctx.setLineDash([]);
        } else if (s.type === 'crease') {
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 1.4 / scale;
          ctx.setLineDash([4 / scale, 3 / scale]);
        } else {
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 1.6 / scale;
          ctx.setLineDash([]);
        }

        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        ctx.restore();
      });

      // Draw Crisp CAD Dimension Leader Lines (L, W, H, Total Flat)
      this.drawDimension(ctx, x2, y3 + 12, x3, y3 + 12, `طول L: ${pUtils.fmtNum(p.length)} mm`, '#F59E0B', scale);
      this.drawDimension(ctx, x1, y3 + 26, x2, y3 + 26, `عرض W: ${pUtils.fmtNum(p.width)} mm`, '#38BDF8', scale);
      this.drawDimension(ctx, x5 + 14, y2, x5 + 14, y3, `ارتفاع H: ${pUtils.fmtNum(p.height)} mm`, '#34D399', scale);
      this.drawDimension(ctx, 0, -14, x5, -14, `عرض شیت گسترده: ${pUtils.fmtNum(flatW)} mm`, '#A78BFA', scale);
    } else {
      // CUSTOM IMPORTED SVG DIE RENDERING
      const pathsToDraw = this.customPaths.length > 0 ? this.customPaths : this.segments;
      pathsToDraw.forEach(p => {
        ctx.save();
        if (p.type === 'cut') {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 1.8 / scale;
          ctx.setLineDash([]);
        } else if (p.type === 'crease') {
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 1.4 / scale;
          ctx.setLineDash([4 / scale, 3 / scale]);
        } else if (p.type === 'glue') {
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 1.6 / scale;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.2 / scale;
          ctx.setLineDash([2 / scale, 2 / scale]);
        }

        if (p.d) {
          try {
            const p2d = new Path2D(p.d);
            ctx.stroke(p2d);
          } catch (e) {
            if (p.x1 !== undefined && p.x2 !== undefined) {
              ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
            }
          }
        } else if (p.x1 !== undefined && p.x2 !== undefined) {
          ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke();
        }
        ctx.restore();
      });

      // Outer Bounding Box Dimensions
      this.drawDimension(ctx, 0, flatH + 14, flatW, flatH + 14, `عرض گسترده قالب: ${pUtils.fmtNum(flatW)} mm`, '#A78BFA', scale);
      this.drawDimension(ctx, flatW + 14, 0, flatW + 14, flatH, `طول گسترده قالب: ${pUtils.fmtNum(flatH)} mm`, '#38BDF8', scale);
    }

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
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - sz * 0.7, y2 - sz); ctx.lineTo(x2 + sz * 0.7, y2 - sz); ctx.fill();
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
