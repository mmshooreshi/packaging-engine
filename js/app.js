/* ============================================================
   LEMONPACK PRO - MASTER ORCHESTRATOR & PWA ENGINE
   ============================================================ */

const STORAGE_KEY = 'lemonpack_config_v3';

const DEFAULT_RATES = {
  paper_price_per_kg_toman: 520000,
  plate_2_5_unit_cost_toman: 1400000,
  default_plate_count_cmyk: 4,
  press_run_base_impression_limit: 5000,
  press_run_cost_per_5000_toman: 13000000,
  lamination_rate_per_cm2_toman: 3.3,
  letterpress_base_run_cost_toman: 4000000,
  laser_die_fabrication_default_cost_toman: 3500000,
  gluing_cost_per_box_toman: 350,
  spot_uv_base_run_cost_toman: 2500000,
  transport_and_logistics_fixed_toman: 1800000,
  consumables_glue_toman: 600000,
  profit_margin_percentage: 30.0,
  talq_pvc_price_per_kg_toman: 220000,
  talq_pet_price_per_kg_toman: 260000,
  talq_patching_machine_setup_toman: 600000,
  talq_patching_unit_cost_auto_toman: 280,
  talq_patching_unit_cost_manual_toman: 650
};

window.LemonPack = {
  cad: {
    model: 'tuck_end',
    length: 120,
    width: 80,
    height: 150,
    flatL: 310,
    flatW: 220,
    glueFlap: 15,
    tuckFlap: 18,
    dustFlap: 15,
    creaseGap: 2,
    bleed: 3,
    isDieInArchive: false,
    orderQty: 1000,
    customDie: null
  },
  materials: {
    substrate: 'inderboard',
    gsm: 300,
    lamination: 'matte',
    gluing: 'auto',
    colors: 4,
    windowPatch: {
      enabled: false,
      length: 70,
      width: 45,
      margin: 10,
      material: 'pvc',
      thicknessMicron: 150,
      method: 'auto'
    },
    foilStamping: {
      enabled: false,
      color: 'gold',
      lengthCm: 6,
      widthCm: 4
    },
    spotUv: {
      enabled: false,
      type: 'spot'
    }
  },
  nesting: {
    sheetL: 100,
    sheetW: 70,
    sheetMode: 'auto',
    ups: 6,
    wastePercentage: 19.8,
    orientation: 'A',
    pressClass: 'دستگاه ۲.۵ ورقی'
  },
  rates: Object.assign({}, DEFAULT_RATES),
  currency: 'toman',
  lengthUnit: 'mm',
  currentTab: 'studio',
  activeCanvasTab: 'nesting'
};

window.toast = function(msg, duration = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (navigator.vibrate) navigator.vibrate(12);
  setTimeout(() => el.classList.remove('show'), duration);
};

window.App = {
  init() {
    this.loadRates();
    this.setupChips();
    if (window.CadEngine) {
      window.CadEngine.init();
      window.CadEngine.recalculateFlatDimensions();
    }
    if (window.NestingEngine) {
      window.NestingEngine.init();
    }
    if (window.InvoiceEngine) {
      window.InvoiceEngine.init();
    }
    if (window.ParametricDieEngine) {
      window.ParametricDieEngine.init();
    }
    this.updateTalqPriceCard();
    this.updateFoilPriceCard();
    this.updateUvPriceCard();
    this.recalculate();
    this.setupPwa();
    this.setupAccordion();

    // Init Date
    try {
      const d = new Date().toLocaleDateString('fa-IR');
      const dEl = document.getElementById('inv-date-disp');
      if (dEl) dEl.textContent = d;
    } catch(e) {}
  },

  setupAccordion() {
    const accordions = document.querySelectorAll('.accordion');
    accordions.forEach(acc => {
      const hdr = acc.querySelector('.accordion-hdr');
      if (hdr) {
        hdr.addEventListener('click', () => {
          acc.classList.toggle('open');
          if (window.SoundEngine) window.SoundEngine.playClick();
        });
      }
    });
  },

  recalculate() {
    if (window.NestingEngine) {
      window.NestingEngine.optimize();
      if (window.LemonPack.activeCanvasTab === 'nesting') {
        window.NestingEngine.renderCanvas();
      } else if (window.LemonPack.activeCanvasTab === '3d') {
        if (window.Cad3DEngine) window.Cad3DEngine.render();
      } else if (window.CadEngine) {
        window.CadEngine.renderBlueprint();
      }
    }
    if (window.CostEngine) {
      window.CostEngine.calculate();
    }
    if (window.InvoiceEngine) {
      window.InvoiceEngine.render();
    }
  },

  switchCanvasTab(tab) {
    window.LemonPack.activeCanvasTab = tab;
    document.querySelectorAll('.canvas-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const nestCanvas = document.getElementById('nesting-canvas');
    const blueCanvas = document.getElementById('blueprint-canvas');
    const canvas3d = document.getElementById('canvas-3d');
    const controls3d = document.getElementById('controls-3d');
    const legend = document.getElementById('canvas-legend-wrap');

    if (tab === 'nesting') {
      if (nestCanvas) nestCanvas.style.display = 'block';
      if (blueCanvas) blueCanvas.style.display = 'none';
      if (canvas3d) canvas3d.style.display = 'none';
      if (controls3d) controls3d.style.display = 'none';
      if (legend) legend.style.display = 'flex';
      if (window.NestingEngine) window.NestingEngine.renderCanvas();
    } else if (tab === '3d') {
      if (nestCanvas) nestCanvas.style.display = 'none';
      if (blueCanvas) blueCanvas.style.display = 'none';
      if (canvas3d) canvas3d.style.display = 'block';
      if (controls3d) controls3d.style.display = 'block';
      if (legend) legend.style.display = 'none';
      if (window.Cad3DEngine) {
        window.Cad3DEngine.init();
        window.Cad3DEngine.render();
      }
    } else {
      if (nestCanvas) nestCanvas.style.display = 'none';
      if (blueCanvas) blueCanvas.style.display = 'block';
      if (canvas3d) canvas3d.style.display = 'none';
      if (controls3d) controls3d.style.display = 'none';
      if (legend) legend.style.display = 'none';
      if (window.CadEngine) window.CadEngine.renderBlueprint();
    }
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  refreshSheetNesting() {
    if (window.NestingEngine) {
      window.NestingEngine.optimize();
      window.NestingEngine.renderCanvas();
    }
    if (window.CadEngine && window.LemonPack.activeCanvasTab === 'blueprint') {
      window.CadEngine.renderBlueprint();
    }
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
    if (window.toast) toast('شیت‌بندی و فرم چاپی مجدداً محاسبه و تولید شد ✓');
  },

  toggleCurrency() {
    const cur = window.LemonPack.currency === 'toman' ? 'rial' : 'toman';
    window.LemonPack.currency = cur;
    const btn = document.getElementById('btn-currency-toggle');
    if (btn) btn.innerHTML = '<i class="ph ph-coins"></i> ' + (cur === 'toman' ? 'تومان' : 'ریال');
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
    toast('واحد پولی به ' + (cur === 'toman' ? 'تومان' : 'ریال') + ' تغییر یافت ✓');
  },

  toggleLengthUnit() {
    const u = window.LemonPack.lengthUnit === 'mm' ? 'cm' : 'mm';
    window.LemonPack.lengthUnit = u;
    const btn = document.getElementById('btn-unit-toggle');
    if (btn) btn.textContent = u;
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  toggleTheme() {
    const isDark = document.body.dataset.theme === 'dark';
    document.body.dataset.theme = isDark ? 'light' : 'dark';
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = isDark ? 'ph ph-moon' : 'ph ph-sun';
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  loadRates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        window.LemonPack.rates = Object.assign({}, DEFAULT_RATES, JSON.parse(raw));
      }
    } catch(e) {}
    this.syncRatesToInputs();
  },

  syncRatesToInputs() {
    const r = window.LemonPack.rates;
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), fmtCurrency: v => String(v) };

    const setField = (id, val, isDecimal = false) => {
      const el = document.getElementById(id);
      const help = document.getElementById('help-' + id);
      if (el) {
        el.value = isDecimal ? pUtils.fmtNum(val, 1) : pUtils.fmtNum(val, 0);
      }
      if (help) {
        if (id === 'set-profit-pct') {
          help.textContent = `${pUtils.fmtNum(val, 0)} درصد حاشیه سود`;
        } else if (id === 'set-lam-rate') {
          help.textContent = `${pUtils.fmtNum(val, 1)} تومان بر سانتی‌متر مربع`;
        } else {
          help.textContent = pUtils.fmtCurrency(val, 'toman');
        }
      }
    };

    setField('set-paper-price', r.paper_price_per_kg_toman);
    setField('set-plate-cost', r.plate_2_5_unit_cost_toman);
    setField('set-press-cost', r.press_run_cost_per_5000_toman);
    setField('set-lam-rate', r.lamination_rate_per_cm2_toman, true);
    setField('set-letterpress-cost', r.letterpress_base_run_cost_toman);
    setField('set-die-cost', r.laser_die_fabrication_default_cost_toman);
    setField('set-gluing-box', r.gluing_cost_per_box_toman);
    setField('set-profit-pct', r.profit_margin_percentage, false);
  },

  onRateInput(id, rateKey, isDecimal = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const pUtils = window.PersianUtils || { p2e: v => v, fmtNum: (v, d) => String(v), fmtCurrency: v => String(v) };
    const rawVal = pUtils.p2e(el.value);
    const num = isDecimal ? (parseFloat(rawVal) || 0) : (parseInt(rawVal, 10) || 0);

    const help = document.getElementById('help-' + id);
    if (help) {
      if (id === 'set-profit-pct') {
        help.textContent = `${pUtils.fmtNum(num, 0)} درصد حاشیه سود`;
      } else if (id === 'set-lam-rate') {
        help.textContent = `${pUtils.fmtNum(num, 1)} تومان بر سانتی‌متر مربع`;
      } else {
        help.textContent = pUtils.fmtCurrency(num, 'toman');
      }
    }

    if (window.LemonPack && window.LemonPack.rates) {
      window.LemonPack.rates[rateKey] = num;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.LemonPack.rates));
      } catch(e) {}
    }
    this.recalculate();
  },

  onRateBlur(id, rateKey, isDecimal = false) {
    const el = document.getElementById(id);
    if (!el) return;
    const pUtils = window.PersianUtils || { p2e: v => v, fmtNum: (v, d) => String(v) };
    const rawVal = pUtils.p2e(el.value);
    const num = isDecimal ? (parseFloat(rawVal) || 0) : (parseInt(rawVal, 10) || 0);
    el.value = isDecimal ? pUtils.fmtNum(num, 1) : pUtils.fmtNum(num, 0);
  },

  saveRates() {
    this.syncRatesToInputs();
    this.recalculate();
  },

  setupChips() {
    document.querySelectorAll('[data-model]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-model]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.cad.model = chip.dataset.model;
        if (window.CadEngine) window.CadEngine.recalculateFlatDimensions();
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    document.querySelectorAll('[data-sub]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-sub]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.substrate = chip.dataset.sub;
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    document.querySelectorAll('[data-gsm]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-gsm]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.gsm = Number(chip.dataset.gsm);
        if (window.CadEngine) window.CadEngine.recalculateFlatDimensions();
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    document.querySelectorAll('[data-lam]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-lam]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.lamination = chip.dataset.lam;
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    document.querySelectorAll('[data-gluing]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-gluing]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.gluing = chip.dataset.gluing;
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    document.querySelectorAll('[data-sheet]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-sheet]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.nesting.sheetMode = chip.dataset.sheet;
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });
  },

  onCadInputChange() {
    const cad = window.LemonPack.cad;
    const inpL = document.getElementById('inp-length');
    const inpW = document.getElementById('inp-width');
    const inpH = document.getElementById('inp-height');
    const sldL = document.getElementById('slider-length');
    const sldW = document.getElementById('slider-width');
    const sldH = document.getElementById('slider-height');

    cad.length = Math.max(10, Number(inpL ? inpL.value : 120) || 120);
    cad.width = Math.max(10, Number(inpW ? inpW.value : 80) || 80);
    cad.height = Math.max(10, Number(inpH ? inpH.value : 150) || 150);
    cad.orderQty = Math.max(1, Number(document.getElementById('inp-order-qty')?.value) || 1000);
    cad.isDieInArchive = document.getElementById('chk-archive-die') ? document.getElementById('chk-archive-die').checked : false;

    if (sldL && sldL.value != cad.length) sldL.value = cad.length;
    if (sldW && sldW.value != cad.width) sldW.value = cad.width;
    if (sldH && sldH.value != cad.height) sldH.value = cad.height;

    const dieL = document.getElementById('die-param-l');
    const dieW = document.getElementById('die-param-w');
    const dieH = document.getElementById('die-param-h');
    if (dieL) dieL.value = cad.length;
    if (dieW) dieW.value = cad.width;
    if (dieH) dieH.value = cad.height;

    if (window.ParametricDieEngine) {
      window.ParametricDieEngine.params.length = cad.length;
      window.ParametricDieEngine.params.width = cad.width;
      window.ParametricDieEngine.params.height = cad.height;
      if (!window.ParametricDieEngine.isCustomImport) {
        window.ParametricDieEngine.synthesizeModel();
      }
      window.ParametricDieEngine.render();
    }

    if (window.CadEngine) {
      window.CadEngine.recalculateFlatDimensions();
    }

    this.updateTalqPriceCard();
    this.updateFoilPriceCard();
    this.updateUvPriceCard();
    this.recalculate();
  },

  onCadMarginChange(marginKey, value) {
    const cad = window.LemonPack.cad;
    cad[marginKey] = Math.max(0, Number(value) || 0);

    if (window.ParametricDieEngine) {
      if (marginKey === 'glueFlap') window.ParametricDieEngine.params.glueFlap = cad[marginKey];
      if (marginKey === 'tuckFlap') window.ParametricDieEngine.params.topTuck = cad[marginKey];
      if (marginKey === 'dustFlap') window.ParametricDieEngine.params.dustFlap = cad[marginKey];
      if (!window.ParametricDieEngine.isCustomImport) {
        window.ParametricDieEngine.synthesizeModel();
      }
      window.ParametricDieEngine.render();
    }

    if (window.CadEngine) {
      window.CadEngine.recalculateFlatDimensions();
    }

    this.recalculate();
  },

  onFlatDimensionInput(axis, value) {
    const cad = window.LemonPack.cad;
    const num = Math.max(20, Number(value) || 20);
    if (axis === 'l' || axis === 'flatL') {
      cad.flatL = num;
      if (cad.customDie) cad.customDie.widthMm = num;
      const inpFlatL = document.getElementById('inp-flat-l');
      if (inpFlatL && inpFlatL.value != num) inpFlatL.value = num;
      const dieFlatW = document.getElementById('die-flat-w');
      if (dieFlatW) dieFlatW.value = num;
      if (window.ParametricDieEngine) window.ParametricDieEngine.setFlatSize('w', num, true);
    } else if (axis === 'w' || axis === 'flatW') {
      cad.flatW = num;
      if (cad.customDie) cad.customDie.heightMm = num;
      const inpFlatW = document.getElementById('inp-flat-w');
      if (inpFlatW && inpFlatW.value != num) inpFlatW.value = num;
      const dieFlatH = document.getElementById('die-flat-h');
      if (dieFlatH) dieFlatH.value = num;
      if (window.ParametricDieEngine) window.ParametricDieEngine.setFlatSize('h', num, true);
    }

    this.recalculate();
  },

  // ==========================================
  // FINISHING & WINDOW PATCHING (TALQ) HANDLERS
  // ==========================================
  onWindowPatchToggle() {
    const chk = document.getElementById('chk-window-patch');
    const isEnabled = chk ? chk.checked : false;
    window.LemonPack.materials.windowPatch.enabled = isEnabled;

    const item = document.getElementById('finishing-item-talq');
    const body = document.getElementById('window-patch-details');
    if (item) item.classList.toggle('active', isEnabled);
    if (body) body.classList.toggle('show', isEnabled);

    this.updateTalqPriceCard();
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  toggleTalqFromHeader(event) {
    const chk = document.getElementById('chk-window-patch');
    if (chk) {
      chk.checked = !chk.checked;
      this.onWindowPatchToggle();
    }
  },

  onWindowPatchChange() {
    const win = window.LemonPack.materials.windowPatch;
    win.length = Math.max(10, Number(document.getElementById('inp-win-length').value) || 70);
    win.width = Math.max(10, Number(document.getElementById('inp-win-width').value) || 45);
    win.margin = Math.max(5, Number(document.getElementById('inp-win-margin').value) || 10);

    this.updateTalqPriceCard();
    this.recalculate();
  },

  setWindowPreset(len, wid) {
    if (len === 'auto') {
      const cad = window.LemonPack.cad;
      len = Math.max(20, Math.round(cad.length * 0.6));
      wid = Math.max(20, Math.round(cad.height * 0.45));
    }
    const inpL = document.getElementById('inp-win-length');
    const inpW = document.getElementById('inp-win-width');
    if (inpL) inpL.value = len;
    if (inpW) inpW.value = wid;

    window.LemonPack.materials.windowPatch.length = len;
    window.LemonPack.materials.windowPatch.width = wid;

    this.updateTalqPriceCard();
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  setTalqMaterial(mat) {
    window.LemonPack.materials.windowPatch.material = mat;
    document.querySelectorAll('#talq-mat-chips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.talqMat === mat);
    });
    this.updateTalqPriceCard();
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  setTalqThickness(thick) {
    window.LemonPack.materials.windowPatch.thicknessMicron = Number(thick);
    document.querySelectorAll('#talq-thick-chips .chip').forEach(c => {
      c.classList.toggle('active', Number(c.dataset.talqThick) === Number(thick));
    });
    this.updateTalqPriceCard();
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  setTalqMethod(method) {
    window.LemonPack.materials.windowPatch.method = method;
    document.querySelectorAll('#talq-method-chips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.talqMethod === method);
    });
    this.updateTalqPriceCard();
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  updateTalqPriceCard() {
    if (!window.CostEngine) return;
    const mat = window.LemonPack.materials;
    const cad = window.LemonPack.cad;
    const rates = window.LemonPack.rates;
    const pUtils = window.PersianUtils || { e2p: function(v){ return v; }, fmtNum: function(v){ return v; }, fmtCurrency: function(v){ return v; } };
    const cur = window.LemonPack.currency || 'toman';

    const d = window.CostEngine.calculateTalqDetails(mat, cad, rates);

    const badgeFilm = document.getElementById('talq-live-badge-film');
    if (badgeFilm) badgeFilm.textContent = `شیت طلق: ${pUtils.e2p(d.filmW)}×${pUtils.e2p(d.filmH)} mm (${pUtils.e2p(d.weightPerPieceGrams)}g)`;

    const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setEl('talq-live-mat-cost', pUtils.fmtCurrency(d.unitMatCost, cur));
    setEl('talq-live-op-cost', pUtils.fmtCurrency(d.unitOpCost, cur));
    setEl('talq-live-unit-add', '+' + pUtils.fmtCurrency(d.unitTotal, cur));
    setEl('talq-live-order-qty', pUtils.fmtNum(cad.orderQty));
    setEl('talq-live-total-cost', pUtils.fmtCurrency(d.totalCost, cur));
  },

  // Foil Stamping Methods
  onFoilToggle() {
    const chk = document.getElementById('chk-foil-stamp');
    const isEnabled = chk ? chk.checked : false;
    window.LemonPack.materials.foilStamping.enabled = isEnabled;

    const item = document.getElementById('finishing-item-foil');
    const body = document.getElementById('foil-details');
    if (item) item.classList.toggle('active', isEnabled);
    if (body) body.classList.toggle('show', isEnabled);

    this.updateFoilPriceCard();
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  toggleFoilFromHeader(event) {
    const chk = document.getElementById('chk-foil-stamp');
    if (chk) {
      chk.checked = !chk.checked;
      this.onFoilToggle();
    }
  },

  onFoilChange() {
    const f = window.LemonPack.materials.foilStamping;
    f.lengthCm = Math.max(1, Number(document.getElementById('inp-foil-w').value) || 6);
    f.widthCm = Math.max(1, Number(document.getElementById('inp-foil-h').value) || 4);
    this.updateFoilPriceCard();
    this.recalculate();
  },

  setFoilColor(col) {
    window.LemonPack.materials.foilStamping.color = col;
    document.querySelectorAll('#foil-color-chips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.foilColor === col);
    });
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  updateFoilPriceCard() {
    if (!window.CostEngine) return;
    const mat = window.LemonPack.materials;
    const cad = window.LemonPack.cad;
    const rates = window.LemonPack.rates;
    const pUtils = window.PersianUtils || { e2p: function(v){ return v; }, fmtNum: function(v){ return v; }, fmtCurrency: function(v){ return v; } };
    const cur = window.LemonPack.currency || 'toman';

    const d = window.CostEngine.calculateFoilDetails(mat, cad, rates);
    const badgePlate = document.getElementById('foil-live-plate-badge');
    if (badgePlate) badgePlate.textContent = `کلیشه: ${pUtils.e2p(mat.foilStamping.lengthCm || 6)}×${pUtils.e2p(mat.foilStamping.widthCm || 4)} cm`;

    const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setEl('foil-live-plate-cost', pUtils.fmtCurrency(d.plateCost, cur));
    setEl('foil-live-run-cost', pUtils.fmtCurrency(250, cur));
    setEl('foil-live-unit-add', '+' + pUtils.fmtCurrency(d.unitTotal, cur));
    setEl('foil-live-order-qty', pUtils.fmtNum(cad.orderQty));
    setEl('foil-live-total-cost', pUtils.fmtCurrency(d.totalCost, cur));
  },

  // Spot UV Methods
  onSpotUvToggle() {
    const chk = document.getElementById('chk-spot-uv');
    const isEnabled = chk ? chk.checked : false;
    window.LemonPack.materials.spotUv.enabled = isEnabled;

    const item = document.getElementById('finishing-item-uv');
    const body = document.getElementById('uv-details');
    if (item) item.classList.toggle('active', isEnabled);
    if (body) body.classList.toggle('show', isEnabled);

    this.updateUvPriceCard();
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  toggleUvFromHeader(event) {
    const chk = document.getElementById('chk-spot-uv');
    if (chk) {
      chk.checked = !chk.checked;
      this.onSpotUvToggle();
    }
  },

  setUvType(type) {
    window.LemonPack.materials.spotUv.type = type;
    document.querySelectorAll('#uv-type-chips .chip').forEach(c => {
      c.classList.toggle('active', c.dataset.uvType === type);
    });
    this.updateUvPriceCard();
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  updateUvPriceCard() {
    const cad = window.LemonPack.cad;
    const mat = window.LemonPack.materials;
    const pUtils = window.PersianUtils || { e2p: function(v){ return v; }, fmtNum: function(v){ return v; }, fmtCurrency: function(v){ return v; } };
    const cur = window.LemonPack.currency || 'toman';

    const screenCost = 1200000;
    const unitRun = (mat.spotUv && mat.spotUv.type === 'cylinder') ? 240 : 180;
    const total = screenCost + (unitRun * cad.orderQty);
    const unitTotal = Math.round(total / Math.max(1, cad.orderQty));

    const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setEl('uv-live-screen-cost', pUtils.fmtCurrency(screenCost, cur));
    setEl('uv-live-run-cost', pUtils.fmtCurrency(unitRun, cur));
    setEl('uv-live-unit-add', '+' + pUtils.fmtCurrency(unitTotal, cur));
    setEl('uv-live-order-qty', pUtils.fmtNum(cad.orderQty));
    setEl('uv-live-total-cost', pUtils.fmtCurrency(total, cur));
  },

  openRatesModal() {
    const modal = document.getElementById('rates-modal');
    if (modal) modal.classList.add('show');
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  closeRatesModal() {
    const modal = document.getElementById('rates-modal');
    if (modal) modal.classList.remove('show');
    this.recalculate();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  setupPwa() {
    // Unregister any stale service workers and clear cache storage
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let r of registrations) r.unregister();
      }).catch(console.warn);
    }
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k));
      }).catch(console.warn);
    }
  }
};

window.go = function(tabId) {
  if (tabId === 'cad') tabId = 'studio';

  // If user clicked rates, simply open the rates modal over the active view without hiding the studio
  if (tabId === 'rates') {
    window.App.openRatesModal();
    return;
  }

  window.LemonPack.currentTab = tabId;

  document.querySelectorAll('.main-tab-view').forEach(v => {
    v.style.display = 'none';
  });

  const target = document.getElementById('view-' + tabId);
  if (target) {
    target.style.display = 'block';
  }

  document.querySelectorAll('.top-nav-item, .bnav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabId);
  });

  if (tabId === 'studio') {
    window.App.recalculate();
  } else if (tabId === 'invoice') {
    if (window.InvoiceEngine) {
      window.InvoiceEngine.switchDoc('commercial');
      window.InvoiceEngine.render();
    }
  } else if (tabId === 'jobticket') {
    if (window.InvoiceEngine) {
      window.InvoiceEngine.switchDoc('jobticket');
      window.InvoiceEngine.render();
    }
  } else if (tabId === 'diecut') {
    if (window.ParametricDieEngine) {
      const cad = window.LemonPack.cad;
      if (cad && !window.ParametricDieEngine.isCustomImport) {
        window.ParametricDieEngine.params.length = cad.length || 120;
        window.ParametricDieEngine.params.width = cad.width || 80;
        window.ParametricDieEngine.params.height = cad.height || 150;
        window.ParametricDieEngine.params.glueFlap = cad.glueFlap || 15;
        window.ParametricDieEngine.params.topTuck = cad.tuckFlap || 25;
        if (typeof window.ParametricDieEngine.synthesizeModelFromParams === 'function') {
          window.ParametricDieEngine.synthesizeModelFromParams();
        } else if (typeof window.ParametricDieEngine.synthesizeModel === 'function') {
          window.ParametricDieEngine.synthesizeModel();
        }
      }
      if (typeof window.ParametricDieEngine.render === 'function') {
        window.ParametricDieEngine.render();
      }
    } else if (window.DieCutImporter) {
      window.DieCutImporter.renderPreviewCanvas();
    }
  }

  if (window.SoundEngine) window.SoundEngine.playClick();
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const rm = document.getElementById('rates-modal');
    if (rm && rm.classList.contains('show')) {
      window.App.closeRatesModal();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
