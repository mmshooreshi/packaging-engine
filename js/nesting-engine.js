/* ============================================================
   LEMONPACK PRO v2.5.0
   INDUSTRIAL IMPOSITION, ZERO-OVERLAP NESTING & DIE-CUT RENDERER
   ============================================================ */

window.NestingEngine = {
  CLEARANCES_MM: {
    gripperMarginMm: 15.0,
    tailMarginMm: 5.0,
    sideMarginLeftMm: 5.0,
    sideMarginRightMm: 5.0,
    interDieGutterMm: 4.0
  },

  PRESS_PORTFOLIO: {
    press_2_5: {
      id: 'press_2_5',
      name: 'دستگاه ۲.۵ ورقی (Heidelberg / Roland SM 74)',
      shortName: 'دستگاه ۲.۵ ورقی',
      maxSheetCm: { length: 72.0, width: 52.0 },
      minSheetCm: { length: 35.0, width: 28.0 },
      maxPrintableAreaMm: { length: 700.0, width: 510.0 },
      cmykPlatesCostToman: 5600000,
      runRatePer5000Toman: 13000000
    },
    press_4_5: {
      id: 'press_4_5',
      name: 'دستگاه ۴.۵ ورقی (Heidelberg CD 102)',
      shortName: 'دستگاه ۴.۵ ورقی',
      maxSheetCm: { length: 104.0, width: 72.0 },
      minSheetCm: { length: 50.0, width: 40.0 },
      maxPrintableAreaMm: { length: 1020.0, width: 710.0 },
      cmykPlatesCostToman: 8800000,
      runRatePer5000Toman: 19000000
    }
  },

  STANDARD_MARKET_SHEETS: [
    {
      id: 'sheet_70x100',
      name: '۷۰ × ۱۰۰ سانتیمتر',
      shortName: '۱۰۰×۷۰',
      lengthCm: 100.0,
      widthCm: 70.0,
      grainDirection: 'parallel_to_100_cm',
      slittingOptions: [
        {
          id: 'slit_50x70',
          name: '۷۰×۵۰ (نصف ۱۰۰×۷۰)',
          lengthCm: 70.0,
          widthCm: 50.0,
          multiplier: 2,
          targetPress: 'press_2_5',
          grainDirection: 'parallel_to_70_cm'
        }
      ]
    },
    {
      id: 'sheet_60x90',
      name: '۶۰ × ۹۰ سانتیمتر',
      shortName: '۹۰×۶۰',
      lengthCm: 90.0,
      widthCm: 60.0,
      grainDirection: 'parallel_to_90_cm',
      slittingOptions: [
        {
          id: 'slit_45x60',
          name: '۶۰×۴۵ (نصف ۹۰×۶۰)',
          lengthCm: 60.0,
          widthCm: 45.0,
          multiplier: 2,
          targetPress: 'press_2_5',
          grainDirection: 'parallel_to_60_cm'
        }
      ]
    }
  ],

  allOptions: [],
  topRecommendations: [],
  smartAssistantAlerts: [],
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
    const mat = window.LemonPack.materials || { gsm: 300 };
    const rates = window.LemonPack.rates || {};
    const orderQty = Math.max(1, Number(cad.orderQty) || 1000);
    const paperRatePerKg = Number(rates.paper_price_per_kg_toman) || 520000;

    const flatL_mm = Math.max(20, Number(cad.flatL) || 310);
    const flatW_mm = Math.max(20, Number(cad.flatW) || 220);
    const gutter_mm = this.CLEARANCES_MM.interDieGutterMm;
    const gripper_mm = this.CLEARANCES_MM.gripperMarginMm;
    const tail_mm = this.CLEARANCES_MM.tailMarginMm;
    const side_mm = this.CLEARANCES_MM.sideMarginLeftMm + this.CLEARANCES_MM.sideMarginRightMm;

    const candidates = [];

    const evaluateBlankLayout = (parentSheet, isSlit, blankL_cm, blankW_cm, targetMachineId) => {
      const machine = this.PRESS_PORTFOLIO[targetMachineId];
      if (!machine) return;

      const blankL_mm = blankL_cm * 10;
      const blankW_mm = blankW_cm * 10;

      const usableL_mm = blankL_mm - (gripper_mm + tail_mm);
      const usableW_mm = blankW_mm - side_mm;

      if (usableL_mm <= 0 || usableW_mm <= 0) return;

      // Mode 1: Orthogonal Normal
      const colsNorm = Math.floor((usableL_mm + gutter_mm) / (flatL_mm + gutter_mm));
      const rowsNorm = Math.floor((usableW_mm + gutter_mm) / (flatW_mm + gutter_mm));
      const upsNorm = Math.max(0, colsNorm * rowsNorm);

      if (upsNorm > 0) {
        candidates.push(this.buildOption({
          parentSheet, isSlit, blankL_cm, blankW_cm,
          layoutMode: 'orthogonal_normal',
          layoutModeFa: 'چیدمان مستقیم (استاندارد)',
          cols: colsNorm, rows: rowsNorm, pairCols: 0,
          upsPerBlank: upsNorm,
          flatL_mm, flatW_mm,
          targetMachine: targetMachineId,
          grainCompliant: true,
          orderQty, paperRatePerKg, gsm: mat.gsm || 300
        }));
      }

      // Mode 2: Orthogonal Rotated 90
      const colsRot = Math.floor((usableL_mm + gutter_mm) / (flatW_mm + gutter_mm));
      const rowsRot = Math.floor((usableW_mm + gutter_mm) / (flatL_mm + gutter_mm));
      const upsRot = Math.max(0, colsRot * rowsRot);

      if (upsRot > 0) {
        candidates.push(this.buildOption({
          parentSheet, isSlit, blankL_cm, blankW_cm,
          layoutMode: 'orthogonal_rotated',
          layoutModeFa: 'چیدمان چرخشی ۹۰ درجه',
          cols: colsRot, rows: rowsRot, pairCols: 0,
          upsPerBlank: upsRot,
          flatL_mm, flatW_mm,
          targetMachine: targetMachineId,
          grainCompliant: true,
          orderQty, paperRatePerKg, gsm: mat.gsm || 300
        }));
      }
    };

    this.STANDARD_MARKET_SHEETS.forEach(parent => {
      evaluateBlankLayout(parent, false, parent.lengthCm, parent.widthCm, 'press_4_5');
      if (parent.slittingOptions) {
        parent.slittingOptions.forEach(slit => {
          evaluateBlankLayout(parent, true, slit.lengthCm, slit.widthCm, slit.targetPress || 'press_2_5');
        });
      }
    });

    candidates.sort((a, b) => a.totalCogs_toman - b.totalCogs_toman);

    if (candidates.length > 0) {
      candidates[0].isBestValue = true;
      candidates[0].badgeText = 'پیشنهاد طلایی (بهینه‌ترین)';
    }

    this.allOptions = candidates.length > 0 ? candidates : [this.getFallbackOption(orderQty, paperRatePerKg, mat.gsm || 300)];
    this.topRecommendations = this.allOptions.slice(0, 3);
    
    // Auto-select best option
    if (this.selectedOptionIndex >= this.allOptions.length) {
      this.selectedOptionIndex = 0;
    }
    this.applyOption(this.selectedOptionIndex);
    this.renderPaginationUI();
    this.renderRecommendationCards();
  },

  buildOption(p) {
    const parentSheet = p.parentSheet;
    const isSlit = p.isSlit;
    const blankL_cm = p.blankL_cm;
    const blankW_cm = p.blankW_cm;
    const layoutMode = p.layoutMode;
    const layoutModeFa = p.layoutModeFa;
    const cols = p.cols;
    const rows = p.rows;
    const pairCols = p.pairCols || 0;
    const upsPerBlank = p.upsPerBlank;
    const flatL_mm = p.flatL_mm;
    const flatW_mm = p.flatW_mm;
    const targetMachine = p.targetMachine;
    const grainCompliant = p.grainCompliant;
    const orderQty = p.orderQty;
    const paperRatePerKg = p.paperRatePerKg;
    const gsm = p.gsm;

    const machine = this.PRESS_PORTFOLIO[targetMachine];
    const multiplier = isSlit ? 2 : 1;
    const upsPerParentSheet = upsPerBlank * multiplier;

    const blankAreaCm2 = blankL_cm * blankW_cm;
    const cartonAreaCm2 = (flatL_mm * flatW_mm) / 100;
    const totalCartonAreaCm2 = upsPerBlank * cartonAreaCm2;
    const wastePercentage = Math.max(0, Math.min(100, Number((((blankAreaCm2 - totalCartonAreaCm2) / blankAreaCm2) * 100).toFixed(1))));

    const plateCost_toman = machine.cmykPlatesCostToman;
    const impressions = Math.ceil(orderQty / upsPerBlank);
    const pressRuns5000 = Math.ceil(impressions / 5000) || 1;
    const pressRunCost_toman = pressRuns5000 * machine.runRatePer5000Toman;

    const requiredBlanks = impressions;
    const requiredParentSheets = Math.ceil(requiredBlanks / multiplier);
    const wasteSheets = Math.max(150, Math.ceil(requiredParentSheets * 0.08));
    const procuredParentSheets = requiredParentSheets + wasteSheets;

    const parentSheetAreaM2 = (parentSheet.lengthCm / 100) * (parentSheet.widthCm / 100);
    const singleSheetWeightKg = parentSheetAreaM2 * (gsm / 1000);
    const totalPaperWeightKg = procuredParentSheets * singleSheetWeightKg;
    const paperCost_toman = Math.round(totalPaperWeightKg * paperRatePerKg);

    const arbitrationCost = 0;
    const totalCogs_toman = plateCost_toman + pressRunCost_toman + paperCost_toman + arbitrationCost;
    const finalInvoice_toman = Math.round(totalCogs_toman * 1.30);
    const unitPrice_toman = Math.round(finalInvoice_toman / orderQty);

    return {
      id: `${parentSheet.id}_${isSlit ? 'slit' : 'full'}_${layoutMode}_${targetMachine}`,
      parentSheetName: parentSheet.shortName,
      parentSheetFull: parentSheet.name,
      isSlitToHalf: isSlit,
      blankLength_cm: blankL_cm,
      blankWidth_cm: blankW_cm,
      layoutMode,
      layoutModeFa,
      cols,
      rows,
      pairCols,
      upsPerBlank,
      upsPerParentSheet,
      wastePercentage,
      targetMachine,
      targetMachineName: machine.name,
      targetMachineShort: machine.shortName,
      plateCost_toman,
      pressRunCost_toman,
      procuredParentSheets,
      impressions,
      paperCost_toman,
      arbitrationCost,
      totalCogs_toman,
      finalInvoice_toman,
      unitPrice_toman,
      grainCompliant,
      isBestValue: false
    };
  },

  getFallbackOption(orderQty, paperRate, gsm) {
    return {
      id: 'fallback_opt',
      parentSheetName: '۱۰۰×۷۰',
      parentSheetFull: '۷۰ × ۱۰۰ سانتیمتر',
      isSlitToHalf: true,
      blankLength_cm: 70.0,
      blankWidth_cm: 50.0,
      layoutMode: 'orthogonal_normal',
      layoutModeFa: 'چیدمان مستقیم (استاندارد)',
      cols: 2,
      rows: 2,
      pairCols: 0,
      upsPerBlank: 4,
      upsPerParentSheet: 8,
      wastePercentage: 19.8,
      targetMachine: 'press_2_5',
      targetMachineName: 'دستگاه ۲.۵ ورقی (Heidelberg / Roland SM 74)',
      targetMachineShort: 'دستگاه ۲.۵ ورقی',
      plateCost_toman: 5600000,
      pressRunCost_toman: 13000000,
      procuredParentSheets: 300,
      impressions: 600,
      paperCost_toman: 24000000,
      arbitrationCost: 0,
      totalCogs_toman: 55000000,
      finalInvoice_toman: 71500000,
      unitPrice_toman: 71500,
      grainCompliant: true,
      isBestValue: true,
      badgeText: 'پیشنهاد طلایی'
    };
  },

  applyOption(index) {
    this.selectedOptionIndex = index;
    const opt = this.allOptions[index];
    if (!opt) return;

    const nest = window.LemonPack.nesting;
    nest.sheetL = opt.blankLength_cm;
    nest.sheetW = opt.blankWidth_cm;
    nest.parentSheetName = opt.parentSheetName;
    nest.isSlitToHalf = opt.isSlitToHalf;
    nest.ups = opt.upsPerBlank;
    nest.upsPerParent = opt.upsPerParentSheet;
    nest.cols = opt.cols;
    nest.rows = opt.rows;
    nest.pairCols = opt.pairCols;
    nest.layoutMode = opt.layoutMode;
    nest.wastePercentage = opt.wastePercentage;
    nest.pressClass = opt.targetMachineShort;
    nest.targetMachine = opt.targetMachine;
    nest.grainCompliant = opt.grainCompliant;

    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: v => String(v) };
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('hud-ups', pUtils.fmtNum(nest.ups) + ' کار');
    setTxt('hud-sheet', pUtils.fmtNum(nest.sheetL) + ' × ' + pUtils.fmtNum(nest.sheetW));
    setTxt('hud-press', nest.pressClass);
    setTxt('hud-waste', pUtils.fmtNum(nest.wastePercentage, 1) + '٪');
  },

  selectOption(globalIdx) {
    this.applyOption(globalIdx);
    this.renderPaginationUI();
    this.renderRecommendationCards();
    this.renderCanvas();
    if (window.CostEngine) window.CostEngine.calculate();
    if (window.InvoiceEngine) window.InvoiceEngine.render();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  renderRecommendationCards() {
    const container = document.getElementById('recommendations-cockpit-container');
    if (!container) return;

    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v) };
    if (this.topRecommendations.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = `
      <div style="margin-bottom:12px;">
        <div style="font-weight:800; font-size:0.86rem; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
          <span style="display:flex; align-items:center; gap:6px; color:var(--graphite-text);">
            <i class="ph ph-trophy" style="color:#D97706; font-size:1.1rem;"></i>
            <span>کارت‌های مقایسه و انتخاب ماشین و فرم‌بندی</span>
          </span>
          <span style="font-size:0.72rem; color:var(--text-muted);">تحلیل خودکار هزینه زینک + دور چاپ + باطله مقوا</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:10px;">
    `;

    this.topRecommendations.forEach((opt, idx) => {
      const isSelected = this.allOptions.indexOf(opt) === this.selectedOptionIndex;
      const isGold = opt.isBestValue;
      const borderClr = isGold ? '#D97706' : (isSelected ? 'var(--brand-primary)' : 'var(--border-color)');
      const bgClr = isGold ? 'rgba(217, 119, 6, 0.07)' : (isSelected ? 'rgba(217, 119, 6, 0.04)' : 'var(--surface-base)');

      html += `
        <div class="cockpit-rec-card" onclick="NestingEngine.selectOption(${this.allOptions.indexOf(opt)})" style="
          border: 2px solid ${borderClr};
          background: ${bgClr};
          border-radius: var(--radius-sm);
          padding: 10px 12px;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        ">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span class="badge ${isGold ? 'badge-primary' : 'badge-subtle'}" style="font-size:0.68rem; font-weight:800;">
                ${opt.badgeText || (idx === 0 ? 'پیشنهاد طلایی' : `گزینه ${idx+1}`)}
              </span>
              ${isSelected ? '<span style="color:var(--brand-primary); font-weight:900; font-size:0.75rem;"><i class="ph ph-check-circle font-bold"></i> انتخابی</span>' : ''}
            </div>

            <div style="font-weight:800; font-size:0.86rem; color:var(--graphite-text); margin-bottom:2px;">
              شیت ${pUtils.fmtNum(opt.blankLength_cm)} × ${pUtils.fmtNum(opt.blankWidth_cm)} cm
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:6px;">
              ${opt.targetMachineShort} | ${opt.layoutModeFa}
            </div>

            <div style="background:rgba(255,255,255,0.7); border-radius:4px; padding:6px 8px; margin-bottom:8px; border:1px solid var(--border-light); font-size:0.72rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <span>تعداد در شیت:</span>
                <strong style="color:var(--brand-primary);">${pUtils.fmtNum(opt.upsPerBlank)} کار</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <span>درصد دورریز:</span>
                <strong class="tabular-nums">${pUtils.fmtNum(opt.wastePercentage, 1)}٪</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>تعداد شیت مادر:</span>
                <strong class="tabular-nums">${pUtils.fmtNum(opt.procuredParentSheets)} شیت</strong>
              </div>
            </div>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; border-top:1px dashed var(--border-light); padding-top:6px;">
              <span style="font-size:0.7rem; color:var(--text-muted);">قیمت هر عدد:</span>
              <strong style="font-size:0.88rem; color:var(--brand-primary);">${pUtils.fmtNum(opt.unitPrice_toman)} تومان</strong>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
  },

  renderPaginationUI() {
    const container = document.getElementById('nesting-options-pagination');
    if (!container) return;

    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v) };
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
            <div style="display:flex; align-items:center; gap:6px;">
              <strong style="color:var(--graphite-text); font-size:0.82rem;">${pUtils.fmtNum(opt.blankLength_cm)} × ${pUtils.fmtNum(opt.blankWidth_cm)} cm</strong>
              <span style="color:var(--text-muted); font-size:0.72rem;">(${opt.targetMachineShort})</span>
            </div>
            <div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">
              ${opt.layoutModeFa} | ${pUtils.fmtNum(opt.rows)} ردیف × ${pUtils.fmtNum(opt.cols)} کار
            </div>
          </div>
          <div style="text-align:left;">
            <div style="font-weight:900; color:var(--brand-primary); font-size:0.88rem;">${pUtils.fmtNum(opt.upsPerBlank)} کار در شیت</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">دورریز: ${pUtils.fmtNum(opt.wastePercentage, 1)}٪ | واحد: ${pUtils.fmtNum(opt.unitPrice_toman)} ت</div>
          </div>
        </div>
      `;
    });

    html += '</div>';

    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.74rem;">
        <button class="btn btn-outline btn-sm" onclick="NestingEngine.prevPage()" ${this.currentPage === 0 ? 'disabled' : ''} style="padding:0 8px;">
          <i class="ph ph-caret-right"></i> قبلی
        </button>
        <span style="color:var(--text-muted); font-weight:700;">
          صفحه ${pUtils.fmtNum(this.currentPage + 1)} از ${pUtils.fmtNum(totalPages)} (${pUtils.fmtNum(this.allOptions.length)} آرایش فرم)
        </span>
        <button class="btn btn-outline btn-sm" onclick="NestingEngine.nextPage()" ${this.currentPage >= totalPages - 1 ? 'disabled' : ''} style="padding:0 8px;">
          بعدی <i class="ph ph-caret-left"></i>
        </button>
      </div>
    `;

    container.innerHTML = html;
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

  /* ============================================================
     CANVAS ZERO-OVERLAP IMPOSITION RENDERING
     ============================================================ */
  renderCanvas() {
    const canvas = document.getElementById('nesting-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const nest = window.LemonPack.nesting;
    const cad = window.LemonPack.cad;
    const opt = this.allOptions[this.selectedOptionIndex] || this.allOptions[0];

    const padding = 28;
    const availW = w - (padding * 2);
    const availH = h - (padding * 2);
    const sheetL_cm = nest.sheetL || 70;
    const sheetW_cm = nest.sheetW || 50;
    const scale = Math.min(availW / sheetL_cm, availH / sheetW_cm);

    const drawSheetW = sheetL_cm * scale;
    const drawSheetH = sheetW_cm * scale;
    const startX = (w - drawSheetW) / 2;
    const startY = (h - drawSheetH) / 2;

    // Sheet Background
    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(startX, startY, drawSheetW, drawSheetH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, startY, drawSheetW, drawSheetH);

    const gripperMarginCm = this.CLEARANCES_MM.gripperMarginMm / 10;
    const safetyMarginCm = this.CLEARANCES_MM.sideMarginLeftMm / 10;
    const gutterCm = this.CLEARANCES_MM.interDieGutterMm / 10;

    const flatLcm = (cad.flatL || 310) / 10;
    const flatWcm = (cad.flatW || 220) / 10;

    // Draw Gripper Margin (15 mm on right)
    const gripperDraw = gripperMarginCm * scale;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
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

    ctx.fillStyle = '#0284C7';
    ctx.font = 'bold 9px Peyda, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('راستای الیاف کاغذ (Grain Direction) ➔', startX + 8, startY + 14);

    const printableStartX = startX + (safetyMarginCm * scale);
    const printableStartY = startY + (safetyMarginCm * scale);

    const isRotated = (opt && opt.layoutMode === 'orthogonal_rotated');
    const unitWcm = isRotated ? flatWcm : flatLcm;
    const unitHcm = isRotated ? flatLcm : flatWcm;

    const cellDrawW = unitWcm * scale;
    const cellDrawH = unitHcm * scale;
    const gutterDraw = gutterCm * scale;

    const cols = opt ? opt.cols : (nest.cols || 2);
    const rows = opt ? opt.rows : (nest.rows || 2);

    let boxIndex = 1;
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: v => v };
    let activeHoverCell = null;
    const mouse = this.hoverPoint;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = printableStartX + (c * (cellDrawW + gutterDraw));
        const by = printableStartY + (r * (cellDrawH + gutterDraw));
        const currentBoxIdx = boxIndex++;

        // Guaranteed safety check
        if (bx + cellDrawW > startX + drawSheetW - gripperDraw + 2) continue;
        if (by + cellDrawH > startY + drawSheetH + 2) continue;

        this.drawCellBox(ctx, bx, by, cellDrawW, cellDrawH, currentBoxIdx, isRotated ? 90 : 0, cad, scale, mouse, pUtils, (hover) => {
          activeHoverCell = hover;
        });
      }
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '10px Peyda, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `ابعاد شیت چاپ: ${pUtils.fmtNum(nest.sheetL)} × ${pUtils.fmtNum(nest.sheetW)} سانتی‌متر (${opt ? opt.targetMachineShort : nest.pressClass})`,
      w / 2,
      h - 8
    );

    if (mouse && activeHoverCell && window.CadEngine && window.CadEngine.drawHoverBadge) {
      window.CadEngine.drawHoverBadge(ctx, mouse.x, mouse.y, activeHoverCell.text);
    }
  },

  drawCellBox(ctx, bx, by, cellDrawW, cellDrawH, boxIdx, rotationDeg, cad, scale, mouse, pUtils, setHover) {
    const isHovered = mouse && mouse.x >= bx && mouse.x <= bx + cellDrawW && mouse.y >= by && mouse.y <= by + cellDrawH;

    if (isHovered) {
      setHover({
        index: boxIdx,
        text: `جعبه ${pUtils.fmtNum(boxIdx)} (${rotationDeg}° ${rotationDeg === 90 ? 'چرخیده ۹۰°' : 'مستقیم'}) | ابعاد گسترده: ${pUtils.fmtNum(cad.flatL)}×${pUtils.fmtNum(cad.flatW)} mm`
      });
      ctx.fillStyle = 'rgba(217, 119, 6, 0.22)';
    } else {
      ctx.fillStyle = 'rgba(217, 119, 6, 0.05)';
    }

    ctx.fillRect(bx, by, cellDrawW, cellDrawH);
    ctx.strokeStyle = isHovered ? '#D97706' : '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, cellDrawW, cellDrawH);

    // Render Vector Custom Die Paths inside cell
    if (cad.customDie && cad.customDie.active && cad.customDie.paths && cad.customDie.paths.length > 0) {
      const b = cad.customDie.bounds || { minX: 0, minY: 0, rawWidth: cad.flatL, rawHeight: cad.flatW, scaleToMm: 1 };
      const rawW = b.rawWidth || cad.flatL;
      const rawH = b.rawHeight || cad.flatW;
      const scaleToMm = b.scaleToMm || 1.0;
      const targetW = cad.flatL;
      const targetH = cad.flatW;

      const fitW = (rotationDeg === 90 || rotationDeg === 270) ? targetH : targetW;
      const fitH = (rotationDeg === 90 || rotationDeg === 270) ? targetW : targetH;
      const cellScale = Math.min((cellDrawW - 4) / fitW, (cellDrawH - 4) / fitH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, cellDrawW, cellDrawH);
      ctx.clip();

      ctx.translate(bx + cellDrawW / 2, by + cellDrawH / 2);
      if (rotationDeg !== 0) ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.scale(cellScale * (targetW / (rawW * scaleToMm)) * scaleToMm, cellScale * (targetH / (rawH * scaleToMm)) * scaleToMm);
      ctx.translate(-b.minX - rawW / 2, -b.minY - rawH / 2);

      cad.customDie.paths.forEach(p => {
        if (!p.visible || p.type === 'ignore') return;
        if (p.type === 'cut') {
          ctx.strokeStyle = '#DC2626';
          ctx.lineWidth = 1.2 / cellScale;
          ctx.setLineDash([]);
        } else if (p.type === 'crease') {
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 0.9 / cellScale;
          ctx.setLineDash([3 / cellScale, 3 / cellScale]);
        } else if (p.type === 'glue') {
          ctx.strokeStyle = '#059669';
          ctx.lineWidth = 1.2 / cellScale;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 0.8 / cellScale;
          ctx.setLineDash([]);
        }
        try {
          ctx.stroke(new Path2D(p.dRaw || p.d));
        } catch (e) {}
      });

      ctx.restore();
    } else {
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(bx, by + (cellDrawH * 0.3));
      ctx.lineTo(bx + cellDrawW, by + (cellDrawH * 0.3));
      ctx.moveTo(bx, by + (cellDrawH * 0.7));
      ctx.lineTo(bx + cellDrawW, by + (cellDrawH * 0.7));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Number Badge
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 10px Peyda, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pUtils.fmtNum(boxIdx), bx + (cellDrawW / 2), by + (cellDrawH / 2) + 3);
  }
};
