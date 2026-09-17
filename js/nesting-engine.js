/* ============================================================
   2D SHEET NESTING OPTIMIZER & INTERACTIVE SHEET CANVAS
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

  STANDARD_SHEETS: [
    { length: 100, width: 70 },
    { length: 90, width: 60 },
    { length: 120, width: 70 },
    { length: 100, width: 80 },
    { length: 120, width: 80 },
    { length: 100, width: 60 },
    { length: 90, width: 70 }
  ],

  optimize() {
    const cad = window.LemonPack.cad;
    const flatLcm = (cad.flatL + this.MACHINE_CONSTRAINTS.interGutterMm) / 10;
    const flatWcm = (cad.flatW + this.MACHINE_CONSTRAINTS.interGutterMm) / 10;
    const gripper = this.MACHINE_CONSTRAINTS.gripperMarginCm;
    const safety = (this.MACHINE_CONSTRAINTS.safetyMarginMm * 2) / 10;

    let bestSheet = this.STANDARD_SHEETS[0];
    let bestUps = 0;
    let bestWaste = 100;
    let bestOrientation = 'A';

    const sheetsToTest = window.LemonPack.nesting.sheetMode === 'auto'
      ? this.STANDARD_SHEETS
      : [
          {
            length: Number(window.LemonPack.nesting.sheetMode.split('x')[0]),
            width: Number(window.LemonPack.nesting.sheetMode.split('x')[1])
          }
        ];

    sheetsToTest.forEach(s => {
      const usableL = s.length - gripper - safety;
      const usableW = s.width - safety;

      const upsA = Math.floor(usableL / flatLcm) * Math.floor(usableW / flatWcm);
      const upsB = Math.floor(usableL / flatWcm) * Math.floor(usableW / flatLcm);

      const maxUps = Math.max(upsA, upsB);
      const orientation = upsA >= upsB ? 'A' : 'B';

      if (maxUps > 0) {
        const pieceArea = (cad.flatL * cad.flatW) / 100;
        const sheetArea = s.length * s.width;
        const waste = Math.max(0, 100 - (((maxUps * pieceArea) / sheetArea) * 100));

        if (maxUps > bestUps || (maxUps === bestUps && waste < bestWaste)) {
          bestUps = maxUps;
          bestWaste = waste;
          bestSheet = s;
          bestOrientation = orientation;
        }
      }
    });

    const nest = window.LemonPack.nesting;
    nest.sheetL = bestSheet.length;
    nest.sheetW = bestSheet.width;
    nest.ups = Math.max(1, bestUps || 1);
    nest.wastePercentage = bestWaste.toFixed(1);
    nest.orientation = bestOrientation;

    if (nest.sheetL <= 50 && nest.sheetW <= 35) {
      nest.pressClass = 'دستگاه ۱.۵ ورقی';
    } else if (nest.sheetL <= 72 && nest.sheetW <= 52) {
      nest.pressClass = 'دستگاه ۲.۵ ورقی';
    } else {
      nest.pressClass = 'دستگاه ۴.۵ ورقی';
    }

    const pUtils = window.PersianUtils || { e2p: function(v){ return v; } };
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('hud-ups', pUtils.e2p(nest.ups) + ' کار');
    setTxt('hud-sheet', pUtils.e2p(nest.sheetL) + ' × ' + pUtils.e2p(nest.sheetW));
    setTxt('hud-press', nest.pressClass);
    setTxt('hud-waste', pUtils.e2p(nest.wastePercentage) + '٪');
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

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = startX + 8 + (c * pieceW);
        const by = startY + 8 + (r * pieceH);
        const cellW = pieceW - 3;
        const cellH = pieceH - 3;

        ctx.fillStyle = 'rgba(217, 119, 6, 0.06)';
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
        ctx.fillText(pUtils.e2p(boxIndex++), bx + (cellW / 2), by + (cellH / 2) + 3);
      }
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '10px Peyda, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ابعاد شیت انتخابی: ' + pUtils.e2p(nest.sheetL) + ' × ' + pUtils.e2p(nest.sheetW) + ' سانتی‌متر', w / 2, h - 8);
  }
};
