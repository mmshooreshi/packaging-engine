/* ============================================================
   CAD GEOMETRY, MARGIN CONTROLLER & FLAT BLUEPRINT ENGINE
   ============================================================ */

window.CadEngine = {
  CALIPER_BY_GSM: {
    200: 0.28,
    230: 0.32,
    250: 0.36,
    270: 0.40,
    300: 0.45,
    350: 0.54,
    400: 0.62
  },

  BOX_MODELS: {
    fefco_0215_tuck_bottom: {
      id: 'fefco_0215_tuck_bottom',
      name_fa: 'جعبه مقوایی درب دارویی / ته قفلی (Straight Tuck & Lock-Bottom)',
      anatomy: { glue_flap_gl: 14, tuck_flap_tf: 15 },
      allows_180_tumble: true,
      grain_criticality: 'high',
      major_fold_axis: 'parallel_to_flat_length'
    },
    fefco_0427_mailer: {
      id: 'fefco_0427_mailer',
      name_fa: 'جعبه کیبوردی / پستی مقاوم (Roll-End Tuck Top Mailer)',
      anatomy: { locking_ears_width: 18 },
      allows_180_tumble: true,
      grain_criticality: 'high',
      major_fold_axis: 'parallel_to_flat_width'
    },
    shopping_bag_luxury: {
      id: 'shopping_bag_luxury',
      name_fa: 'شاپینگ بگ / ساک دستی گلاسه با تقویت‌کننده',
      anatomy: { top_turnover: 40, glue_flap: 25 },
      allows_180_tumble: false,
      supports_two_piece_split: true,
      grain_criticality: 'medium',
      two_piece_auto_threshold_mm: 980
    },
    rigid_box_two_piece: {
      id: 'rigid_box_two_piece',
      name_fa: 'هاردباکس دو تکه (مغزی مقوای کرجی + کاور گلاسه)',
      allows_180_tumble: false,
      grain_criticality: 'low'
    }
  },

  getCaliper(gsm) {
    const g = Number(gsm) || 300;
    return this.CALIPER_BY_GSM[g] || (g >= 400 ? 0.62 : g >= 350 ? 0.54 : g >= 300 ? 0.45 : g >= 250 ? 0.36 : g >= 230 ? 0.32 : 0.28);
  },

  presets: {
    standard_pharma: {
      name: 'استاندارد دارویی',
      glueFlap: 14,
      tuckFlap: 15,
      dustFlap: 15,
      creaseGap: 2,
      bleed: 3
    },
    economical: {
      name: 'اقتصادی کم‌مصرف',
      glueFlap: 12,
      tuckFlap: 13,
      dustFlap: 12,
      creaseGap: 1.5,
      bleed: 2
    },
    heavy_duty: {
      name: 'مقاوم و صادراتی',
      glueFlap: 18,
      tuckFlap: 18,
      dustFlap: 18,
      creaseGap: 2.5,
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
    const mat = window.LemonPack.materials || { gsm: 300 };
    const L = Number(cad.length) || 120;
    const W = Number(cad.width) || 80;
    const D = Number(cad.height || cad.depth) || 150;
    const t = cad.caliper_t || this.getCaliper(mat.gsm);
    cad.caliper_t = t;

    // Normalizing model ID
    const model = cad.model === 'tuck_end' || cad.model === 'lock_bottom' ? 'fefco_0215_tuck_bottom'
      : cad.model === 'mailer_0427' ? 'fefco_0427_mailer'
      : cad.model === 'shopping_bag' ? 'shopping_bag_luxury'
      : cad.model === 'rigid_box' ? 'rigid_box_two_piece'
      : (cad.model || 'fefco_0215_tuck_bottom');

    let flatL = 0;
    let flatW = 0;
    let tumbleGain = 0;
    let isTwoPiece = false;

    if (model === 'fefco_0215_tuck_bottom') {
      // flat_length_mm = (2 * L) + (2 * W) + 14 + (4 * t)
      // flat_width_mm = D + 15 + ((W / 2) + 10) + (2 * t)
      flatL = (2 * L) + (2 * W) + 14 + (4 * t);
      flatW = D + 15 + ((W / 2) + 10) + (2 * t);
      tumbleGain = Math.max(0, ((W / 2) + 10) + 15 - 8);
      cad.glueFlap = 14;
      cad.tuckFlap = 15;
      cad.dustFlap = Math.max(5, Math.round((W / 2) - 1));
      cad.majorFoldAxis = 'parallel_to_flat_length';
      cad.allows180Tumble = true;
      cad.grainCriticality = 'high';
    } else if (model === 'fefco_0427_mailer') {
      // flat_length_mm = (2 * W) + (3 * D) + L + 20
      // flat_width_mm = L + (4 * D) + (6 * t)
      flatL = (2 * W) + (3 * D) + L + 20;
      flatW = L + (4 * D) + (6 * t);
      tumbleGain = 2 * D;
      cad.lockingEarsWidth = 18;
      cad.rollOverFlaps = Math.max(5, D - 2);
      cad.majorFoldAxis = 'parallel_to_flat_width';
      cad.allows180Tumble = true;
      cad.grainCriticality = 'high';
    } else if (model === 'shopping_bag_luxury') {
      // 1-piece: (2 * L) + (2 * W) + 25, flat_width: D + 40 + ((W / 2) + 20)
      const onePieceL = (2 * L) + (2 * W) + 25;
      flatW = D + 40 + ((W / 2) + 20);
      if (onePieceL > 980) {
        flatL = L + W + 25; // 2-piece half
        isTwoPiece = true;
      } else {
        flatL = onePieceL;
        isTwoPiece = false;
      }
      tumbleGain = 0;
      cad.topTurnover = 40;
      cad.bottomFold = (W / 2) + 20;
      cad.glueFlap = 25;
      cad.majorFoldAxis = 'parallel_to_flat_width';
      cad.allows180Tumble = false;
      cad.supportsTwoPieceSplit = true;
      cad.isTwoPiece = isTwoPiece;
      cad.grainCriticality = 'medium';
    } else if (model === 'rigid_box_two_piece') {
      const dLid = Math.max(25, Math.round(D * 0.35));
      flatL = L + (2 * D) + 30;
      flatW = W + (2 * D) + 30;
      cad.lidFlatL = (L + 3) + (2 * dLid) + 30;
      cad.lidFlatW = (W + 3) + (2 * dLid) + 30;
      tumbleGain = 0;
      cad.majorFoldAxis = 'parallel_to_flat_length';
      cad.allows180Tumble = false;
      cad.grainCriticality = 'low';
    }

    cad.flatL = Math.round(flatL);
    cad.flatW = Math.round(flatW);
    cad.tumblePitchGain = Math.round(tumbleGain);

    if (cad.customDie && cad.customDie.active) {
      cad.flatL = Math.round(cad.customDie.widthMm || cad.flatL);
      cad.flatW = Math.round(cad.customDie.heightMm || cad.flatW);
    }

    const inpL = document.getElementById('inp-flat-l');
    const inpW = document.getElementById('inp-flat-w');
    if (inpL) inpL.value = Math.round(cad.flatL);
    if (inpW) inpW.value = Math.round(cad.flatW);

    const caliperBadge = document.getElementById('caliper-badge-disp');
    if (caliperBadge) {
      const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v) };
      caliperBadge.textContent = `ضخامت (t): ${pUtils.fmtNum(t, 2)} mm`;
    }
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
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: function(v){ return v; } };
    let activeHoverText = null;
    const mouse = this.hoverPoint;

    // 1. CUSTOM IMPORTED SVG DIE BLUEPRINT
    if (cad.customDie && cad.customDie.active && cad.customDie.paths && cad.customDie.paths.length > 0) {
      const b = cad.customDie.bounds || { minX: 0, minY: 0, rawWidth: cad.flatL, rawHeight: cad.flatW, scaleToMm: 1 };
      const rawW = b.rawWidth || cad.flatL;
      const rawH = b.rawHeight || cad.flatW;
      const scaleToMm = b.scaleToMm || 1.0;
      const flatW = cad.flatL || 415;
      const flatH = cad.flatW || 266;

      const scale = Math.min((w - padding * 2) / flatW, (h - padding * 2) / flatH);
      const boxW = flatW * scale;
      const boxH = flatH * scale;
      const startX = (w - boxW) / 2;
      const startY = (h - boxH) / 2;

      ctx.fillStyle = '#FAF8F5';
      ctx.fillRect(startX, startY, boxW, boxH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX, startY, boxW, boxH);

      const sx = scale * (flatW / (rawW * scaleToMm)) * scaleToMm;
      const sy = scale * (flatH / (rawH * scaleToMm)) * scaleToMm;

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.scale(sx, sy);
      ctx.translate(-b.minX - rawW / 2, -b.minY - rawH / 2);

      cad.customDie.paths.forEach(p => {
        if (!p.visible || p.type === 'ignore') return;

        if (p.type === 'cut') {
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 1.8 / sx;
          ctx.setLineDash([]);
        } else if (p.type === 'crease') {
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 1.4 / sx;
          ctx.setLineDash([4 / sx, 3 / sx]);
        } else if (p.type === 'glue') {
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 1.8 / sx;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1 / sx;
          ctx.setLineDash([]);
        }

        try {
          ctx.stroke(new Path2D(p.dRaw || p.d));
        } catch (e) {}
      });

      ctx.restore();

      // Check mouse hover over outer bounds
      if (mouse && mouse.x >= startX && mouse.x <= startX + boxW && mouse.y >= startY && mouse.y <= startY + boxH) {
        const mmX = Math.round((mouse.x - startX) / scale);
        const mmY = Math.round((mouse.y - startY) / scale);
        activeHoverText = `مختصات خطی: X: ${pUtils.fmtNum(mmX)}mm | Y: ${pUtils.fmtNum(mmY)}mm (کل: ${pUtils.fmtNum(cad.flatL)}×${pUtils.fmtNum(cad.flatW)}mm)`;
      }

      // Outer Dimension Extension Lines
      ctx.strokeStyle = '#D97706';
      ctx.fillStyle = '#D97706';
      ctx.lineWidth = 1.2;
      ctx.font = 'bold 11px Peyda, sans-serif';
      ctx.textAlign = 'center';

      ctx.fillText(pUtils.fmtNum(cad.flatL) + ' mm (طول گسترده قالب برداری)', w / 2, startY - 14);
      ctx.beginPath();
      ctx.moveTo(startX, startY - 6);
      ctx.lineTo(startX + boxW, startY - 6);
      ctx.stroke();

      ctx.save();
      ctx.translate(startX - 14, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(pUtils.fmtNum(cad.flatW) + ' mm (عرض گسترده قالب)', 0, 0);
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
        activeHoverText = `${labels[i]}: عرض ${pUtils.fmtNum(pwMm)} mm | ارتفاع ${pUtils.fmtNum(cad.height)} mm`;
      }

      ctx.fillStyle = '#64748B';
      ctx.font = '10px Peyda, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], curX + (pw / 2), startY + (boxH / 2));
      ctx.font = 'bold 9px Peyda, sans-serif';
      ctx.fillStyle = '#2563EB';
      ctx.fillText(`${pUtils.fmtNum(pwMm)} mm`, curX + (pw / 2), startY + (boxH / 2) + 14);

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
        activeHoverText = `لبه چسب (Glue Flap): عرض ${pUtils.fmtNum(cad.glueFlap)} mm`;
      } else if (mouse.y >= startY && mouse.y <= startY + T) {
        activeHoverText = `زبانه درپوش بالا (Top Tuck): ارتفاع ${pUtils.fmtNum(cad.tuckFlap)} mm`;
      } else if (mouse.y >= startY + T + H && mouse.y <= startY + boxH) {
        activeHoverText = `زبانه درپوش پایین (Bottom Tuck): ارتفاع ${pUtils.fmtNum(cad.tuckFlap)} mm`;
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
      ctx.fillText(`پنجره طلق: ${pUtils.fmtNum(winLenMm)}×${pUtils.fmtNum(winWidMm)} mm`, winX + (winDrawW / 2), winY + (winDrawH / 2) - 3);
      ctx.font = '8px Peyda, sans-serif';
      ctx.fillText(`(${win.material.toUpperCase()} ${pUtils.fmtNum(win.thicknessMicron)}µm)`, winX + (winDrawW / 2), winY + (winDrawH / 2) + 9);
      ctx.restore();

      if (mouse && mouse.x >= winX && mouse.x <= winX + winDrawW && mouse.y >= winY && mouse.y <= winY + winDrawH) {
        const filmW = winLenMm + (2 * (win.margin || 10));
        const filmH = winWidMm + (2 * (win.margin || 10));
        activeHoverText = `پنجره طلقی (Window): ${pUtils.fmtNum(winLenMm)}×${pUtils.fmtNum(winWidMm)} mm | طلق مصرفی: ${pUtils.fmtNum(filmW)}×${pUtils.fmtNum(filmH)} mm (${pUtils.fmtNum(win.thicknessMicron)} میکرون)`;
      }
    }

    // Top / Left Dimension Extension Lines
    ctx.strokeStyle = '#D97706';
    ctx.fillStyle = '#D97706';
    ctx.lineWidth = 1.2;
    ctx.font = 'bold 11px Peyda, sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(pUtils.fmtNum(cad.flatL) + ' mm (طول گسترده)', w / 2, startY - 14);
    ctx.beginPath();
    ctx.moveTo(startX, startY - 6);
    ctx.lineTo(startX + boxW, startY - 6);
    ctx.stroke();

    ctx.save();
    ctx.translate(startX - 14, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(pUtils.fmtNum(cad.flatW) + ' mm (عرض گسترده)', 0, 0);
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

/* ============================================================
   INTERACTIVE 3D PACKAGING FOLDING & ASSEMBLY VIEWER
   ============================================================ */
window.Cad3DEngine = {
  canvas: null,
  ctx: null,
  foldProgress: 1.0,
  yaw: 35 * Math.PI / 180,
  pitch: 22 * Math.PI / 180,
  zoom: 1.0,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  autoRotate: false,
  animId: null,

  init() {
    this.canvas = document.getElementById('canvas-3d');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.setupEvents();
    this.render();
  },

  setupEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      if (this.canvas) this.canvas.style.cursor = 'grab';
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      this.yaw += dx * 0.008;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + dy * 0.008));
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.render();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom = Math.max(0.4, Math.min(3.0, this.zoom * factor));
      this.render();
    }, { passive: false });

    let lastTouch = null;
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1 && lastTouch) {
        const dx = e.touches[0].clientX - lastTouch.x;
        const dy = e.touches[0].clientY - lastTouch.y;
        this.yaw += dx * 0.01;
        this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + dy * 0.01));
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.render();
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.isDragging = false;
      lastTouch = null;
    });
  },

  setFoldProgress(val) {
    this.foldProgress = Math.max(0, Math.min(1, Number(val) || 0));
    const label = document.getElementById('fold-progress-val');
    const pUtils = window.PersianUtils || { fmtNum: v => String(v) };
    if (label) {
      label.textContent = pUtils.fmtNum(Math.round(this.foldProgress * 100)) + '٪';
    }
    this.render();
  },

  resetView(preset = 'isometric') {
    if (preset === 'isometric') {
      this.yaw = 35 * Math.PI / 180;
      this.pitch = 22 * Math.PI / 180;
    } else if (preset === 'front') {
      this.yaw = 0;
      this.pitch = 0;
    } else if (preset === 'back') {
      this.yaw = Math.PI;
      this.pitch = 0;
    } else if (preset === 'top') {
      this.yaw = 0;
      this.pitch = Math.PI / 2 - 0.01;
    }
    this.zoom = 1.0;
    this.render();
  },

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    const btn = document.getElementById('btn-3d-autorotate');
    if (btn) btn.classList.toggle('active', this.autoRotate);
    if (this.autoRotate) {
      const loop = () => {
        if (!this.autoRotate) return;
        this.yaw += 0.012;
        this.render();
        this.animId = requestAnimationFrame(loop);
      };
      loop();
    } else if (this.animId) {
      cancelAnimationFrame(this.animId);
    }
  },

  render() {
    if (!this.canvas || !this.ctx) {
      this.canvas = document.getElementById('canvas-3d');
      if (this.canvas) this.ctx = this.canvas.getContext('2d');
      else return;
    }

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cad = (window.LemonPack && window.LemonPack.cad) || { length: 120, width: 80, height: 150, glueFlap: 15, tuckFlap: 25 };
    const pUtils = window.PersianUtils || { fmtNum: (v,d)=>String(v) };

    ctx.clearRect(0, 0, w, h);

    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w / 1.4);
    const isDark = document.body && document.body.dataset && document.body.dataset.theme === 'dark';
    if (isDark) {
      bgGrad.addColorStop(0, '#1E293B');
      bgGrad.addColorStop(1, '#0F172A');
    } else {
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(1, '#E2E8F0');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const floorY = h * 0.78;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w / 2, floorY, w * 0.32 * this.zoom, h * 0.12 * this.zoom, 0, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(15, 23, 42, 0.12)';
    ctx.fill();
    ctx.restore();

    const L = Number(cad.length) || 120;
    const W = Number(cad.width) || 80;
    const H = Number(cad.height) || 150;
    const G = Number(cad.glueFlap) || 15;
    const T = Number(cad.tuckFlap) || 25;

    const fold = this.foldProgress;
    const theta = fold * (Math.PI / 2);

    const scale3d = (Math.min(w, h) / (Math.max(L, W, H) * 2.8)) * this.zoom;
    const cx = w / 2;
    const cy = h / 2 + 10;

    const rot = (pt) => {
      const cosP = Math.cos(this.pitch), sinP = Math.sin(this.pitch);
      const y1 = pt.y * cosP - pt.z * sinP;
      const z1 = pt.y * sinP + pt.z * cosP;

      const cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw);
      const x2 = pt.x * cosY + z1 * sinY;
      const z2 = -pt.x * sinY + z1 * cosY;

      const dist = 600;
      const persp = dist / (dist + z2);
      return {
        x: cx + x2 * scale3d * persp,
        y: cy - y1 * scale3d * persp,
        z: z2
      };
    };

    const faces = [];
    const addFace = (p1, p2, p3, p4, name, colorOuter, colorInner, extra = {}) => {
      const sp1 = rot(p1), sp2 = rot(p2), sp3 = rot(p3), sp4 = rot(p4);
      const avgZ = (sp1.z + sp2.z + sp3.z + sp4.z) / 4;
      const v1x = sp2.x - sp1.x, v1y = sp2.y - sp1.y;
      const v2x = sp4.x - sp1.x, v2y = sp4.y - sp1.y;
      const isFront = (v1x * v2y - v1y * v2x) < 0;

      faces.push({
        pts: [sp1, sp2, sp3, sp4],
        avgZ,
        isFront,
        name,
        colorOuter,
        colorInner,
        extra
      });
    };

    const matSub = (window.LemonPack && window.LemonPack.materials && window.LemonPack.materials.substrate) || 'inderboard';
    const cOuter = matSub === 'inderboard' ? '#F8FAFC' : '#F1F5F9';
    const cInner = '#E2D9CC';

    const fA = { x: -L/2, y: H/2, z: 0 };
    const fB = { x:  L/2, y: H/2, z: 0 };
    const fC = { x:  L/2, y: -H/2, z: 0 };
    const fD = { x: -L/2, y: -H/2, z: 0 };
    addFace(fA, fB, fC, fD, 'Front', cOuter, cInner, { isFrontPanel: true });

    const rB = { x: L/2, y: H/2, z: 0 };
    const rA = { x: L/2 + W * Math.cos(theta), y: H/2, z: -W * Math.sin(theta) };
    const rD = { x: L/2 + W * Math.cos(theta), y: -H/2, z: -W * Math.sin(theta) };
    const rC = { x: L/2, y: -H/2, z: 0 };
    addFace(rB, rA, rD, rC, 'Right', cOuter, cInner);

    const bB = rA;
    const bA = { x: rA.x - L * Math.sin(theta), y: H/2, z: rA.z - L * Math.cos(theta) };
    const bD = { x: rD.x - L * Math.sin(theta), y: -H/2, z: rD.z - L * Math.cos(theta) };
    const bC = rD;
    addFace(bB, bA, bD, bC, 'Back', cOuter, cInner);

    const lA = { x: -L/2, y: H/2, z: 0 };
    const lB = { x: -L/2 - W * Math.cos(theta), y: H/2, z: -W * Math.sin(theta) };
    const lC = { x: -L/2 - W * Math.cos(theta), y: -H/2, z: -W * Math.sin(theta) };
    const lD = { x: -L/2, y: -H/2, z: 0 };
    addFace(lB, lA, lD, lC, 'Left', cOuter, cInner);

    const gB = lB;
    const gA = { x: lB.x + G * Math.sin(theta), y: H/2, z: lB.z - G * Math.cos(theta) };
    const gD = { x: lC.x + G * Math.sin(theta), y: -H/2, z: lC.z - G * Math.cos(theta) };
    const gC = lC;
    addFace(gA, gB, gC, gD, 'Glue', '#10B981', '#E2D9CC');

    const topFlapAng = fold * (Math.PI / 2);
    const tB = { x: -L/2, y: H/2 + W * Math.cos(topFlapAng), z: -W * Math.sin(topFlapAng) };
    const tA = { x:  L/2, y: H/2 + W * Math.cos(topFlapAng), z: -W * Math.sin(topFlapAng) };
    addFace(fA, fB, tA, tB, 'TopCap', cOuter, cInner);

    const tuckLipAng = topFlapAng + fold * (Math.PI / 2);
    const ttB = { x: -L/2 + 4, y: tB.y + T * Math.cos(tuckLipAng), z: tB.z - T * Math.sin(tuckLipAng) };
    const ttA = { x:  L/2 - 4, y: tA.y + T * Math.cos(tuckLipAng), z: tA.z - T * Math.sin(tuckLipAng) };
    addFace(tB, tA, ttA, ttB, 'TuckLip', cOuter, cInner);

    const botFlapAng = fold * (Math.PI / 2);
    const btB = { x: -L/2, y: -H/2 - W * Math.cos(botFlapAng), z: -W * Math.sin(botFlapAng) };
    const btA = { x:  L/2, y: -H/2 - W * Math.cos(botFlapAng), z: -W * Math.sin(botFlapAng) };
    addFace(btB, btA, fC, fD, 'BottomCap', cOuter, cInner);

    faces.sort((a, b) => b.avgZ - a.avgZ);

    faces.forEach(f => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(f.pts[0].x, f.pts[0].y);
      for (let i = 1; i < f.pts.length; i++) {
        ctx.lineTo(f.pts[i].x, f.pts[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = f.isFront ? f.colorOuter : f.colorInner;
      ctx.fill();

      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (f.extra.isFrontPanel && f.isFront) {
        const mat = (window.LemonPack && window.LemonPack.materials) || {};

        if (mat.windowPatch && mat.windowPatch.enabled) {
          const winW = (mat.windowPatch.width || 45) / L;
          const winH = (mat.windowPatch.length || 70) / H;

          const p0 = f.pts[0], p1 = f.pts[1], p2 = f.pts[2], p3 = f.pts[3];
          const wx1 = p0.x + (p1.x - p0.x) * (0.5 - winW/2) + (p3.x - p0.x) * (0.5 - winH/2);
          const wy1 = p0.y + (p1.y - p0.y) * (0.5 - winW/2) + (p3.y - p0.y) * (0.5 - winH/2);
          const wx2 = p0.x + (p1.x - p0.x) * (0.5 + winW/2) + (p3.x - p0.x) * (0.5 - winH/2);
          const wy2 = p0.y + (p1.y - p0.y) * (0.5 + winW/2) + (p3.y - p0.y) * (0.5 - winH/2);
          const wx3 = p0.x + (p1.x - p0.x) * (0.5 + winW/2) + (p3.x - p0.x) * (0.5 + winH/2);
          const wy3 = p0.y + (p1.y - p0.y) * (0.5 + winW/2) + (p3.y - p0.y) * (0.5 + winH/2);
          const wx4 = p0.x + (p1.x - p0.x) * (0.5 - winW/2) + (p3.x - p0.x) * (0.5 + winH/2);
          const wy4 = p0.y + (p1.y - p0.y) * (0.5 - winW/2) + (p3.y - p0.y) * (0.5 + winH/2);

          ctx.beginPath();
          ctx.moveTo(wx1, wy1); ctx.lineTo(wx2, wy2); ctx.lineTo(wx3, wy3); ctx.lineTo(wx4, wy4);
          ctx.closePath();
          ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
          ctx.fill();
          ctx.strokeStyle = '#0284C7';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        if (mat.foilStamp && mat.foilStamp.enabled) {
          const foilCol = mat.foilStamp.color === 'silver' ? '#E2E8F0' : '#F59E0B';
          const midX = (f.pts[0].x + f.pts[1].x + f.pts[2].x + f.pts[3].x) / 4;
          const midY = (f.pts[0].y + f.pts[1].y + f.pts[2].y + f.pts[3].y) / 4 - 15;

          ctx.beginPath();
          ctx.arc(midX, midY, 16 * scale3d, 0, Math.PI * 2);
          ctx.fillStyle = foilCol;
          ctx.fill();
          ctx.strokeStyle = '#B45309';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.font = 'bold ' + Math.max(8, Math.round(10 * scale3d)) + 'px Peyda, sans-serif';
          ctx.fillStyle = '#78350F';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('LEMON', midX, midY);
        }
      }

      ctx.restore();
    });

    ctx.save();
    ctx.font = 'bold 11px Peyda, sans-serif';
    ctx.fillStyle = '#D97706';
    ctx.textAlign = 'center';
    const bMid = (fC.x + fD.x) / 2;
    const bMidPt = rot({ x: bMid, y: -H/2 - 14, z: 0 });
    ctx.fillText('طول L: ' + pUtils.fmtNum(L) + ' mm', bMidPt.x, bMidPt.y);

    ctx.fillStyle = '#0284C7';
    const hMidPt = rot({ x: L/2 + 20, y: 0, z: 0 });
    ctx.fillText('ارتفاع H: ' + pUtils.fmtNum(H) + ' mm', hMidPt.x, hMidPt.y);

    // Active Die Top Banner Badge
    const dieTitle = (cad.customDie && cad.customDie.active && cad.customDie.fileName) ? `قالب اختصاصی: ${cad.customDie.fileName}` : 'پیش‌نمایش سه‌بعدی هندسی جعبه';
    ctx.font = 'bold 11px Peyda, sans-serif';
    ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
    ctx.fillText(`${dieTitle} (${pUtils.fmtNum(L)} × ${pUtils.fmtNum(W)} × ${pUtils.fmtNum(H)} mm)`, w / 2, 22);
    ctx.restore();
  }
};
