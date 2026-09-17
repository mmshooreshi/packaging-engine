/* ============================================================
   LEMONPACK PRO - MASTER ORCHESTRATOR & PWA ENGINE
   ============================================================ */

const STORAGE_KEY = 'lemonpack_config_v2';

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
  profit_margin_percentage: 30.0
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
    uv: 'spot',
    gluing: 'auto',
    colors: 4
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
  viewMode: 'studio', // 'studio' or 'steps'
  activeCanvasTab: 'nesting' // 'nesting' or 'blueprint'
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
    window.CadEngine.init();
    window.CadEngine.recalculateFlatDimensions();
    window.InvoiceEngine.init();
    this.recalculate();
    this.setupPwa();
    this.setupAccordion();
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
    window.NestingEngine.optimize();
    if (window.LemonPack.activeCanvasTab === 'nesting') {
      window.NestingEngine.renderCanvas();
    } else {
      window.CadEngine.renderBlueprint();
    }
    window.CostEngine.calculate();
    window.InvoiceEngine.render();
  },

  switchCanvasTab(tab) {
    window.LemonPack.activeCanvasTab = tab;
    document.querySelectorAll('.canvas-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const nestCanvas = document.getElementById('nesting-canvas');
    const blueCanvas = document.getElementById('blueprint-canvas');
    const legend = document.getElementById('canvas-legend-wrap');

    if (tab === 'nesting') {
      if (nestCanvas) nestCanvas.style.display = 'block';
      if (blueCanvas) blueCanvas.style.display = 'none';
      if (legend) legend.style.display = 'flex';
      window.NestingEngine.renderCanvas();
    } else {
      if (nestCanvas) nestCanvas.style.display = 'none';
      if (blueCanvas) blueCanvas.style.display = 'block';
      if (legend) legend.style.display = 'none';
      window.CadEngine.renderBlueprint();
    }
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  toggleCurrency() {
    const cur = window.LemonPack.currency === 'toman' ? 'rial' : 'toman';
    window.LemonPack.currency = cur;
    const btn = document.getElementById('btn-currency-toggle');
    if (btn) btn.textContent = cur === 'toman' ? 'تومان' : 'ریال';
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

  toggleViewMode() {
    const mode = window.LemonPack.viewMode === 'studio' ? 'steps' : 'studio';
    window.LemonPack.viewMode = mode;
    document.body.classList.toggle('view-mode-studio', mode === 'studio');
    document.body.classList.toggle('view-mode-steps', mode === 'steps');
    const btn = document.getElementById('btn-view-mode');
    if (btn) {
      btn.innerHTML = mode === 'studio' 
        ? '<i class="ph ph-squares-four"></i> استودیو' 
        : '<i class="ph ph-steps"></i> گام‌به‌گام';
    }
    if (window.SoundEngine) window.SoundEngine.playClick();
    toast(mode === 'studio' ? 'نمای استودیوی یکپارچه فعال شد' : 'نمای گام‌به‌گام فعال شد');
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
    const setInp = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setInp('set-paper-price', r.paper_price_per_kg_toman);
    setInp('set-plate-cost', r.plate_2_5_unit_cost_toman);
    setInp('set-press-cost', r.press_run_cost_per_5000_toman);
    setInp('set-lam-rate', r.lamination_rate_per_cm2_toman);
    setInp('set-letterpress-cost', r.letterpress_base_run_cost_toman);
    setInp('set-die-cost', r.laser_die_fabrication_default_cost_toman);
    setInp('set-gluing-box', r.gluing_cost_per_box_toman);
    setInp('set-profit-pct', r.profit_margin_percentage);

    setInp('drw-paper-price', r.paper_price_per_kg_toman);
    setInp('drw-plate-cost', r.plate_2_5_unit_cost_toman);
    setInp('drw-press-cost', r.press_run_cost_per_5000_toman);
    setInp('drw-profit-pct', r.profit_margin_percentage);
  },

  saveRates() {
    const pUtils = window.PersianUtils || { p2e: function(v){ return v; } };
    const getVal = (id, def) => {
      const el = document.getElementById(id);
      return el && el.value ? Number(pUtils.p2e(el.value)) : def;
    };
    const r = window.LemonPack.rates;
    r.paper_price_per_kg_toman = getVal('set-paper-price', DEFAULT_RATES.paper_price_per_kg_toman);
    r.plate_2_5_unit_cost_toman = getVal('set-plate-cost', DEFAULT_RATES.plate_2_5_unit_cost_toman);
    r.press_run_cost_per_5000_toman = getVal('set-press-cost', DEFAULT_RATES.press_run_cost_per_5000_toman);
    r.lamination_rate_per_cm2_toman = getVal('set-lam-rate', DEFAULT_RATES.lamination_rate_per_cm2_toman);
    r.letterpress_base_run_cost_toman = getVal('set-letterpress-cost', DEFAULT_RATES.letterpress_base_run_cost_toman);
    r.laser_die_fabrication_default_cost_toman = getVal('set-die-cost', DEFAULT_RATES.laser_die_fabrication_default_cost_toman);
    r.gluing_cost_per_box_toman = getVal('set-gluing-box', DEFAULT_RATES.gluing_cost_per_box_toman);
    r.profit_margin_percentage = getVal('set-profit-pct', DEFAULT_RATES.profit_margin_percentage);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    this.recalculate();
  },

  setupChips() {
    // Model chips
    document.querySelectorAll('[data-model]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-model]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.cad.model = chip.dataset.model;
        window.CadEngine.recalculateFlatDimensions();
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    // Substrate chips
    document.querySelectorAll('[data-sub]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-sub]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.substrate = chip.dataset.sub;
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    // GSM chips
    document.querySelectorAll('[data-gsm]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-gsm]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.gsm = Number(chip.dataset.gsm);
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    // Lamination chips
    document.querySelectorAll('[data-lam]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-lam]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.lamination = chip.dataset.lam;
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    // UV chips
    document.querySelectorAll('[data-uv]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-uv]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.uv = chip.dataset.uv;
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    // Gluing chips
    document.querySelectorAll('[data-gluing]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-gluing]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.gluing = chip.dataset.gluing;
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    // Colors chips
    document.querySelectorAll('[data-colors]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-colors]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        window.LemonPack.materials.colors = Number(chip.dataset.colors);
        this.recalculate();
        if (window.SoundEngine) window.SoundEngine.playClick();
      });
    });

    // Sheet size chips
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
    cad.length = Number(document.getElementById('inp-length').value) || 120;
    cad.width = Number(document.getElementById('inp-width').value) || 80;
    cad.height = Number(document.getElementById('inp-height').value) || 150;
    cad.orderQty = Number(document.getElementById('inp-order-qty').value) || 1000;
    cad.isDieInArchive = document.getElementById('chk-archive-die') ? document.getElementById('chk-archive-die').checked : false;

    window.CadEngine.recalculateFlatDimensions();
    this.recalculate();
  },

  setupPwa() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(console.warn);
    }
  }
};

window.go = function(tabId) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('visible');
    setTimeout(() => v.classList.remove('active'), 50);
  });
  setTimeout(() => {
    const target = document.getElementById('v-' + tabId);
    if (target) {
      target.classList.add('active');
      target.scrollTop = 0;
      requestAnimationFrame(() => target.classList.add('visible'));
    }
  }, 60);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabId);
  });

  if (window.SoundEngine) window.SoundEngine.playClick();
};

window.openRatesDrawer = function() {
  document.getElementById('rates-overlay').classList.add('show');
  document.getElementById('rates-drawer').classList.add('show');
  if (window.SoundEngine) window.SoundEngine.playClick();
};

window.closeRatesDrawer = function() {
  document.getElementById('rates-overlay').classList.remove('show');
  document.getElementById('rates-drawer').classList.remove('show');
};

document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
