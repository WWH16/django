let barChart, pieChart;

// =======================
// CSV helpers
// =======================
function csvEscape(value) {
  const v = value ?? '';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}
function arrayToCsv(rows) {
  return rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
}
function downloadCsv(filename, csvString) {
  const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// =======================
// Data Cache
// =======================
const cache = {
  summary: null,     // from /api/teacher-evaluation-dashboard/
  programs: null,    // { programs: [...] } current (filtered) program performance
  improvement: null, // from /api/teacher-improvement-priority/
  recent: null,      // from /api/recent-teacher-evaluations/
  teachers: null     // current (filtered) teacher performance array
};

// =======================
// Chart Colors (match KPI cards)
// =======================
const sharedColors = {
  positive: '#198754',           // success
  neutral:  '#ffc107',           // warning
  negative: '#dc3545',           // danger
  positiveBorder: '#198754',
  neutralBorder:  '#ffc107',
  negativeBorder: '#dc3545'
};

// Replace theme detection with CSS-driven sampling that prefers the chart container background
function getChartColors() {
  try {
    const root = document.documentElement || document.body;
    const csRoot = getComputedStyle(root);

    const tryVars = (names, cs = csRoot) => {
      for (const n of names) {
        const v = cs.getPropertyValue(n);
        if (v && v.trim()) return v.trim();
      }
      return null;
    };

    // Prefer the chart container (.chart-area / card) background so the canvas blends with the card
    let chartBackground = null;
    const sampleEl = document.querySelector('.chart-area, .bg-white, .block, .card, .bg-base-900, .bg-base-100');
    if (sampleEl) {
      const sampleCs = getComputedStyle(sampleEl);
      chartBackground = sampleCs.backgroundColor || tryVars(['--card-bg', '--surface'], sampleCs);
      if (chartBackground && chartBackground.trim() === 'rgba(0, 0, 0, 0)') chartBackground = null;
    }

    chartBackground =
      chartBackground ||
      tryVars(['--bg', '--bg-base', '--base-100', '--background', '--color-background', '--surface', '--card-bg']) ||
      csRoot.backgroundColor ||
      'transparent';

    let textColor =
      tryVars(['--text', '--color-text', '--font-color', '--color', '--body-color']) ||
      csRoot.color;

    const textSample = document.querySelector('.text-font-important-light, .text-font-important-dark, h1, h2, h3, h4, h5, h6, p, span');
    if (textSample) {
      const sampleColor = getComputedStyle(textSample).color;
      if (sampleColor && sampleColor !== 'rgba(0, 0, 0, 0)' && sampleColor !== 'transparent') {
        textColor = sampleColor;
      }
    }

    const parseRGB = (c) => {
      if (!c || c === 'transparent') return null;
      const m = c.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
      if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
      const hex = c.trim().replace('#','');
      if (hex.length === 3) return [parseInt(hex[0]+hex[0],16), parseInt(hex[1]+hex[1],16), parseInt(hex[2]+hex[2],16)];
      if (hex.length === 6) return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
      return null;
    };
    const luminance = (rgb) => {
      if (!rgb) return null;
      const [r,g,b] = rgb.map(v => v / 255).map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const bgRgb = parseRGB(chartBackground);
    const textRgb = parseRGB(textColor);
    const bgLum = luminance(bgRgb);
    const textLum = luminance(textRgb);

    let isDarkMode = false;
    if (bgLum !== null) isDarkMode = bgLum < 0.5;
    else isDarkMode = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (bgLum !== null && textLum !== null) {
      const L1 = Math.max(bgLum, textLum);
      const L2 = Math.min(bgLum, textLum);
      const contrast = (L1 + 0.05) / (L2 + 0.05);
      if (contrast < 3) {
        textColor = bgLum > 0.5 ? '#0f172a' : '#ffffff';
      }
    } else if (!textColor || textColor === 'rgba(0, 0, 0, 0)' || textColor === 'transparent') {
      textColor = (bgRgb && luminance(bgRgb) > 0.5) ? '#0f172a' : (isDarkMode ? '#ffffff' : '#374151');
    }

    const tooltipBackground = isDarkMode ? 'rgba(0,0,0,0.85)' : '#ffffff';
    const tooltipTextColor = isDarkMode ? '#ffffff' : '#0f172a';

    let gridColor =
      tryVars(['--border', '--border-color', '--color-border', '--muted', '--divider-color']) ||
      'rgba(55,65,81,0.06)';

    const sampleBorder = document.querySelector('.border-base-200, .border, .card, .bg-white');
    if (sampleBorder) {
      const sCs = getComputedStyle(sampleBorder);
      if (sCs && sCs.borderColor && sCs.borderColor.trim()) gridColor = sCs.borderColor;
    }

    if (!gridColor || gridColor === 'rgba(0, 0, 0, 0)' || gridColor === 'transparent') {
      gridColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(55,65,81,0.06)';
    }

    return {
      chartBackground,
      textColor,
      gridColor,
      isDarkMode,
      tooltipBackground,
      tooltipTextColor,
      positive: { background: 'rgba(75,192,192,0.75)', border: 'rgba(75,192,192,1)' },
      neutral:  { background: 'rgba(255,205,86,0.75)',  border: 'rgba(255,205,86,1)' },
      negative: { background: 'rgba(255,99,132,0.75)',  border: 'rgba(255,99,132,1)' }
    };
  } catch (e) {
    return {
      chartBackground: 'transparent',
      textColor: '#374151',
      gridColor: 'rgba(55,65,81,0.06)',
      isDarkMode: false,
      tooltipBackground: '#ffffff',
      tooltipTextColor: '#0f172a',
      positive: { background: 'rgba(75,192,192,0.75)', border: 'rgba(75,192,192,1)' },
      neutral:  { background: 'rgba(255,205,86,0.75)',  border: 'rgba(255,205,86,1)' },
      negative: { background: 'rgba(255,99,132,0.75)',  border: 'rgba(255,99,132,1)' }
    };
  }
}

// Update plugin: do not fill canvas if sampled background is transparent
const canvasBackgroundPlugin = {
  id: 'canvasBackground',
  beforeDraw: (chart) => {
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    if (!chartArea) return;
    const colors = getChartColors();
    const bg = (colors.chartBackground || '').toString().trim().toLowerCase();
    if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return; // let CSS card background show
    ctx.save();
    ctx.fillStyle = colors.chartBackground;
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);
    ctx.restore();
  }
};

// Also update the existing function that sets canvas element backgrounds (if present)
function updateChartCanvasBackground() {
  const colors = getChartColors();
  const barCanvas = document.getElementById('barChart');
  if (barCanvas) barCanvas.style.backgroundColor = (colors.chartBackground && colors.chartBackground !== 'transparent') ? colors.chartBackground : 'transparent';
  const pieCanvas = document.getElementById('pieChart');
  if (pieCanvas) pieCanvas.style.backgroundColor = (colors.chartBackground && colors.chartBackground !== 'transparent') ? colors.chartBackground : 'transparent';
}

// =======================
// Charts
// =======================
function initializeCharts() {
  const colors = getChartColors();
  const safeText = ensureReadable(colors.textColor, colors.chartBackground);

  // Ensure axis ticks are visible in dark mode by selecting a high-contrast axis color
  const isDarkMode = colors.isDarkMode || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const axisColor = isDarkMode ? '#e5e7eb' : safeText;
  const gridColor = isDarkMode ? 'rgba(229,231,235,0.06)' : colors.gridColor;

  // debug: expose computed values to console / debug panel
  try {
    console.debug('[TEACHERS] Chart.js version:', (window.Chart && window.Chart.version) || 'n/a', 'safeText:', safeText, 'sampledText:', colors.textColor, 'sampledBg:', colors.chartBackground, 'isDarkMode:', colors.isDarkMode);
  } catch (e) { /* ignore */ }

  // Ensure Chart.js uses the sampled text color as the global default for legends/ticks/tooltips
  try { 
    Chart.defaults.color = safeText;
    // v2 fallback
    if (Chart && Chart.version && String(Chart.version).startsWith('2')) {
      Chart.defaults.global = Chart.defaults.global || {};
      Chart.defaults.global.defaultFontColor = safeText;
      Chart.defaults.global.legend = Chart.defaults.global.legend || {};
      Chart.defaults.global.legend.labels = Chart.defaults.global.legend.labels || {};
      Chart.defaults.global.legend.labels.fontColor = safeText;
      Chart.defaults.global.tooltips = Chart.defaults.global.tooltips || {};
      Chart.defaults.global.tooltips.titleFontColor = colors.tooltipTextColor || safeText;
      Chart.defaults.global.tooltips.bodyFontColor  = colors.tooltipTextColor || safeText;
      Chart.defaults.global.tooltips.backgroundColor = colors.tooltipBackground;
    }
  } catch (e) { /* ignore */ }

  const barEl = document.getElementById('barChart');
  const barCtx = barEl && barEl.getContext ? barEl.getContext('2d') : null;
  if (barCtx) {
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Positive', backgroundColor: colors.positive.background, borderColor: colors.positive.border, data: [] },
          { label: 'Neutral',  backgroundColor: colors.neutral.background,  borderColor: colors.neutral.border,  data: [] },
          { label: 'Negative', backgroundColor: colors.negative.background, borderColor: colors.negative.border, data: [] }
        ]
      },
      options: Object.assign({ color: safeText }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          // Use axisColor for legend text so it matches ticks; make it slightly bolder for visibility
          legend: { position: 'top', labels: { color: axisColor, font: { weight: '600' } } },
          tooltip: { titleColor: colors.tooltipTextColor || safeText, bodyColor: colors.tooltipTextColor || safeText, backgroundColor: colors.tooltipBackground, borderColor: colors.gridColor, borderWidth: 1 }
        },
        // legacy v2 tooltips object (Chart.js v2)
        tooltips: { titleFontColor: colors.tooltipTextColor || safeText, bodyFontColor: colors.tooltipTextColor || safeText, backgroundColor: colors.tooltipBackground, borderColor: colors.gridColor },
        scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: axisColor, font: { weight: '600' } } }, x: { grid: { color: gridColor }, ticks: { color: axisColor, font: { weight: '600' } } } }
      }),
      plugins: [canvasBackgroundPlugin]
    });

    // Ensure barChart has consistent data and is updated
    try {
      if (barChart) {
        barChart.data = barChart.data || { labels: [], datasets: [] };
        barChart.data.labels = barChart.data.labels || [];
        barChart.data.datasets = barChart.data.datasets.length ? barChart.data.datasets : [
          { label: 'Positive', data: [], backgroundColor: colors.positive.background, borderColor: colors.positive.border },
          { label: 'Neutral',  data: [], backgroundColor: colors.neutral.background,  borderColor: colors.neutral.border },
          { label: 'Negative', data: [], backgroundColor: colors.negative.background, borderColor: colors.negative.border }
        ];
        try { barChart.update(); } catch (e) { /* ignore */ }
      }
    } catch (err) { console.error('barChart init update failed', err); }

  }

  const pieEl = document.getElementById('pieChart');
  const pieCtx = pieEl && pieEl.getContext ? pieEl.getContext('2d') : null;
  if (pieCtx) {
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: [colors.positive.background, colors.neutral.background, colors.negative.background],
          borderColor: [colors.positive.border, colors.neutral.border, colors.negative.border]
        }]
      },
      options: Object.assign({ color: safeText }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          // Make pie legend consistent with axisColor and stronger weight
          legend: { position: 'bottom', labels: { color: axisColor, font: { weight: '600' }, usePointStyle: true, pointStyle: 'circle' } },
          tooltip: {
            titleColor: colors.tooltipTextColor || safeText,
            bodyColor:  colors.tooltipTextColor || safeText,
            backgroundColor: colors.tooltipBackground,
            borderColor: colors.gridColor,
            borderWidth: 1
          },
          canvasBackground: {}
        }
      }),
      plugins: [canvasBackgroundPlugin]
    });

    // Ensure pieChart has consistent data and is updated
    try {
      if (pieChart) {
        pieChart.data = pieChart.data || {};
        pieChart.data.labels = pieChart.data.labels || ['Positive','Neutral','Negative'];
        pieChart.data.datasets = pieChart.data.datasets || [{ data: [0,0,0] }];
        try { pieChart.update(); } catch (e) { /* ignore */ }
      }
    } catch (err) { console.error('pieChart init update failed', err); }
  }
}

// small helper: ensure a text color reads over a background (returns a dark or light fallback if contrast poor)
function ensureReadable(textColor, bgColor) {
  const parseRGB = (c) => {
    if (!c) return null;
    const s = String(c).trim();
    if (!s || s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return null;
    const m = s.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    const hex = s.replace('#','');
    if (hex.length === 3) return [parseInt(hex[0]+hex[0],16), parseInt(hex[1]+hex[1],16), parseInt(hex[2]+hex[2],16)];
    if (hex.length === 6) return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
    return null;
  };
  const luminance = (rgb) => {
    if (!rgb) return null;
    const [r,g,b] = rgb.map(v => v/255).map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };

  let bgRgb = parseRGB(bgColor);
  const txtRgb = parseRGB(textColor);

  // fallback to document/body computed background when sampling failed
  if (!bgRgb) {
    try {
      const rootBg = getComputedStyle(document.documentElement).backgroundColor;
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      bgRgb = parseRGB(rootBg) || parseRGB(bodyBg) || null;
    } catch (e) { /* ignore */ }
  }

  const bgL = luminance(bgRgb);
  const txtL = luminance(txtRgb);

  const themeIsDark = document.documentElement.classList.contains('dark')
    || document.body.classList.contains('dark')
    || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (bgL === null) {
    return themeIsDark ? (textColor || '#ffffff') : '#0f172a';
  }

  if (bgL !== null && txtL !== null) {
    const L1 = Math.max(bgL, txtL);
    const L2 = Math.min(bgL, txtL);
    const contrast = (L1 + 0.05) / (L2 + 0.05);
    if (contrast < 3) return (bgL > 0.5) ? '#0f172a' : '#ffffff';
    return textColor;
  }
  if (bgL !== null) return (bgL > 0.5) ? '#0f172a' : '#ffffff';
  return textColor || '#0f172a';
}

// Apply sampled theme colors to Chart.js defaults so labels/tooltips/legends don't stay black.
function applyGlobalChartColors(colors) {
  try {
    if (!window.Chart) return;
    let safeText = ensureReadable(colors.textColor, colors.chartBackground);

    // Guard: if safeText is white and bg is transparent or light, force dark label color.
    try {
      const isWhite = !!String(safeText).match(/(^|\s)(#fff$|#ffffff$|white$|rgba?\(\s*255\s*,\s*255\s*,\s*255\s*\))/i);
      const bg = String(colors.chartBackground || '').trim().toLowerCase();
      const parseRGB = (c) => {
        if (!c) return null;
        const m = String(c).match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
        if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
        const hex = String(c).replace('#','').trim();
        if (hex.length === 6) return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
        if (hex.length === 3) return [parseInt(hex[0]+hex[0],16), parseInt(hex[1]+hex[1],16), parseInt(hex[2]+hex[2],16)];
        return null;
      };
      const lum = (rgb) => {
        if (!rgb) return null;
        const [r,g,b] = rgb.map(v => v/255).map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
        return 0.2126*r + 0.7152*g + 0.0722*b;
      };
      const bgRgb = parseRGB(bg);
      const bgL = lum(bgRgb);
      if (isWhite && (!bg || bg === 'transparent' || bg.includes('rgba(0, 0, 0, 0)') || (bgL !== null && bgL > 0.5))) {
        safeText = '#0f172a';
      }
    } catch (e) { /* ignore */ }

    Chart.defaults.color = safeText || '#374151';
    Chart.defaults.plugins = Chart.defaults.plugins || {};
    Chart.defaults.plugins.legend = Chart.defaults.plugins.legend || {};
    Chart.defaults.plugins.legend.labels = Chart.defaults.plugins.legend.labels || {};
    Chart.defaults.plugins.legend.labels.color = safeText || '#374151';

    Chart.defaults.plugins.tooltip = Chart.defaults.plugins.tooltip || {};
    Chart.defaults.plugins.tooltip.titleColor = colors.tooltipTextColor || safeText;
    Chart.defaults.plugins.tooltip.bodyColor  = colors.tooltipTextColor || safeText;

    Chart.defaults.scales = Chart.defaults.scales || {};
    Chart.defaults.scales.linear = Chart.defaults.scales.linear || {};
    Chart.defaults.scales.linear.ticks = Chart.defaults.scales.linear.ticks || {};
    Chart.defaults.scales.linear.ticks.color = safeText || '#374151';
  } catch (e) { /* ignore */ }
}

// Update existing chart instances so they pick up new colors without recreating DOM nodes.
function updateExistingChartsColors(colors) {
  try {
    let safeText = ensureReadable(colors.textColor, colors.chartBackground);

    const isDarkMode = colors.isDarkMode || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const axisColor = isDarkMode ? '#e5e7eb' : safeText;
    const gridColor = isDarkMode ? 'rgba(229,231,235,0.06)' : colors.gridColor;

    const upd = (ch) => {
      if (!ch) return;
      ch.options = ch.options || {};
      ch.options.color = safeText;
      if (ch.config) ch.config.options = ch.config.options || {}, ch.config.options.color = safeText;

      ch.options.plugins = ch.options.plugins || {};
      ch.options.plugins.legend = ch.options.plugins.legend || {};
      ch.options.plugins.legend.labels = ch.options.plugins.legend.labels || {};
      ch.options.plugins.legend.labels.color = axisColor;
      ch.options.plugins.legend.labels.font = ch.options.plugins.legend.labels.font || {};
      ch.options.plugins.legend.labels.font.weight = '600';

      ch.options.plugins.tooltip = ch.options.plugins.tooltip || {};
      ch.options.plugins.tooltip.titleColor = colors.tooltipTextColor || safeText;
      ch.options.plugins.tooltip.bodyColor  = colors.tooltipTextColor || safeText;
      ch.options.plugins.tooltip.backgroundColor = colors.tooltipBackground;

      if (ch.options.scales) {
        if (ch.options.scales.x) { ch.options.scales.x.ticks = ch.options.scales.x.ticks || {}; ch.options.scales.x.ticks.color = axisColor; ch.options.scales.x.ticks.font = ch.options.scales.x.ticks.font || {}; ch.options.scales.x.ticks.font.weight = '600'; ch.options.scales.x.grid = ch.options.scales.x.grid || {}; ch.options.scales.x.grid.color = gridColor; }
        if (ch.options.scales.y) { ch.options.scales.y.ticks = ch.options.scales.y.ticks || {}; ch.options.scales.y.ticks.color = axisColor; ch.options.scales.y.ticks.font = ch.options.scales.y.ticks.font || {}; ch.options.scales.y.ticks.font.weight = '600'; ch.options.scales.y.grid = ch.options.scales.y.grid || {}; ch.options.scales.y.grid.color = gridColor; }
      }
      try { ch.update(); } catch (e) { /* ignore */ }
    };
    upd(barChart);
    upd(pieChart);
  } catch (e) { /* ignore */ }
}

// =======================
// Convenience: get current active year/semester from UI
// =======================
function getActiveFilter() {
  const active = document.querySelector('.year-filter.active, .year-semester-filter.active');
  let year = 'all', semester = null;
  if (active) {
    year = active.getAttribute('data-year') || 'all';
    const s = active.getAttribute('data-semester');
    if (s) semester = s;
  }
  return { year, semester };
}

// =======================
// Year/Semester filter (updates charts + caches + recos)
// =======================
async function loadYearData(year, semester = null) {
  try {
    // 1) Programs (for bar/pie + per-program cards + recos)
    let programsData;
    if (year === 'all') {
      const programsRes = await fetch('/api/teacher-performance-by-program/');
      programsData = await programsRes.json();
    } else {
      let url = `/api/teacher-evaluation-by-semester/?year=${year}`;
      if (semester) url += `&semester=${semester}`;
      const res = await fetch(url);
      const data = await res.json();
      programsData = { programs: data.programs || [] };
    }
    cache.programs = programsData;

    const programs = programsData.programs || [];
    const labels   = programs.map(p => p.name);
    const positive = programs.map(p => Number(p.positive || 0));
    const neutral  = programs.map(p => Number(p.neutral  || 0));
    const negative = programs.map(p => Number(p.negative || 0));

    // Bar
    barChart.data.labels = labels;
    barChart.data.datasets = [
      { label: 'Positive', backgroundColor: sharedColors.positive, borderColor: sharedColors.positiveBorder, borderWidth: 0, data: positive },
      { label: 'Neutral',  backgroundColor: sharedColors.neutral,  borderColor: sharedColors.neutralBorder,  borderWidth: 0, data: neutral  },
      { label: 'Negative', backgroundColor: sharedColors.negative, borderColor: sharedColors.negativeBorder,  borderWidth: 0, data: negative }
    ];
    barChart.update();

    // Pie
    pieChart.data.datasets[0].data = [
      positive.reduce((s, v) => s + v, 0),
      neutral.reduce((s, v) => s + v, 0),
      negative.reduce((s, v) => s + v, 0)
    ];
    pieChart.update();

    // Update per-program cards
    programs.forEach(prog => {
      const key = (prog.name || '').toLowerCase();
      const p = Number(prog.positive || 0), u = Number(prog.neutral || 0), n = Number(prog.negative || 0);
      const t = p + u + n;
      const rating = t ? Math.round((p / t) * 100) : 0;

      const posEl = document.getElementById(`${key}-positive`);
      const neuEl = document.getElementById(`${key}-neutral`);
      const negEl = document.getElementById(`${key}-negative`);
      const rateEl = document.getElementById(`${key}-rating`);

      if (posEl) posEl.textContent = p.toLocaleString();
      if (neuEl) neuEl.textContent = u.toLocaleString();
      if (negEl) negEl.textContent = n.toLocaleString();
      if (rateEl) rateEl.textContent = rating;
    });

    // 2) Activate UI filters
    document.querySelectorAll('.year-filter, .year-semester-filter').forEach(f => f.classList.remove('active'));
    if (semester) {
      document.querySelectorAll(`.year-semester-filter[data-year="${year}"][data-semester="${semester}"]`).forEach(el => el.classList.add('active'));
    } else {
      document.querySelectorAll(`.year-filter[data-year="${year}"]`).forEach(el => el.classList.add('active'));
    }

    // 3) Teachers (for recos + CSV), fetch with same filter
    await loadTeacherPerformanceData(year, semester);

    // 4) Recompute recommendations using filtered caches
    loadTeacherRecommendations();
  } catch (err) {
    console.error('Year filter failed:', err);
    alert('Failed to apply year filter. Please try again.');
  }
}

// =======================
// CSV Builder
// =======================
function buildTeacherCsv(cacheObj, filterInfo = {}) {
  const now = new Date().toISOString();
  const { year = 'all', semester = null } = filterInfo;

  const s = cacheObj.summary || {};
  const total = Number(s.total || 0);
  const pos = Number(s.positive || 0);
  const neu = Number(s.neutral || 0);
  const neg = Number(s.negative || 0);
  const ppos = Number(s.positive_percent ?? (total ? Math.round((pos / total) * 100) : 0));
  const pneu = Number(s.neutral_percent  ?? (total ? Math.round((neu / total) * 100) : 0));
  const pneg = Number(s.negative_percent ?? (total ? Math.round((neg / total) * 100) : 0));

  const filterText = year === 'all' ? 'All Time' : `Year ${year}${semester ? `, Semester ${semester}` : ''}`;

  const header = [
    ['Teacher Evaluation Sentiment Analysis Export'],
    ['Generated At', now],
    ['Data Filter', filterText],
    []
  ];

  const summary = [
    ['Summary'],
    ['Total', 'Positive', 'Neutral', 'Negative', 'Positive %', 'Neutral %', 'Negative %'],
    [total, pos, neu, neg, ppos, pneu, pneg],
    []
  ];

  const programs = (cacheObj.programs && cacheObj.programs.programs) ? cacheObj.programs.programs : [];
  const programRows = programs.map(p => {
    const P = Number(p.positive || 0), U = Number(p.neutral || 0), N = Number(p.negative || 0);
    const T = P + U + N;
    return [p.name || '', P, U, N, T,
      T ? Math.round((P / T) * 100) : 0,
      T ? Math.round((U / T) * 100) : 0,
      T ? Math.round((N / T) * 100) : 0
    ];
  });

  const perProgram = [
    ['Per-Program Breakdown'],
    ['Program', 'Positive', 'Neutral', 'Negative', 'Total', 'Positive %', 'Neutral %', 'Negative %'],
    ...programRows
  ];

  const teachers = Array.isArray(cacheObj.teachers) ? cacheObj.teachers : [];
  const teacherRows = teachers
    .map(t => {
      const name = t.teacher || 'Unknown';
      const P = Number(t.positive || 0), U = Number(t.neutral || 0), N = Number(t.negative || 0);
      const T = P + U + N;
      return { name, P, U, N, T };
    })
    .sort((a, b) => b.T - a.T)
    .map(t => [t.name, t.P, t.U, t.N, t.T]);

  const perTeacher = [
    [],
    ['Per-Teacher Breakdown'],
    ['Teacher', 'Positive', 'Neutral', 'Negative', 'Total'],
    ...teacherRows
  ];

  return arrayToCsv([...header, ...summary, ...perProgram, ...perTeacher]);
}

// =======================
// KPI + Pie
// =======================
function loadEvaluationData(data) {
  cache.summary = data;

  document.getElementById('positive-count').textContent = Number(data.positive || 0).toLocaleString();
  document.getElementById('neutral-count').textContent  = Number(data.neutral  || 0).toLocaleString();
  document.getElementById('negative-count').textContent = Number(data.negative || 0).toLocaleString();
  document.getElementById('total-count').textContent    = Number(data.total    || 0).toLocaleString();

  document.getElementById('positive-percent').textContent = `${data.positive_percent || 0}% of total reviews`;
  document.getElementById('neutral-percent').textContent  = `${data.neutral_percent  || 0}% of total reviews`;
  document.getElementById('negative-percent').textContent = `${data.negative_percent || 0}% of total reviews`;

  document.getElementById('pie-positive-percent').textContent = data.positive_percent || 0;
  document.getElementById('pie-neutral-percent').textContent  = data.neutral_percent  || 0;
  document.getElementById('pie-negative-percent').textContent = data.negative_percent || 0;

  const chartData = [Number(data.positive || 0), Number(data.neutral || 0), Number(data.negative || 0)];
  pieChart.data.datasets[0].data = chartData;
  pieChart.data.datasets[0].backgroundColor = [sharedColors.positive, sharedColors.neutral, sharedColors.negative];
  pieChart.update();
}

// =======================
// Recent Evaluations (sentiment label above comment)
// =======================
function loadRecentEvaluations() {
  fetch('/api/recent-teacher-evaluations/')
    .then(r => r.json())
    .then(evaluations => {
      cache.recent = evaluations;
      const list = document.getElementById('recent-evaluations-list');
      if (!list) return;

      list.innerHTML = '';

      const colorBySentiment = {
        Positive: 'text-success',
        Neutral:  'text-warning',
        Negative: 'text-danger'
      };

      const labelBySentiment = {
        Positive: 'Positive Sentiment',
        Neutral:  'Neutral Sentiment',
        Negative: 'Negative Sentiment'
      };

      evaluations.forEach(ev => {
        const safeQuote   = (ev.comments || '').replace(/"/g, '&quot;');
        const programText = ev.program ? ` - ${ev.program}` : '';

        const colorClass = colorBySentiment[ev.sentiment] || 'text-muted';
        const labelText  = labelBySentiment[ev.sentiment] || 'Review';

        list.insertAdjacentHTML('beforeend', `
          <li class="list-group-item">
            <div class="row align-items-center no-gutters">
              <div class="col me-2">
                <h6 class="mb-0"><strong>${ev.teacher || 'Teacher'}${programText}</strong></h6>
                <span class="text-xs ${colorClass}">${labelText}</span>
                <p class="text-xs text-muted mb-0">"${safeQuote}"</p>
              </div>
            </div>
          </li>
        `);
      });
    })
    .catch(error => console.error('Failed to load recent evaluations:', error));
}

// =======================
// Program Performance (fills cache.programs on initial load)
// =======================
function loadProgramPerformance() {
  return fetch('/api/teacher-performance-by-program/')
    .then(r => r.json())
    .then(data => {
      cache.programs = data;
      return data;
    })
    .catch(error => {
      console.error('Failed to load program performance:', error);
    });
}

// =======================
// Teacher Improvement Priority (existing separate list)
// =======================
function loadTeacherImprovementPriority() {
  fetch('/api/teacher-improvement-priority/')
    .then(r => r.json())
    .then(priorityList => {
      cache.improvement = priorityList;
      const list = document.getElementById('teacher-priority-list');
      if (!list) return;

      list.innerHTML = '';
      priorityList.forEach(item => {
        let badgeClass = 'bg-secondary', rowClass = '';
        if (item.priority === 'Urgent')  { badgeClass = 'bg-danger';  rowClass = 'is-urgent'; }
        else if (item.priority === 'Medium') { badgeClass = 'bg-warning'; rowClass = 'is-review'; }
        else if (item.priority === 'Low')    { badgeClass = 'bg-success'; rowClass = 'is-maintain'; }

        list.insertAdjacentHTML('beforeend', `
          <li class="list-group-item priority-item ${rowClass}">
            <div class="pri-left">
              <strong>${item.teacher || ''}</strong>${item.program ? ` (${item.program})` : ''}<br>
              <span class="text-muted">${Number(item.percent_negative || 0)}% negative reviews</span>
            </div>
            <span class="badge ${badgeClass}">${item.priority || ''}</span>
          </li>
        `);
      });
    })
    .catch(error => console.error('Failed to load teacher improvement priority:', error));
}

// =======================
// Events (Export + Filters)
// =======================
function initializeEventHandlers() {
  // Export
  document.querySelectorAll('.export-teacher-report, #export-teacher-report-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { year, semester } = getActiveFilter();

        let programsData, summaryData, teachersData;

        if (year === 'all') {
          const [programsRes, summaryRes, teachersRes] = await Promise.all([
            fetch('/api/teacher-performance-by-program/'),
            fetch('/api/teacher-evaluation-dashboard/'),
            fetch('/api/teacher-performance-by-teacher/')
          ]);
          programsData = await programsRes.json();
          summaryData  = await summaryRes.json();
          teachersData = await teachersRes.json();
        } else {
          let url = `/api/teacher-evaluation-by-semester/?year=${year}`;
          if (semester) url += `&semester=${semester}`;

          const [filterRes, teachersRes] = await Promise.all([
            fetch(url),
            fetch(`/api/teacher-performance-by-teacher/?year=${year}${semester ? `&semester=${semester}` : ''}`)
          ]);

          const filterData = await filterRes.json();
          programsData = { programs: filterData.programs || [] };
          teachersData = await teachersRes.json();

          const positive = programsData.programs.reduce((sum, p) => sum + (Number(p.positive) || 0), 0);
          const neutral  = programsData.programs.reduce((sum, p) => sum + (Number(p.neutral)  || 0), 0);
          const negative = programsData.programs.reduce((sum, p) => sum + (Number(p.negative) || 0), 0);
          const total    = positive + neutral + negative;

          summaryData = {
            total,
            positive,
            neutral,
            negative,
            positive_percent: total ? Math.round((positive / total) * 100) : 0,
            neutral_percent:  total ? Math.round((neutral  / total) * 100) : 0,
            negative_percent: total ? Math.round((negative / total) * 100) : 0
          };
        }

        const csv = buildTeacherCsv({
          summary:  summaryData,
          programs: programsData,
          teachers: teachersData
        }, { year, semester });

        let filename = 'teacher-evaluation-dashboard';
        if (year !== 'all') {
          filename += `_${year}`;
          if (semester) filename += `-sem${semester}`;
        }
        filename += `_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

        downloadCsv(filename, csv);
      } catch (err) {
        console.error('Export failed:', err);
        alert('Sorry—failed to export the report. Please try again.');
      }
    });
  });

  // Year filters
  document.querySelectorAll('.year-filter').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const year = e.currentTarget.getAttribute('data-year');
      await loadYearData(year);
    });
  });

  // Year-semester filters
  document.querySelectorAll('.year-semester-filter').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const year = e.currentTarget.getAttribute('data-year');
      const semester = e.currentTarget.getAttribute('data-semester');
      await loadYearData(year, semester);
    });
  });
}

// =======================
// Teacher performance list (supports filters)
// =======================
function loadTeacherPerformanceData(year = 'all', semester = null) {
  let url = '/api/teacher-performance-by-teacher/';
  if (year && year !== 'all') {
    url += `?year=${encodeURIComponent(year)}`;
    if (semester) url += `&semester=${encodeURIComponent(semester)}`;
  }
  return fetch(url)
    .then(r => r.json())
    .then(data => {
      cache.teachers = data;
      return data;
    })
    .catch(error => console.error('Failed to load teacher performance data:', error));
}

// =======================
// Teacher Development Recommendations (JS-only)
// =======================
const REC_MIN_SAMPLE = 1; // set to 5 or 10 if you want to ignore tiny samples
function loadTeacherRecommendations() {
  const wrap = document.getElementById('static-recos');
  if (!wrap) return;
  wrap.innerHTML = '';

  const teachers = Array.isArray(cache.teachers) ? cache.teachers : [];
  const programs = (cache.programs && cache.programs.programs) ? cache.programs.programs : [];

  // nothing to show
  if (!teachers.length && !programs.length) {
    wrap.innerHTML = `<div class="text-muted">No data available</div>`;
    return;
  }

  const pct = (num, den) => den ? (num / den) * 100 : 0;

  // pickers
  const pickMostByShare = (arr, keyName) => {
    let best = null;
    arr.forEach(it => {
      const pos = Number(it.positive || 0);
      const neu = Number(it.neutral  || 0);
      const neg = Number(it.negative || 0);
      const tot = pos + neu + neg;
      if (tot < REC_MIN_SAMPLE) return;
      let share = 0;
      if (keyName === 'positive') share = pct(pos, tot);
      if (keyName === 'neutral')  share = pct(neu, tot);
      if (keyName === 'negative') share = pct(neg, tot);
      if (!best || share > best.share) best = { ...it, total: tot, share };
    });
    return best;
  };

  // build four items
  const mostNegTeacher = pickMostByShare(teachers, 'negative');
  const mostNeuTeacher = pickMostByShare(teachers, 'neutral');
  const mostPosTeacher = pickMostByShare(teachers, 'positive');
  const mostNegProgram = pickMostByShare(programs, 'negative');

  // render helpers
  const addItem = (cls, label, text) => {
    let borderColor = '';
    let backgroundColor = '';

    if (cls === 'is-urgent') {
      borderColor = '#ff6384';
      backgroundColor = 'rgba(255,99,132,0.08)';
    } else if (cls === 'is-review') {
      borderColor = '#ffcd56';
      backgroundColor = 'rgba(255,205,86,0.08)';
    } else if (cls === 'is-recognize') {
      borderColor = '#4bc0c0';
      backgroundColor = 'rgba(75,192,192,0.08)';
    } else if (cls === 'is-support') {
      borderColor = '#3b82f6';
      backgroundColor = 'rgba(59,130,246,0.08)';
    }

    wrap.insertAdjacentHTML('beforeend', `
      <div class="action-item ${cls}" style="border-left: 8px solid ${borderColor}; background: ${backgroundColor};">
        <span class="label">${label}:</span> ${text}
      </div>
    `);
  };

  if (mostNegTeacher) {
    const tLabel = `${mostNegTeacher.teacher || 'Teacher'}${mostNegTeacher.program ? ` (${mostNegTeacher.program})` : ''}`;
    const percent = mostNegTeacher.share.toFixed(0);
    addItem(
      'is-urgent',
      'Urgent',
      `Professor, ${tLabel} has received the most negative feedback, with ${percent}% of evaluations marked as negative. Immediate action is recommended to address concerns.`
    );
  }

  if (mostNeuTeacher) {
    const tLabel = `${mostNeuTeacher.teacher || 'Teacher'}${mostNeuTeacher.program ? ` (${mostNeuTeacher.program})` : ''}`;
    const percent = mostNeuTeacher.share.toFixed(0);
    addItem(
      'is-review',
      'Review',
      `Professor, ${tLabel} stands out with the highest neutral feedback at ${percent}%. This suggests a need to review and provide guidance to move evaluations toward more positive outcomes.`
    );
  }

  if (mostPosTeacher) {
    const tLabel = `${mostPosTeacher.teacher || 'Teacher'}${mostPosTeacher.program ? ` (${mostPosTeacher.program})` : ''}`;
    const percent = mostPosTeacher.share.toFixed(0);
    addItem(
      'is-maintain',
      'Recognize',
      `Professor, ${tLabel} has received the most positive evaluations, with ${percent}% marked as positive. Recognition and encouragement are recommended to reinforce this performance.`
    );
  }

  if (mostNegProgram) {
    const pLabel = mostNegProgram.name || mostNegProgram.program || 'Program';
    const percent = mostNegProgram.share.toFixed(0);
    addItem(
      'is-support',
      'Support',
      `The ${pLabel} Department, received the highest negative evaluations, with ${percent}% of feedback classified as negative. Department-level support and development initiatives are advised.`
    );
  }

  // if still empty (e.g., all below sample threshold)
  if (!wrap.children.length) {
    wrap.innerHTML = `<div class="text-muted">Insufficient data for recommendations</div>`;
  }
}

// =======================
// Init
// =======================
window.addEventListener('DOMContentLoaded', async () => {
  // ensure Chart.js picks up theme colors before charts are created
  try { applyGlobalChartColors(getChartColors()); } catch (e) { /* ignore */ }

  initializeCharts();
  // try to update existing charts immediately after init (in case theme sampling changed)
  try { updateExistingChartsColors(getChartColors()); } catch (e) { /* ignore */ }

  // Hook system theme change to reapply colors for existing charts
  try {
    if (window && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', () => {
          try {
            const colors = getChartColors();
            applyGlobalChartColors(colors);
            updateExistingChartsColors(colors);
          } catch (e) { /* ignore */ }
        });
      } else if (mq && mq.addListener) {
        mq.addListener(() => {
          try {
            const colors = getChartColors();
            applyGlobalChartColors(colors);
            updateExistingChartsColors(colors);
          } catch (e) { /* ignore */ }
        });
      }
    }
  } catch (e) { /* ignore */ }

  observeThemeChanges();

  // Load static widgets
  loadRecentEvaluations();
  loadTeacherImprovementPriority();

  // Initial summary (KPI + pie percentages)
  fetch('/api/teacher-evaluation-dashboard/')
    .then(res => res.json())
    .then(data => loadEvaluationData(data))
    .catch(error => {
      console.error('Failed to load dashboard summary:', error);
    });

  // Initial program + teacher data (all time) then recos
  try {
    await loadYearData('all'); // sets cache.programs, fetches teachers with same filter, then renders recos
  } catch (e) {
    console.error('Initial load failed:', e);
    alert('Failed to load dashboard data. Please refresh the page.');
  }
}); // end DOMContentLoaded
          } catch (e) { /* ignore */ }
        });
      }
    }
  } catch (e) { /* ignore */ }

  observeThemeChanges();

  // Load static widgets
  loadRecentEvaluations();
  loadTeacherImprovementPriority();

  // Initial summary (KPI + pie percentages)
  fetch('/api/teacher-evaluation-dashboard/')
    .then(res => res.json())
    .then(data => loadEvaluationData(data))
    .catch(error => {
      console.error('Failed to load dashboard summary:', error);
    });

  // Initial program + teacher data (all time) then recos
  try {
    await loadYearData('all'); // sets cache.programs, fetches teachers with same filter, then renders recos
  } catch (e) {
    console.error('Initial load failed:', e);
    alert('Failed to load dashboard data. Please refresh the page.');
  }
}); // end DOMContentLoaded
  observeThemeChanges();

  // Load static widgets
  loadRecentEvaluations();
  loadTeacherImprovementPriority();

  // Initial summary (KPI + pie percentages)
  fetch('/api/teacher-evaluation-dashboard/')
    .then(res => res.json())
    .then(data => loadEvaluationData(data))
    .catch(error => {
      console.error('Failed to load dashboard summary:', error);
    });

  // Initial program + teacher data (all time) then recos
  try {
    await loadYearData('all'); // sets cache.programs, fetches teachers with same filter, then renders recos
  } catch (e) {
    console.error('Initial load failed:', e);
    alert('Failed to load dashboard data. Please refresh the page.');
  }
});
