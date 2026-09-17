/* ============================================================
   LEMONPACK PRO v2.0.0-refined-production
   INDUSTRIAL IMPOSITION, PRESS ROUTING & 180° TUMBLE NESTING ENGINE
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

  ARCHIVE_DIES: [
    { id: 'arc_1', name: 'قالب دارویی استاندارد A', model: 'fefco_0215_tuck_bottom', L: 120, W: 80, D: 150 },
    { id: 'arc_2', name: 'قالب دارویی کوچک B', model: 'fefco_0215_tuck_bottom', L: 90, W: 60, D: 120 },
    { id: 'arc_3', name: 'قالب کیبوردی متوسط پستی', model: 'fefco_0427_mailer', L: 200, W: 150, D: 70 },
    { id: 'arc_4', name: 'قالب ساک دستی متوسط', model: 'shopping_bag_luxury', L: 250, W: 100, D: 350 }
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

    const flatL_mm = cad.flatL || 310;
    const flatW_mm = cad.flatW || 220;
    const gutter_mm = this.CLEARANCES_MM.interDieGutterMm;
    const gripper_mm = this.CLEARANCES_MM.gripperMarginMm;
    const tail_mm = this.CLEARANCES_MM.tailMarginMm;
    const side_mm = this.CLEARANCES_MM.sideMarginLeftMm + this.CLEARANCES_MM.sideMarginRightMm;

    const tumbleGain_mm = cad.tumblePitchGain || 0;
    const allows180 = !!cad.allows180Tumble;
    const grainCriticality = cad.grainCriticality || 'high';

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
        const isGrainCompliant = (grainCriticality !== 'high');
        candidates.push(this.buildOption({
          parentSheet, isSlit, blankL_cm, blankW_cm,
          layoutMode: 'orthogonal_rotated',
          layoutModeFa: 'چیدمان چرخشی ۹۰ درجه',
          cols: colsRot, rows: rowsRot, pairCols: 0,
          upsPerBlank: upsRot,
          flatL_mm, flatW_mm,
          targetMachine: targetMachineId,
          grainCompliant: isGrainCompliant,
          advisoryNote: !isGrainCompliant ? 'هشدار شکستگی خط‌تا خلاف جهت الیاف کاغذ' : undefined,
          orderQty, paperRatePerKg, gsm: mat.gsm || 300
        }));
      }

      // Mode 3: Interlocking 180° Tumble
      if (allows180 && tumbleGain_mm > 0) {
        const pairPitchLength_mm = (2 * flatL_mm) + gutter_mm - tumbleGain_mm;
        if (pairPitchLength_mm > 0) {
          const pairCols = Math.floor((usableL_mm + gutter_mm) / pairPitchLength_mm);
          const rowsTumble = Math.floor((usableW_mm + gutter_mm) / (flatW_mm + gutter_mm));
          const upsTumble = (pairCols * 2) * rowsTumble;

          if (upsTumble > 0) {
            candidates.push(this.buildOption({
              parentSheet, isSlit, blankL_cm, blankW_cm,
              layoutMode: 'interlocking_tumble',
              layoutModeFa: 'چیدمان کله‌به‌کله ۱۸۰ درجه (Tumble)',
              cols: pairCols * 2, rows: rowsTumble, pairCols: pairCols,
              upsPerBlank: upsTumble,
              flatL_mm, flatW_mm,
              targetMachine: targetMachineId,
              grainCompliant: true,
              advisoryNote: `صرفه‌جویی گام با اینترلاک: ${Math.round(tumbleGain_mm)} میلیمتر`,
              orderQty, paperRatePerKg, gsm: mat.gsm || 300
            }));
          }
        }
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

    const uniqueMap = {};
    candidates.forEach(c => {
      const key = `${c.parentSheetName}-${c.isSlitToHalf}-${c.blankLength_cm}x${c.blankWidth_cm}-${c.layoutMode}-${c.upsPerBlank}`;
      if (!uniqueMap[key] || uniqueMap[key].arbitrationCost > c.arbitrationCost) {
        uniqueMap[key] = c;
      }
    });

    const sorted = Object.values(uniqueMap).sort((a, b) => {
      if (a.grainCompliant !== b.grainCompliant) return a.grainCompliant ? -1 : 1;
      return a.arbitrationCost - b.arbitrationCost;
    });

    if (sorted.length > 0) {
      sorted[0].isBestValue = true;
      sorted[0].badgeText = 'پیشنهاد طلایی (Gold Pick)';
      if (sorted[1]) sorted[1].badgeText = 'گزینه اقتصادی ۲';
      if (sorted[2]) sorted[2].badgeText = 'گزینه جایگزین ۳';
    }

    this.allOptions = sorted.length > 0 ? sorted : [this.getFallbackOption(orderQty, paperRatePerKg, mat.gsm || 300)];
    this.topRecommendations = this.allOptions.slice(0, 3);

    if (this.selectedOptionIndex >= this.allOptions.length) {
      this.selectedOptionIndex = 0;
    }

    this.applyOption(this.selectedOptionIndex);
    this.evaluateSmartAssistantTriggers();
    this.renderPaginationUI();
    this.renderRecommendationCards();
  },

  buildOption(params) {
    const {
      parentSheet, isSlit, blankL_cm, blankW_cm,
      layoutMode, layoutModeFa, cols, rows, pairCols,
      upsPerBlank, flatL_mm, flatW_mm,
      targetMachine, grainCompliant, advisoryNote,
      orderQty, paperRatePerKg, gsm
    } = params;

    const machine = this.PRESS_PORTFOLIO[targetMachine];
    const multiplier = isSlit ? 2 : 1;
    const upsPerParentSheet = upsPerBlank * multiplier;

    const blankArea_cm2 = blankL_cm * blankW_cm;
    const usefulArea_cm2 = (upsPerBlank * flatL_mm * flatW_mm) / 100;
    const wastePercentage = Math.max(0, Number((100 - ((usefulArea_cm2 / blankArea_cm2) * 100)).toFixed(1)));

    const weightPerParentSheetKg = (parentSheet.lengthCm * parentSheet.widthCm * gsm) / 10000000;
    let rawParentSheetsNeeded = 0;
    let impressions = 0;

    if (targetMachine === 'press_4_5') {
      rawParentSheetsNeeded = Math.ceil(orderQty / Math.max(1, upsPerBlank));
      impressions = rawParentSheetsNeeded;
    } else {
      const blanksNeeded = Math.ceil(orderQty / Math.max(1, upsPerBlank));
      rawParentSheetsNeeded = Math.ceil(blanksNeeded / multiplier);
      impressions = blanksNeeded;
    }

    const procuredParentSheets = Math.ceil(rawParentSheetsNeeded / 100) * 100;
    const totalPaperKg = procuredParentSheets * weightPerParentSheetKg;
    const paperCost_toman = Math.round(totalPaperKg * paperRatePerKg);

    const plateCost_toman = machine.cmykPlatesCostToman;
    const pressRunsCount = Math.max(1, Math.ceil(impressions / 5000));
    const pressRunCost_toman = pressRunsCount * machine.runRatePer5000Toman;

    const arbitrationCost = paperCost_toman + plateCost_toman + pressRunCost_toman;

    const laminationCost_toman = Math.round(blankL_cm * blankW_cm * 3.3 * (isSlit ? procuredParentSheets * 2 : procuredParentSheets));
    const dieCuttingCost_toman = (window.LemonPack.cad.isDieInArchive ? 0 : 3500000) + 4000000;
    const finishingCost_toman = (orderQty * 350) + 1800000 + 600000;
    const totalCogs_toman = arbitrationCost + laminationCost_toman + dieCuttingCost_toman + finishingCost_toman;
    const finalInvoice_toman = Math.round(totalCogs_toman * 1.30);
    const unitPrice_toman = Math.round(finalInvoice_toman / orderQty);

    return {
      id: `${parentSheet.id}_${isSlit ? 'slit' : 'full'}_${layoutMode}_${targetMachine}`,
      parentSheetName: parentSheet.shortName,
      parentSheetFull: parentSheet.name,
      isSlitToHalf: isSlit,
      blankLength_cm: blankL_cm,
      blankWidth_cm: blankW_cm,
      layoutMode: layoutMode,
      layoutModeFa: layoutModeFa,
      cols: cols,
      rows: rows,
      pairCols: pairCols,
      upsPerBlank: upsPerBlank,
      upsPerParentSheet: upsPerParentSheet,
      wastePercentage: wastePercentage,
      targetMachine: targetMachine,
      targetMachineName: machine.name,
      targetMachineShort: machine.shortName,
      plateCost_toman: plateCost_toman,
      pressRunCost_toman: pressRunCost_toman,
      procuredParentSheets: procuredParentSheets,
      impressions: impressions,
      paperCost_toman: paperCost_toman,
      arbitrationCost: arbitrationCost,
      totalCogs_toman: totalCogs_toman,
      finalInvoice_toman: finalInvoice_toman,
      unitPrice_toman: unitPrice_toman,
      grainCompliant: grainCompliant,
      isBestValue: false,
      advisoryNote: advisoryNote
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
      arbitrationCost: 42600000,
      totalCogs_toman: 55000000,
      finalInvoice_toman: 71500000,
      unitPrice_toman: 71500,
      grainCompliant: true,
      isBestValue: true,
      badgeText: 'پیشنهاد طلایی (Gold Pick)'
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

  evaluateSmartAssistantTriggers() {
    const cad = window.LemonPack.cad;
    const currentOpt = this.allOptions[this.selectedOptionIndex] || this.allOptions[0];
    const alerts = [];

    if (!currentOpt) return;

    if (currentOpt.wastePercentage > 20) {
      const flatL = cad.flatL;
      const flatW = cad.flatW;
      const usableL_mm = (currentOpt.blankLength_cm * 10) - 20;
      const usableW_mm = (currentOpt.blankWidth_cm * 10) - 10;
      const gutter = 4;

      let foundOptimization = null;
      for (let delta = 1; delta <= 8; delta++) {
        const testFlatW = flatW - delta;
        const testRows = Math.floor((usableW_mm + gutter) / (testFlatW + gutter));
        if (testRows > currentOpt.rows) {
          const newUps = testRows * currentOpt.cols;
          const savingsPct = Math.round(((newUps - currentOpt.upsPerBlank) / newUps) * 100);
          foundOptimization = {
            dimension: 'عمق/عرض',
            deltaMm: delta,
            newUps: newUps,
            savingsPct: Math.max(8, savingsPct)
          };
          break;
        }
      }

      if (foundOptimization) {
        alerts.push({
          type: 'dimension_optimization',
          icon: 'ph-trend-down',
          color: '#D97706',
          title: 'پیشنهاد بهینه‌سازی مهندسی ابعاد (کاهش دورریز)',
          message: `کاهش ابعاد جعبه به میزان ${foundOptimization.deltaMm} میلیمتر، یک ردیف به شیت اضافه کرده و قیمت واحد را حدود ${foundOptimization.savingsPct}٪ کاهش می‌دهد.`,
          actionLabel: `اعمال کاهش ${foundOptimization.deltaMm}mm ابعاد`,
          deltaMm: foundOptimization.deltaMm
        });
      }
    }

    const boxL = Number(cad.length) || 0;
    const boxW = Number(cad.width) || 0;
    const boxD = Number(cad.height || cad.depth) || 0;

    const matchedArchive = this.ARCHIVE_DIES.find(a =>
      Math.abs(a.L - boxL) <= 2 &&
      Math.abs(a.W - boxW) <= 2 &&
      Math.abs(a.D - boxD) <= 2
    );

    if (matchedArchive && !cad.isDieInArchive) {
      alerts.push({
        type: 'archive_die_match',
        icon: 'ph-check-circle',
        color: '#10B981',
        title: 'قالب آماده مشابه در انبار یافت شد!',
        message: `قالب کد ${matchedArchive.name} با ابعاد ${matchedArchive.L}×${matchedArchive.W}×${matchedArchive.D} در بایگانی موجود است. ۳,۵۰۰,۰۰۰ تومان صرفه‌جویی در هزینه ساخت قالب لیزری.`,
        actionLabel: 'استفاده از قالب آرشیو (حذف هزینه)',
        archiveId: matchedArchive.id
      });
    }

    this.smartAssistantAlerts = alerts;
    this.renderSmartAssistantUI();
  },

  applyDimensionOptimization(deltaMm) {
    const cad = window.LemonPack.cad;
    if (cad.height) cad.height = Math.max(10, cad.height - deltaMm);
    if (cad.depth) cad.depth = Math.max(10, cad.depth - deltaMm);
    const inpH = document.getElementById('inp-height');
    if (inpH) inpH.value = cad.height || cad.depth;

    if (window.CadEngine) window.CadEngine.recalculateFlatDimensions();
    if (window.App) window.App.recalculate();
    toast(`ابعاد با موفقیت ${deltaMm} میلیمتر کاهش یافت و شیت بهینه شد ✓`);
  },

  applyArchiveDie() {
    const cad = window.LemonPack.cad;
    cad.isDieInArchive = true;
    const chk = document.getElementById('chk-archive-die');
    if (chk) chk.checked = true;
    if (window.App) window.App.recalculate();
    toast('قالب آرشیو فعال شد و هزینه ساخت قالب حذف گردید ✓');
  },

  renderSmartAssistantUI() {
    const container = document.getElementById('smart-assistant-container');
    if (!container) return;

    if (this.smartAssistantAlerts.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    let html = '';

    this.smartAssistantAlerts.forEach(alert => {
      if (alert.type === 'dimension_optimization') {
        html += `
          <div class="smart-alert-card" style="
            background: rgba(217, 119, 6, 0.08);
            border: 1px solid rgba(217, 119, 6, 0.4);
            border-right: 4px solid #D97706;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
          ">
            <div style="display:flex; align-items:center; gap:10px;">
              <i class="ph ${alert.icon}" style="font-size:1.4rem; color:#D97706;"></i>
              <div>
                <div style="font-weight:800; font-size:0.82rem; color:#B45309;">${alert.title}</div>
                <div style="font-size:0.75rem; color:var(--text-main); margin-top:2px;">${alert.message}</div>
              </div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="NestingEngine.applyDimensionOptimization(${alert.deltaMm})" style="font-size:0.75rem; padding:4px 12px; font-weight:700;">
              <i class="ph ph-magic-wand"></i> ${alert.actionLabel}
            </button>
          </div>
        `;
      } else if (alert.type === 'archive_die_match') {
        html += `
          <div class="smart-alert-card" style="
            background: rgba(16, 185, 129, 0.08);
            border: 1px solid rgba(16, 185, 129, 0.4);
            border-right: 4px solid #10B981;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
          ">
            <div style="display:flex; align-items:center; gap:10px;">
              <i class="ph ${alert.icon}" style="font-size:1.4rem; color:#10B981;"></i>
              <div>
                <div style="font-weight:800; font-size:0.82rem; color:#065F46;">${alert.title}</div>
                <div style="font-size:0.75rem; color:var(--text-main); margin-top:2px;">${alert.message}</div>
              </div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="NestingEngine.applyArchiveDie()" style="font-size:0.75rem; padding:4px 12px; font-weight:700; border-color:#10B981; color:#065F46; background:white;">
              <i class="ph ph-check"></i> ${alert.actionLabel}
            </button>
          </div>
        `;
      }
    });

    container.innerHTML = html;
  },

  renderRecommendationCards() {
    const container = document.getElementById('recommendations-cockpit-container');
    if (!container) return;

    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: v => String(v) };
    if (this.topRecommendations.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = `
      <div style="margin-bottom:12px;">
        <div style="font-weight:800; font-size:0.86rem; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
          <span style="display:flex; align-items:center; gap:6px; color:var(--graphite-text);">
            <i class="ph ph-trophy" style="color:#D97706; font-size:1.1rem;"></i>
            <span>کارت‌های مقایسه و انتخاب ماشین و فرم‌بندی (Admin Cockpit)</span>
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
                <strong class="tabular-nums">${pUtils.fmtNum(opt.procuredParentSheets)} شیت (${pUtils.fmtNum(Math.round(opt.procuredParentSheets/100))} بند)</strong>
              </div>
            </div>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; border-top:1px dashed var(--border-light); padding-top:6px;">
              <span style="font-size:0.7rem; color:var(--text-muted);">قیمت هر عدد:</span>
              <strong style="font-size:0.88rem; color:var(--brand-primary);">${pUtils.fmtNum(opt.unitPrice_toman)} تومان</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:0.68rem; color:var(--text-dim); margin-top:2px;">
              <span>مبلغ کل فاکتور:</span>
              <span class="tabular-nums font-bold">${pUtils.fmtNum(opt.finalInvoice_toman)} تومان</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  renderPaginationUI() {
    const container = document.getElementById('nesting-options-pagination');
    if (!container) return;

    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: v => String(v) };
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
              ${opt.isBestValue ? '<span class="badge badge-primary" style="font-size:0.62rem; padding:1px 5px;">پیشنهاد طلایی</span>' : ''}
              ${!opt.grainCompliant ? '<span class="badge" style="background:#FEE2E2; color:#DC2626; font-size:0.62rem; padding:1px 5px;">خلاف الیاف</span>' : ''}
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
    const scale = Math.min(availW / (nest.sheetL || 70), availH / (nest.sheetW || 50));

    const drawSheetW = (nest.sheetL || 70) * scale;
    const drawSheetH = (nest.sheetW || 50) * scale;
    const startX = (w - drawSheetW) / 2;
    const startY = (h - drawSheetH) / 2;

    ctx.fillStyle = '#FAF8F5';
    ctx.fillRect(startX, startY, drawSheetW, drawSheetH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, startY, drawSheetW, drawSheetH);

    const gripperMarginCm = this.CLEARANCES_MM.gripperMarginMm / 10;
    const tailMarginCm = this.CLEARANCES_MM.tailMarginMm / 10;
    const safetyMarginCm = this.CLEARANCES_MM.sideMarginLeftMm / 10;
    const gutterCm = this.CLEARANCES_MM.interDieGutterMm / 10;

    const flatLcm = (cad.flatL || 310) / 10;
    const flatWcm = (cad.flatW || 220) / 10;

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
    const isTumble = (opt && opt.layoutMode === 'interlocking_tumble');

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

    if (isTumble && opt && opt.pairCols > 0) {
      const pairPitchCm = ((2 * flatLcm) + gutterCm - (cad.tumblePitchGain / 10));
      const pairDrawPitch = pairPitchCm * scale;

      for (let r = 0; r < rows; r++) {
        for (let p = 0; p < opt.pairCols; p++) {
          const pairStartX = printableStartX + (p * pairDrawPitch);
          const by = printableStartY + (r * (cellDrawH + gutterDraw));

          const bx1 = pairStartX;
          const boxIdx1 = boxIndex++;
          if (bx1 + cellDrawW <= startX + drawSheetW - gripperDraw + 2 && by + cellDrawH <= startY + drawSheetH + 2) {
            this.drawCellBox(ctx, bx1, by, cellDrawW, cellDrawH, boxIdx1, 0, cad, scale, mouse, pUtils, (hover) => {
              activeHoverCell = hover;
            });
          }

          const tumbleGainDraw = (cad.tumblePitchGain / 10) * scale;
          const bx2 = pairStartX + cellDrawW + gutterDraw - tumbleGainDraw;
          const boxIdx2 = boxIndex++;
          if (bx2 + cellDrawW <= startX + drawSheetW - gripperDraw + 2 && by + cellDrawH <= startY + drawSheetH + 2) {
            this.drawCellBox(ctx, bx2, by, cellDrawW, cellDrawH, boxIdx2, 180, cad, scale, mouse, pUtils, (hover) => {
              activeHoverCell = hover;
            });
          }
        }
      }
    } else {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = printableStartX + (c * (cellDrawW + gutterDraw));
          const by = printableStartY + (r * (cellDrawH + gutterDraw));
          const currentBoxIdx = boxIndex++;

          if (bx + cellDrawW > startX + drawSheetW - gripperDraw + 2) continue;
          if (by + cellDrawH > startY + drawSheetH + 2) continue;

          this.drawCellBox(ctx, bx, by, cellDrawW, cellDrawH, currentBoxIdx, isRotated ? 90 : 0, cad, scale, mouse, pUtils, (hover) => {
            activeHoverCell = hover;
          });
        }
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
        text: `جعبه ${pUtils.fmtNum(boxIdx)} (${rotationDeg}° ${rotationDeg === 180 ? 'وارونه/Tumble' : 'مستقیم'}) | ابعاد گسترده: ${pUtils.fmtNum(cad.flatL)}×${pUtils.fmtNum(cad.flatW)} mm`
      });
      ctx.fillStyle = 'rgba(217, 119, 6, 0.24)';
    } else {
      ctx.fillStyle = rotationDeg === 180 ? 'rgba(2, 132, 199, 0.08)' : 'rgba(217, 119, 6, 0.06)';
    }

    ctx.fillRect(bx, by, cellDrawW, cellDrawH);

    if (cad.customDie && cad.customDie.active && cad.customDie.paths && cad.customDie.paths.length > 0) {
      const b = cad.customDie.bounds || { minX: 0, minY: 0, width: cad.flatL, height: cad.flatW };
      const pScale = Math.min((cellDrawW - 2) / (b.width || 1), (cellDrawH - 2) / (b.height || 1));

      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, cellDrawW, cellDrawH);
      ctx.clip();

      ctx.translate(bx + cellDrawW / 2, by + cellDrawH / 2);
      if (rotationDeg !== 0) ctx.rotate((rotationDeg * Math.PI) / 180);
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
        } else {
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 0.8 / pScale;
          ctx.setLineDash([]);
        }
        try {
          ctx.stroke(new Path2D(p.d));
        } catch (e) {}
      });

      ctx.restore();
    } else {
      ctx.strokeStyle = rotationDeg === 180 ? '#0284C7' : '#DC2626';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx, by, cellDrawW, cellDrawH);

      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(bx, by + (cellDrawH * 0.3));
      ctx.lineTo(bx + cellDrawW, by + (cellDrawH * 0.3));
      ctx.moveTo(bx, by + (cellDrawH * 0.7));
      ctx.lineTo(bx + cellDrawW, by + (cellDrawH * 0.7));
      ctx.stroke();
      ctx.setLineDash([]);

      if (rotationDeg === 180) {
        ctx.fillStyle = '#0284C7';
        ctx.font = 'bold 8px Peyda, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⮁ 180°', bx + (cellDrawW / 2), by + 12);
      }
    }

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 10px Peyda, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pUtils.fmtNum(boxIdx), bx + (cellDrawW / 2), by + (cellDrawH / 2) + 3);
  }
};

