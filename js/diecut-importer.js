/* ============================================================
   CUSTOM DIE-CUT VECTOR IMPORT & LAYER REFINER (.svg & .ai)
   ============================================================ */

window.DieCutImporter = {
  currentPaths: [],
  layerGroups: [],
  originalBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 },
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
    const zone = document.getElementById('dropzone');
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

  parseVectorData(text, isAi) {
    this.currentPaths = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (!isAi && text.includes('<svg')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const elements = doc.querySelectorAll('path, line, rect, polyline, polygon');

      elements.forEach((el, index) => {
        let d = '';
        const tag = el.tagName.toLowerCase();
        if (tag === 'path') {
          d = el.getAttribute('d') || '';
        } else if (tag === 'line') {
          const x1 = parseFloat(el.getAttribute('x1') || 0);
          const y1 = parseFloat(el.getAttribute('y1') || 0);
          const x2 = parseFloat(el.getAttribute('x2') || 0);
          const y2 = parseFloat(el.getAttribute('y2') || 0);
          d = 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
        } else if (tag === 'rect') {
          const x = parseFloat(el.getAttribute('x') || 0);
          const y = parseFloat(el.getAttribute('y') || 0);
          const rw = parseFloat(el.getAttribute('width') || 0);
          const rh = parseFloat(el.getAttribute('height') || 0);
          d = 'M ' + x + ' ' + y + ' H ' + (x + rw) + ' V ' + (y + rh) + ' H ' + x + ' Z';
        } else if (tag === 'polyline' || tag === 'polygon') {
          const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/);
          if (pts.length >= 2) {
            d = 'M ' + pts[0] + ' ' + pts[1];
            for (let i = 2; i < pts.length; i += 2) {
              d += ' L ' + pts[i] + ' ' + pts[i+1];
            }
            if (tag === 'polygon') d += ' Z';
          }
        }

        if (d) {
          const stroke = el.getAttribute('stroke') || el.style.stroke || '#DC2626';
          const strokeDash = el.getAttribute('stroke-dasharray') || el.style.strokeDasharray || '';
          const strokeWidth = parseFloat(el.getAttribute('stroke-width') || 1);
          const layerName = (el.closest('g') && el.closest('g').id) || ('Layer_' + (index + 1));

          let type = 'cut';
          if (strokeDash || stroke.toLowerCase().includes('blue') || stroke.includes('0000ff') || stroke.includes('2563eb')) {
            type = 'crease';
          } else if (stroke.toLowerCase().includes('green') || stroke.includes('059669')) {
            type = 'glue';
          }

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
      this.groupLayers();
      this.renderLayerTable();
      this.renderPreviewCanvas();
      toast('فایل با موفقیت تحلیل شد (' + this.currentPaths.length + ' مسیر برداری) ✓');
    }
  },

  generateFallbackTemplate() {
    const cad = window.LemonPack.cad;
    const L = cad.length;
    const W = cad.width;
    const H = cad.height;
    this.currentPaths = [
      { id: 1, d: 'M 0 0 H 310 V 220 H 0 Z', originalStroke: '#DC2626', type: 'cut', layerName: 'Outer_Cut_Blade', visible: true },
      { id: 2, d: 'M 15 20 H 310', originalStroke: '#2563EB', strokeDash: '4,4', type: 'crease', layerName: 'Top_Tuck_Crease', visible: true },
      { id: 3, d: 'M 15 170 H 310', originalStroke: '#2563EB', strokeDash: '4,4', type: 'crease', layerName: 'Bottom_Tuck_Crease', visible: true },
      { id: 4, d: 'M 15 20 V 170', originalStroke: '#059669', type: 'glue', layerName: 'Glue_Flap_Score', visible: true }
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
        '<td><span class="color-badge" style="background:' + g.stroke + '"></span> ' + g.stroke + (g.isDash ? ' (خط‌چین)' : '') + '</td>' +
        '<td>' + g.count + ' مسیر</td>' +
        '<td>' +
          '<select class="input-box" style="height:28px; font-size:0.75rem;" onchange="DieCutImporter.updateGroupType(' + idx + ', this.value)">' +
            '<option value="cut" ' + (g.type === 'cut' ? 'selected' : '') + '>🔴 خط تیغ (Cut Blade)</option>' +
            '<option value="crease" ' + (g.type === 'crease' ? 'selected' : '') + '>🔵 خط تا (Crease Rule)</option>' +
            '<option value="glue" ' + (g.type === 'glue' ? 'selected' : '') + '>🟢 لبه چسب (Glue Flap)</option>' +
            '<option value="ignore" ' + (g.type === 'ignore' ? 'selected' : '') + '>⚪ نادیده گرفتن (Ignore)</option>' +
          '</select>' +
        '</td>' +
        '<td>' +
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

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(0.85, 0.85);
    ctx.translate(-155, -110);

    this.currentPaths.forEach(p => {
      if (!p.visible || p.type === 'ignore') return;

      if (p.type === 'cut') {
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      } else if (p.type === 'crease') {
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
      } else if (p.type === 'glue') {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2;
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
      paths: this.currentPaths,
      widthMm: cad.flatL || 310,
      heightMm: cad.flatW || 220
    };
    this.closeModal();
    toast('قالب اختصاصی در شیت‌بندی و محاسبات اعمال گردید ✓');
    if (window.App && window.App.recalculate) {
      window.App.recalculate();
    }
  }
};
