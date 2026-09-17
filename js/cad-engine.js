/* ============================================================
   CAD GEOMETRY, MARGIN CONTROLLER & FLAT BLUEPRINT ENGINE
   ============================================================ */

window.CadEngine = {
  presets: {
    standard_pharma: {
      name: 'استاندارد دارویی',
      glueFlap: 15,
      tuckFlap: 18,
      dustFlap: 15,
      creaseGap: 2,
      bleed: 3
    },
    economical: {
      name: 'اقتصادی کم‌مصرف',
      glueFlap: 12,
      tuckFlap: 14,
      dustFlap: 12,
      creaseGap: 1.5,
      bleed: 2
    },
    heavy_duty: {
      name: 'مقاوم و صادراتی',
      glueFlap: 22,
      tuckFlap: 24,
      dustFlap: 20,
      creaseGap: 3,
      bleed: 4
    }
  },

  init() {
    this.loadCustomPresets();
  },

  loadCustomPresets() {
    try {
      const raw = localStorage.getItem('lemonpack_cad_presets');
      if (raw) {
        const custom = JSON.parse(raw);
        this.presets = Object.assign({}, this.presets, custom);
      }
    } catch (e) {}
  },

  saveCustomPreset(name) {
    if (!name) return;
    const cad = window.LemonPack.cad;
    this.presets[name] = {
      name: name,
      glueFlap: cad.glueFlap,
      tuckFlap: cad.tuckFlap,
      dustFlap: cad.dustFlap,
      creaseGap: cad.creaseGap,
      bleed: cad.bleed
    };
    try {
      localStorage.setItem('lemonpack_cad_presets', JSON.stringify(this.presets));
    } catch (e) {}
    toast('پریست با موفقیت ذخیره شد ✓');
  },

  applyPreset(presetKey) {
    const p = this.presets[presetKey];
    if (!p) return;
    const cad = window.LemonPack.cad;
    cad.glueFlap = p.glueFlap;
    cad.tuckFlap = p.tuckFlap;
    cad.dustFlap = p.dustFlap;
    cad.creaseGap = p.creaseGap;
    cad.bleed = p.bleed;

    const setInp = function(id, val) { const el = document.getElementById(id); if (el) el.value = val; };
    setInp('inp-glue-flap', cad.glueFlap);
    setInp('inp-tuck-flap', cad.tuckFlap);
    setInp('inp-dust-flap', cad.dustFlap);
    setInp('inp-crease-gap', cad.creaseGap);
    setInp('inp-bleed-margin', cad.bleed);

    this.recalculateFlatDimensions();
    if (window.App && window.App.recalculate) {
      window.App.recalculate();
    }
  },

  recalculateFlatDimensions() {
    const cad = window.LemonPack.cad;
    if (cad.customDie && cad.customDie.active) {
      cad.flatL = cad.customDie.widthMm;
      cad.flatW = cad.customDie.heightMm;
    } else {
      const L = cad.length;
      const W = cad.width;
      const H = cad.height;
      const G = cad.glueFlap || 15;
      const T = cad.tuckFlap || 18;
      const gap = cad.creaseGap || 2;

      if (cad.model === 'tuck_end') {
        cad.flatL = Math.round((2 * L) + (2 * W) + G + (4 * gap));
        cad.flatW = Math.round(H + (2 * W) + (2 * T) + (4 * gap));
      } else if (cad.model === 'mailer_0427') {
        cad.flatL = Math.round((2 * H) + (2 * W) + L + (4 * gap));
        cad.flatW = Math.round((2 * H) + L + (2 * T) + (4 * gap));
      } else if (cad.model === 'lock_bottom') {
        cad.flatL = Math.round((2 * L) + (2 * W) + G + (4 * gap));
        cad.flatW = Math.round(H + (1.5 * W) + T + (3 * gap));
      } else if (cad.model === 'rigid_box') {
        cad.flatL = Math.round(L + (2 * H) + 30);
        cad.flatW = Math.round(W + (2 * H) + 30);
      } else {
        cad.flatL = Math.round((2 * L) + (2 * W) + 35);
        cad.flatW = Math.round(H + (2 * W) + 25);
      }
    }

    const inpL = document.getElementById('inp-flat-l');
    const inpW = document.getElementById('inp-flat-w');
    if (inpL) inpL.value = Math.round(cad.flatL);
    if (inpW) inpW.value = Math.round(cad.flatW);
  },

  renderBlueprint() {
    const canvas = document.getElementById('blueprint-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cad = window.LemonPack.cad;
    const padding = 35;
    const pUtils = window.PersianUtils || { e2p: function(v){ return v; } };

    // If Custom Vector Die is imported and active, render the true vector blueprint
    if (cad.customDie && cad.customDie.active && cad.customDie.paths && cad.customDie.paths.length > 0) {
      const b = cad.customDie.bounds || { minX: 0, minY: 0, width: cad.flatL, height: cad.flatW };
      const scale = Math.min((w - padding * 2) / b.width, (h - padding * 2) / b.height);
      const boxW = b.width * scale;
      const boxH = b.height * scale;
      const startX = (w - boxW) / 2;
      const startY = (h - boxH) / 2;

      ctx.fillStyle = '#FAF8F5';
      ctx.fillRect(startX, startY, boxW, boxH);

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-b.minX - b.width / 2, -b.minY - b.height / 2);

      cad.customDie.paths.forEach(p => {
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

      // Dimension extension lines
      ctx.strokeStyle = '#D97706';
      ctx.fillStyle = '#D97706';
      ctx.lineWidth = 1;
      ctx.font = 'bold 11px Peyda, sans-serif';
      ctx.textAlign = 'center';

      ctx.fillText(pUtils.e2p(cad.flatL) + ' mm (طول گسترده قالب برداری)', w / 2, startY - 12);
      ctx.beginPath();
      ctx.moveTo(startX, startY - 6);
      ctx.lineTo(startX + boxW, startY - 6);
      ctx.stroke();

      ctx.save();
      ctx.translate(startX - 14, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(pUtils.e2p(cad.flatW) + ' mm (عرض گسترده)', 0, 0);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(startX - 6, startY);
      ctx.lineTo(startX - 6, startY + boxH);
      ctx.stroke();
      return;
    }

    // Default Parametric CAD Blueprint
    const drawW = w - (padding * 2);
    const drawH = h - (padding * 2);
    const scale = Math.min(drawW / Math.max(1, cad.flatL), drawH / Math.max(1, cad.flatW));
    const boxW = cad.flatL * scale;
    const boxH = cad.flatW * scale;
    const startX = (w - boxW) / 2;
    const startY = (h - boxH) / 2;

    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(startX, startY, boxW, boxH);

    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, boxW, boxH);

    const L = cad.length * scale;
    const W = cad.width * scale;
    const H = cad.height * scale;
    const G = (cad.glueFlap || 15) * scale;
    const T = (cad.tuckFlap || 18) * scale;

    ctx.fillStyle = 'rgba(5, 150, 105, 0.15)';
    ctx.fillRect(startX, startY + T, G, H);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY + T, G, H);

    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);

    let curX = startX + G;
    const panelWidths = [W, L, W, L];
    const labels = ['بغل راست', 'روی جعبه', 'بغل چپ', 'پشت جعبه'];
    for (let i = 0; i < panelWidths.length; i++) {
      const pw = panelWidths[i];
      ctx.beginPath();
      ctx.moveTo(curX, startY);
      ctx.lineTo(curX, startY + boxH);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '10px Peyda, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i] || '', curX + (pw / 2), startY + (boxH / 2));

      curX += pw;
    }

    ctx.beginPath();
    ctx.moveTo(startX, startY + T);
    ctx.lineTo(startX + boxW, startY + T);
    ctx.moveTo(startX, startY + T + H);
    ctx.lineTo(startX + boxW, startY + T + H);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#D97706';
    ctx.fillStyle = '#D97706';
    ctx.lineWidth = 1;
    ctx.font = 'bold 11px Peyda, sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(pUtils.e2p(cad.flatL) + ' mm', w / 2, startY - 12);
    ctx.beginPath();
    ctx.moveTo(startX, startY - 6);
    ctx.lineTo(startX + boxW, startY - 6);
    ctx.stroke();

    ctx.save();
    ctx.translate(startX - 14, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(pUtils.e2p(cad.flatW) + ' mm', 0, 0);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(startX - 6, startY);
    ctx.lineTo(startX - 6, startY + boxH);
    ctx.stroke();
  }
};
