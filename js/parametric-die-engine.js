/* ============================================================
   PARAMETRIC DIE-CUT & MATHEMATICAL PACKAGING FORMULA ENGINE v6.1
   Atomic Segment Decomposition, Similarity & Symmetry Engine,
   Piecewise Parametric Deformation (Non-Stretching), Keyboard Controls,
   MacDora-Standard Packaging Topology Detection (L, W, H, G, T),
   and Real-time Blueprint CAD Workspace.
   ============================================================ */

window.ParametricDieEngine = {
  isCustomImport: false,
  rawSvgString: null,
  activeTab: 'similarity',

  // Core Parametric Packaging Dimensions (in millimeters)
  params: {
    length: 120,    // L: طول بدنه (Front & Back)
    width: 80,      // W: عرض پهلو (Side Panels)
    height: 150,    // H: ارتفاع بدنه (Body Height)
    glueFlap: 15,   // G: لبه چسب (Glue Flap)
    topTuck: 25,    // T: زبانه درپوش / درب (Tuck Flap)
    bottomTuck: 25, // T_bot
    dustFlap: 15,   // D: گوشواره گردگیر
    lockNotch: 4,   // قفل زبانه
    creaseGap: 2
  },

  // Calculated Metrics
  calculated: {
    flatWidth: 415,
    flatHeight: 266,
    totalBladeLengthMm: 1840,
    totalCreaseLengthMm: 1120,
    areaCm2: 1103.9,
    boxDimensions: { l: 120, w: 80, h: 150 }
  },

  // Atomic Segments Repository
  segments: [],
  similarityGroups: [],
  deletedSegmentsHistory: [],

  // Interaction State
  selectedParam: 'length',    // 'length' | 'width' | 'height' | 'glueFlap' | 'topTuck'
  hoveredParam: null,
  selectedSegmentId: null,
  hoveredSegmentId: null,

  // Canvas Viewport Controls
  zoomLevel: 1.0,
  panOffset: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  canvasWidthMm: 500,
  canvasHeightMm: 350,
  scalePxPerMm: 2.0,

  init() {
    this.synthesizeModelFromParams();
    this.setupCanvasEvents();
    this.setupKeyboardListeners();
    this.render();
  },

  /* ============================================================
     1. SYNTHESIS OF PARAMETRIC MODEL (Piecewise, Non-Stretching)
     Constructs accurate industrial box diecut geometry from L, W, H, G, T
     ============================================================ */
  synthesizeModelFromParams() {
    const p = this.params;
    const L = Math.max(20, Number(p.length) || 120);
    const W = Math.max(15, Number(p.width) || 80);
    const H = Math.max(20, Number(p.height) || 150);
    const G = Math.max(8, Number(p.glueFlap) || 15);
    const T = Math.max(10, Number(p.topTuck) || 25);
    const D = Math.max(8, Number(p.dustFlap) || 15);

    p.length = L; p.width = W; p.height = H;
    p.glueFlap = G; p.topTuck = T; p.dustFlap = D;

    // Piecewise horizontal coordinate anchors (X)
    const x0 = 0;
    const x1 = G;
    const x2 = G + W;
    const x3 = G + W + L;
    const x4 = G + W + L + W;
    const x5 = G + W + L + W + L;

    // Piecewise vertical coordinate anchors (Y)
    const y0 = 0;
    const y1 = T;
    const y2 = T + W;
    const y3 = T + W + H;
    const y4 = T + W + H + W;
    const y5 = T + W + H + W + T;

    const flatW = x5;
    const flatH = y5;
    this.calculated.flatWidth = flatW;
    this.calculated.flatHeight = flatH;
    this.calculated.boxDimensions = { l: L, w: W, h: H };

    // Atomic Segments Construction with Semantic Roles & Group Signatures
    const segs = [];
    let nextId = 1;
    const addSeg = (type, x1, y1, x2, y2, mapping, groupName, label) => {
      const nX1 = typeof x1 === 'number' ? x1 : (parseFloat(x1) || 0);
      const nY1 = typeof y1 === 'number' ? y1 : (parseFloat(y1) || 0);
      const nX2 = typeof x2 === 'number' ? x2 : (parseFloat(x2) || 0);
      const nY2 = typeof y2 === 'number' ? y2 : (parseFloat(y2) || 0);

      const len = Math.hypot(nX2 - nX1, nY2 - nY1);
      const isHoriz = Math.abs(nY2 - nY1) < 0.2;
      const isVert = Math.abs(nX2 - nX1) < 0.2;
      const orientation = isHoriz ? 'horizontal' : (isVert ? 'vertical' : 'diagonal');

      segs.push({
        id: `seg_${nextId++}`,
        type: type, // 'cut' | 'crease' | 'glue' | 'perforation' | 'guide'
        x1: Number(nX1.toFixed(2)),
        y1: Number(nY1.toFixed(2)),
        x2: Number(nX2.toFixed(2)),
        y2: Number(nY2.toFixed(2)),
        d: `M ${nX1.toFixed(2)} ${nY1.toFixed(2)} L ${nX2.toFixed(2)} ${nY2.toFixed(2)}`,
        lengthMm: Number(len.toFixed(1)),
        mapping: mapping, // 'length' | 'width' | 'height' | 'glueFlap' | 'topTuck' | 'dustFlap' | null
        groupKey: groupName,
        label: label,
        orientation: orientation,
        isDeleted: false
      });
    };

    // --- 1. Vertical Creases (4 body folds of height H) ---
    addSeg('crease', x1, y2, x1, y3, 'height', 'grp_crease_vertical_body', 'خط تا عمودی: لبه چسب / پهلو چپ');
    addSeg('crease', x2, y2, x2, y3, 'height', 'grp_crease_vertical_body', 'خط تا عمودی: پهلو چپ / جلو');
    addSeg('crease', x3, y2, x3, y3, 'height', 'grp_crease_vertical_body', 'خط تا عمودی: جلو / پهلو راست');
    addSeg('crease', x4, y2, x4, y3, 'height', 'grp_crease_vertical_body', 'خط تا عمودی: پهلو راست / پشت');

    // --- 2. Horizontal Creases (Body Top and Bottom fold lines) ---
    // Top Body Creases at y2
    addSeg('crease', x1, y2, x2, y2, 'width', 'grp_crease_horiz_width', 'خط تا افقی: درپوش پهلو چپ');
    addSeg('crease', x2, y2, x3, y2, 'length', 'grp_crease_horiz_length', 'خط تا افقی: درپوش اصلی جلو');
    addSeg('crease', x3, y2, x4, y2, 'width', 'grp_crease_horiz_width', 'خط تا افقی: درپوش پهلو راست');
    addSeg('crease', x4, y2, x5, y2, 'length', 'grp_crease_horiz_length', 'خط تا افقی: درپوش اصلی پشت');

    // Bottom Body Creases at y3
    addSeg('crease', x1, y3, x2, y3, 'width', 'grp_crease_horiz_width', 'خط تا افقی: کف پهلو چپ');
    addSeg('crease', x2, y3, x3, y3, 'length', 'grp_crease_horiz_length', 'خط تا افقی: کف اصلی جلو');
    addSeg('crease', x3, y3, x4, y3, 'width', 'grp_crease_horiz_width', 'خط تا افقی: کف پهلو راست');
    addSeg('crease', x4, y3, x5, y3, 'length', 'grp_crease_horiz_length', 'خط تا افقی: کف اصلی پشت');

    // Flap Tuck Creases (between tuck flap and lid panel)
    addSeg('crease', x2, y1, x3, y1, 'topTuck', 'grp_crease_flap_tuck', 'خط تا زبانه درپوش بالا');
    addSeg('crease', x4, y4, x5, y4, 'topTuck', 'grp_crease_flap_tuck', 'خط تا زبانه درپوش پایین');

    // --- 3. Glue Flap Edges (Left Tab) ---
    addSeg('glue', x0, y2 + 4, x0, y3 - 4, 'glueFlap', 'grp_glue_flap', 'تیغ لبه چسب کناری');
    addSeg('cut', x0, y2 + 4, x1, y2, 'glueFlap', 'grp_glue_flap_taper', 'پخ بالای لبه چسب');
    addSeg('cut', x0, y3 - 4, x1, y3, 'glueFlap', 'grp_glue_flap_taper', 'پخ پایین لبه چسب');

    // --- 4. Top Tuck Flap Contours (Panel 2: x2 to x3) ---
    // Lip edge of tuck flap at y0
    addSeg('cut', x2 + 4, y0, x3 - 4, y0, 'length', 'grp_tuck_lip', 'تیغ لبه درپوش بالا');
    // Radiused / chamfered corners
    addSeg('cut', x2, y1, x2 + 4, y0, 'topTuck', 'grp_tuck_side', 'گوشه مایل درپوش بالا');
    addSeg('cut', x3 - 4, y0, x3, y1, 'topTuck', 'grp_tuck_side', 'گوشه مایل درپوش بالا');
    // Flap side slits
    addSeg('cut', x2, y1, x2, y2, 'width', 'grp_flap_slits', 'چاک و شیار پهلوی درپوش بالا');
    addSeg('cut', x3, y1, x3, y2, 'width', 'grp_flap_slits', 'چاک و شیار پهلوی درپوش بالا');

    // --- 5. Dust Flap Contours (Ears on Panel 1: x1 to x2, and Panel 3: x3 to x4) ---
    // Dust flap 1 (Top of Panel 1)
    addSeg('cut', x1, y2, x1, y2 - (W * 0.7), 'dustFlap', 'grp_dust_flap_edge', 'برش عمودی گوشواره چپ');
    addSeg('cut', x1, y2 - (W * 0.7), x2 - 4, y2 - (W * 0.7), 'width', 'grp_dust_flap_top', 'برش افقی گوشواره چپ');
    addSeg('cut', x2 - 4, y2 - (W * 0.7), x2, y2, 'dustFlap', 'grp_dust_flap_chamfer', 'پخ زاویه‌دار گوشواره چپ');

    // Dust flap 2 (Top of Panel 3)
    addSeg('cut', x3, y2, x3 + 4, y2 - (W * 0.7), 'dustFlap', 'grp_dust_flap_chamfer', 'پخ زاویه‌دار گوشواره راست');
    addSeg('cut', x3 + 4, y2 - (W * 0.7), x4, y2 - (W * 0.7), 'width', 'grp_dust_flap_top', 'برش افقی گوشواره راست');
    addSeg('cut', x4, y2 - (W * 0.7), x4, y2, 'dustFlap', 'grp_dust_flap_edge', 'برش عمودی گوشواره راست');

    // Top Right Lip on Panel 4
    addSeg('cut', x4, y2, x5, y2, 'length', 'grp_lip_flat', 'لبه مستقیم بالای پشت');

    // --- 6. Bottom Flap Contours (Panel 4: x4 to x5) ---
    // Lip edge of bottom tuck flap at y5
    addSeg('cut', x4 + 4, y5, x5 - 4, y5, 'length', 'grp_tuck_lip', 'تیغ لبه درپوش پایین');
    addSeg('cut', x4, y4, x4 + 4, y5, 'topTuck', 'grp_tuck_side', 'گوشه مایل درپوش پایین');
    addSeg('cut', x5 - 4, y5, x5, y4, 'topTuck', 'grp_tuck_side', 'گوشه مایل درپوش پایین');
    addSeg('cut', x4, y3, x4, y4, 'width', 'grp_flap_slits', 'چاک و شیار درپوش پایین');
    addSeg('cut', x5, y3, x5, y4, 'width', 'grp_flap_slits', 'چاک و شیار درپوش پایین');

    // Dust flap 3 (Bottom of Panel 1)
    addSeg('cut', x1, y3, x1, y3 + (W * 0.7), 'dustFlap', 'grp_dust_flap_edge', 'برش عمودی گوشواره پایین چپ');
    addSeg('cut', x1, y3 + (W * 0.7), x2 - 4, y3 + (W * 0.7), 'width', 'grp_dust_flap_top', 'برش افقی گوشواره پایین چپ');
    addSeg('cut', x2 - 4, y3 + (W * 0.7), x2, y3, 'dustFlap', 'grp_dust_flap_chamfer', 'پخ گوشواره پایین چپ');

    // Dust flap 4 (Bottom of Panel 3)
    addSeg('cut', x3, y3, x3 + 4, y3 + (W * 0.7), 'dustFlap', 'grp_dust_flap_chamfer', 'پخ گوشواره پایین راست');
    addSeg('cut', x3 + 4, y3 + (W * 0.7), x4, y3 + (W * 0.7), 'width', 'grp_dust_flap_top', 'برش افقی گوشواره پایین راست');
    addSeg('cut', x4, y3 + (W * 0.7), x4, y3, 'dustFlap', 'grp_dust_flap_edge', 'برش عمودی گوشواره پایین راست');

    // Bottom Left Lip on Panel 2
    addSeg('cut', x2, y3, x3, y3, 'length', 'grp_lip_flat', 'لبه مستقیم پایین جلو');

    // --- 7. Rightmost Outer Perimeter Cut (Back Panel free edge) ---
    addSeg('cut', x5, y2, x5, y3, 'height', 'grp_outer_right_edge', 'لبه آزاد برش انتهایی راست');

    // Merge any previously marked deleted segments by matching coordinates
    if (this.deletedSegmentsHistory && this.deletedSegmentsHistory.length > 0) {
      segs.forEach(s => {
        const wasDeleted = this.deletedSegmentsHistory.some(d => d.groupKey === s.groupKey && Math.abs(d.lengthMm - s.lengthMm) < 2);
        if (wasDeleted) s.isDeleted = true;
      });
    }

    this.segments = segs;
    this.clusterSimilarityGroups();
    this.recalculateTotals();
  },

  /* ============================================================
     2. SIMILARITY & SYMMETRY CLUSTERING ("know what stuff are the same")
     Groups segments with identical dimensions, orientation and function
     ============================================================ */
  clusterSimilarityGroups() {
    const map = {};
    const persianGroupTitles = {
      'grp_crease_vertical_body': 'خطوط تای عمودی ۴گانه بدنه (ارتفاع H)',
      'grp_crease_horiz_width': 'خطوط تای افقی پهلوها (عرض W)',
      'grp_crease_horiz_length': 'خطوط تای افقی درپوش و کف (طول L)',
      'grp_crease_flap_tuck': 'خطوط تای زبانه‌های درپوش (درب T)',
      'grp_glue_flap': 'لبه چسباننده قوطی (لبچسب G)',
      'grp_glue_flap_taper': 'پخ‌های زاویه‌دار لبه چسب',
      'grp_tuck_lip': 'لبه‌های برش زبانه‌های درپوش',
      'grp_tuck_side': 'گوشه‌های قفل‌شونده درپوش',
      'grp_flap_slits': 'شیارها و چاک‌های جانبی درپوش',
      'grp_dust_flap_edge': 'برش‌های عمودی گوشواره‌های گردگیر',
      'grp_dust_flap_top': 'لبه‌های افقی گوشواره‌ها',
      'grp_dust_flap_chamfer': 'پخ‌های ۴۵ درجه گوشواره‌ها',
      'grp_lip_flat': 'لبه‌های برش مستقیم بدنه',
      'grp_outer_right_edge': 'برش حاشیه راست شیت'
    };

    this.segments.forEach(seg => {
      const key = seg.groupKey || `${seg.type}_${seg.orientation}_${Math.round(seg.lengthMm)}`;
      if (!map[key]) {
        map[key] = {
          key: key,
          name: persianGroupTitles[key] || `دسته قطعات ${seg.orientation} (${seg.lengthMm} mm)`,
          type: seg.type,
          mapping: seg.mapping,
          orientation: seg.orientation,
          lengthMm: seg.lengthMm,
          segmentIds: [],
          totalLengthMm: 0,
          isDeleted: false
        };
      }
      map[key].segmentIds.push(seg.id);
      if (!seg.isDeleted) {
        map[key].totalLengthMm += seg.lengthMm;
      }
    });

    this.similarityGroups = Object.values(map);
  },

  recalculateTotals() {
    let bladeMm = 0;
    let creaseMm = 0;
    let deletedCount = 0;

    this.segments.forEach(s => {
      if (s.isDeleted) {
        deletedCount++;
        return;
      }
      if (s.type === 'crease') {
        creaseMm += s.lengthMm;
      } else if (s.type === 'cut' || s.type === 'glue' || s.type === 'perforation') {
        bladeMm += s.lengthMm;
      }
    });

    this.calculated.totalBladeLengthMm = Math.round(bladeMm);
    this.calculated.totalCreaseLengthMm = Math.round(creaseMm);
    this.calculated.areaCm2 = Number(((this.calculated.flatWidth * this.calculated.flatHeight) / 100).toFixed(1));

    // Update Top Metric HUD
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: s => String(s) };
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setVal('diecut-3d-box-dims', `${pUtils.fmtNum(this.params.length)} × ${pUtils.fmtNum(this.params.width)} × ${pUtils.fmtNum(this.params.height)} mm`);
    setVal('diecut-flat-dims', `${pUtils.fmtNum(this.calculated.flatWidth)} × ${pUtils.fmtNum(this.calculated.flatHeight)} mm`);
    setVal('diecut-blade-len', `${pUtils.fmtNum(this.calculated.totalBladeLengthMm)} mm تیغ / ${pUtils.fmtNum(this.calculated.totalCreaseLengthMm)} mm تا`);
    setVal('diecut-card-area', `${pUtils.fmtNum(this.calculated.areaCm2, 1)} cm²`);

    const delBadge = document.getElementById('deleted-count-badge');
    const delBtn = document.getElementById('btn-restore-deleted');
    if (delBadge) delBadge.textContent = pUtils.fmtNum(deletedCount);
    if (delBtn) delBtn.style.display = deletedCount > 0 ? 'inline-flex' : 'none';

    const tabSegsCount = document.getElementById('tab-segments-count');
    if (tabSegsCount) tabSegsCount.textContent = pUtils.fmtNum(this.segments.length);
  },

  /* ============================================================
     3. USER INTERACTION: HOVER & SELECTION SYNCHRONIZATION
     "make these hovered or selected when i hover or click"
     ============================================================ */
  selectParam(paramKey) {
    this.selectedParam = paramKey;
    this.selectedSegmentId = null;
    this.hideQuickPill();
    this.render();
  },

  hoverParam(paramKey) {
    this.hoveredParam = paramKey;
    this.renderCanvas();
    this.updateCardAuras();
  },

  updateCardAuras() {
    ['length', 'width', 'height', 'glueFlap', 'topTuck'].forEach(k => {
      const el = document.getElementById(`param-card-${k}`);
      if (!el) return;
      el.classList.toggle('active', this.selectedParam === k);
      el.classList.toggle('hovered', this.hoveredParam === k);
    });
  },

  /* ============================================================
     4. STEPPING DIMENSIONS (Keyboard & +/- Buttons)
     "by arrow keys i can change or shift arrow keys their value"
     "do not stretch the whole thing"
     ============================================================ */
  stepParam(paramKey, delta) {
    const cur = Number(this.params[paramKey]) || 0;
    const minVal = (paramKey === 'glueFlap' || paramKey === 'topTuck') ? 6 : 15;
    const nextVal = Math.max(minVal, cur + delta);
    this.updateParam(paramKey, nextVal);
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  updateParam(paramKey, value) {
    const num = Math.max(1, parseFloat(value) || 0);
    this.params[paramKey] = num;
    this.synthesizeModelFromParams();
    this.render();
    if (window.App && window.App.recalculate) {
      window.App.recalculate();
    }
  },

  setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      const viewDiecut = document.getElementById('view-diecut');
      if (!viewDiecut || viewDiecut.style.display === 'none') return;

      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = (tag === 'input' || tag === 'textarea' || tag === 'select');

      if (e.key === 'Escape') {
        this.selectedSegmentId = null;
        this.hideQuickPill();
        this.renderCanvas();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isInput && this.selectedSegmentId) {
          e.preventDefault();
          this.deleteSelectedSegment(false);
          return;
        }
      }

      // Arrow keys manipulation
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (!isInput) {
          e.preventDefault();
          const stepSize = e.shiftKey ? 5 : 1;
          const direction = (e.key === 'ArrowUp' || e.key === 'ArrowRight') ? 1 : -1;
          const delta = direction * stepSize;

          if (this.selectedParam) {
            this.stepParam(this.selectedParam, delta);
          } else if (this.selectedSegmentId) {
            const seg = this.segments.find(s => s.id === this.selectedSegmentId);
            if (seg && seg.mapping) {
              this.stepParam(seg.mapping, delta);
            }
          }
        }
      }
    });
  },

  /* ============================================================
     5. ATOMIC SEGMENT OPERATIONS ("remove edit any segment")
     ============================================================ */
  selectSegment(segId) {
    this.selectedSegmentId = segId;
    const seg = this.segments.find(s => s.id === segId);
    if (seg) {
      this.selectedParam = seg.mapping || null;
      this.showQuickPill(seg);
    } else {
      this.hideQuickPill();
    }
    this.render();
  },

  deleteSelectedSegment(deleteSimilar = false) {
    if (!this.selectedSegmentId) return;
    const target = this.segments.find(s => s.id === this.selectedSegmentId);
    if (!target) return;

    if (deleteSimilar && target.groupKey) {
      this.segments.forEach(s => {
        if (s.groupKey === target.groupKey) {
          s.isDeleted = true;
          this.deletedSegmentsHistory.push({ id: s.id, groupKey: s.groupKey, lengthMm: s.lengthMm });
        }
      });
      if (window.toast) window.toast(`تمام خطوط دسته «${target.groupKey}» حذف شدند ✓`);
    } else {
      target.isDeleted = true;
      this.deletedSegmentsHistory.push({ id: target.id, groupKey: target.groupKey, lengthMm: target.lengthMm });
      if (window.toast) window.toast(`قطعه ${target.label || target.id} حذف شد ✓`);
    }

    this.selectedSegmentId = null;
    this.hideQuickPill();
    this.clusterSimilarityGroups();
    this.recalculateTotals();
    this.render();
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  restoreSegment(segId) {
    const s = this.segments.find(seg => seg.id === segId);
    if (s) {
      s.isDeleted = false;
      this.deletedSegmentsHistory = this.deletedSegmentsHistory.filter(d => d.id !== segId);
      this.clusterSimilarityGroups();
      this.recalculateTotals();
      this.render();
      if (window.toast) window.toast(`قطعه بازگردانی شد ✓`);
    }
  },

  restoreAllDeleted() {
    this.segments.forEach(s => { s.isDeleted = false; });
    this.deletedSegmentsHistory = [];
    this.clusterSimilarityGroups();
    this.recalculateTotals();
    this.render();
    if (window.toast) window.toast('تمام خطوط حذف‌شده بازیابی شدند ✓');
    if (window.SoundEngine) window.SoundEngine.playClick();
  },

  setSelectedSegmentType(newType) {
    if (!this.selectedSegmentId) return;
    const seg = this.segments.find(s => s.id === this.selectedSegmentId);
    if (!seg) return;
    seg.type = newType;
    this.clusterSimilarityGroups();
    this.recalculateTotals();
    this.render();
    if (window.toast) window.toast(`نوع خط به «${newType}» تغییر یافت ✓`);
  },

  setSelectedSegmentMapping(newMapping) {
    if (!this.selectedSegmentId) return;
    const seg = this.segments.find(s => s.id === this.selectedSegmentId);
    if (!seg) return;
    seg.mapping = newMapping || null;
    this.selectedParam = newMapping || null;
    this.clusterSimilarityGroups();
    this.render();
    if (window.toast) window.toast(`نگاشت ابعادی به «${newMapping || 'مستقل'}» تغییر یافت ✓`);
  },

  changeGroupType(groupKey, newType) {
    this.segments.forEach(s => {
      if (s.groupKey === groupKey) s.type = newType;
    });
    this.clusterSimilarityGroups();
    this.recalculateTotals();
    this.render();
    if (window.toast) window.toast('نوع کل دسته تغییر یافت ✓');
  },

  changeGroupMapping(groupKey, newMapping) {
    this.segments.forEach(s => {
      if (s.groupKey === groupKey) s.mapping = newMapping || null;
    });
    this.clusterSimilarityGroups();
    this.render();
    if (window.toast) window.toast('نگاشت ابعادی دسته به‌روزرسانی شد ✓');
  },

  deleteGroup(groupKey) {
    this.segments.forEach(s => {
      if (s.groupKey === groupKey) {
        s.isDeleted = true;
        this.deletedSegmentsHistory.push({ id: s.id, groupKey: s.groupKey, lengthMm: s.lengthMm });
      }
    });
    this.clusterSimilarityGroups();
    this.recalculateTotals();
    this.render();
    if (window.toast) window.toast('دسته به طور کامل حذف شد ✓');
  },

  /* ============================================================
     6. FLOATING QUICK ACTION PILL ON CANVAS
     ============================================================ */
  showQuickPill(seg) {
    const pill = document.getElementById('segment-quick-pill');
    if (!pill) return;
    pill.style.display = 'flex';
    const titleEl = document.getElementById('pill-segment-title');
    const lenEl = document.getElementById('pill-segment-len');
    const mapSelect = document.getElementById('pill-mapping-select');
    if (titleEl) titleEl.textContent = seg.label || `قطعه ${seg.id}`;
    if (lenEl) lenEl.textContent = `طول: ${seg.lengthMm} mm`;
    if (mapSelect) mapSelect.value = seg.mapping || '';

    pill.querySelectorAll('.btn-pill-action').forEach(b => {
      b.classList.toggle('active', b.classList.contains(seg.type));
    });
  },

  hideQuickPill() {
    const pill = document.getElementById('segment-quick-pill');
    if (pill) pill.style.display = 'none';
  },

  /* ============================================================
     7. ULTRA-CLEAR BLUEPRINT CAD CANVAS RENDERING
     "write what is what" & dimension lines & symmetry glow
     ============================================================ */
  setupCanvasEvents() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const ptMm = this.canvasPxToMm(clientX, clientY);
      const coordsDisplay = document.getElementById('canvas-coords-display');
      if (coordsDisplay) {
        coordsDisplay.textContent = `X: ${ptMm.x.toFixed(1)} mm | Y: ${ptMm.y.toFixed(1)} mm`;
      }

      let closestSeg = null;
      let minDistance = 7; // mm

      this.segments.forEach(s => {
        if (s.isDeleted) return;
        const d = this.distToSegment(ptMm.x, ptMm.y, s.x1, s.y1, s.x2, s.y2);
        if (d < minDistance) {
          minDistance = d;
          closestSeg = s;
        }
      });

      const hoverTag = document.getElementById('canvas-hover-tag');
      const hoverText = document.getElementById('canvas-hover-text');

      if (closestSeg) {
        this.hoveredSegmentId = closestSeg.id;
        if (hoverTag && hoverText) {
          hoverTag.style.display = 'block';
          hoverText.textContent = `${closestSeg.label || closestSeg.id} (${(window.PersianUtils || { fmtNum: (v, d) => String(v) }).fmtNum(closestSeg.lengthMm, 1)} mm)`;
        }
      } else {
        this.hoveredSegmentId = null;
        if (hoverTag) hoverTag.style.display = 'none';
      }

      this.renderCanvas();
    });

    canvas.addEventListener('mouseleave', () => {
      this.hoveredSegmentId = null;
      const hoverTag = document.getElementById('canvas-hover-tag');
      if (hoverTag) hoverTag.style.display = 'none';
      this.renderCanvas();
    });

    canvas.addEventListener('click', (e) => {
      if (this.hoveredSegmentId) {
        this.selectSegment(this.hoveredSegmentId);
      } else {
        this.selectedSegmentId = null;
        this.hideQuickPill();
        this.render();
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      this.zoomLevel = Math.max(0.3, Math.min(4.5, this.zoomLevel * zoomFactor));
      this.renderCanvas();
    }, { passive: false });
  },

  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  },

  canvasPxToMm(px, py) {
    const canvas = document.getElementById('diecut-preview-canvas');
    const w = canvas.width;
    const h = canvas.height;
    const flatW = this.calculated.flatWidth;
    const flatH = this.calculated.flatHeight;
    const paddingMm = 45;
    const baseScale = Math.min((w - 80) / (flatW + paddingMm * 2), (h - 80) / (flatH + paddingMm * 2));
    const effectiveScale = baseScale * this.zoomLevel;

    const centerX = w / 2 + this.panOffset.x;
    const centerY = h / 2 + this.panOffset.y;

    const mmX = (px - centerX) / effectiveScale + flatW / 2;
    const mmY = (py - centerY) / effectiveScale + flatH / 2;
    return { x: mmX, y: mmY };
  },

  resetView() {
    this.zoomLevel = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.renderCanvas();
  },

  renderCanvas() {
    const canvas = document.getElementById('diecut-preview-canvas');
    if (!canvas || !canvas.getContext) return;
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: s => String(s) };
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0B1120';
    ctx.fillRect(0, 0, w, h);

    const flatW = this.calculated.flatWidth;
    const flatH = this.calculated.flatHeight;
    const paddingMm = 45;
    const baseScale = Math.min((w - 80) / (flatW + paddingMm * 2), (h - 80) / (flatH + paddingMm * 2));
    const scale = baseScale * this.zoomLevel;
    this.scalePxPerMm = scale;

    ctx.save();
    ctx.translate(w / 2 + this.panOffset.x, h / 2 + this.panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-flatW / 2, -flatH / 2);

    // Draw Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 0.5 / scale;
    const stepMm = 20;
    for (let x = -40; x <= flatW + 40; x += stepMm) {
      ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, flatH + 40); ctx.stroke();
    }
    for (let y = -40; y <= flatH + 40; y += stepMm) {
      ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(flatW + 40, y); ctx.stroke();
    }

    let activeHighlightKey = null;
    let activeHighlightMapping = this.selectedParam || this.hoveredParam || null;

    if (this.hoveredSegmentId) {
      const hSeg = this.segments.find(s => s.id === this.hoveredSegmentId);
      if (hSeg) {
        activeHighlightKey = hSeg.groupKey;
        if (hSeg.mapping) activeHighlightMapping = hSeg.mapping;
      }
    } else if (this.selectedSegmentId) {
      const sSeg = this.segments.find(s => s.id === this.selectedSegmentId);
      if (sSeg) {
        activeHighlightKey = sSeg.groupKey;
        if (sSeg.mapping) activeHighlightMapping = sSeg.mapping;
      }
    }

    // 1. DRAW PANEL ANNOTATION BOXES ("write what is what")
    const p = this.params;
    const x1 = p.glueFlap;
    const x2 = p.glueFlap + p.width;
    const x3 = p.glueFlap + p.width + p.length;
    const x4 = p.glueFlap + p.width + p.length + p.width;
    const x5 = p.glueFlap + p.width + p.length + p.width + p.length;
    const y2 = p.topTuck + p.width;
    const y3 = p.topTuck + p.width + p.height;

    const drawPanelLabel = (px, py, pw, ph, label, isHighlighted) => {
      ctx.save();
      ctx.fillStyle = isHighlighted ? 'rgba(245, 158, 11, 0.14)' : 'rgba(255, 255, 255, 0.02)';
      ctx.fillRect(px + 2, py + 2, pw - 4, ph - 4);

      ctx.font = `bold ${Math.max(10, Math.min(14, pw * 0.15))}px Peyda, sans-serif`;
      ctx.fillStyle = isHighlighted ? '#F59E0B' : 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px + pw / 2, py + ph / 2);
      ctx.restore();
    };

    drawPanelLabel(0, y2, x1, p.height, 'لبچسب G', activeHighlightMapping === 'glueFlap');
    drawPanelLabel(x1, y2, p.width, p.height, 'پهلو چپ (W)', activeHighlightMapping === 'width');
    drawPanelLabel(x2, y2, p.length, p.height, 'بدنه جلو (L)', activeHighlightMapping === 'length');
    drawPanelLabel(x3, y2, p.width, p.height, 'پهلو راست (W)', activeHighlightMapping === 'width');
    drawPanelLabel(x4, y2, p.length, p.height, 'بدنه پشت (L)', activeHighlightMapping === 'length');
    drawPanelLabel(x2, 0, p.length, p.topTuck, 'درب بالا (T)', activeHighlightMapping === 'topTuck');
    drawPanelLabel(x4, y3 + p.width, p.length, p.topTuck, 'درب پایین (T)', activeHighlightMapping === 'topTuck');

    // 2. DRAW SIMILARITY HALO FOR MATCHING LINES ("know what stuff are the same")
    this.segments.forEach(s => {
      if (s.isDeleted) return;
      const matchesGroup = activeHighlightKey && (s.groupKey === activeHighlightKey);
      const matchesParam = activeHighlightMapping && (s.mapping === activeHighlightMapping);

      if (matchesGroup || matchesParam) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 7 / scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 3. DRAW ATOMIC SEGMENTS
    this.segments.forEach(s => {
      if (s.isDeleted) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([3 / scale, 3 / scale]);
        ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        ctx.restore();
        return;
      }

      ctx.save();
      if (s.type === 'cut') {
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1.8 / scale;
        ctx.setLineDash([]);
      } else if (s.type === 'crease') {
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 1.4 / scale;
        ctx.setLineDash([5 / scale, 3 / scale]);
      } else if (s.type === 'glue') {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.8 / scale;
        ctx.setLineDash([]);
      } else if (s.type === 'perforation') {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5 / scale;
        ctx.setLineDash([3 / scale, 3 / scale]);
      } else {
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.0 / scale;
        ctx.setLineDash([2 / scale, 2 / scale]);
      }

      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.restore();
    });

    // 4. DRAW SELECTED SEGMENT HIGHLIGHT & ANCHOR HANDLES
    if (this.selectedSegmentId) {
      const selSeg = this.segments.find(s => s.id === this.selectedSegmentId);
      if (selSeg && !selSeg.isDeleted) {
        ctx.save();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 3.5 / scale;
        ctx.beginPath();
        ctx.moveTo(selSeg.x1, selSeg.y1);
        ctx.lineTo(selSeg.x2, selSeg.y2);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2 / scale;
        const handleR = 4.5 / scale;
        ctx.beginPath(); ctx.arc(selSeg.x1, selSeg.y1, handleR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(selSeg.x2, selSeg.y2, handleR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }

    // 5. DRAW DIMENSION OVERLAYS WITH ARROWS (L, W, H, Total Flat)
    this.drawDimensionLine(ctx, x2, y3 + 12, x3, y3 + 12, `L: ${pUtils.fmtNum(p.length)} mm`, '#F59E0B', scale);
    this.drawDimensionLine(ctx, x1, y3 + 24, x2, y3 + 24, `W: ${pUtils.fmtNum(p.width)} mm`, '#3B82F6', scale);
    this.drawDimensionLine(ctx, x5 + 12, y2, x5 + 12, y3, `H: ${pUtils.fmtNum(p.height)} mm`, '#10B981', scale);

    ctx.restore();
  },

  drawDimensionLine(ctx, x1, y1, x2, y2, text, color, scale) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.0 / scale;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const isHoriz = Math.abs(y2 - y1) < 0.1;
    const arrowSize = 3.5 / scale;
    if (isHoriz) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + arrowSize, y1 - arrowSize * 0.7); ctx.lineTo(x1 + arrowSize, y1 + arrowSize * 0.7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - arrowSize, y2 - arrowSize * 0.7); ctx.lineTo(x2 - arrowSize, y2 + arrowSize * 0.7); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - arrowSize * 0.7, y1 + arrowSize); ctx.lineTo(x1 + arrowSize * 0.7, y1 + arrowSize); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - arrowSize, y2 - arrowSize * 0.7); ctx.lineTo(x2 + arrowSize * 0.7, y2 - arrowSize); ctx.fill();
    }

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    ctx.font = `bold ${10 / scale}px Peyda, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = isHoriz ? 'bottom' : 'middle';
    ctx.fillText(text, midX, midY - (isHoriz ? 2 / scale : 0));
    ctx.restore();
  },

  /* ============================================================
     8. TAB RENDERERS (Similarity Groups, Segments Tree, Formulas)
     ============================================================ */
  switchTab(tabId) {
    this.activeTab = tabId;
    document.querySelectorAll('.diecut-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.dtab === tabId);
    });
    document.querySelectorAll('.diecut-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === `dtab-content-${tabId}`);
    });
    this.render();
  },

  renderSimilarityTab() {
    const container = document.getElementById('diecut-similarity-container');
    if (!container) return;
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: s => String(s) };

    let html = '';
    this.similarityGroups.forEach(grp => {
      const isSelected = this.selectedParam === grp.mapping;
      html += `
        <div class="similarity-card ${isSelected ? 'active' : ''}">
          <div class="similarity-card-hdr">
            <div class="similarity-title">
              <span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:${grp.type === 'crease' ? '#2563EB' : '#DC2626'};"></span>
              <strong>${grp.name}</strong>
            </div>
            <span class="similarity-badge-count">${pUtils.fmtNum(grp.segmentIds.length)} خط</span>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted);">
            <span>طول هر خط: <strong style="color:var(--graphite-text);">${pUtils.fmtNum(grp.lengthMm, 1)} mm</strong></span>
            <span>مجموع متراژ: <strong>${pUtils.e2p((grp.totalLengthMm / 1000).toFixed(2))} متر</strong></span>
          </div>

          <div class="similarity-actions-row">
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-size:0.72rem; color:var(--text-muted);">نگاشت:</span>
              <select class="input-box" style="height:26px; font-size:0.72rem; padding:0 4px;" onchange="ParametricDieEngine.changeGroupMapping('${grp.key}', this.value)">
                <option value="" ${!grp.mapping ? 'selected' : ''}>آزاد / مستقل</option>
                <option value="length" ${grp.mapping === 'length' ? 'selected' : ''}>طول (L)</option>
                <option value="width" ${grp.mapping === 'width' ? 'selected' : ''}>عرض (W)</option>
                <option value="height" ${grp.mapping === 'height' ? 'selected' : ''}>ارتفاع (H)</option>
                <option value="glueFlap" ${grp.mapping === 'glueFlap' ? 'selected' : ''}>لبچسب (G)</option>
                <option value="topTuck" ${grp.mapping === 'topTuck' ? 'selected' : ''}>درب (T)</option>
                <option value="dustFlap" ${grp.mapping === 'dustFlap' ? 'selected' : ''}>گوشواره (D)</option>
              </select>
            </div>

            <div style="display:flex; align-items:center; gap:4px;">
              <select class="input-box" style="height:26px; font-size:0.72rem; padding:0 4px;" onchange="ParametricDieEngine.changeGroupType('${grp.key}', this.value)">
                <option value="cut" ${grp.type === 'cut' ? 'selected' : ''}>🔴 تیغ</option>
                <option value="crease" ${grp.type === 'crease' ? 'selected' : ''}>🔵 تا</option>
                <option value="glue" ${grp.type === 'glue' ? 'selected' : ''}>🟢 چسب</option>
                <option value="perforation" ${grp.type === 'perforation' ? 'selected' : ''}>🟠 پرفراژ</option>
              </select>
              <button class="btn btn-outline btn-sm" style="padding:2px 6px; font-size:0.7rem; color:#EF4444;" onclick="ParametricDieEngine.deleteGroup('${grp.key}')" title="حذف تمام خطوط این دسته">
                <i class="ph ph-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  renderSegmentsTab() {
    const tbody = document.getElementById('diecut-segments-tbody');
    if (!tbody) return;

    const search = (document.getElementById('segment-search-input')?.value || '').toLowerCase();
    const filterType = document.getElementById('segment-filter-type')?.value || 'all';

    let html = '';
    this.segments.forEach(seg => {
      if (filterType === 'deleted' && !seg.isDeleted) return;
      if (filterType !== 'all' && filterType !== 'deleted' && seg.type !== filterType) return;
      if (search && !seg.label.toLowerCase().includes(search) && !seg.id.toLowerCase().includes(search)) return;

      const isSelected = this.selectedSegmentId === seg.id;
      const isHighlighted = this.hoveredSegmentId === seg.id;

      html += `
        <tr class="segment-row ${seg.isDeleted ? 'deleted' : ''} ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}"
            style="cursor:pointer;"
            onmouseenter="ParametricDieEngine.hoverSegment('${seg.id}')"
            onmouseleave="ParametricDieEngine.hoverSegment(null)"
            onclick="ParametricDieEngine.selectSegment('${seg.id}')">
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:${seg.type === 'crease' ? '#2563EB' : (seg.type === 'glue' ? '#059669' : '#DC2626')};"></span>
              <strong>${seg.label || seg.id}</strong>
            </div>
          </td>
          <td>
            <span class="badge" style="font-size:0.72rem;">
              ${seg.type === 'cut' ? '🔴 تیغ برش' : (seg.type === 'crease' ? '🔵 خط تا' : (seg.type === 'glue' ? '🟢 لبه چسب' : '🟠 پرفراژ'))}
            </span>
          </td>
          <td class="tabular-nums" style="direction:ltr; font-family:monospace; font-weight:800; color:var(--brand-primary);">
            ${seg.lengthMm} mm
          </td>
          <td>
            <span style="font-size:0.75rem; color:var(--text-muted);">${seg.mapping || 'مستقل'}</span>
          </td>
          <td style="font-size:0.75rem; color:var(--text-muted);">
            ${seg.groupKey}
          </td>
          <td style="text-align:center;" onclick="event.stopPropagation()">
            ${seg.isDeleted ? `
              <button class="btn btn-outline btn-sm" style="padding:2px 8px; font-size:0.72rem; color:#10B981;" onclick="ParametricDieEngine.restoreSegment('${seg.id}')">
                <i class="ph ph-arrow-counter-clockwise"></i> بازیابی
              </button>
            ` : `
              <button class="btn btn-outline btn-sm" style="padding:2px 6px; font-size:0.72rem; color:#EF4444;" onclick="ParametricDieEngine.selectedSegmentId='${seg.id}'; ParametricDieEngine.deleteSelectedSegment(false);" title="حذف این قطعه">
                <i class="ph ph-trash"></i>
              </button>
            `}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  filterSegmentsTable() {
    this.renderSegmentsTab();
  },

  hoverSegment(segId) {
    this.hoveredSegmentId = segId;
    this.renderCanvas();
  },

  renderFormulasTab() {
    const container = document.getElementById('diecut-formulas-container');
    if (!container) return;
    const pUtils = window.PersianUtils || { fmtNum: (v, d) => String(v), e2p: s => String(s) };

    const p = this.params;
    const flatW = this.calculated.flatWidth;
    const flatH = this.calculated.flatHeight;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr; gap:8px;">
        <div style="background:var(--surface-base); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:8px 12px;">
          <div style="font-size:0.75rem; color:var(--graphite-text); font-weight:700;">۱. عرض شیت گسترده (Flat Width):</div>
          <div style="direction:ltr; font-family:monospace; color:var(--brand-primary); margin:2px 0; font-size:0.8rem;">
            W_flat = G + 2W + 2L
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted);">
            = ${pUtils.fmtNum(p.glueFlap)} + (۲ × ${pUtils.fmtNum(p.width)}) + (۲ × ${pUtils.fmtNum(p.length)}) = <strong style="color:var(--graphite-text);">${pUtils.fmtNum(flatW)} mm</strong>
          </div>
        </div>

        <div style="background:var(--surface-base); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:8px 12px;">
          <div style="font-size:0.75rem; color:var(--graphite-text); font-weight:700;">۲. طول شیت گسترده (Flat Height):</div>
          <div style="direction:ltr; font-family:monospace; color:var(--brand-primary); margin:2px 0; font-size:0.8rem;">
            H_flat = 2T + 2W + H
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted);">
            = (۲ × ${pUtils.fmtNum(p.topTuck)}) + (۲ × ${pUtils.fmtNum(p.width)}) + ${pUtils.fmtNum(p.height)} = <strong style="color:var(--graphite-text);">${pUtils.fmtNum(flatH)} mm</strong>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; background:var(--surface-base); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:8px 12px; font-size:0.72rem;">
          <span>تیغ لیزری: <strong style="color:#DC2626;">${pUtils.fmtNum((this.calculated.totalBladeLengthMm / 1000).toFixed(2))} متر</strong></span>
          <span>خط تا: <strong style="color:#2563EB;">${pUtils.fmtNum((this.calculated.totalCreaseLengthMm / 1000).toFixed(2))} متر</strong></span>
        </div>
      </div>
    `;
  },

  renderHeroInputs() {
    const p = this.params;
    const setInp = (id, val) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = val;
    };
    setInp('param-inp-L', p.length);
    setInp('param-inp-W', p.width);
    setInp('param-inp-H', p.height);
    setInp('param-inp-G', p.glueFlap);
    setInp('param-inp-T', p.topTuck);
    this.updateCardAuras();
  },

  render() {
    this.renderHeroInputs();
    this.renderCanvas();
    this.renderSimilarityTab();
    this.renderFormulasTab();
  },

  /* ============================================================
     9. TEMPLATES & EXPORTS & STUDIO SYNCHRONIZATION
     ============================================================ */
  loadTemplate(modelType) {
    this.isCustomImport = false;
    if (modelType === 'tuck_end') {
      this.params = { length: 120, width: 80, height: 150, glueFlap: 15, topTuck: 25, bottomTuck: 25, dustFlap: 15, lockNotch: 4, creaseGap: 2 };
    } else if (modelType === 'mailer_0427') {
      this.params = { length: 200, width: 150, height: 60, glueFlap: 0, topTuck: 22, bottomTuck: 22, dustFlap: 25, lockNotch: 6, creaseGap: 2 };
    } else if (modelType === 'lock_bottom') {
      this.params = { length: 140, width: 90, height: 180, glueFlap: 16, topTuck: 25, bottomTuck: 25, dustFlap: 16, lockNotch: 4, creaseGap: 2 };
    }
    this.deletedSegmentsHistory = [];
    this.synthesizeModelFromParams();
    this.render();
    if (window.toast) window.toast(`قالب با موفقیت بازنشانی شد ✓`);
  },

  exportCleanSvg() {
    const flatW = this.calculated.flatWidth;
    const flatH = this.calculated.flatHeight;
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${flatW} ${flatH}" width="${flatW}mm" height="${flatH}mm">\n`;

    svg += `  <g id="crease-matrix" stroke="#2563EB" stroke-width="0.5" stroke-dasharray="2,2" fill="none">\n`;
    this.segments.filter(s => !s.isDeleted && s.type === 'crease').forEach(s => {
      svg += `    <path d="${s.d}" />\n`;
    });
    svg += `  </g>\n`;

    svg += `  <g id="cut-blades" stroke="#DC2626" stroke-width="0.7" fill="none">\n`;
    this.segments.filter(s => !s.isDeleted && s.type !== 'crease').forEach(s => {
      svg += `    <path d="${s.d}" />\n`;
    });
    svg += `  </g>\n`;
    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LemonPack_Die_${flatW}x${flatH}mm.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.toast) window.toast('فایل SVG تمیز با موفقیت دانلود شد ✓');
  },

  syncWithGlobalLemonPack() {
    if (!window.LemonPack) return;
    const cad = window.LemonPack.cad;
    const p = this.params;

    cad.length = p.length;
    cad.width = p.width;
    cad.height = p.height;
    cad.glueFlap = p.glueFlap;
    cad.tuckFlap = p.topTuck;
    cad.dustFlap = p.dustFlap;
    cad.flatL = this.calculated.flatWidth;
    cad.flatW = this.calculated.flatHeight;

    // Export non-deleted segments to customDie
    cad.customDie = {
      active: true,
      widthMm: cad.flatL,
      heightMm: cad.flatW,
      paths: this.segments.filter(s => !s.isDeleted).map(s => ({
        id: s.id,
        d: s.d,
        originalStroke: s.type === 'crease' ? '#2563EB' : (s.type === 'glue' ? '#059669' : '#DC2626'),
        strokeDash: s.type === 'crease' ? '4,3' : '',
        type: s.type,
        visible: true
      })),
      bounds: {
        minX: 0, minY: 0, maxX: cad.flatL, maxY: cad.flatW, width: cad.flatL, height: cad.flatW
      }
    };

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = val;
    };
    setVal('inp-length', p.length);
    setVal('inp-width', p.width);
    setVal('inp-height', p.height);
    setVal('inp-glue-flap', p.glueFlap);
    setVal('inp-tuck-flap', p.topTuck);
    setVal('inp-flat-l', cad.flatL);
    setVal('inp-flat-w', cad.flatW);

    if (window.App && window.App.recalculate) {
      window.App.recalculate();
    }
    if (window.toast) window.toast('قالب به استودیو و شیت‌بندی اعمال شد ✓');
  },

  /* ============================================================
     10. IMPORT EXTERNAL SVG/AI WITH MACDORA PACKAGING TOPOLOGY DETECTION
     Detects L, W, H, G, T automatically from crease lines and boundary
     ============================================================ */
  parseSvgString(svgText) {
    if (!svgText || !svgText.includes('<svg')) return;
    this.rawSvgString = svgText;
    this.isCustomImport = true;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return;

    // Extract viewBox / dimension bounds
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const vb = svgEl.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        bounds.minX = parts[0]; bounds.minY = parts[1];
        bounds.maxX = parts[0] + parts[2]; bounds.maxY = parts[1] + parts[3];
      }
    }

    const elements = doc.querySelectorAll('path, line, rect, polyline, polygon');
    const importedSegs = [];
    let segId = 1;

    elements.forEach(el => {
      const tag = el.tagName.toLowerCase();
      const stroke = (el.getAttribute('stroke') || el.style.stroke || '#DC2626').toLowerCase();
      const isCrease = stroke.includes('blue') || stroke.includes('cyan') || stroke.includes('0000ff') || stroke.includes('2563eb');
      const isGlue = stroke.includes('green') || stroke.includes('059669');

      if (tag === 'line') {
        const x1 = parseFloat(el.getAttribute('x1') || 0);
        const y1 = parseFloat(el.getAttribute('y1') || 0);
        const x2 = parseFloat(el.getAttribute('x2') || 0);
        const y2 = parseFloat(el.getAttribute('y2') || 0);
        const len = Math.hypot(x2 - x1, y2 - y1);
        importedSegs.push({
          id: `seg_${segId++}`,
          type: isCrease ? 'crease' : (isGlue ? 'glue' : 'cut'),
          x1, y1, x2, y2,
          d: `M ${x1} ${y1} L ${x2} ${y2}`,
          lengthMm: Number(len.toFixed(1)),
          mapping: null,
          groupKey: `imported_${isCrease ? 'crease' : 'cut'}_${Math.round(len)}`,
          label: `خط ${segId}`,
          orientation: Math.abs(y2 - y1) < 1 ? 'horizontal' : (Math.abs(x2 - x1) < 1 ? 'vertical' : 'diagonal'),
          isDeleted: false
        });
      } else if (tag === 'path') {
        const d = el.getAttribute('d') || '';
        const subCommands = d.match(/[MLHV][^MLHV]*/gi) || [];
        let curX = 0, curY = 0;
        subCommands.forEach(cmd => {
          const type = cmd[0];
          const nums = (cmd.match(/-?[\d.]+(?:e-?\d+)?/gi) || []).map(Number);
          if (type === 'M' || type === 'm') {
            curX = nums[0] || 0;
            curY = nums[1] || 0;
          } else if (type === 'L' || type === 'l') {
            const nextX = nums[0] || 0;
            const nextY = nums[1] || 0;
            const len = Math.hypot(nextX - curX, nextY - curY);
            if (len > 1) {
              importedSegs.push({
                id: `seg_${segId++}`,
                type: isCrease ? 'crease' : (isGlue ? 'glue' : 'cut'),
                x1: curX, y1: curY, x2: nextX, y2: nextY,
                d: `M ${curX} ${curY} L ${nextX} ${nextY}`,
                lengthMm: Number(len.toFixed(1)),
                mapping: null,
                groupKey: `imported_${isCrease ? 'crease' : 'cut'}_${Math.round(len)}`,
                label: `خط ${segId}`,
                orientation: Math.abs(nextY - curY) < 1 ? 'horizontal' : (Math.abs(nextX - curX) < 1 ? 'vertical' : 'diagonal'),
                isDeleted: false
              });
            }
            curX = nextX; curY = nextY;
          }
        });
      }
    });

    if (importedSegs.length > 0) {
      // Automatic Detection of L, W, H, G, T (MacDora Packaging Intelligence)
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      importedSegs.forEach(s => {
        minX = Math.min(minX, s.x1, s.x2);
        maxX = Math.max(maxX, s.x1, s.x2);
        minY = Math.min(minY, s.y1, s.y2);
        maxY = Math.max(maxY, s.y1, s.y2);
      });

      const vertCreases = importedSegs.filter(s => s.type === 'crease' && s.orientation === 'vertical' && s.lengthMm > 15);
      const horizCreases = importedSegs.filter(s => s.type === 'crease' && s.orientation === 'horizontal' && s.lengthMm > 15);

      const rawX = vertCreases.map(s => (s.x1 + s.x2) / 2);
      const clustersX = [];
      rawX.forEach(x => {
        const match = clustersX.find(c => Math.abs(c.x - x) < 6);
        if (match) { match.count++; } else { clustersX.push({ x: x, count: 1 }); }
      });
      clustersX.sort((a, b) => a.x - b.x);

      const rawY = horizCreases.map(s => (s.y1 + s.y2) / 2);
      const clustersY = [];
      rawY.forEach(y => {
        const match = clustersY.find(c => Math.abs(c.y - y) < 6);
        if (match) { match.count++; } else { clustersY.push({ y: y, count: 1 }); }
      });
      clustersY.sort((a, b) => a.y - b.y);

      // Height and Tuck Flap
      if (clustersY.length >= 2) {
        const yTop = clustersY[0].y;
        const yBot = clustersY[clustersY.length - 1].y;
        this.params.height = Math.max(20, Math.round(yBot - yTop));
        this.params.topTuck = Math.max(12, Math.round(yTop - minY));
      }

      // Width, Length, Glue Flap
      if (clustersX.length >= 4) {
        const g = Math.round(clustersX[0].x - minX);
        const w1 = Math.round(clustersX[1].x - clustersX[0].x);
        const l1 = Math.round(clustersX[2].x - clustersX[1].x);
        const w2 = Math.round(clustersX[3].x - clustersX[2].x);
        const l2 = Math.round(maxX - clustersX[3].x);

        this.params.glueFlap = Math.max(8, g);
        this.params.length = Math.max(20, Math.round((Math.max(w1, l1) + Math.max(w2, l2)) / 2));
        this.params.width = Math.max(15, Math.round((Math.min(w1, l1) + Math.min(w2, l2)) / 2));
      } else {
        const totalW = maxX - minX;
        const totalH = maxY - minY;
        this.params.glueFlap = 15;
        this.params.length = Math.round((totalW - 15) * 0.32);
        this.params.width = Math.round(((totalW - 15) - 2 * this.params.length) / 2);
        this.params.height = Math.round(totalH * 0.55);
        this.params.topTuck = 25;
      }

      // Re-synthesize clean parametric geometry based on detected L, W, H, G, T
      this.synthesizeModelFromParams();
      this.render();

      const pUtils = window.PersianUtils || { fmtNum: (v) => String(v) };
      const resPanel = document.getElementById('import-result-panel');
      const resDims = document.getElementById('import-result-dims');
      if (resPanel && resDims) {
        resPanel.style.display = 'block';
        resDims.innerHTML = `طول (L): <strong>${pUtils.fmtNum(this.params.length)} mm</strong> | عرض (W): <strong>${pUtils.fmtNum(this.params.width)} mm</strong> | ارتفاع (H): <strong>${pUtils.fmtNum(this.params.height)} mm</strong> | لبچسب (G): <strong>${pUtils.fmtNum(this.params.glueFlap)} mm</strong>`;
      }

      if (window.toast) window.toast(`ابعاد قالب استخراج شد: طول ${pUtils.fmtNum(this.params.length)}، عرض ${pUtils.fmtNum(this.params.width)}، ارتفاع ${pUtils.fmtNum(this.params.height)} mm ✓`);
    } else {
      this.synthesizeModelFromParams();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.ParametricDieEngine) {
    window.ParametricDieEngine.init();
  }
});
