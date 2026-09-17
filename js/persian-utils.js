/* ============================================================
   PERSIAN NUMBER FORMATTING, CURRENCY CONVERSION & WORDS ENGINE
   ============================================================ */

window.PersianUtils = {
  faDigits: ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'],

  e2p(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/\d/g, d => this.faDigits[d]);
  },

  p2e(str) {
    if (!str) return '';
    return String(str).replace(/[۰-۹]/g, w => this.faDigits.indexOf(w));
  },

  fmtNum(n, decimals = 0) {
    if (isNaN(n) || n === null) return '۰';
    const num = Number(n);
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return this.e2p(formatted);
  },

  fmtCurrency(tomanAmount, targetCurrency = 'toman', showUnit = true) {
    const isRial = targetCurrency === 'rial';
    const val = isRial ? (tomanAmount * 10) : tomanAmount;
    const unitText = isRial ? 'ریال' : 'تومان';
    const numStr = this.fmtNum(val);
    return showUnit ? (numStr + ' ' + unitText) : numStr;
  },

  numToWords(num, currency = 'toman') {
    if (num === 0) return 'صفر';
    if (!num || isNaN(num)) return '';
    num = Math.floor(Math.abs(num));
    
    const ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
    const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
    const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
    const hundreds = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
    const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

    function convertThreeDigits(n) {
      const parts = [];
      const h = Math.floor(n / 100);
      const t = Math.floor((n % 100) / 10);
      const o = n % 10;
      if (h > 0) parts.push(hundreds[h]);
      if (t === 1) {
        parts.push(teens[o]);
      } else {
        if (t > 1) parts.push(tens[t]);
        if (o > 0) parts.push(ones[o]);
      }
      return parts.join(' و ');
    }

    const chunks = [];
    let temp = num;
    while (temp > 0) {
      chunks.push(temp % 1000);
      temp = Math.floor(temp / 1000);
    }

    const words = [];
    for (let i = chunks.length - 1; i >= 0; i--) {
      const chunk = chunks[i];
      if (chunk > 0) {
        const chunkText = convertThreeDigits(chunk);
        const scale = scales[i];
        words.push(scale ? (chunkText + ' ' + scale) : chunkText);
      }
    }
    
    const unitSuffix = currency === 'rial' ? ' ریال تمام' : ' تومان تمام';
    return words.join(' و ') + unitSuffix;
  }
};
