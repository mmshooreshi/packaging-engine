/* ============================================================
   IRANIAN PRINT-HOUSE INDUSTRIAL COGS MATHEMATICAL ENGINE
   ============================================================ */

window.CostEngine = {
  calculateTalqDetails(mat, cad, rates) {
    const win = mat && mat.windowPatch ? mat.windowPatch : { length: 70, width: 45, margin: 10, material: 'pvc', thicknessMicron: 150, method: 'auto' };
    const winLen = Math.max(10, Number(win.length) || 70);
    const winWid = Math.max(10, Number(win.width) || 45);
    const margin = Math.max(5, Number(win.margin) || 10);
    const filmW = winLen + (2 * margin);
    const filmH = winWid + (2 * margin);
    const filmAreaM2 = (filmW * filmH) / 1000000;
    const thicknessMicron = Number(win.thicknessMicron) || 150;
    const density = win.material === 'pet' ? 1.38 : 1.35; // g/cm3
    const weightPerPieceGrams = ((filmW / 10) * (filmH / 10) * (thicknessMicron / 10000) * density);
    const pricePerKg = win.material === 'pet'
      ? (rates.talq_pet_price_per_kg_toman || 260000)
      : (rates.talq_pvc_price_per_kg_toman || 220000);
    
    // Raw film cost with 10% scrap/trim allowance
    const unitMatCost = Math.max(120, Math.round((weightPerPieceGrams / 1000) * pricePerKg * 1.10));
    const unitOpCost = win.method === 'manual'
      ? (rates.talq_patching_unit_cost_manual_toman || 650)
      : (rates.talq_patching_unit_cost_auto_toman || 280);
    
    const setupCost = win.method === 'auto'
      ? (rates.talq_patching_machine_setup_toman || 600000)
      : 0;

    const qty = Math.max(1, cad.orderQty || 1000);
    const totalCost = Math.round(((unitMatCost + unitOpCost) * qty) + setupCost);
    const unitTotal = Math.round(totalCost / qty);

    return {
      winLen,
      winWid,
      filmW,
      filmH,
      filmAreaM2,
      thicknessMicron,
      weightPerPieceGrams: weightPerPieceGrams.toFixed(2),
      unitMatCost,
      unitOpCost,
      setupCost,
      unitTotal,
      totalCost
    };
  },

  calculateFoilDetails(mat, cad, rates) {
    const foil = mat && mat.foilStamping ? mat.foilStamping : { lengthCm: 6, widthCm: 4 };
    const l = Math.max(1, Number(foil.lengthCm) || 6);
    const w = Math.max(1, Number(foil.widthCm) || 4);
    const plateCost = (l * w * 25000) + 400000;
    const unitFoil = 250;
    const qty = Math.max(1, cad.orderQty || 1000);
    const totalCost = Math.round(plateCost + (unitFoil * qty));
    return {
      plateCost,
      unitTotal: Math.round(totalCost / qty),
      totalCost
    };
  },

  calculate() {
    const cad = window.LemonPack.cad;
    const mat = window.LemonPack.materials;
    const nest = window.LemonPack.nesting;
    const rates = window.LemonPack.rates;

    const isPress45 = nest.targetMachine === 'press_4_5' || nest.sheetL > 72 || nest.sheetW > 52;
    const parentSheetL = nest.parentSheetName === '۹۰×۶۰' ? 90 : 100;
    const parentSheetW = nest.parentSheetName === '۹۰×۶۰' ? 60 : 70;

    // 1. Paper weight & sheets calculation (with 100-sheet band rule)
    const weightPerParentSheetKg = (parentSheetL * parentSheetW * (mat.gsm || 300)) / 10000000;
    const ups = Math.max(1, nest.ups || 4);
    const multiplier = nest.isSlitToHalf ? 2 : 1;
    
    let rawParentSheetsNeeded = 0;
    let impressions = 0;
    if (isPress45) {
      rawParentSheetsNeeded = Math.ceil(cad.orderQty / ups);
      impressions = rawParentSheetsNeeded;
    } else {
      const blanksNeeded = Math.ceil(cad.orderQty / ups);
      rawParentSheetsNeeded = Math.ceil(blanksNeeded / multiplier);
      impressions = blanksNeeded;
    }

    const procuredSheets = Math.ceil(rawParentSheetsNeeded / 100) * 100;
    const bandsCount = Math.round(procuredSheets / 100);
    const totalPaperKg = procuredSheets * weightPerParentSheetKg;

    // 2. Base Costs
    const costPaper = Math.round(totalPaperKg * rates.paper_price_per_kg_toman);
    const plateCount = mat.colors || 4;
    
    // Press Plates Cost
    const plateUnitCost = isPress45
      ? (rates.plate_4_5_unit_cost_toman || 2200000)
      : (rates.plate_2_5_unit_cost_toman || 1400000);
    const costPlates = plateCount * plateUnitCost;

    // Press Impression Cost (Mudarab of 5,000)
    const runBaseRate = isPress45
      ? (rates.press_4_5_run_cost_per_5000_toman || 19000000)
      : (rates.press_run_cost_per_5000_toman || 13000000);
    const runsCount = Math.max(1, Math.ceil(impressions / rates.press_run_base_impression_limit));
    const costPrinting = runsCount * runBaseRate;

    // Lamination Cost
    const sheetAreaCm2 = (nest.sheetL || 70) * (nest.sheetW || 50);
    const printPassesCount = nest.isSlitToHalf ? procuredSheets * 2 : procuredSheets;
    const costLamination = mat.lamination !== 'none'
      ? Math.round(sheetAreaCm2 * rates.lamination_rate_per_cm2_toman * printPassesCount)
      : 0;

    // Die-cutting & Laser Die Cost
    const costDie = cad.isDieInArchive ? 0 : rates.laser_die_fabrication_default_cost_toman;
    const costDieCutting = costDie + rates.letterpress_base_run_cost_toman;

    // Finishing & Gluing Cost
    const costGluing = mat.gluing !== 'none' ? cad.orderQty * rates.gluing_cost_per_box_toman : 0;

    // 3. Optional Finishing & Window Patching (خاموش بای دیفالت)
    let costTalq = 0;
    let talqDetails = null;
    if (mat.windowPatch && mat.windowPatch.enabled) {
      talqDetails = this.calculateTalqDetails(mat, cad, rates);
      costTalq = talqDetails.totalCost;
    }

    let costFoil = 0;
    let foilDetails = null;
    if (mat.foilStamping && mat.foilStamping.enabled) {
      foilDetails = this.calculateFoilDetails(mat, cad, rates);
      costFoil = foilDetails.totalCost;
    }

    let costUV = 0;
    if (mat.spotUv && mat.spotUv.enabled) {
      const screenCost = 1200000;
      const unitUv = mat.spotUv.type === 'cylinder' ? 240 : 180;
      costUV = Math.round(screenCost + (unitUv * cad.orderQty));
    } else if (mat.uv && mat.uv !== 'none') {
      costUV = rates.spot_uv_base_run_cost_toman || 0;
    }

    const costFinishing = Math.round(
      costGluing +
      costTalq +
      costFoil +
      costUV +
      rates.consumables_glue_toman +
      rates.transport_and_logistics_fixed_toman
    );

    const totalCogs = costPaper + costPlates + costPrinting + costLamination + costDieCutting + costFinishing;
    const marginMultiplier = 1 + (rates.profit_margin_percentage / 100);
    const grandTotal = Math.round(totalCogs * marginMultiplier);
    const unitPrice = Math.round(grandTotal / cad.orderQty);

    const results = {
      procuredSheets,
      bandsCount,
      totalPaperKg,
      costPaper,
      plateCount,
      costPlates,
      runsCount,
      costPrinting,
      costLamination,
      costDieCutting,
      costGluing,
      costTalq,
      talqDetails,
      costFoil,
      foilDetails,
      costUV,
      costFinishing,
      totalCogs,
      grandTotal,
      unitPrice
    };

    window.LemonPack.lastCalculations = results;
    this.updateDiagnosticsUI(results);
    return results;
  },

  updateDiagnosticsUI(res) {
    const pUtils = window.PersianUtils || { fmtNum: function(v){ return v; }, fmtCurrency: function(v){ return v; }, e2p: function(v){ return v; } };
    const cur = window.LemonPack.currency || 'toman';
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    setTxt('cogs-paper-sub', pUtils.fmtNum(res.procuredSheets) + ' برگ (' + pUtils.fmtNum(res.bandsCount) + ' بند) • ' + pUtils.fmtNum(res.totalPaperKg, 1) + ' کیلو');
    setTxt('cogs-paper-val', pUtils.fmtCurrency(res.costPaper, cur));
    setTxt('cogs-plates-sub', pUtils.fmtNum(res.plateCount) + ' زینک ۲.۵ ورقی');
    setTxt('cogs-plates-val', pUtils.fmtCurrency(res.costPlates, cur));
    setTxt('cogs-press-sub', pUtils.fmtNum(res.runsCount) + ' دور (' + pUtils.fmtNum(res.procuredSheets) + ' شیت)');
    setTxt('cogs-press-val', pUtils.fmtCurrency(res.costPrinting, cur));
    setTxt('cogs-lam-sub', pUtils.fmtNum(res.procuredSheets) + ' شیت');
    setTxt('cogs-lam-val', pUtils.fmtCurrency(res.costLamination, cur));
    setTxt('cogs-die-sub', window.LemonPack.cad.isDieInArchive ? 'قالب آرشیو + تیغ‌زنی' : 'قالب جدید + تیغ‌زنی');
    setTxt('cogs-die-val', pUtils.fmtCurrency(res.costDieCutting, cur));
    setTxt('cogs-finish-sub', pUtils.fmtNum(window.LemonPack.cad.orderQty) + ' عدد + چسب و لجستیک');
    setTxt('cogs-finish-val', pUtils.fmtCurrency(res.costFinishing, cur));

    // Dynamic Talq row in COGS
    const talqRow = document.getElementById('cogs-talq-row');
    if (talqRow) {
      if (res.talqDetails && window.LemonPack.materials.windowPatch && window.LemonPack.materials.windowPatch.enabled) {
        talqRow.style.display = 'table-row';
        setTxt('cogs-talq-sub', `فیلم ${pUtils.e2p(res.talqDetails.filmW)}×${pUtils.e2p(res.talqDetails.filmH)} mm (${pUtils.e2p(res.talqDetails.thicknessMicron)}µm)`);
        setTxt('cogs-talq-val', pUtils.fmtCurrency(res.costTalq, cur));
      } else {
        talqRow.style.display = 'none';
      }
    }

    // Dynamic Foil row in COGS
    const foilRow = document.getElementById('cogs-foil-row');
    if (foilRow) {
      if (res.foilDetails && window.LemonPack.materials.foilStamping && window.LemonPack.materials.foilStamping.enabled) {
        foilRow.style.display = 'table-row';
        setTxt('cogs-foil-sub', `کلیشه ${pUtils.e2p(window.LemonPack.materials.foilStamping.lengthCm || 6)}×${pUtils.e2p(window.LemonPack.materials.foilStamping.widthCm || 4)} cm`);
        setTxt('cogs-foil-val', pUtils.fmtCurrency(res.costFoil, cur));
      } else {
        foilRow.style.display = 'none';
      }
    }

    setTxt('cogs-total-val', pUtils.fmtCurrency(res.totalCogs, cur));
  }
};

