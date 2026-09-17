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
    this.setupBlueprintHover();
  },

  hoverPoint: null,
  hoverAnnotation: null,

  setupBlueprintHover() {
    const canvas = document.getElementById('blueprint-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
      this.hoverPoint = { x: mouseX, y: mouseY };
      this.renderBlueprint();
    });

    canvas.addEventListener('mouseleave', () => {
      this.hoverPoint = null;
      this.renderBlueprint();
    });
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
    const L = Number(cad.length) || 120;
    const W = Number(cad.width) || 80;
    const H = Number(cad.height) || 150;
    const G = Number(cad.glueFlap) || 15;
    const T = Number(cad.tuckFlap) || 18;
    const D = Number(cad.dustFlap) || 15;
    const gap = Number(cad.creaseGap) || 2;

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

    if (cad.customDie && cad.customDie.active) {
      // If custom die is scaled, keep dimensions matched
      cad.flatL = Math.round(cad.customDie.widthMm || cad.flatL);
      cad.flatW = Math.round(cad.customDie.heightMm || cad.flatW);
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
    const padding = 38;
    const pUtils = window.PersianUtils || { e2p: function(v){ return v; } };
    let activeHoverText = null;
    const mouse = this.hoverPoint;

    // 1. CUSTOM IMPORTED SVG DIE BLUEPRINT
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

      // Check mouse hover over outer bounds
      if (mouse && mouse.x >= startX && mouse.x <= startX + boxW && mouse.y >= startY && mouse.y <= startY + boxH) {
        const mmX = Math.round((mouse.x - startX) / scale);
        const mmY = Math.round((mouse.y - startY) / scale);
        activeHoverText = `مختصات خطی: X: ${pUtils.e2p(mmX)}mm | Y: ${pUtils.e2p(mmY)}mm (کل: ${pUtils.e2p(cad.flatL)}×${pUtils.e2p(cad.flatW)}mm)`;
      }

      // Outer Dimension Extension Lines
      ctx.strokeStyle = '#D97706';
      ctx.fillStyle = '#D97706';
      ctx.lineWidth = 1.2;
      ctx.font = 'bold 11px Peyda, sans-serif';
      ctx.textAlign = 'center';

      ctx.fillText(pUtils.e2p(cad.flatL) + ' mm (طول گسترده قالب برداری)', w / 2, startY - 14);
      ctx.beginPath();
      ctx.moveTo(startX, startY - 6);
      ctx.lineTo(startX + boxW, startY - 6);
      ctx.stroke();

      ctx.save();
      ctx.translate(startX - 14, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(pUtils.e2p(cad.flatW) + ' mm (عرض گسترده قالب)', 0, 0);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(startX - 6, startY);
      ctx.lineTo(startX - 6, startY + boxH);
      ctx.stroke();

      // Render Floating Hover Annotation
      if (mouse && activeHoverText) {
        this.drawHoverBadge(ctx, mouse.x, mouse.y, activeHoverText);
      }
      return;
    }

    // 2. DEFAULT PARAMETRIC CAD BLUEPRINT
    const drawW = w - (padding * 2);
    const drawH = h - (padding * 2);
    const scale = Math.min(drawW / Math.max(1, cad.flatL), drawH / Math.max(1, cad.flatW));
    const boxW = cad.flatL * scale;
    const boxH = cad.flatW * scale;
    const startX = (w - boxW) / 2;
    const startY = (h - boxH) / 2;

    const L = cad.length * scale;
    const W = cad.width * scale;
    const H = cad.height * scale;
    const G = (cad.glueFlap || 15) * scale;
    const T = (cad.tuckFlap || 18) * scale;
    const D = (cad.dustFlap || 15) * scale;

    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(startX, startY, boxW, boxH);

    // Outer Cut Blade
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, boxW, boxH);

    // Glue Flap Area (Green highlight)
    ctx.fillStyle = 'rgba(5, 150, 105, 0.15)';
    ctx.fillRect(startX, startY + T, G, H);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY + T, G, H);

    // Crease Rules (Blue dashed lines)
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);

    let curX = startX + G;
    const panelWidths = [W, L, W, L];
    const panelWidthsMm = [cad.width, cad.length, cad.width, cad.length];
    const labels = ['بغل راست (W)', 'روی جعبه (L)', 'بغل چپ (W)', 'پشت جعبه (L)'];

    for (let i = 0; i < panelWidths.length; i++) {
      const pw = panelWidths[i];
      const pwMm = panelWidthsMm[i];
      ctx.beginPath();
      ctx.moveTo(curX, startY);
      ctx.lineTo(curX, startY + boxH);
      ctx.stroke();

      // Check hover on this panel column
      if (mouse && mouse.x >= curX && mouse.x <= curX + pw && mouse.y >= startY && mouse.y <= startY + boxH) {
        activeHoverText = `${labels[i]}: عرض ${pUtils.e2p(pwMm)} mm | ارتفاع ${pUtils.e2p(cad.height)} mm`;
      }

      ctx.fillStyle = '#64748B';
      ctx.font = '10px Peyda, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], curX + (pw / 2), startY + (boxH / 2));
      ctx.font = 'bold 9px Peyda, sans-serif';
      ctx.fillStyle = '#2563EB';
      ctx.fillText(`${pUtils.e2p(pwMm)} mm`, curX + (pw / 2), startY + (boxH / 2) + 14);

      curX += pw;
    }

    // Horizontal Flap Crease Lines
    ctx.beginPath();
    ctx.moveTo(startX, startY + T);
    ctx.lineTo(startX + boxW, startY + T);
    ctx.moveTo(startX, startY + T + H);
    ctx.lineTo(startX + boxW, startY + T + H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Check hover on top/bottom tuck flaps or glue flap
    if (mouse) {
      if (mouse.x >= startX && mouse.x <= startX + G && mouse.y >= startY + T && mouse.y <= startY + T + H) {
        activeHoverText = `لبه چسب (Glue Flap): عرض ${pUtils.e2p(cad.glueFlap)} mm`;
      } else if (mouse.y >= startY && mouse.y <= startY + T) {
        activeHoverText = `زبانه درپوش بالا (Top Tuck): ارتفاع ${pUtils.e2p(cad.tuckFlap)} mm`;
      } else if (mouse.y >= startY + T + H && mouse.y <= startY + boxH) {
        activeHoverText = `زبانه درپوش پایین (Bottom Tuck): ارتفاع ${pUtils.e2p(cad.tuckFlap)} mm`;
      }
    }

    // Render Window Patch (پنجره طلقی) if enabled
    if (window.LemonPack.materials && window.LemonPack.materials.windowPatch && window.LemonPack.materials.windowPatch.enabled) {
      const win = window.LemonPack.materials.windowPatch;
      const winLenMm = Math.min(Math.max(10, Number(win.length) || 70), cad.length - 8);
      const winWidMm = Math.min(Math.max(10, Number(win.width) || 45), cad.height - 8);
      const winDrawW = winLenMm * scale;
      const winDrawH = winWidMm * scale;
      const winX = (startX + G + W) + ((L - winDrawW) / 2);
      const winY = (startY + T) + ((H - winDrawH) / 2);

      ctx.save();
      ctx.fillStyle = 'rgba(14, 165, 233, 0.22)';
      ctx.beginPath();
      ctx.roundRect(winX, winY, winDrawW, winDrawH, 4);
      ctx.fill();

      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 2]);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(winX + 6, winY + winDrawH - 6);
      ctx.lineTo(winX + winDrawW - 6, winY + 6);
      ctx.stroke();

      ctx.fillStyle = '#0369A1';
      ctx.font = 'bold 9px Peyda, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`پنجره طلق: ${pUtils.e2p(winLenMm)}×${pUtils.e2p(winWidMm)} mm`, winX + (winDrawW / 2), winY + (winDrawH / 2) - 3);
      ctx.font = '8px Peyda, sans-serif';
      ctx.fillText(`(${win.material.toUpperCase()} ${pUtils.e2p(win.thicknessMicron)}µm)`, winX + (winDrawW / 2), winY + (winDrawH / 2) + 9);
      ctx.restore();

      if (mouse && mouse.x >= winX && mouse.x <= winX + winDrawW && mouse.y >= winY && mouse.y <= winY + winDrawH) {
        const filmW = winLenMm + (2 * (win.margin || 10));
        const filmH = winWidMm + (2 * (win.margin || 10));
        activeHoverText = `پنجره طلقی (Window): ${pUtils.e2p(winLenMm)}×${pUtils.e2p(winWidMm)} mm | طلق مصرفی: ${pUtils.e2p(filmW)}×${pUtils.e2p(filmH)} mm (${pUtils.e2p(win.thicknessMicron)} میکرون)`;
      }
    }

    // Top / Left Dimension Extension Lines
    ctx.strokeStyle = '#D97706';
    ctx.fillStyle = '#D97706';
    ctx.lineWidth = 1.2;
    ctx.font = 'bold 11px Peyda, sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(pUtils.e2p(cad.flatL) + ' mm (طول گسترده)', w / 2, startY - 14);
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

    // Floating Hover Measurement Tooltip
    if (mouse && activeHoverText) {
      this.drawHoverBadge(ctx, mouse.x, mouse.y, activeHoverText);
    }
  },

  drawHoverBadge(ctx, x, y, text) {
    ctx.save();
    ctx.font = 'bold 10.5px Peyda, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const badgeW = textWidth + 18;
    const badgeH = 26;
    let badgeX = x + 12;
    let badgeY = y - 32;

    // Prevent overflow
    if (badgeX + badgeW > 640) badgeX = x - badgeW - 12;
    if (badgeY < 10) badgeY = y + 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();

    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, badgeX + 9, badgeY + (badgeH / 2));
    ctx.restore();
  }
};
