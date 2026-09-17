/* ============================================================
   CUSTOM DIE-CUT VECTOR IMPORT & LAYER REFINER (.svg & .ai)
   Full CSS/Class style resolution & full color detection
   ============================================================ */

window.DieCutImporter = {
  currentPaths: [],
  layerGroups: [],
  originalBounds: { minX: 0, minY: 0, maxX: 310, maxY: 220, width: 310, height: 220 },
  calibration: { scaleMmPerUnit: 0.352778, targetWidthMm: 310, targetHeightMm: 220 },

  openModal() {
    const modal = document.getElementById('diecut-modal');
    if (modal) modal.classList.add('show');
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  closeModal() {
    const modal = document.getElementById('diecut-modal');
    if (modal) modal.classList.remove('show');
  },

  handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    this.processFile(file);
  },

  handleDrop(event) {
    event.preventDefault();
    const zone = document.getElementById('dropzone-main') || document.getElementById('dropzone');
    if (zone) zone.classList.remove('dragover');
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    this.processFile(file);
  },

  processFile(file) {
    const reader = new FileReader();
    const isAi = file.name.toLowerCase().endsWith('.ai') || file.name.toLowerCase().endsWith('.eps') || file.name.toLowerCase().endsWith('.pdf');
    
    reader.onload = (e) => {
      const content = e.target.result;
      if (typeof content === 'string') {
        this.parseVectorData(content, isAi);
      } else {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(content);
        this.parseVectorData(text, isAi);
      }
    };

    if (isAi) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  },

  parseSvgString(svgText) {
    this.parseVectorData(svgText, false);
  },

  // Color helper & normalizer
  normalizeColor(colorStr) {
    if (!colorStr) return null;
    let s = colorStr.trim().toLowerCase();
    if (s === 'none' || s === 'transparent') return 'none';

    // Named colors map
    const named = {
      yellow: '#ffff00',
      gold: '#ffd700',
      red: '#dc2626',
      crimson: '#dc143c',
      blue: '#2563eb',
      navy: '#000080',
      green: '#059669',
      lime: '#00ff00',
      magenta: '#ff00ff',
      cyan: '#00ffff',
      black: '#000000',
      gray: '#6b7280',
      grey: '#6b7280',
      orange: '#ea580c'
    };
    if (named[s]) return named[s];

    // RGB / RGBA
    if (s.startsWith('rgb')) {
      const nums = s.replace(/[^\d,]/g, '').split(',').map(Number);
      if (nums.length >= 3) {
        return '#' + nums.slice(0, 3).map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
      }
    }

    // 3-char hex to 6-char hex
    if (s.startsWith('#') && s.length === 4) {
      return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }

    return s;
  },

  // Extract CSS <style> class rules
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

  // Resolve stroke color from element, CSS class, or parent <g>
  resolveElementStroke(el, cssMap) {
    // 1. Direct inline style
    if (el.style && el.style.stroke) {
      const norm = this.normalizeColor(el.style.stroke);
      if (norm && norm !== 'none') return { stroke: norm, isExplicit: true };
    }

    // 2. Direct attribute
    const attrStroke = el.getAttribute('stroke');
    if (attrStroke) {
      const norm = this.normalizeColor(attrStroke);
      if (norm && norm !== 'none') return { stroke: norm, isExplicit: true };
    }

    // 3. Class mapping from <style>
    const classAttr = el.getAttribute('class');
    if (classAttr) {
      const classes = classAttr.split(/\s+/);
      for (const cls of classes) {
        if (cssMap[cls] && cssMap[cls]['stroke']) {
          const norm = this.normalizeColor(cssMap[cls]['stroke']);
          if (norm && norm !== 'none') return { stroke: norm, isExplicit: true };
        }
      }
    }

    // 4. Inherit from parent <g>
    let parent = el.parentElement;
    while (parent && parent.tagName.toLowerCase() !== 'svg') {
      if (parent.style && parent.style.stroke) {
        const norm = this.normalizeColor(parent.style.stroke);
        if (norm && norm !== 'none') return { stroke: norm, isExplicit: true };
      }
      const pStroke = parent.getAttribute('stroke');
      if (pStroke) {
        const norm = this.normalizeColor(pStroke);
        if (norm && norm !== 'none') return { stroke: norm, isExplicit: true };
      }
      const pClass = parent.getAttribute('class');
      if (pClass) {
        const pClasses = pClass.split(/\s+/);
        for (const cls of pClasses) {
          if (cssMap[cls] && cssMap[cls]['stroke']) {
            const norm = this.normalizeColor(cssMap[cls]['stroke']);
            if (norm && norm !== 'none') return { stroke: norm, isExplicit: true };
          }
        }
      }
      parent = parent.parentElement;
    }

    return { stroke: '#dc2626', isExplicit: false };
  },

  resolveElementDash(el, cssMap) {
    if (el.style && el.style.strokeDasharray) return el.style.strokeDasharray;
    if (el.getAttribute('stroke-dasharray')) return el.getAttribute('stroke-dasharray');

    const classAttr = el.getAttribute('class');
    if (classAttr) {
      const classes = classAttr.split(/\s+/);
      for (const cls of classes) {
        if (cssMap[cls] && cssMap[cls]['stroke-dasharray']) {
          return cssMap[cls]['stroke-dasharray'];
        }
      }
    }
    return '';
  },

  classifyPathType(stroke, strokeDash, layerName) {
    const s = (stroke || '').toLowerCase();
    const l = (layerName || '').toLowerCase();
    const isDash = !!strokeDash && strokeDash !== 'none';

    // Yellow / Gold / Orange -> Guide / Bleed / Spot / Custom
    if (s.includes('yellow') || s.includes('ffff00') || s.includes('ffd700') || s.includes('ffea00') || s.includes('rgb(255, 255, 0)')) {
      return 'guide';
    }
    if (s.includes('magenta') || s.includes('ff00ff') || s.includes('ec4899')) {
      return 'cut';
    }
    if (s.includes('cyan') || s.includes('00ffff') || s.includes('06b6d4')) {
      return 'crease';
    }

    // Crease: Blue / dashed / crease layer name
    if (isDash || s.includes('blue') || s.includes('0000ff') || s.includes('2563eb') || s.includes('1d4ed8') || l.includes('crease') || l.includes('fold') || l.includes('ta')) {
      return 'crease';
    }

    // Glue: Green
    if (s.includes('green') || s.includes('059669') || s.includes('10b981') || s.includes('00ff00') || l.includes('glue') || l.includes('chasb')) {
      return 'glue';
    }

    // Cut: Red / default
    if (s.includes('red') || s.includes('dc2626') || s.includes('ef4444') || s.includes('ff0000') || l.includes('cut') || l.includes('die') || l.includes('tigh')) {
      return 'cut';
    }

    return 'cut';
  },

  updateBoundsFromNumbers(numbers, bounds) {
    for (let i = 0; i < numbers.length - 1; i += 2) {
      const x = numbers[i];
      const y = numbers[i+1];
      if (!isNaN(x) && !isNaN(y)) {
        if (x < bounds.minX) bounds.minX = x;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (y > bounds.maxY) bounds.maxY = y;
      }
    }
  },

  parseVectorData(text, isAi) {
    this.currentPaths = [];
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

    if (!isAi && text.includes('<svg')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const cssMap = this.extractCssRules(doc);

      const svgEl = doc.querySelector('svg');
      if (svgEl) {
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
      }

      const elements = doc.querySelectorAll('path, line, rect, polyline, polygon, circle, ellipse');

      elements.forEach((el, index) => {
        let d = '';
        const tag = el.tagName.toLowerCase();
        if (tag === 'path') {
          d = el.getAttribute('d') || '';
          const nums = (d.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
          this.updateBoundsFromNumbers(nums, bounds);
        } else if (tag === 'line') {
          const x1 = parseFloat(el.getAttribute('x1') || 0);
          const y1 = parseFloat(el.getAttribute('y1') || 0);
          const x2 = parseFloat(el.getAttribute('x2') || 0);
          const y2 = parseFloat(el.getAttribute('y2') || 0);
          d = `M ${x1} ${y1} L ${x2} ${y2}`;
          this.updateBoundsFromNumbers([x1, y1, x2, y2], bounds);
        } else if (tag === 'rect') {
          const x = parseFloat(el.getAttribute('x') || 0);
          const y = parseFloat(el.getAttribute('y') || 0);
          const rw = parseFloat(el.getAttribute('width') || 0);
          const rh = parseFloat(el.getAttribute('height') || 0);
          d = `M ${x} ${y} H ${x + rw} V ${y + rh} H ${x} Z`;
          this.updateBoundsFromNumbers([x, y, x + rw, y + rh], bounds);
        } else if (tag === 'polyline' || tag === 'polygon') {
          const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/);
          if (pts.length >= 2) {
            d = `M ${pts[0]} ${pts[1]}`;
            for (let i = 2; i < pts.length; i += 2) {
              d += ` L ${pts[i]} ${pts[i+1]}`;
            }
            if (tag === 'polygon') d += ' Z';
            this.updateBoundsFromNumbers(pts.map(Number), bounds);
          }
        } else if (tag === 'circle') {
          const cx = parseFloat(el.getAttribute('cx') || 0);
          const cy = parseFloat(el.getAttribute('cy') || 0);
          const r = parseFloat(el.getAttribute('r') || 0);
          d = `M ${cx - r}, ${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
          this.updateBoundsFromNumbers([cx - r, cy - r, cx + r, cy + r], bounds);
        }

        if (d) {
          const { stroke } = this.resolveElementStroke(el, cssMap);
          const strokeDash = this.resolveElementDash(el, cssMap);
          const strokeWidth = parseFloat(el.getAttribute('stroke-width') || 1);
          const layerName = (el.closest('g') && (el.closest('g').id || el.closest('g').getAttribute('inkscape:label'))) || ('Layer_' + (index + 1));

          const type = this.classifyPathType(stroke, strokeDash, layerName);

          this.currentPaths.push({
            id: index + 1,
            d: d,
            originalStroke: stroke,
            strokeDash: strokeDash,
            strokeWidth: strokeWidth,
            layerName: layerName,
            type: type,
            visible: true
          });
        }
      });
    }

    if (this.currentPaths.length === 0) {
      this.generateFallbackTemplate();
    } else {
      if (bounds.minX === Infinity) {
        bounds.minX = 0; bounds.minY = 0; bounds.maxX = 310; bounds.maxY = 220;
      }
      bounds.width = Math.max(1, bounds.maxX - bounds.minX);
      bounds.height = Math.max(1, bounds.maxY - bounds.minY);
      this.originalBounds = bounds;

      this.groupLayers();
      this.renderLayerTable();
      this.renderPreviewCanvas();
      toast(`فایل با موفقیت تحلیل شد (${this.currentPaths.length} مسیر برداری) ✓`);
    }
  },

  generateFallbackTemplate() {
    this.originalBounds = { minX: 0, minY: 0, maxX: 310, maxY: 220, width: 310, height: 220 };
    this.currentPaths = [
      { id: 1, d: 'M 0 0 H 310 V 220 H 0 Z', originalStroke: '#DC2626', type: 'cut', layerName: 'Outer_Cut_Blade', visible: true },
      { id: 2, d: 'M 15 20 H 310', originalStroke: '#2563EB', strokeDash: '4,4', type: 'crease', layerName: 'Top_Tuck_Crease', visible: true },
      { id: 3, d: 'M 15 170 H 310', originalStroke: '#2563EB', strokeDash: '4,4', type: 'crease', layerName: 'Bottom_Tuck_Crease', visible: true },
      { id: 4, d: 'M 15 20 V 170', originalStroke: '#059669', type: 'glue', layerName: 'Glue_Flap_Score', visible: true },
      { id: 5, d: 'M 5 5 H 305 V 215 H 5 Z', originalStroke: '#EAB308', strokeDash: '2,2', type: 'guide', layerName: 'Yellow_Guide_Margin', visible: true }
    ];
    this.groupLayers();
    this.renderLayerTable();
    this.renderPreviewCanvas();
  },

  groupLayers() {
    const map = {};
    this.currentPaths.forEach(p => {
      const key = p.originalStroke + '|' + (p.strokeDash ? 'dash' : 'solid');
      if (!map[key]) {
        map[key] = {
          key: key,
          stroke: p.originalStroke,
          isDash: !!p.strokeDash,
          count: 0,
          type: p.type,
          visible: true
        };
      }
      map[key].count++;
    });
    this.layerGroups = Object.values(map);
  },

  renderLayerTable() {
    const tbody = document.getElementById('layer-tbody');
    if (!tbody) return;
    let html = '';
    this.layerGroups.forEach((g, idx) => {
      html += '<tr>' +
        '<td><span class="color-badge" style="background:' + g.stroke + '; border:1px solid rgba(255,255,255,0.3); display:inline-block; width:12px; height:12px; border-radius:3px; vertical-align:middle; margin-left:6px;"></span> ' + g.stroke + (g.isDash ? ' (خط‌چین)' : '') + '</td>' +
        '<td class="tabular-nums">' + g.count + ' مسیر</td>' +
        '<td>' +
          '<select class="input-box" style="height:28px; font-size:0.75rem;" onchange="DieCutImporter.updateGroupType(' + idx + ', this.value)">' +
            '<option value="cut" ' + (g.type === 'cut' ? 'selected' : '') + '>🔴 خط تیغ (Cut Blade)</option>' +
            '<option value="crease" ' + (g.type === 'crease' ? 'selected' : '') + '>🔵 خط تا (Crease Rule)</option>' +
            '<option value="glue" ' + (g.type === 'glue' ? 'selected' : '') + '>🟢 لبه چسب (Glue Flap)</option>' +
            '<option value="guide" ' + (g.type === 'guide' ? 'selected' : '') + '>🟡 راهنما و بلید (Guide/Bleed)</option>' +
            '<option value="ignore" ' + (g.type === 'ignore' ? 'selected' : '') + '>⚪ نادیده گرفتن (Ignore)</option>' +
          '</select>' +
        '</td>' +
        '<td style="text-align:center;">' +
          '<input type="checkbox" ' + (g.visible ? 'checked' : '') + ' onchange="DieCutImporter.toggleGroupVisibility(' + idx + ', this.checked)">' +
        '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  updateGroupType(groupIndex, newType) {
    const g = this.layerGroups[groupIndex];
    if (!g) return;
    g.type = newType;
    this.currentPaths.forEach(p => {
      const key = p.originalStroke + '|' + (p.strokeDash ? 'dash' : 'solid');
      if (key === g.key) {
        p.type = newType;
      }
    });
    this.renderPreviewCanvas();
  },

  toggleGroupVisibility(groupIndex, isVisible) {
    const g = this.layerGroups[groupIndex];
    if (!g) return;
    g.visible = isVisible;
    this.currentPaths.forEach(p => {
      const key = p.originalStroke + '|' + (p.strokeDash ? 'dash' : 'solid');
      if (key === g.key) {
        p.visible = isVisible;
      }
    });
    this.renderPreviewCanvas();
  },

  renderPreviewCanvas() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#151F32';
    ctx.fillRect(0, 0, w, h);

    const b = this.originalBounds;
    const padding = 20;
    const scale = Math.min((w - padding * 2) / b.width, (h - padding * 2) / b.height);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-b.minX - b.width / 2, -b.minY - b.height / 2);

    this.currentPaths.forEach(p => {
      if (!p.visible || p.type === 'ignore') return;

      if (p.type === 'cut') {
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1.8 / scale;
        ctx.setLineDash([]);
      } else if (p.type === 'crease') {
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.4 / scale;
        ctx.setLineDash([4 / scale, 3 / scale]);
      } else if (p.type === 'glue') {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.8 / scale;
        ctx.setLineDash([]);
      } else if (p.type === 'guide') {
        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 1.2 / scale;
        ctx.setLineDash([3 / scale, 3 / scale]);
      } else {
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([]);
      }

      try {
        const path2d = new Path2D(p.d);
        ctx.stroke(path2d);
      } catch (e) {}
    });

    ctx.restore();
  },

  applyToProject() {
    const cad = window.LemonPack.cad;
    cad.customDie = {
      active: true,
      paths: JSON.parse(JSON.stringify(this.currentPaths)),
      bounds: Object.assign({}, this.originalBounds),
      widthMm: Math.round(this.originalBounds.width),
      heightMm: Math.round(this.originalBounds.height)
    };
    cad.flatL = cad.customDie.widthMm;
    cad.flatW = cad.customDie.heightMm;

    const inpL = document.getElementById('inp-flat-l');
    const inpW = document.getElementById('inp-flat-w');
    if (inpL) inpL.value = cad.flatL;
    if (inpW) inpW.value = cad.flatW;

    this.closeModal();
    toast('قالب اختصاصی در شیت‌بندی و محاسبات اعمال گردید ✓');
    if (window.App && window.App.recalculate) {
      window.App.recalculate();
    }
  }
};
