/* ============================================================
   OFFICIAL INDUSTRIAL INVOICING & PRODUCTION TICKET ENGINE
   ============================================================ */

window.InvoiceEngine = {
  currentDocTab: 'commercial', // 'commercial' or 'jobticket'

  init() {
    this.setupCustomerData();
  },

  setupCustomerData() {
    try {
      const raw = localStorage.getItem('lemonpack_customer_info');
      if (raw) {
        const info = JSON.parse(raw);
        window.LemonPack.customer = Object.assign({
          name: 'شرکت داروسازی و بهداشتی البرز (سهامی خاص)',
          id: '۱۰۱۰۴۹۵۸۲۹۱',
          phone: '۰۲۱-۴۴۵۵۶۶۷۷',
          postal: '۱۴۸۹۷۶۵۴۳۲',
          address: 'تهران، کیلومتر ۱۲ جاده مخصوص کرج، خیابان بیست‌وسوم، پلاک ۱۸'
        }, info);
      }
    } catch(e) {}
  },

  switchDoc(tabName) {
    this.currentDocTab = tabName;
    const tabs = document.querySelectorAll('.doc-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.doc === tabName));

    const comEl = document.getElementById('doc-commercial');
    const jobEl = document.getElementById('doc-jobticket');
    if (comEl) comEl.style.display = tabName === 'commercial' ? 'block' : 'none';
    if (jobEl) jobEl.style.display = tabName === 'jobticket' ? 'block' : 'none';

    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  render() {
    const cad = window.LemonPack.cad;
    const mat = window.LemonPack.materials;
    const nest = window.LemonPack.nesting;
    const rates = window.LemonPack.rates;
    const res = window.CostEngine.calculate();
    const cur = window.LemonPack.currency || 'toman';
    const pUtils = window.PersianUtils;

    // Model name
    const modelNames = {
      tuck_end: 'جعبه دارویی / درب دارویی',
      mailer_0427: 'جعبه کیبوردی پستی 0427',
      lock_bottom: 'جعبه ته قفلی صنعتی',
      rigid_box: 'هاردباکس لوکس مکعبی',
      shopping_bag: 'ساک دستی خرید / بگ شاپ'
    };
    const modelText = modelNames[cad.model] || cad.model;

    // Substrate name
    const substrateNames = {
      inderboard: 'ایندربرد بهداشتی (FBB)',
      glosse: 'گلاسه اختصاصی'
    };
    const subText = (substrateNames[mat.substrate] || mat.substrate) + ' ' + pUtils.e2p(mat.gsm) + ' گرم';

    // 1. Render Official Commercial Invoice Header & Specs
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('inv-model-text', modelText);
    setTxt('inv-dims-text', pUtils.e2p(cad.length) + ' × ' + pUtils.e2p(cad.width) + ' × ' + pUtils.e2p(cad.height) + ' mm');
    setTxt('inv-flat-text', pUtils.e2p(cad.flatL) + ' × ' + pUtils.e2p(cad.flatW) + ' mm');
    setTxt('inv-paper-text', subText);
    setTxt('inv-lam-text', mat.lamination === 'matte' ? 'سلفون مات حرارتی' : (mat.lamination === 'gloss' ? 'سلفون براق' : (mat.lamination === 'velvet' ? 'سلفون مخملی' : 'بدون سلفون')));

    // Finishing & Window specs
    const finishList = [];
    if (mat.windowPatch && mat.windowPatch.enabled) {
      finishList.push(`پنجره طلقی ${pUtils.e2p(mat.windowPatch.length)}×${pUtils.e2p(mat.windowPatch.width)} mm (${mat.windowPatch.material.toUpperCase()} ${pUtils.e2p(mat.windowPatch.thicknessMicron)}µm)`);
    }
    if (mat.foilStamping && mat.foilStamping.enabled) {
      finishList.push(`طلاکوب ${pUtils.e2p(mat.foilStamping.lengthCm)}×${pUtils.e2p(mat.foilStamping.widthCm)} cm`);
    }
    if (mat.spotUv && mat.spotUv.enabled) {
      finishList.push(mat.spotUv.type === 'cylinder' ? 'یووی سیلندری' : 'یووی موضعی');
    }
    setTxt('inv-uv-text', finishList.length > 0 ? finishList.join(' + ') : 'بدون خدمات تکمیلی');
    setTxt('inv-gluing-text', mat.gluing === 'auto' ? 'لب‌چسب اتوماتیک' : (mat.gluing === 'manual' ? 'چسب دستی' : 'شیت تخت'));
    setTxt('inv-ups-text', pUtils.e2p(nest.ups) + ' کار در شیت (' + pUtils.e2p(nest.sheetL) + '×' + pUtils.e2p(nest.sheetW) + ' cm)');

    let itemDesc = 'تولید صنعتی جعبه با مشخصات فنی فوق (شامل مقوا، زینک، چاپ ۴ رنگ، سلفون، لترپرس و جعبه‌چسبانی';
    if (mat.windowPatch && mat.windowPatch.enabled) itemDesc += ' + پنجره طلقی ویندوپچ';
    if (mat.foilStamping && mat.foilStamping.enabled) itemDesc += ' + طلاکوب حرارتی';
    if (mat.spotUv && mat.spotUv.enabled) itemDesc += ' + یووی موضعی';
    itemDesc += ')';
    setTxt('inv-item-desc', itemDesc);

    // Financial Rows
    setTxt('inv-qty-val', pUtils.fmtNum(cad.orderQty));
    setTxt('inv-unit-val', pUtils.fmtCurrency(res.unitPrice, cur, false));
    setTxt('inv-total-val', pUtils.fmtCurrency(res.grandTotal, cur, false));
    
    // VAT & Grand Total
    const withVat = document.getElementById('chk-vat') ? document.getElementById('chk-vat').checked : true;
    const vatAmount = withVat ? Math.round(res.grandTotal * 0.1) : 0;
    const payableTotal = res.grandTotal + vatAmount;

    setTxt('inv-subtotal-text', pUtils.fmtCurrency(res.grandTotal, cur));
    setTxt('inv-vat-text', withVat ? pUtils.fmtCurrency(vatAmount, cur) : 'معاف');
    setTxt('inv-payable-text', pUtils.fmtCurrency(payableTotal, cur));
    setTxt('inv-words-text', pUtils.numToWords(cur === 'rial' ? (payableTotal * 10) : payableTotal, cur));

    // 2. Render Tiered Matrix
    this.renderTieredMatrix(res);

    // 3. Render Factory Job-Ticket
    this.renderJobTicket(res, modelText, subText);
  },

  renderTieredMatrix(res) {
    const tbody = document.getElementById('tier-tbody');
    if (!tbody) return;
    const tiers = [500, 1000, 2500, 5000, 10000];
    const cad = window.LemonPack.cad;
    const rates = window.LemonPack.rates;
    const nest = window.LemonPack.nesting;
    const mat = window.LemonPack.materials;
    const cur = window.LemonPack.currency || 'toman';
    const pUtils = window.PersianUtils;

    const weightPerSheet = (nest.sheetL * nest.sheetW * mat.gsm) / 10000000;
    const fixedCost = (mat.colors * rates.plate_2_5_unit_cost_toman) +
      (cad.isDieInArchive ? 0 : rates.laser_die_fabrication_default_cost_toman) +
      rates.letterpress_base_run_cost_toman +
      rates.transport_and_logistics_fixed_toman;

    let html = '';
    let baseUnitPrice = 0;

    tiers.forEach((qty, idx) => {
      const rawSheets = Math.ceil(qty / Math.max(1, nest.ups));
      const procured = Math.ceil(rawSheets / 100) * 100;
      const runs = Math.max(1, Math.ceil(procured / rates.press_run_base_impression_limit));

      const paperCost = procured * weightPerSheet * rates.paper_price_per_kg_toman;
      const printCost = runs * rates.press_run_cost_per_5000_toman;
      const lamCost = mat.lamination !== 'none' ? nest.sheetL * nest.sheetW * rates.lamination_rate_per_cm2_toman * procured : 0;
      const gluingCost = qty * rates.gluing_cost_per_box_toman;

      const tierCogs = fixedCost + paperCost + printCost + lamCost + gluingCost;
      const tierTotal = Math.round(tierCogs * (1 + (rates.profit_margin_percentage / 100)));
      const tierUnit = Math.round(tierTotal / qty);

      if (idx === 0) baseUnitPrice = tierUnit;
      const savingsPct = baseUnitPrice > 0 ? Math.round(((baseUnitPrice - tierUnit) / baseUnitPrice) * 100) : 0;
      const isCurrent = (qty === cad.orderQty);

      html += '<tr class="' + (isCurrent ? 'current-tier' : '') + '">' +
        '<td class="tabular-nums">' + pUtils.fmtNum(qty) + ' عدد' + (isCurrent ? ' (انتخاب فعلی)' : '') + '</td>' +
        '<td class="tabular-nums" style="font-weight:800;">' + pUtils.fmtCurrency(tierUnit, cur) + '</td>' +
        '<td class="tabular-nums">' + pUtils.fmtCurrency(tierTotal, cur) + '</td>' +
        '<td class="tabular-nums" style="color:#059669; font-weight:800;">' + (savingsPct > 0 ? ('-' + pUtils.e2p(savingsPct) + '٪') : 'مبنا') + '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  },

  renderJobTicket(res, modelText, subText) {
    const pUtils = window.PersianUtils;
    const cad = window.LemonPack.cad;
    const nest = window.LemonPack.nesting;
    const mat = window.LemonPack.materials;
    const cur = window.LemonPack.currency || 'toman';

    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('jt-model', modelText);
    setTxt('jt-qty', pUtils.fmtNum(cad.orderQty) + ' عدد');
    setTxt('jt-substrate', subText);
    setTxt('jt-sheets', pUtils.fmtNum(res.procuredSheets) + ' شیت (' + pUtils.fmtNum(res.bandsCount) + ' بند)');
    setTxt('jt-weight', pUtils.fmtNum(res.totalPaperKg, 1) + ' کیلوگرم');
    setTxt('jt-press', nest.pressClass + ' (' + pUtils.fmtNum(res.runsCount) + ' دور چاپ)');
    setTxt('jt-waste', pUtils.e2p(nest.wastePercentage) + '٪');
    setTxt('jt-plates', pUtils.fmtNum(mat.colors) + ' عدد زینک (' + (mat.colors >= 4 ? 'CMYK' : 'تک رنگ') + ')');
    setTxt('jt-die', cad.isDieInArchive ? 'قالب در آرشیو موجود است' : 'قالب لیزری جدید ساخته شود');
  },

  exportPdf() {
    const el = document.getElementById(this.currentDocTab === 'commercial' ? 'doc-commercial' : 'doc-jobticket');
    if (!el) return;
    toast('در حال ساخت سند PDF با فونت برداری...');

    if (window.html2canvas && window.jspdf) {
      window.html2canvas(el, { scale: 2.5, useCORS: true, backgroundColor: '#FFFFFF' }).then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgW = 194;
        const imgH = (canvas.height * imgW) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 8, 8, imgW, imgH);
        pdf.save('LemonPack_Official_' + Date.now() + '.pdf');
        toast('سند با کیفیت بالا ذخیره شد ✓');
      }).catch(err => {
        console.error(err);
        toast('خطا در خروجی PDF');
      });
    } else {
      window.print();
    }
  },

  shareWhatsApp() {
    const cad = window.LemonPack.cad;
    const res = window.CostEngine.calculate();
    const cur = window.LemonPack.currency || 'toman';
    const pUtils = window.PersianUtils;

    const lines = [
      '📦 *پیش‌فاکتور رسمی استودیو بسته‌بندی لمون‌پک*',
      '━━━━━━━━━━━━━━━━━━━━',
      '• ابعاد جعبه: ' + pUtils.e2p(cad.length) + '×' + pUtils.e2p(cad.width) + '×' + pUtils.e2p(cad.height) + ' mm',
      '• تیراژ سفارش: ' + pUtils.fmtNum(cad.orderQty) + ' عدد',
      '• قیمت هر عدد: ' + pUtils.fmtCurrency(res.unitPrice, cur),
      '• *مبلغ کل پیش‌فاکتور:* ' + pUtils.fmtCurrency(res.grandTotal, cur),
      '• اعتبار استعلام: ۴۸ ساعت کاری',
      '━━━━━━━━━━━━━━━━━━━━',
      'تلفن کارخانه: ۰۲۱-۸۸۷۶۵۴۳۲'
    ];
    const text = lines.join('\n');

    if (navigator.share) {
      navigator.share({ title: 'پیش‌فاکتور لمون پک', text: text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => toast('متن پیش‌فاکتور برای واتس‌اپ کپی شد ✓'));
    }
  }
};
