/* ============================================================
   IRANIAN PRINT-HOUSE INDUSTRIAL COGS MATHEMATICAL ENGINE
   ============================================================ */

window.CostEngine = {
  calculate() {
    const cad = window.LemonPack.cad;
    const mat = window.LemonPack.materials;
    const nest = window.LemonPack.nesting;
    const rates = window.LemonPack.rates;

    // 1. Paper weight & sheets
    const weightPerSheetKg = (nest.sheetL * nest.sheetW * mat.gsm) / 10000000;
    const rawSheetsNeeded = Math.ceil(cad.orderQty / Math.max(1, nest.ups));
    const procuredSheets = Math.ceil(rawSheetsNeeded / 100) * 100;
    const bandsCount = Math.round(procuredSheets / 100);
    const totalPaperKg = procuredSheets * weightPerSheetKg;

    // 2. Costs Breakdown
    const costPaper = Math.round(totalPaperKg * rates.paper_price_per_kg_toman);
    const plateCount = mat.colors;
    const costPlates = plateCount * rates.plate_2_5_unit_cost_toman;
    const runsCount = Math.max(1, Math.ceil(procuredSheets / rates.press_run_base_impression_limit));
    const costPrinting = runsCount * rates.press_run_cost_per_5000_toman;
    const costLamination = mat.lamination !== 'none'
      ? Math.round(nest.sheetL * nest.sheetW * rates.lamination_rate_per_cm2_toman * procuredSheets)
      : 0;
    const costDie = cad.isDieInArchive ? 0 : rates.laser_die_fabrication_default_cost_toman;
    const costDieCutting = costDie + rates.letterpress_base_run_cost_toman;
    const costGluing = mat.gluing !== 'none' ? cad.orderQty * rates.gluing_cost_per_box_toman : 0;
    const costUV = mat.uv !== 'none' ? rates.spot_uv_base_run_cost_toman : 0;
    const costFinishing = Math.round(costGluing + costUV + rates.consumables_glue_toman + rates.transport_and_logistics_fixed_toman);

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
    const pUtils = window.PersianUtils || { fmtNum: function(v){ return v; }, fmtCurrency: function(v){ return v; } };
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
    setTxt('cogs-total-val', pUtils.fmtCurrency(res.totalCogs, cur));
  }
};
