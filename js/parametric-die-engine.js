/* ============================================================
   PARAMETRIC DIE-CUT & MATHEMATICAL PACKAGING FORMULA ENGINE v5.0
   100% True Imported SVG Vector Preservation, Geometric Segment
   Classifier & Piecewise Parametric Morphing/Deformation Engine.
   ============================================================ */

window.ParametricDieEngine = {
  isCustomImport: false,
  rawSvgString: null,
  
  // Storage of original imported SVG paths before deformation
  originalImportedPaths: [],
  originalBounds: { minX: 0, minY: 0, maxX: 310, maxY: 220, width: 310, height: 220 },
  originalCoords: { x0: 0, x1: 15, x2: 95, x3: 215, x4: 295, x5: 415, y0: 0, y1: 18, y2: 98, y3: 248, y4: 328, y5: 346 },

  // Current active model
  model: {
    name: 'قالب اختصاصی وکتور',
    type: 'tuck_end',
    params: {
      length: 120,      // L: طول بدنه
      width: 80,        // W: عرض پهلو
      height: 150,      // H: ارتفاع بدنه
      glueFlap: 15,     // G: لبه چسب
      topTuck: 18,      // T_top: زبانه درپوش بالا
      bottomTuck: 18,   // T_bot: زبانه درپوش پایین
      dustFlap: 15,     // D: گوشواره / زبانه‌های گردگیر
      lockNotch: 4,     // N: قفل / لقط درپوش
      creaseGap: 2
    },
    calculated: {
      boxDimensions: { l: 120, w: 80, h: 150 },
      flatDimensions: { width: 415, height: 266 },
      totalBladeLengthMm: 1840,
      totalCreaseLengthMm: 1120,
      areaCm2: 1103.9
    },
    features: [],
    segments: [],
    formulas: [],
    coordinates: null
  },

  // Interactive Canvas State
  selectedFeatureId: null,
  hoveredFeatureId: null,
  hoveredHandle: null,
  activeDrag: null,
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  canvasBounds: { width: 1100, height: 380 },
  renderScale: 1.0,

  init() {
    this.synthesizeModelFromParams();
    this.setupCanvasInteractions();
  },

  /* ============================================================
     1. PARSING & IMPORTING USER'S EXACT SVG FILE
     Preserves every curve, notch, path, stroke and coordinate
     ============================================================ */
  parseSvgString(svgText) {
    if (!svgText || !svgText.includes('<svg')) return;
    this.rawSvgString = svgText;
    this.isCustomImport = true;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return;

    const cssMap = this.extractCssRules(doc);
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const parsedPaths = [];

    // Parse viewBox
    const vb = svgEl.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        bounds.minX = parts[0];
        bounds.minY = parts[1];
        bounds.maxX = parts[0] + parts[2];
        bounds.maxY = parts[1] + parts[3];
      }
    }

    const elements = doc.querySelectorAll('path, line, rect, polyline, polygon, circle, ellipse');

    elements.forEach((el, index) => {
      let d = '';
      const tag = el.tagName.toLowerCase();
      if (tag === 'path') {
        d = el.getAttribute('d') || '';
        const nums = (d.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
        this.updateBounds(nums, bounds);
      } else if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || 0);
        const y1 = parseFloat(el.getAttribute('y1') || 0);
        const x2 = parseFloat(el.getAttribute('x2') || 0);
        const y2 = parseFloat(el.getAttribute('y2') || 0);
        d = `M ${x1} ${y1} L ${x2} ${y2}`;
        this.updateBounds([x1, y1, x2, y2], bounds);
      } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || 0);
        const y = parseFloat(el.getAttribute('y') || 0);
        const rw = parseFloat(el.getAttribute('width') || 0);
        const rh = parseFloat(el.getAttribute('height') || 0);
        d = `M ${x} ${y} H ${x + rw} V ${y + rh} H ${x} Z`;
        this.updateBounds([x, y, x + rw, y + rh], bounds);
      } else if (tag === 'polyline' || tag === 'polygon') {
        const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/);
        if (pts.length >= 2) {
          d = `M ${pts[0]} ${pts[1]}`;
          for (let i = 2; i < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i+1]}`;
          if (tag === 'polygon') d += ' Z';
          this.updateBounds(pts.map(Number), bounds);
        }
      } else if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx') || 0);
        const cy = parseFloat(el.getAttribute('cy') || 0);
        const r = parseFloat(el.getAttribute('r') || 0);
        d = `M ${cx - r}, ${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
        this.updateBounds([cx - r, cy - r, cx + r, cy + r], bounds);
      }

      if (d) {
        const { stroke } = this.resolveStroke(el, cssMap);
        const strokeDash = this.resolveDash(el, cssMap);
        const strokeWidth = parseFloat(el.getAttribute('stroke-width') || 1.2);
        const isCrease = (strokeDash && strokeDash !== 'none') || stroke.includes('blue') || stroke.includes('cyan') || stroke.includes('0000ff') || stroke.includes('2563eb');

        parsedPaths.push({
          id: `svg_path_${index + 1}`,
          originalIndex: index + 1,
          d: d,
          originalStroke: stroke,
          stroke: stroke,
          strokeDash: strokeDash,
          strokeWidth: strokeWidth,
          isCrease: isCrease,
          type: isCrease ? 'crease' : (stroke.includes('green') ? 'glue' : 'cut'),
          color: isCrease ? '#2563EB' : (stroke.includes('green') ? '#059669' : '#DC2626')
        });
      }
    });

    if (parsedPaths.length === 0) {
      this.isCustomImport = false;
      this.synthesizeModelFromParams();
      return;
    }

    if (bounds.minX === Infinity) {
      bounds.minX = 0; bounds.minY = 0; bounds.maxX = 310; bounds.maxY = 220;
    }
    bounds.width = Math.max(1, bounds.maxX - bounds.minX);
    bounds.height = Math.max(1, bounds.maxY - bounds.minY);

    this.originalBounds = Object.assign({}, bounds);
    this.originalImportedPaths = JSON.parse(JSON.stringify(parsedPaths));

    // Analyze topology and extract L, W, H, Glue, Tuck parameters
    this.analyzeImportedGeometry(bounds, parsedPaths);
    this.applyParametricDeformation();
    this.render();

    if (window.toast) {
      window.toast(`فایل وکتور با ${parsedPaths.length} مسیر برداری با موفقیت بارگذاری شد ✓`);
    }
  },

  updateBounds(nums, bounds) {
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = nums[i];
      const y = nums[i+1];
      if (!isNaN(x) && !isNaN(y)) {
        if (x < bounds.minX) bounds.minX = x;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (y > bounds.maxY) bounds.maxY = y;
      }
    }
  },

  extractCssRules(doc) {
    const cssMap = {};
    doc.querySelectorAll('style').forEach(st => {
      const regex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
      let match;
      while ((match = regex.exec(st.textContent || '')) !== null) {
        const cls = match[1];
        cssMap[cls] = cssMap[cls] || {};
        const pReg = /([a-zA-Z-]+)\s*:\s*([^;]+)/g;
        let pm;
        while ((pm = pReg.exec(match[2])) !== null) {
          cssMap[cls][pm[1].trim().toLowerCase()] = pm[2].trim();
        }
      }
    });
    return cssMap;
  },

  resolveStroke(el, cssMap) {
    if (el.style && el.style.stroke && el.style.stroke !== 'none') return { stroke: el.style.stroke };
    if (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none') return { stroke: el.getAttribute('stroke') };
    const cls = el.getAttribute('class');
    if (cls && cssMap[cls] && cssMap[cls]['stroke']) return { stroke: cssMap[cls]['stroke'] };
    return { stroke: '#DC2626' };
  },

  resolveDash(el, cssMap) {
    if (el.style && el.style.strokeDasharray) return el.style.strokeDasharray;
    if (el.getAttribute('stroke-dasharray')) return el.getAttribute('stroke-dasharray');
    return '';
  },

  /* ============================================================
     2. AUTOMATED PACKAGING TOPOLOGY EXTRACTION
     Extracts L, W, H, Glue Flap, Tuck Flap and coordinates from user SVG
     ============================================================ */
  analyzeImportedGeometry(bounds, paths) {
    const totalW = Math.round(bounds.width);
    const totalH = Math.round(bounds.height);

    // Extract vertical creases (X coordinates)
    const vertX = [];
    paths.filter(p => p.isCrease).forEach(p => {
      const nums = (p.d.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
      if (nums.length >= 4 && Math.abs(nums[0] - nums[2]) < 3) {
        vertX.push(nums[0]);
      }
    });

    // Cluster X coordinates
    const clustersX = [];
    vertX.forEach(x => {
      const match = clustersX.find(c => Math.abs(c.x - x) < 8);
      if (match) { match.count++; } else { clustersX.push({ x: x, count: 1 }); }
    });
    clustersX.sort((a, b) => a.x - b.x);

    let g = 15;
    let w = 80;
    let l = 120;
    let h = 150;
    let t_top = 18;
    let t_bot = 18;
    let d = 15;

    if (clustersX.length >= 4) {
      const intervals = [];
      for (let i = 0; i < clustersX.length - 1; i++) {
        intervals.push(Math.round(clustersX[i+1].x - clustersX[i].x));
      }
      if (intervals[0] < 35) {
        g = Math.max(10, intervals[0]);
        const bodyPanels = intervals.slice(1);
        if (bodyPanels.length >= 4) {
          w = Math.round((bodyPanels[0] + bodyPanels[2]) / 2);
          l = Math.round((bodyPanels[1] + bodyPanels[3]) / 2);
        } else if (bodyPanels.length >= 2) {
          w = Math.round(bodyPanels[0]);
          l = Math.round(bodyPanels[1]);
        }
      }
    } else {
      g = 15;
      const netW = totalW - g;
      l = Math.round(netW * 0.30);
      w = Math.round((netW - 2 * l) / 2);
    }

    h = Math.round(totalH * 0.55);
    t_top = Math.max(12, Math.round((totalH - h - (2 * w)) / 2));
    t_bot = t_top;
    d = Math.round(w * 0.7);

    this.model.params = {
      length: Math.max(20, l),
      width: Math.max(15, w),
      height: Math.max(20, h),
      glueFlap: Math.max(8, g),
      topTuck: Math.max(10, t_top),
      bottomTuck: Math.max(10, t_bot),
      dustFlap: Math.max(8, d),
      lockNotch: 4,
      creaseGap: 2
    };

    // Store original coordinate anchors for piecewise deformation
    const minX = bounds.minX;
    const minY = bounds.minY;
    this.originalCoords = {
      x0: minX,
      x1: minX + g,
      x2: minX + g + w,
      x3: minX + g + w + l,
      x4: minX + g + w + l + w,
      x5: minX + g + w + l + w + l,
      y0: minY,
      y1: minY + t_top,
      y2: minY + t_top + w,
      y3: minY + t_top + w + h,
      y4: minY + t_top + w + h + w,
      y5: minY + t_top + w + h + w + t_bot
    };
  },

  /* ============================================================
     3. PIECEWISE PARAMETRIC DEFORMATION ON USER'S EXACT SVG
     Transforms coordinates of the imported SVG based on edited parameters
     ============================================================ */
  applyParametricDeformation() {
    if (!this.isCustomImport || this.originalImportedPaths.length === 0) {
      this.generateSyntheticSvgPaths();
      return;
    }

    const p = this.model.params;
    const origC = this.originalCoords;
    const origB = this.originalBounds;

    // Target new coordinates
    const newX0 = 0;
    const newX1 = p.glueFlap;
    const newX2 = p.glueFlap + p.width;
    const newX3 = p.glueFlap + p.width + p.length;
    const newX4 = p.glueFlap + p.width + p.length + p.width;
    const newX5 = p.glueFlap + p.width + p.length + p.width + p.length;

    const newY0 = 0;
    const newY1 = p.topTuck;
    const newY2 = p.topTuck + p.width;
    const newY3 = p.topTuck + p.width + p.height;
    const newY4 = p.topTuck + p.width + p.height + p.width;
    const newY5 = p.topTuck + p.width + p.height + p.width + p.bottomTuck;

    const newFlatW = newX5;
    const newFlatH = newY5;

    // Piecewise linear coordinate transform
    const transformX = (x) => {
      if (x <= origC.x1) {
        const ratio = (origC.x1 - origC.x0) > 0 ? (x - origC.x0) / (origC.x1 - origC.x0) : 0;
        return newX0 + ratio * (newX1 - newX0);
      } else if (x <= origC.x2) {
        const ratio = (origC.x2 - origC.x1) > 0 ? (x - origC.x1) / (origC.x2 - origC.x1) : 0;
        return newX1 + ratio * (newX2 - newX1);
      } else if (x <= origC.x3) {
        const ratio = (origC.x3 - origC.x2) > 0 ? (x - origC.x2) / (origC.x3 - origC.x2) : 0;
        return newX2 + ratio * (newX3 - newX2);
      } else if (x <= origC.x4) {
        const ratio = (origC.x4 - origC.x3) > 0 ? (x - origC.x3) / (origC.x4 - origC.x3) : 0;
        return newX3 + ratio * (newX4 - newX3);
      } else {
        const ratio = (origC.x5 - origC.x4) > 0 ? (x - origC.x4) / (origC.x5 - origC.x4) : 0;
        return newX4 + ratio * (newX5 - newX4);
      }
    };

    const transformY = (y) => {
      if (y <= origC.y1) {
        const ratio = (origC.y1 - origC.y0) > 0 ? (y - origC.y0) / (origC.y1 - origC.y0) : 0;
        return newY0 + ratio * (newY1 - newY0);
      } else if (y <= origC.y2) {
        const ratio = (origC.y2 - origC.y1) > 0 ? (y - origC.y1) / (origC.y2 - origC.y1) : 0;
        return newY1 + ratio * (newY2 - newY1);
      } else if (y <= origC.y3) {
        const ratio = (origC.y3 - origC.y2) > 0 ? (y - origC.y2) / (origC.y3 - origC.y2) : 0;
        return newY2 + ratio * (newY3 - newY2);
      } else if (y <= origC.y4) {
        const ratio = (origC.y4 - origC.y3) > 0 ? (y - origC.y3) / (origC.y4 - origC.y3) : 0;
        return newY3 + ratio * (newY4 - newY3);
      } else {
        const ratio = (origC.y5 - origC.y4) > 0 ? (y - origC.y4) / (origC.y5 - origC.y4) : 0;
        return newY4 + ratio * (newY5 - newY4);
      }
    };

    // Transform all original imported paths
    const transformedPaths = this.originalImportedPaths.map(pOrig => {
      const newD = this.transformSvgPathData(pOrig.d, transformX, transformY);
      return {
        id: pOrig.id,
        originalIndex: pOrig.originalIndex,
        d: newD,
        color: pOrig.color,
        stroke: pOrig.stroke,
        strokeDash: pOrig.strokeDash,
        strokeWidth: pOrig.strokeWidth,
        isCrease: pOrig.isCrease,
        type: pOrig.type,
        featureId: this.classifyFeatureIdFromCoords(pOrig.d, origC)
      };
    });

    this.model.segments = transformedPaths;
    this.model.coordinates = {
      x0: newX0, x1: newX1, x2: newX2, x3: newX3, x4: newX4, x5: newX5,
      y0: newY0, y1: newY1, y2: newY2, y3: newY3, y4: newY4, y5: newY5
    };

    this.updateCalculationsAndFormulas(newFlatW, newFlatH);
  },

  transformSvgPathData(d, transformX, transformY) {
    if (!d) return '';
    const commandRegex = /([a-df-z])([^a-df-z]*)/gi;
    let newD = '';
    let match;

    while ((match = commandRegex.exec(d)) !== null) {
      const cmd = match[1];
      const argsStr = match[2].trim();
      if (!argsStr) {
        newD += cmd + ' ';
        continue;
      }

      const nums = (argsStr.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
      const isRelative = (cmd === cmd.toLowerCase());
      const upperCmd = cmd.toUpperCase();

      if (upperCmd === 'H') {
        const newNums = nums.map(x => (isRelative ? x : transformX(x)).toFixed(2));
        newD += cmd + ' ' + newNums.join(' ') + ' ';
      } else if (upperCmd === 'V') {
        const newNums = nums.map(y => (isRelative ? y : transformY(y)).toFixed(2));
        newD += cmd + ' ' + newNums.join(' ') + ' ';
      } else if (upperCmd === 'M' || upperCmd === 'L' || upperCmd === 'T') {
        const newPairs = [];
        for (let i = 0; i < nums.length - 1; i += 2) {
          const nx = isRelative ? nums[i] : transformX(nums[i]);
          const ny = isRelative ? nums[i+1] : transformY(nums[i+1]);
          newPairs.push(`${nx.toFixed(2)} ${ny.toFixed(2)}`);
        }
        newD += cmd + ' ' + newPairs.join(' ') + ' ';
      } else if (upperCmd === 'C') {
        const newTriplets = [];
        for (let i = 0; i < nums.length - 5; i += 6) {
          const x1 = isRelative ? nums[i] : transformX(nums[i]);
          const y1 = isRelative ? nums[i+1] : transformY(nums[i+1]);
          const x2 = isRelative ? nums[i+2] : transformX(nums[i+2]);
          const y2 = isRelative ? nums[i+3] : transformY(nums[i+3]);
          const x3 = isRelative ? nums[i+4] : transformX(nums[i+4]);
          const y3 = isRelative ? nums[i+5] : transformY(nums[i+5]);
          newTriplets.push(`${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x3.toFixed(2)} ${y3.toFixed(2)}`);
        }
        newD += cmd + ' ' + newTriplets.join(' ') + ' ';
      } else if (upperCmd === 'S' || upperCmd === 'Q') {
        const newQuads = [];
        for (let i = 0; i < nums.length - 3; i += 4) {
          const x1 = isRelative ? nums[i] : transformX(nums[i]);
          const y1 = isRelative ? nums[i+1] : transformY(nums[i+1]);
          const x2 = isRelative ? nums[i+2] : transformX(nums[i+2]);
          const y2 = isRelative ? nums[i+3] : transformY(nums[i+3]);
          newQuads.push(`${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`);
        }
        newD += cmd + ' ' + newQuads.join(' ') + ' ';
      } else {
        newD += cmd + ' ' + argsStr + ' ';
      }
    }
    return newD.trim();
  },

  classifyFeatureIdFromCoords(d, origC) {
    const nums = (d.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
    if (nums.length < 2) return 'all';
    const avgX = (nums[0] + (nums[2] || nums[0])) / 2;
    const avgY = (nums[1] + (nums[3] || nums[1])) / 2;

    if (avgX <= origC.x1) return 'param_glue';
    if (avgY <= origC.y1) return 'param_top_tuck';
    if (avgY >= origC.y4) return 'param_bot_tuck';
    if ((avgX > origC.x1 && avgX <= origC.x2) || (avgX > origC.x3 && avgX <= origC.x4)) return 'param_width';
    return 'param_length';
  },

  /* ============================================================
     4. SYNTHETIC FALLBACK BLUEPRINT GENERATOR (WHEN NO SVG)
     ============================================================ */
  generateSyntheticSvgPaths() {
    const p = this.model.params;
    const L = Number(p.length);
    const W = Number(p.width);
    const H = Number(p.height);
    const G = Number(p.glueFlap);
    const T_top = Number(p.topTuck);
    const T_bot = Number(p.bottomTuck);
    const D = Number(p.dustFlap);

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

    let outerCutD = `M ${x1} ${y2} `;
    outerCutD += `L ${x0 + 3} ${y2 + 4} L ${x0} ${y2 + 10} L ${x0} ${y3 - 10} L ${x0 + 3} ${y3 - 4} L ${x1} ${y3} `;
    outerCutD += `L ${x1 + 3} ${y3 + D} L ${x2 - 5} ${y3 + D} L ${x2} ${y3} `;
    outerCutD += `L ${x2} ${y4} L ${x2 + 8} ${y5} L ${x3 - 8} ${y5} L ${x3} ${y4} L ${x3} ${y3} `;
    outerCutD += `L ${x3 + 5} ${y3 + D} L ${x4 - 3} ${y3 + D} L ${x4} ${y3} `;
    outerCutD += `L ${x4} ${y3 + W * 0.6} L ${x5} ${y3 + W * 0.6} L ${x5} ${y3} `;
    outerCutD += `L ${x5} ${y2} `;
    outerCutD += `L ${x5} ${y2 - W * 0.6} L ${x4} ${y2 - W * 0.6} L ${x4} ${y2} `;
    outerCutD += `L ${x4 - 3} ${y2 - D} L ${x3 + 5} ${y2 - D} L ${x3} ${y2} `;
    outerCutD += `L ${x3} ${y1} L ${x3 - 8} ${y0} L ${x2 + 8} ${y0} L ${x2} ${y1} L ${x2} ${y2} `;
    outerCutD += `L ${x2 - 5} ${y2 - D} L ${x1 + 3} ${y2 - D} L ${x1} ${y2} Z`;

    const paths = [
      { id: 'outer_cut', featureId: 'all', type: 'cut', color: '#DC2626', strokeWidth: 2.0, isCrease: false, d: outerCutD },
      { id: 'crease_h_top', featureId: 'param_height', type: 'crease', color: '#2563EB', strokeWidth: 1.5, isCrease: true, d: `M ${x1} ${y2} H ${x5}` },
      { id: 'crease_h_bot', featureId: 'param_height', type: 'crease', color: '#2563EB', strokeWidth: 1.5, isCrease: true, d: `M ${x1} ${y3} H ${x5}` },
      { id: 'crease_v_glue', featureId: 'param_glue', type: 'crease', color: '#059669', strokeWidth: 1.5, isCrease: true, d: `M ${x1} ${y2} V ${y3}` },
      { id: 'crease_v_w1', featureId: 'param_width', type: 'crease', color: '#2563EB', strokeWidth: 1.5, isCrease: true, d: `M ${x2} ${y2} V ${y3}` },
      { id: 'crease_v_l1', featureId: 'param_length', type: 'crease', color: '#2563EB', strokeWidth: 1.5, isCrease: true, d: `M ${x3} ${y2} V ${y3}` },
      { id: 'crease_v_w2', featureId: 'param_width', type: 'crease', color: '#2563EB', strokeWidth: 1.5, isCrease: true, d: `M ${x4} ${y2} V ${y3}` },
      { id: 'crease_t_top', featureId: 'param_top_tuck', type: 'crease', color: '#F59E0B', strokeWidth: 1.5, isCrease: true, d: `M ${x2} ${y1} H ${x3}` },
      { id: 'crease_t_bot', featureId: 'param_bot_tuck', type: 'crease', color: '#D97706', strokeWidth: 1.5, isCrease: true, d: `M ${x2} ${y4} H ${x3}` }
    ];

    this.model.segments = paths;
    this.model.coordinates = { x0, x1, x2, x3, x4, x5, y0, y1, y2, y3, y4, y5 };

    const flatWidth = x5;
    const flatHeight = y5;
    this.updateCalculationsAndFormulas(flatWidth, flatHeight);
  },

  updateCalculationsAndFormulas(flatWidth, flatHeight) {
    const p = this.model.params;
    const L = p.length;
    const W = p.width;
    const H = p.height;
    const G = p.glueFlap;
    const T_top = p.topTuck;
    const T_bot = p.bottomTuck;
    const D = p.dustFlap;

    this.model.calculated = {
      boxDimensions: { l: L, w: W, h: H },
      flatDimensions: { width: Math.round(flatWidth), height: Math.round(flatHeight) },
      totalBladeLengthMm: Math.round((2 * flatWidth + 2 * flatHeight) + (4 * D) + (2 * T_top) + (2 * T_bot) + G),
      totalCreaseLengthMm: Math.round((4 * H) + (2 * flatWidth)),
      areaCm2: parseFloat(((flatWidth * flatHeight) / 100).toFixed(1))
    };

    this.model.features = [
      { id: 'param_length', key: 'length', name: 'طول بدنه (L - Length)', value: L, unit: 'mm', formula: 'L', instances: 2, description: 'عرض دیواره‌های رو و پشت', color: '#3B82F6' },
      { id: 'param_width', key: 'width', name: 'عرض پهلو (W - Width)', value: W, unit: 'mm', formula: 'W', instances: 2, description: 'عرض دیواره‌های پهلوی چپ و راست', color: '#6366F1' },
      { id: 'param_height', key: 'height', name: 'ارتفاع بدنه (H - Height)', value: H, unit: 'mm', formula: 'H', instances: 4, description: 'ارتفاع عمودی خط تا', color: '#8B5CF6' },
      { id: 'param_glue', key: 'glueFlap', name: 'لبه چسب (G - Glue Flap)', value: G, unit: 'mm', formula: 'G', instances: 1, description: 'نوار چسب‌خوری اتصال', color: '#10B981' },
      { id: 'param_top_tuck', key: 'topTuck', name: 'زبانه درپوش بالا (Top Tuck)', value: T_top, unit: 'mm', formula: 'T_{top}', instances: 1, description: 'زبانه قفل‌شونده درب بالا', color: '#F59E0B' },
      { id: 'param_bot_tuck', key: 'bottomTuck', name: 'زبانه درپوش پایین (Bottom Tuck)', value: T_bot, unit: 'mm', formula: 'T_{bot}', instances: 1, description: 'زبانه قفل‌شونده درب کف', color: '#D97706' },
      { id: 'param_dust', key: 'dustFlap', name: 'گوشواره‌ها (Dust Flaps)', value: D, unit: 'mm', formula: 'D', instances: 4, description: '۴ گوشواره گردگیر جانبی', color: '#EC4899' }
    ];

    this.model.formulas = [
      {
        title: 'فرمول عرض کل گسترده (Total Flat Width)',
        latex: 'W_{flat} = G + 2W + 2L',
        substituted: `${G} + (2 × ${W}) + (2 × ${L}) = ${Math.round(flatWidth)} \\text{ mm}`,
        result: Math.round(flatWidth),
        unit: 'mm'
      },
      {
        title: 'فرمول ارتفاع کل گسترده (Total Flat Height)',
        latex: 'H_{flat} = H + 2W + T_{top} + T_{bot}',
        substituted: `${H} + (2 × ${W}) + ${T_top} + ${T_bot} = ${Math.round(flatHeight)} \\text{ mm}`,
        result: Math.round(flatHeight),
        unit: 'mm'
      },
      {
        title: 'مساحت کل مقوای مصرفی',
        latex: 'A = W_{flat} \\times H_{flat} / 100',
        substituted: `${Math.round(flatWidth)} \\times ${Math.round(flatHeight)} / 100 = ${this.model.calculated.areaCm2} \\text{ cm}^2`,
        result: this.model.calculated.areaCm2,
        unit: 'cm²'
      }
    ];

    this.syncWithGlobalLemonPack();
  },

  synthesizeModelFromParams() {
    if (this.isCustomImport && this.originalImportedPaths.length > 0) {
      this.applyParametricDeformation();
    } else {
      this.generateSyntheticSvgPaths();
    }
  },

  /* ============================================================
     5. INTERACTIVE DIRECT CANVAS DRAGGING & TOUCH
     ============================================================ */
  setupCanvasInteractions() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        this.handleCanvasMouseDown({ clientX: t.clientX, clientY: t.clientY, currentTarget: canvas });
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.activeDrag && e.touches.length === 1) {
        const t = e.touches[0];
        this.handleCanvasMouseMove({ clientX: t.clientX, clientY: t.clientY });
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => this.handleCanvasMouseUp(e));

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.zoomLevel = Math.max(0.4, Math.min(3.5, this.zoomLevel * zoomFactor));
      this.render();
    }, { passive: false });
  },

  getCanvasMousePos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  },

  getInteractiveHandles() {
    const coords = this.model.coordinates;
    if (!coords) return [];

    const p = this.model.params;
    const flat = this.model.calculated.flatDimensions;
    const w = this.canvasBounds.width;
    const h = this.canvasBounds.height;
    const padding = 50;
    const scale = Math.min((w - padding * 2) / flat.width, (h - padding * 2) / flat.height) * this.zoomLevel;
    this.renderScale = scale;

    const toScreen = (mmX, mmY) => {
      return {
        x: (w / 2 + this.panOffset.x) + (mmX - flat.width / 2) * scale,
        y: (h / 2 + this.panOffset.y) + (mmY - flat.height / 2) * scale
      };
    };

    const yMid = (coords.y2 + coords.y3) / 2;
    const xMid = (coords.x2 + coords.x3) / 2;

    return [
      { key: 'glueFlap', featureId: 'param_glue', pos: toScreen(coords.x0, yMid), type: 'ew-resize', label: `لبه چسب: ${p.glueFlap} mm`, dir: 'x', invert: true },
      { key: 'width', featureId: 'param_width', pos: toScreen(coords.x2, yMid), type: 'ew-resize', label: `عرض پهلو: ${p.width} mm`, dir: 'x', invert: false },
      { key: 'length', featureId: 'param_length', pos: toScreen(coords.x3, yMid), type: 'ew-resize', label: `طول بدنه: ${p.length} mm`, dir: 'x', invert: false },
      { key: 'height', featureId: 'param_height', pos: toScreen(xMid, coords.y3), type: 'ns-resize', label: `ارتفاع بدنه: ${p.height} mm`, dir: 'y', invert: false },
      { key: 'topTuck', featureId: 'param_top_tuck', pos: toScreen(xMid, coords.y0), type: 'ns-resize', label: `زبانه درپوش: ${p.topTuck} mm`, dir: 'y', invert: true },
      { key: 'dustFlap', featureId: 'param_dust', pos: toScreen(coords.x1 + p.width / 2, coords.y2 - p.dustFlap), type: 'ns-resize', label: `گوشواره: ${p.dustFlap} mm`, dir: 'y', invert: true }
    ];
  },

  handleCanvasMouseDown(e) {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas) return;
    const pos = this.getCanvasMousePos(e, canvas);

    const handles = this.getInteractiveHandles();
    const hitRadius = 22;

    const hit = handles.find(h => {
      const dx = h.pos.x - pos.x;
      const dy = h.pos.y - pos.y;
      return (dx * dx + dy * dy) <= (hitRadius * hitRadius);
    });

    if (hit) {
      this.activeDrag = {
        handle: hit,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origVal: this.model.params[hit.key]
      };
      this.selectedFeatureId = hit.featureId;
      this.render();
      if (window.SoundEngine) window.SoundEngine.playClick();
    } else {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
    }
  },

  handleCanvasMouseMove(e) {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas) return;

    if (this.activeDrag) {
      const drag = this.activeDrag;
      const scale = this.renderScale || 1.0;
      let deltaPx = 0;

      if (drag.handle.dir === 'x') {
        deltaPx = (e.clientX - drag.startMouseX);
        if (drag.handle.invert) deltaPx = -deltaPx;
      } else {
        deltaPx = (e.clientY - drag.startMouseY);
        if (drag.handle.invert) deltaPx = -deltaPx;
      }

      const deltaMm = Math.round(deltaPx / scale);
      const newVal = Math.max(5, drag.origVal + deltaMm);

      this.model.params[drag.handle.key] = newVal;
      this.synthesizeModelFromParams();
      this.render();
      canvas.style.cursor = drag.handle.type;
      return;
    }

    if (this.isPanning) {
      this.panOffset.x = e.clientX - this.panStart.x;
      this.panOffset.y = e.clientY - this.panStart.y;
      this.render();
      canvas.style.cursor = 'grab';
      return;
    }

    const pos = this.getCanvasMousePos(e, canvas);
    const handles = this.getInteractiveHandles();
    const hitRadius = 20;

    const hit = handles.find(h => {
      const dx = h.pos.x - pos.x;
      const dy = h.pos.y - pos.y;
      return (dx * dx + dy * dy) <= (hitRadius * hitRadius);
    });

    if (hit) {
      this.hoveredHandle = hit.key;
      this.hoveredFeatureId = hit.featureId;
      canvas.style.cursor = hit.type;
    } else {
      this.hoveredHandle = null;
      this.hoveredFeatureId = null;
      canvas.style.cursor = 'default';
    }
    this.renderCanvas();
  },

  handleCanvasMouseUp() {
    if (this.activeDrag) {
      this.activeDrag = null;
      if (window.App && window.App.recalculate) window.App.recalculate();
    }
    this.isPanning = false;
  },

  stepParam(key, delta) {
    const current = Number(this.model.params[key]) || 0;
    const newVal = Math.max(5, current + delta);
    this.model.params[key] = newVal;
    this.synthesizeModelFromParams();
    this.render();
    if (window.App && window.App.recalculate) window.App.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  resetView() {
    this.zoomLevel = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.render();
  },

  /* ============================================================
     6. RENDERING CANVAS WITH DIRECT IMPORTED SVG PATHS
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

  renderCanvas() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    this.canvasBounds = { width: w, height: h };
    ctx.clearRect(0, 0, w, h);

    // Dark sleek blueprint background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, w, h);

    // CAD Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 25;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const flat = this.model.calculated.flatDimensions;
    const padding = 50;
    const scale = Math.min((w - padding * 2) / flat.width, (h - padding * 2) / flat.height) * this.zoomLevel;
    this.renderScale = scale;

    ctx.save();
    ctx.translate(w / 2 + this.panOffset.x, h / 2 + this.panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-flat.width / 2, -flat.height / 2);

    // 1. Draw Panel Highlights if hovered or selected
    if (this.selectedFeatureId || this.hoveredFeatureId) {
      const activeF = this.selectedFeatureId || this.hoveredFeatureId;
      const coords = this.model.coordinates;
      if (coords) {
        ctx.save();
        if (activeF === 'param_glue') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
          ctx.fillRect(coords.x0, coords.y2, coords.x1 - coords.x0, coords.y3 - coords.y2);
        } else if (activeF === 'param_width') {
          ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
          ctx.fillRect(coords.x1, coords.y2, coords.x2 - coords.x1, coords.y3 - coords.y2);
          ctx.fillRect(coords.x3, coords.y2, coords.x4 - coords.x3, coords.y3 - coords.y2);
        } else if (activeF === 'param_length') {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
          ctx.fillRect(coords.x2, coords.y2, coords.x3 - coords.x2, coords.y3 - coords.y2);
          ctx.fillRect(coords.x4, coords.y2, coords.x5 - coords.x4, coords.y3 - coords.y2);
        } else if (activeF === 'param_height') {
          ctx.fillStyle = 'rgba(139, 92, 246, 0.18)';
          ctx.fillRect(coords.x1, coords.y2, coords.x5 - coords.x1, coords.y3 - coords.y2);
        } else if (activeF === 'param_top_tuck') {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
          ctx.fillRect(coords.x2, coords.y0, coords.x3 - coords.x2, coords.y1 - coords.y0);
        }
        ctx.restore();
      }
    }

    // 2. Render all actual vector paths from the user's file!
    this.model.segments.forEach(seg => {
      ctx.save();
      const isSelected = this.selectedFeatureId && (seg.featureId === this.selectedFeatureId || this.selectedFeatureId === 'all');
      const isHovered = this.hoveredFeatureId && seg.featureId === this.hoveredFeatureId;

      if (isSelected || isHovered) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3.2 / scale;
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = seg.color || seg.stroke || '#DC2626';
        ctx.lineWidth = (seg.strokeWidth || 1.5) / scale;
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

    ctx.restore();

    // 3. Render Direct On-Canvas Drag Handles
    this.renderOnCanvasHandles(ctx);
  },

  renderOnCanvasHandles(ctx) {
    const handles = this.getInteractiveHandles();
    const pUtils = window.PersianUtils || { e2p: v => v };

    handles.forEach(h => {
      const isHovered = this.hoveredHandle === h.key || this.hoveredFeatureId === h.featureId;
      const isSelected = this.selectedFeatureId === h.featureId;
      const r = isHovered || isSelected ? 11 : 8;

      ctx.save();
      ctx.fillStyle = isSelected ? '#F59E0B' : isHovered ? '#FFFFFF' : '#38BDF8';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = isSelected ? '#F59E0B' : 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = isSelected ? 12 : 6;

      ctx.beginPath();
      ctx.arc(h.pos.x, h.pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const labelText = pUtils.e2p(h.label);
      ctx.font = `bold ${isHovered || isSelected ? 12 : 11}px 'Peyda', sans-serif`;
      const metrics = ctx.measureText(labelText);
      const pillW = metrics.width + 16;
      const pillH = 22;
      const pillY = h.pos.y + (h.dir === 'y' ? 18 : -18);

      ctx.fillStyle = isSelected ? '#F59E0B' : '#1E293B';
      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(h.pos.x - pillW / 2, pillY - pillH / 2, pillW, pillH, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#000000' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, h.pos.x, pillY);

      ctx.restore();
    });
  },

  /* ============================================================
     7. PARAMETER TABLE & FORMULA CARDS
     ============================================================ */
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
            style="cursor:pointer; transition:all 0.15s; ${isSelected ? 'background:rgba(217, 119, 6, 0.15);' : ''}">
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="display:inline-block; width:12px; height:12px; border-radius:3px; background:${f.color};"></span>
              <div>
                <strong style="font-size:0.84rem;">${f.name}</strong>
                <div style="font-size:0.7rem; color:var(--text-muted);">${f.description}</div>
              </div>
            </div>
          </td>
          <td class="tabular-nums" style="font-family:monospace; direction:ltr; font-weight:800; color:var(--brand-primary); font-size:0.9rem;">
            ${f.formula}
          </td>
          <td onclick="event.stopPropagation()">
            <div style="display:flex; align-items:center; gap:4px;">
              <button class="btn btn-outline btn-sm" style="padding:2px 8px; font-weight:900; height:28px;" onclick="ParametricDieEngine.stepParam('${f.key}', -5)" title="-5 mm">-5</button>
              <button class="btn btn-outline btn-sm" style="padding:2px 6px; font-weight:900; height:28px;" onclick="ParametricDieEngine.stepParam('${f.key}', -1)" title="-1 mm">-</button>
              <input type="number" step="1" class="input-box" style="width:65px; height:28px; text-align:center; font-weight:900; font-size:0.88rem; padding:0 4px;"
                     value="${f.value}"
                     oninput="ParametricDieEngine.updateParam('${f.key}', this.value)">
              <button class="btn btn-outline btn-sm" style="padding:2px 6px; font-weight:900; height:28px;" onclick="ParametricDieEngine.stepParam('${f.key}', 1)" title="+1 mm">+</button>
              <button class="btn btn-outline btn-sm" style="padding:2px 8px; font-weight:900; height:28px;" onclick="ParametricDieEngine.stepParam('${f.key}', 5)" title="+5 mm">+5</button>
            </div>
          </td>
          <td class="tabular-nums" style="text-align:center;">
            <span class="badge" style="background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">
              ${pUtils.e2p(f.instances)} خط متناظر
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

  updateParam(key, value) {
    const num = Math.max(1, parseFloat(value) || 0);
    this.model.params[key] = num;
    this.synthesizeModelFromParams();
    this.render();
    if (window.App && window.App.recalculate) window.App.recalculate();
  },

  selectFeature(featureId) {
    this.selectedFeatureId = (this.selectedFeatureId === featureId) ? null : featureId;
    this.render();
  },

  hoverFeature(featureId) {
    this.hoveredFeatureId = featureId;
    this.renderCanvas();
  },

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

    cad.customDie = {
      active: true,
      widthMm: cad.flatL,
      heightMm: cad.flatW,
      paths: this.model.segments.map(s => ({
        id: s.id,
        d: s.d,
        originalStroke: s.color || s.stroke,
        strokeDash: s.isCrease ? '4,3' : '',
        type: s.type,
        visible: true
      })),
      bounds: {
        minX: 0, minY: 0, maxX: cad.flatL, maxY: cad.flatW, width: cad.flatL, height: cad.flatW
      }
    };

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

  loadTemplate(modelType) {
    this.isCustomImport = false;
    if (modelType === 'tuck_end') {
      this.model.name = 'جعبه دارویی Tuck-End';
      this.model.type = 'tuck_end';
      this.model.params = { length: 120, width: 80, height: 150, glueFlap: 15, topTuck: 18, bottomTuck: 18, dustFlap: 15, lockNotch: 4, creaseGap: 2 };
    } else if (modelType === 'mailer_0427') {
      this.model.name = 'جعبه کیبوردی استانداردی 0427';
      this.model.type = 'mailer_0427';
      this.model.params = { length: 200, width: 150, height: 60, glueFlap: 0, topTuck: 22, bottomTuck: 22, dustFlap: 25, lockNotch: 6, creaseGap: 2 };
    } else if (modelType === 'lock_bottom') {
      this.model.name = 'جعبه ته‌قفلی خودکار';
      this.model.type = 'lock_bottom';
      this.model.params = { length: 140, width: 90, height: 180, glueFlap: 16, topTuck: 18, bottomTuck: 25, dustFlap: 16, lockNotch: 4, creaseGap: 2 };
    }
    this.synthesizeModelFromParams();
    this.render();
    if (window.toast) window.toast(`قالب «${this.model.name}» بارگذاری شد ✓`);
  },

  exportCleanSvg() {
    const flat = this.model.calculated.flatDimensions;
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${flat.width} ${flat.height}" width="${flat.width}mm" height="${flat.height}mm">\n`;
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
    if (window.toast) window.toast('فایل SVG با موفقیت دانلود شد ✓');
  }
};
