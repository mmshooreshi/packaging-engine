/* ============================================================
   2D SHEET NESTING OPTIMIZER & INTERACTIVE SHEET CANVAS
   With 2.5-Sheet Cuts & Multi-Option Pagination Engine
   ============================================================ */

window.NestingEngine = {
  MACHINE_CONSTRAINTS: {
    pressClasses: [
      { id: 'press_1_5', nameFa: 'دستگاه ۱.۵ ورقی', maxL: 50.0, maxW: 35.0 },
      { id: 'press_2_5', nameFa: 'دستگاه ۲.۵ ورقی', maxL: 72.0, maxW: 52.0 },
      { id: 'press_4_5', nameFa: 'دستگاه ۴.۵ ورقی', maxL: 100.0, maxW: 70.0 }
    ],
    gripperMarginCm: 1.5,
    interGutterMm: 4.0,
    safetyMarginMm: 5.0
  },

  // Standard raw parent sheets in Iranian market (100x70, 90x60, 100x80, 120x80)
  PARENT_SHEETS: [
    { length: 100, width: 70, name: '۱۰۰×۷۰ (۴.۵ ورقی کامل)' },
    { length: 90, width: 60, name: '۹۰×۶۰ (۳ ورقی)' },
    { length: 100, width: 80, name: '۱۰۰×۸۰ (سایز خاص)' },
    { length: 120, width: 80, name: '۱۲۰×۸۰ (سایز بزرگ)' }
  ],

  // Press 2.5 cut sub-sheets (70x50, 70x40, 70x35, 70x30, 60x45, 60x30, 50x35)
  SUB_CUT_PRESETS: [
    { length: 70, width: 50, parent: '100x70', cutsCount: 2, name: '۷۰×۵۰ (نصف ۱۰۰×۷۰)' },
    { length: 70, width: 40, parent: '100x70', cutsCount: 2, name: '۷۰×۴۰ (برش طولی ۴۰)' },
    { length: 70, width: 35, parent: '100x70', cutsCount: 2, name: '۷۰×۳۵ (نصف عرضی ۷۰)' },
    { length: 70, width: 30, parent: '100x70', cutsCount: 3, name: '۷۰×۳۰ (۳ تکه از ۱۰۰×۷۰)' },
    { length: 60, width: 45, parent: '90x60', cutsCount: 2, name: '۶۰×۴۵ (نصف ۹۰×۶۰)' },
    { length: 60, width: 30, parent: '90x60', cutsCount: 3, name: '۶۰×۳۰ (۳ تکه از ۹۰×۶۰)' },
    { length: 50, width: 35, parent: '100x70', cutsCount: 4, name: '۵۰×۳۵ (یک‌چهارم ۱۰۰×۷۰)' }
  ],

  allOptions: [],
  currentPage: 0,
  pageSize: 3,
  selectedOptionIndex: 0,
  hoverPoint: null,

  init() {
    this.setupNestingHover();
  },

  setupNestingHover() {
    const canvas = document.getElementById('nesting-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
      this.hoverPoint = { x: mouseX, y: mouseY };
      this.renderCanvas();
    });

    canvas.addEventListener('mouseleave', () => {
      this.hoverPoint = null;
      this.renderCanvas();
    });
  },

  optimize() {
    const cad = window.LemonPack.cad;
    const flatLcm = (cad.flatL + this.MACHINE_CONSTRAINTS.interGutterMm) / 10;
    const flatWcm = (cad.flatW + this.MACHINE_CONSTRAINTS.interGutterMm) / 10;
    const gripper = this.MACHINE_CONSTRAINTS.gripperMarginCm;
    const safety = (this.MACHINE_CONSTRAINTS.safetyMarginMm * 2) / 10;

    const candidates = [];

    // Evaluate all 2.5 sheet cut presets and standard sheets
    const sheetsToEvaluate = [...this.SUB_CUT_PRESETS, ...this.PARENT_SHEETS.map(p => ({ ...p, cutsCount: 1 }))];

    sheetsToEvaluate.forEach(s => {
      // Usable area considering gripper on length edge
      const usableL = s.length - gripper - safety;
      const usableW = s.width - safety;

      // Orientation A: length along sheet length, width along sheet width
      const colsA = Math.floor(usableL / flatLcm);
      const rowsA = Math.floor(usableW / flatWcm);
      const upsA = Math.max(0, colsA * rowsA);

      // Orientation B: rotated 90 degrees
      const colsB = Math.floor(usableL / flatWcm);
      const rowsB = Math.floor(usableW / flatWcm);
      const upsB = Math.max(0, colsB * rowsB);

      const maxUps = Math.max(upsA, upsB);
      if (maxUps > 0) {
        const bestOrient = upsA >= upsB ? 'A' : 'B';
        const cols = bestOrient === 'A' ? colsA : colsB;
        const rows = bestOrient === 'A' ? rowsA : rowsB;
        const pieceArea = (cad.flatL * cad.flatW) / 100;
        const sheetArea = s.length * s.width;
        const waste = Math.max(0, 100 - (((maxUps * pieceArea) / sheetArea) * 100));

        // Machine class classification
        let pressClass = 'دستگاه ۲.۵ ورقی';
        if (s.length <= 50 && s.width <= 35) {
          pressClass = 'دستگاه ۱.۵ ورقی';
        } else if (s.length <= 72 && s.width <= 52) {
          pressClass = 'دستگاه ۲.۵ ورقی';
        } else {
          pressClass = 'دستگاه ۴.۵ ورقی';
        }

        candidates.push({
          sheetL: s.length,
          sheetW: s.width,
          name: s.name || `${s.length}×${s.width}`,
          parent: s.parent || `${s.length}×${s.width}`,
          cutsCount: s.cutsCount || 1,
          ups: maxUps,
          cols: cols,
          rows: rows,
          orientation: bestOrient,
          wastePercentage: Number(waste.toFixed(1)),
          pressClass: pressClass,
          efficiencyScore: (maxUps * 10) - (waste * 0.5)
        });
      }
    });

    // Deduplicate and sort by best efficiency / ups
    const uniqueMap = {};
    candidates.forEach(c => {
      const key = `${c.sheetL}x${c.sheetW}-${c.ups}-${c.orientation}`;
      if (!uniqueMap[key] || uniqueMap[key].wastePercentage > c.wastePercentage) {
        uniqueMap[key] = c;
      }
    });

    this.allOptions = Object.values(uniqueMap).sort((a, b) => b.efficiencyScore - a.efficiencyScore);

    if (this.allOptions.length === 0) {
      this.allOptions = [{
        sheetL: 70, sheetW: 50, name: '۷۰×۵۰ (۲.۵ ورقی)', parent: '100x70', cutsCount: 2,
        ups: 4, cols: 2, rows: 2, orientation: 'A', wastePercentage: 22.5, pressClass: 'دستگاه ۲.۵ ورقی'
      }];
    }

    if (this.selectedOptionIndex >= this.allOptions.length) {
      this.selectedOptionIndex = 0;
    }

    this.applyOption(this.selectedOptionIndex);
    this.renderPaginationUI();
  },

  applyOption(index) {
    this.selectedOptionIndex = index;
    const opt = this.allOptions[index];
    if (!opt) return;

    const nest = window.LemonPack.nesting;
    nest.sheetL = opt.sheetL;
    nest.sheetW = opt.sheetW;
    nest.ups = opt.ups;
    nest.cols = opt.cols;
    nest.rows = opt.rows;
    nest.wastePercentage = opt.wastePercentage;
    nest.orientation = opt.orientation;
    nest.pressClass = opt.pressClass;

    const pUtils = window.PersianUtils || { e2p: function(v){ return v; } };
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('hud-ups', pUtils.e2p(nest.ups) + ' کار');
    setTxt('hud-sheet', pUtils.e2p(nest.sheetL) + ' × ' + pUtils.e2p(nest.sheetW));
    setTxt('hud-press', nest.pressClass);
    setTxt('hud-waste', pUtils.e2p(nest.wastePercentage) + '٪');
  },

  renderPaginationUI() {
    const container = document.getElementById('nesting-options-pagination');
    if (!container) return;

    const pUtils = window.PersianUtils || { e2p: function(v){ return v; } };
    const totalPages = Math.ceil(this.allOptions.length / this.pageSize) || 1;
    if (this.currentPage >= totalPages) this.currentPage = totalPages - 1;
    if (this.currentPage < 0) this.currentPage = 0;

    const startIdx = this.currentPage * this.pageSize;
    const pageItems = this.allOptions.slice(startIdx, startIdx + this.pageSize);

    let html = '<div class="nest-options-list" style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;">';

    pageItems.forEach((opt, localIdx) => {
      const globalIdx = startIdx + localIdx;
      const isSelected = globalIdx === this.selectedOptionIndex;
      html += `
        <div class="nest-option-card ${isSelected ? 'active' : ''}" onclick="NestingEngine.selectOption(${globalIdx})" style="
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          border: 1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-color)'};
          background: ${isSelected ? 'rgba(217, 119, 6, 0.12)' : 'var(--surface-base)'};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.78rem;
          transition: all 0.15s;
        ">
          <div>
            <strong style="color:var(--graphite-text); font-size:0.82rem;">${pUtils.e2p(opt.sheetL)} × ${pUtils.e2p(opt.sheetW)} cm</strong>
            <span style="color:var(--text-muted); font-size:0.72rem; margin-right:6px;">(${opt.name})</span>
            <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">
              ${pUtils.e2p(opt.rows)} ردیف × ${pUtils.e2p(opt.cols)} ستون (${pUtils.e2p(opt.cols)} در هر ردیف)
            </div>
          </div>
          <div style="text-align:left;">
            <div style="font-weight:900; color:var(--brand-primary); font-size:0.88rem;">${pUtils.e2p(opt.ups)} کار در فرم</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">دورریز: ${pUtils.e2p(opt.wastePercentage)}٪</div>
          </div>
        </div>
      `;
    });

    html += '</div>';

    // Pagination buttons footer
    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.74rem;">
        <button class="btn btn-outline btn-sm" onclick="NestingEngine.prevPage()" ${this.currentPage === 0 ? 'disabled' : ''} style="padding:0 8px;">
          <i class="ph ph-caret-right"></i> گزینه‌های قبلی
        </button>
        <span style="color:var(--text-muted); font-weight:700;">
          صفحه ${pUtils.e2p(this.currentPage + 1)} از ${pUtils.e2p(totalPages)} (${pUtils.e2p(this.allOptions.length)} آرایش شیت)
        </span>
        <button class="btn btn-outline btn-sm" onclick="NestingEngine.nextPage()" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''} style="padding:0 8px;">
          گزینه‌های بعدی <i class="ph ph-caret-left"></i>
        </button>
      </div>
    `;

    container.innerHTML = html;
  },

  selectOption(globalIdx) {
    this.applyOption(globalIdx);
    this.renderPaginationUI();
    this.renderCanvas();
    if (window.CostEngine) window.CostEngine.calculate();
    if (window.InvoiceEngine) window.InvoiceEngine.render();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  nextPage() {
    const totalPages = Math.ceil(this.allOptions.length / this.pageSize);
    if (this.currentPage < totalPages - 1) {
      this.currentPage++;
      this.renderPaginationUI();
      if (window.SoundEngine) window.SoundEngine.playClick();
    }
  },

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.renderPaginationUI();
      if (window.SoundEngine) window.SoundEngine.playClick();
    }
  },

  renderCanvas() {
    const canvas = document.getElementById('nesting-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const nest = window.LemonPack.nesting;
    const cad = window.LemonPack.cad;

    const padding = 25;
    const availW = w - (padding * 2);
    const availH = h - (padding * 2);
    const scale = Math.min(availW / nest.sheetL, availH / nest.sheetW);

    const drawSheetW = nest.sheetL * scale;
    const drawSheetH = nest.sheetW * scale;
    const startX = (w - drawSheetW) / 2;
    const startY = (h - drawSheetH) / 2;

    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(startX, startY, drawSheetW, drawSheetH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, startY, drawSheetW, drawSheetH);

    const gripperDraw = this.MACHINE_CONSTRAINTS.gripperMarginCm * scale;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.fillRect(startX + drawSheetW - gripperDraw, startY, gripperDraw, drawSheetH);
    ctx.strokeStyle = '#DC2626';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(startX + drawSheetW - gripperDraw, startY);
    ctx.lineTo(startX + drawSheetW - gripperDraw, startY + drawSheetH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 9px Peyda, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('لب‌پنجه (۱.۵cm)', startX + drawSheetW - (gripperDraw / 2), startY + (drawSheetH / 2));

    const flatLcm = (cad.flatL + this.MACHINE_CONSTRAINTS.interGutterMm) / 10;
    const flatWcm = (cad.flatW + this.MACHINE_CONSTRAINTS.interGutterMm) / 10;
    const pieceW = (nest.orientation === 'A' ? flatLcm : flatWcm) * scale;
    const pieceH = (nest.orientation === 'A' ? flatWcm : flatLcm) * scale;

    const cols = Math.floor((nest.sheetL - this.MACHINE_CONSTRAINTS.gripperMarginCm) / (nest.orientation === 'A' ? flatLcm : flatWcm));
    const rows = Math.floor(nest.sheetW / (nest.orientation === 'A' ? flatWcm : flatLcm));

    let boxIndex = 1;
    const pUtils = window.PersianUtils || { e2p: function(v){ return v; } };

    let activeHoverCell = null;
    const mouse = this.hoverPoint;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = startX + 8 + (c * pieceW);
        const by = startY + 8 + (r * pieceH);
        const cellW = pieceW - 3;
        const cellH = pieceH - 3;
        const currentBoxIdx = boxIndex++;

        // Hover detection on cell
        if (mouse && mouse.x >= bx && mouse.x <= bx + cellW && mouse.y >= by && mouse.y <= by + cellH) {
          activeHoverCell = {
            index: currentBoxIdx,
            row: r + 1,
            col: c + 1,
            text: `جعبه ${pUtils.e2p(currentBoxIdx)} (ردیف ${pUtils.e2p(r+1)}، ستون ${pUtils.e2p(c+1)}) | گسترده: ${pUtils.e2p(cad.flatL)}×${pUtils.e2p(cad.flatW)} mm`
          };
          ctx.fillStyle = 'rgba(217, 119, 6, 0.22)';
        } else {
          ctx.fillStyle = 'rgba(217, 119, 6, 0.06)';
        }

        ctx.fillRect(bx, by, cellW, cellH);

        // If custom SVG diecut is active, draw miniature vector contours in each nested cell
        if (cad.customDie && cad.customDie.active && cad.customDie.paths && cad.customDie.paths.length > 0) {
          const b = cad.customDie.bounds || { minX: 0, minY: 0, width: cad.flatL, height: cad.flatW };
          const pScale = Math.min((cellW - 4) / b.width, (cellH - 4) / b.height);

          ctx.save();
          ctx.beginPath();
          ctx.rect(bx, by, cellW, cellH);
          ctx.clip();

          ctx.translate(bx + cellW / 2, by + cellH / 2);
          ctx.scale(pScale, pScale);
          ctx.translate(-b.minX - b.width / 2, -b.minY - b.height / 2);

          cad.customDie.paths.forEach(p => {
            if (!p.visible || p.type === 'ignore') return;
            if (p.type === 'cut') {
              ctx.strokeStyle = '#DC2626';
              ctx.lineWidth = 1.2 / pScale;
              ctx.setLineDash([]);
            } else if (p.type === 'crease') {
              ctx.strokeStyle = '#2563EB';
              ctx.lineWidth = 0.9 / pScale;
              ctx.setLineDash([3 / pScale, 3 / pScale]);
            } else if (p.type === 'glue') {
              ctx.strokeStyle = '#059669';
              ctx.lineWidth = 1.2 / pScale;
              ctx.setLineDash([]);
            } else if (p.type === 'guide') {
              ctx.strokeStyle = '#EAB308';
              ctx.lineWidth = 0.8 / pScale;
              ctx.setLineDash([2 / pScale, 2 / pScale]);
            } else {
              ctx.strokeStyle = '#94A3B8';
              ctx.lineWidth = 0.8 / pScale;
              ctx.setLineDash([]);
            }

            try {
              const path2d = new Path2D(p.d);
              ctx.stroke(path2d);
            } catch (e) {}
          });

          ctx.restore();
        } else {
          // Parametric fallback box
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(bx, by, cellW, cellH);

          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(bx, by + (cellH * 0.3));
          ctx.lineTo(bx + cellW, by + (cellH * 0.3));
          ctx.moveTo(bx, by + (cellH * 0.7));
          ctx.lineTo(bx + cellW, by + (cellH * 0.7));
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.fillStyle = '#1E293B';
        ctx.font = 'bold 10px Peyda, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pUtils.e2p(currentBoxIdx), bx + (cellW / 2), by + (cellH / 2) + 3);
      }
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '10px Peyda, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ابعاد شیت انتخابی: ' + pUtils.e2p(nest.sheetL) + ' × ' + pUtils.e2p(nest.sheetW) + ' سانتی‌متر', w / 2, h - 8);

    // Render Floating Hover Badge
    if (mouse && activeHoverCell && window.CadEngine && window.CadEngine.drawHoverBadge) {
      window.CadEngine.drawHoverBadge(ctx, mouse.x, mouse.y, activeHoverCell.text);
    }
  }
};
