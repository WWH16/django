/* OSAS dashboard scripts — fixed & polished with dark mode support */
let osasPieChart, osasBarChart;
let baselineData = null;
let isBaselineLoading = false;
let chartData = null;
let isChartLoading = false;
let chartRange = { key: 'all', start: null, end: null };

/* ---------------- Debug panel (temporary) ---------------- */
function ensureDebugPanel() {
  if (document.getElementById('osas-debug-panel')) return;
  try {
    const d = document.createElement('div');
    d.id = 'osas-debug-panel';
    d.style.position = 'fixed';
    d.style.right = '12px';
    d.style.bottom = '12px';
    d.style.zIndex = '99999';
    d.style.background = 'rgba(0,0,0,0.7)';
    d.style.color = '#fff';
    d.style.fontSize = '12px';
    d.style.padding = '8px 10px';
    d.style.borderRadius = '6px';
    d.style.maxWidth = '360px';
    d.style.maxHeight = '40vh';
    d.style.overflow = 'auto';
    d.style.boxShadow = '0 6px 18px rgba(0,0,0,0.3)';
    d.innerText = 'OSAS debug panel';
    document.body.appendChild(d);
  } catch (e) { /* ignore if DOM not ready */ }
}

function setDebugInfo(msg) {
  try {
    ensureDebugPanel();
    const d = document.getElementById('osas-debug-panel');
    if (!d) return;
    const time = new Date().toLocaleTimeString();
    d.innerText = `[${time}] ${msg}`;
  } catch (e) { /* ignore */ }
}

/* ---------------- Dark mode detection ---------------- */
function isDarkMode() {
  // robust detection: check body, html/documentElement classes and system preference
  try {
    if (document && document.body && document.body.classList.contains('dark')) return true;
    if (document && document.documentElement && document.documentElement.classList.contains('dark')) return true;
    if (window && window.matchMedia) return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    // ignore errors and fall back to false
  }
  return false;
}

function getChartColors() {
  const darkMode = isDarkMode();
  
  return {
    // Chart background
    chartBackground: darkMode ? '#0b1220' : '#ffffff',
    
    // Text colors
    textColor: darkMode ? '#e5e7eb' : '#374151',
    gridColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(55,65,81,0.06)',
    
    // Sentiment colors (pastel versions)
    positive: {
      background: 'rgba(75, 192, 192, 0.75)',
      border: 'rgba(75, 192, 192, 1)',
      backgroundLight: 'rgba(75, 192, 192, 0.28)'
    },
    neutral: {
      background: 'rgba(255, 205, 86, 0.75)',
      border: 'rgba(255, 205, 86, 1)', 
      backgroundLight: 'rgba(255, 205, 86, 0.28)'
    },
    negative: {
      background: 'rgba(255, 99, 132, 0.75)',
      border: 'rgba(255, 99, 132, 1)',
      backgroundLight: 'rgba(255, 99, 132, 0.28)'
    }
  };
}

/* Canvas background plugin: fills the chartArea with theme-appropriate color so the canvas interior isn't white in dark mode */
const canvasBackgroundPlugin = {
  id: 'canvasBackground',
  beforeDraw: (chart, args, options) => {
    const colors = getChartColors();
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    if (!chartArea) return;
    ctx.save();
    ctx.fillStyle = colors.chartBackground || '#ffffff';
    ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    ctx.restore();
  }
};

// Register the plugin if Chart is available and not already registered
try {
  if (window && window.Chart && Chart && !(Chart.registry && Chart.registry.plugins && Chart.registry.plugins.get && Chart.registry.plugins.get('canvasBackground'))) {
    Chart.register(canvasBackgroundPlugin);
  }
} catch (e) { /* ignore registration errors */ }

/* ---------------- Date helpers ---------------- */
function toISODate(d) { const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function today() { return new Date(); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function firstDayOfThisMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }
function monthsAgo(n) { const d = new Date(); const day = d.getDate(); d.setMonth(d.getMonth() - n); if (d.getDate() !== day) d.setDate(0); return d; }
function yearsAgo(n) { const d = new Date(); const m = d.getMonth(), day = d.getDate(); d.setFullYear(d.getFullYear() - n); if (d.getMonth() !== m) d.setDate(0); return d; }

/* ---------------- CSV helpers ---------------- */
function csvEscape(value) { const v = value ?? ''; const s = String(v).replace(/"/g, '""'); return `"${s}"`; }
function arrayToCsv(rows) { return rows.map(r => r.map(csvEscape).join(',')).join('\r\n'); }
function downloadCsv(filename, csvString) {
  const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function buildDashboardCsv(data, labelText) {
  const stamp = new Date().toISOString();
  const total = Number(data.total || 0);
  const pos = Number(data.positive || 0);
  const neu = Number(data.neutral || 0);
  const neg = Number(data.negative || 0);
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

  const header = [
    ['OSAS Services Sentiment Analysis Export'],
    ['Generated At', stamp],
    ['Range', labelText || 'All Time'],
    []
  ];
  const summary = [
    ['Summary'],
    ['Total', 'Positive', 'Neutral', 'Negative', 'Positive %', 'Neutral %', 'Negative %'],
    [
      total, pos, neu, neg,
      (data.positive_percent ?? pct(pos, total)),
      (data.neutral_percent  ?? pct(neu, total)),
      (data.negative_percent ?? pct(neg, total))
    ],
    []
  ];
  const servicesHeader = [['Per-Service Breakdown']];
  const servicesColumns = [['Service', 'Positive', 'Neutral', 'Negative', 'Total', 'Positive %', 'Neutral %', 'Negative %']];

  const rows = (data.services || []).map(s => {
    const p = Number(s.positive || 0);
    const u = Number(s.neutral || 0);
    const n = Number(s.negative || 0);
    const t = p + u + n;
    return [s.name ?? '', p, u, n, t,
      t ? Math.round((p / t) * 100) : 0,
      t ? Math.round((u / t) * 100) : 0,
      t ? Math.round((n / t) * 100) : 0
    ];
  });

  return arrayToCsv([...header, ...summary, ...servicesHeader, ...servicesColumns, ...rows]);
}

/* ---------------- API ---------------- */
function buildBaselineApiUrl() { return new URL('/api/osas-sentiment-dashboard/', window.location.origin).toString(); }
function buildChartApiUrl() {
  const url = new URL('/api/osas-sentiment-dashboard/', window.location.origin);
  if (chartRange.key && chartRange.key !== 'all') url.searchParams.set('range', chartRange.key);
  if (chartRange.start) url.searchParams.set('start', chartRange.start);
  if (chartRange.end)   url.searchParams.set('end',   chartRange.end);
  return url.toString();
}
const RECENT_FEEDBACK_URL = '/api/recent-osas-feedback/?limit=5';

/* ---------------- UI labels ---------------- */
function setChartRangeLabel() {
  const el = document.getElementById('active-range-label'); if (!el) return;
  switch (chartRange.key) {
    case '7d': el.textContent = '· Last 7 Days'; break;
    case '30d': el.textContent = '· Last 30 Days'; break;
    case 'this_month': el.textContent = '· This Month'; break;
    case '6m': el.textContent = '· Last 6 Months'; break;
    case '1y': el.textContent = '· Last Year'; break;
    default: el.textContent = '· All Time';
  }
}
function markActiveChartMenu(key) {
  document.querySelectorAll('.osas-range').forEach(a => {
    const k = a.getAttribute('data-range') || 'all';
    a.classList.toggle('active', k === key);
  });
}

/* ---------------- Action Items (pastel cards) ---------------- */
function renderActionItems(data) {
  const target = document.getElementById('action-items'); if (!target) return;

  const svcs = (data?.services || []).map(s => {
    const p = Number(s.positive || 0);
    const u = Number(s.neutral  || 0);
    const n = Number(s.negative || 0);
    const t = p + u + n;
    return {
      name: s.name || 'Unknown',
      pos: p, neu: u, neg: n,
      pctNeg: Number(s.percent_negative || (t ? Math.round((n / t) * 100) : 0)),
      sat: t ? Math.round((p / t) * 100) : 0
    };
  });

  if (!svcs.length || svcs.every(s => (s.pos + s.neu + s.neg) === 0)) {
    target.innerHTML = `<div class="action-item"><span class="label">Info:</span> Add feedback to generate recommendations.</div>`;
    return;
  }

  const byPctNegDesc       = [...svcs].sort((a,b) => b.pctNeg - a.pctNeg);
  const byNeutralDesc      = [...svcs].sort((a,b) => b.neu - a.neu || a.pctNeg - b.pctNeg);
  const bySatisfactionDesc = [...svcs].sort((a,b) => b.sat - a.sat || a.pctNeg - b.pctNeg);

  const URGENT_MIN = 14; // tweak as desired

  const blocks = [];
  const worst = byPctNegDesc[0];
  if (worst && worst.pctNeg >= URGENT_MIN) {
    blocks.push({
      cls: 'is-urgent',
      label: 'Urgent:',
      text: `${worst.name} Services needs immediate attention, receiving ${worst.pctNeg}% negative feedback. Address concerns as soon as possible to improve service quality.`
    });
  }

  const mostNeutral = byNeutralDesc[0];
  if (mostNeutral && mostNeutral.neu > 0) {
    blocks.push({
      cls: 'is-review',
      label: 'Review:',
      text: `${mostNeutral.name} Services has the highest share of neutral comments. Focus on converting these average experiences into positive outcomes through improvements and engagement.`
    });
  }

  const best = bySatisfactionDesc[0];
  if (best) {
    blocks.push({
      cls: 'is-maintain',
      label: 'Maintain:',
      text: `${best.name} Services is showing excellent performance with ${best.sat}% satisfaction. Maintain current practices and recognize this achievement to sustain success.`
    });
  }

  if (!blocks.length) {
    blocks.push({ cls: '', label: 'Info:', text: 'Not enough data to form recommendations yet.' });
  }

  target.innerHTML = blocks
    .map(b => `<div class="action-item ${b.cls}"><span class="label">${b.label}</span> ${b.text}</div>`)
    .join('');
}

/* ---------------- Recent feedback ---------------- */
function truncate(str, n) { if (!str) return ''; const s = String(str); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function sentimentClass(label) {
  const l = (label||'').toLowerCase();
  if (l==='positive') return 'text-success';
  if (l==='neutral')  return 'text-warning';
  if (l==='negative') return 'text-danger';
  return 'text-muted';
}
function renderRecentFeedback(items) {
  const list = document.getElementById('recent-feedback-list'); if (!list) return;
  if (!items || !items.length) {
    list.innerHTML = `<li class="list-group-item text-muted">No recent feedback.</li>`;
    return;
  }
  list.innerHTML = items.map(it => `
    <li class="list-group-item">
      <div class="row align-items-center">
        <div class="col me-2">
          <h6 class="mb-0"><strong>${it.service || 'Unknown Service'}</strong></h6>
          <span class="text-xs ${sentimentClass(it.sentiment)}">${it.sentiment || 'Unknown'} Sentiment</span>
          <p class="text-xs text-muted mb-0">"${truncate(it.comments || '', 90)}"</p>
          <small class="text-muted">${it.timestamp ? new Date(it.timestamp).toLocaleString() : ''}</small>
        </div>
      </div>
    </li>`).join('');
}
async function fetchRecentFeedback() {
  try {
    const r = await fetch(RECENT_FEEDBACK_URL, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    renderRecentFeedback(data);
  } catch (err) {
    console.error('Failed to load recent feedback:', err);
    renderRecentFeedback([]);
  }
}

/* ---------------- Charts with Dark Mode Support ---------------- */
function updateChartCanvasBackground() {
  const colors = getChartColors();
  
  // Update pie chart canvas
  const pieCanvas = document.getElementById('osasPieChart');
  if (pieCanvas) {
    pieCanvas.style.backgroundColor = colors.chartBackground;
  }
  
  // Update bar chart canvas
  const barCanvas = document.getElementById('osasBarChart');
  if (barCanvas) {
    barCanvas.style.backgroundColor = colors.chartBackground;
  }
}

function renderCharts(data) {
  if (!data) return;

  const colors = getChartColors();
  const total = Number(data.total || 0),
        pos   = Number(data.positive || 0),
        neu   = Number(data.neutral  || 0),
        neg   = Number(data.negative || 0);
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

  // Update canvas backgrounds
  updateChartCanvasBackground();

  // PIE CHART with dark mode support
  const pieCanvas = document.getElementById('osasPieChart');
  if (pieCanvas) {
    const pieCtx = pieCanvas.getContext('2d');
    const pieData = [pos, neu, neg];
    
    const pieOptions = {
      responsive: true, 
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          position: 'bottom',
          labels: {
            color: colors.textColor
          }
        }
      }
    };
    
    if (!osasPieChart) {
      osasPieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: ['Positive', 'Neutral', 'Negative'],
          datasets: [{
            backgroundColor: [
              colors.positive.background,
              colors.neutral.background,
              colors.negative.background
            ],
            borderColor: [
              colors.positive.border,
              colors.neutral.border,
              colors.negative.border
            ],
            data: pieData, 
            borderWidth: 1,
            hoverOffset: 5,
          }]
        },
        options: pieOptions
      });
    } else {
      // Update existing chart with new colors
      osasPieChart.data.datasets[0].backgroundColor = [
        colors.positive.background,
        colors.neutral.background,
        colors.negative.background
      ];
      osasPieChart.data.datasets[0].borderColor = [
        colors.positive.border,
        colors.neutral.border,
        colors.negative.border
      ];
      osasPieChart.data.datasets[0].data = pieData;
      osasPieChart.options = pieOptions;
      osasPieChart.update();
    }
  }
  
  const pp = document.getElementById('osas-pie-positive-percent'); if (pp) pp.textContent = pct(pos, total);
  const np = document.getElementById('osas-pie-neutral-percent');  if (np) np.textContent = pct(neu, total);
  const np2= document.getElementById('osas-pie-negative-percent'); if (np2) np2.textContent = pct(neg, total);

  // BAR CHART with dark mode support
  const barCanvas = document.getElementById('osasBarChart');
  if (barCanvas) {
    const serviceLabels = (data.services || []).map(s => s.name);
    const positiveData  = (data.services || []).map(s => Number(s.positive || 0));
    const neutralData   = (data.services || []).map(s => Number(s.neutral  || 0));
    const negativeData  = (data.services || []).map(s => Number(s.negative || 0));

    const barOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          position: 'top',
          labels: {
            color: colors.textColor
          }
        }, 
        tooltip: { mode: 'index', intersect: false } 
      },
      scales: {
        x: { 
          grid: { 
            display: false,
            color: colors.gridColor
          }, 
          stacked: false, 
          offset: true,
          ticks: {
            color: colors.textColor
          }
        },
        y: { 
          beginAtZero: true, 
          min: 0, 
          stacked: false, 
          ticks: { 
            precision: 0,
            color: colors.textColor
          }, 
          grid: { 
            drawBorder: false,
            color: colors.gridColor
          } 
        }
      }
    };

    if (osasBarChart) { try { osasBarChart.destroy(); } catch { /* noop */ } osasBarChart = null; }
    osasBarChart = new Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: serviceLabels,
        datasets: [
          { 
            label: 'Positive', 
            data: positiveData, 
            backgroundColor: colors.positive.backgroundLight,
            borderColor: colors.positive.border,
            borderWidth: 1, 
            maxBarThickness: 48 
          },
          { 
            label: 'Neutral',  
            data: neutralData,  
            backgroundColor: colors.neutral.backgroundLight,
            borderColor: colors.neutral.border,
            borderWidth: 1, 
            maxBarThickness: 48 
          },
          { 
            label: 'Negative', 
            data: negativeData, 
            backgroundColor: colors.negative.backgroundLight,
            borderColor: colors.negative.border,
            borderWidth: 1, 
            maxBarThickness: 48 
          }
        ]
      },
      options: barOptions
    });
  }

  setChartRangeLabel();
  renderActionItems(data);
}

/* ---------------- Theme change observer ---------------- */
function observeThemeChanges() {
  // Create a MutationObserver to watch for theme class changes on body or documentElement
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        // Theme changed, update charts
        if (chartData || baselineData) {
          renderCharts(chartData || baselineData);
        }
      }
    });
  });

  // Observe both body and documentElement in case theme toggles apply to either
  try {
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (document.documentElement) observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  } catch (e) { /* ignore */ }

  // Also listen for system preference changes
  try {
    if (window && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', () => { if (chartData || baselineData) renderCharts(chartData || baselineData); });
      } else if (mq && mq.addListener) {
        mq.addListener(() => { if (chartData || baselineData) renderCharts(chartData || baselineData); });
      }
    }
  } catch (e) { /* ignore */ }
}

/* ---------------- Baseline (KPIs, cards, priority) ---------------- */
function renderBaseline(data) {
  if (!data) return;

  const total = Number(data.total || 0),
        pos   = Number(data.positive || 0),
        neu   = Number(data.neutral  || 0),
        neg   = Number(data.negative || 0);
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

  const el = id => document.getElementById(id);

  const pc = el('osas-positive-count'); if (pc) pc.textContent = pos.toLocaleString();
  const nc = el('osas-neutral-count');  if (nc) nc.textContent = neu.toLocaleString();
  const dc = el('osas-negative-count'); if (dc) dc.textContent = neg.toLocaleString();
  const tc = el('osas-total-count');    if (tc) tc.textContent = total.toLocaleString();

  const pp = el('osas-positive-percent'); if (pp) pp.textContent = data.positive_percent ?? pct(pos, total);
  const np = el('osas-neutral-percent');  if (np) np.textContent = data.neutral_percent  ?? pct(neu, total);
  const dp = el('osas-negative-percent'); if (dp) dp.textContent = data.negative_percent ?? pct(neg, total);

  // Service priority list
  const priorityContainer = el('service-priority-list');
  if (priorityContainer) {
    const sorted = [...(data.services || [])]
      .sort((a, b) => (Number(b.percent_negative || 0)) - (Number(a.percent_negative || 0)));
    priorityContainer.innerHTML = '';
    sorted.forEach(svc => {
      const pctNeg = Number(svc.percent_negative || 0);
      const barClass = pctNeg >= 20 ? 'bg-danger'
                    : pctNeg >= 10 ? 'bg-warning'
                    : pctNeg >= 5  ? 'bg-primary'
                    : 'bg-success';
      const priority = pctNeg >= 20 ? 'Urgent'
                    : pctNeg >= 10 ? 'Medium'
                    : pctNeg >= 5  ? 'Low'
                    : 'Excellent';
      priorityContainer.insertAdjacentHTML('beforeend', `
        <h4 class="small fw-bold">${svc.name}<span class="float-end">${priority}</span></h4>
        <div class="progress mb-4"><div class="progress-bar ${barClass}" style="width:${pctNeg}%"></div></div>
      `);
    });
  }

  // Zero-out then fill service cards
  ['wifi', 'admission', 'scholarship', 'library'].forEach(id => {
    ['positive', 'neutral', 'negative'].forEach(kind => {
      const el = document.getElementById(`${id}-${kind}`); if (el) el.textContent = '0';
    });
    const sEl = document.getElementById(`${id}-satisfaction`); if (sEl) sEl.textContent = '0% Satisfaction';
  });

  const nameToId = (n) => {
    const s = (n || '').toLowerCase();
    if (s.includes('wi-fi') || s.includes('wifi')) return 'wifi';
    if (s.includes('admission')) return 'admission';
    if (s.includes('scholar')) return 'scholarship';
    if (s.includes('library')) return 'library';
    return null;
  };

  (data.services || []).forEach(svc => {
    const id = nameToId(svc.name); if (!id) return;
    const p = Number(svc.positive || 0);
    const u = Number(svc.neutral  || 0);
    const n = Number(svc.negative || 0);
    const t = p + u + n;
    const sat = t ? Math.round((p / t) * 100) : 0;

    const posEl = el(`${id}-positive`);
    const neuEl = el(`${id}-neutral`);
    const negEl = el(`${id}-negative`);
    const satEl = el(`${id}-satisfaction`);

    if (posEl) posEl.textContent = p.toLocaleString();
    if (neuEl) neuEl.textContent = u.toLocaleString();
    if (negEl) negEl.textContent = n.toLocaleString();
    if (satEl) satEl.textContent = `${sat}% Satisfaction`;
  });

  renderActionItems(data);
}

/* ---------------- Fetchers ---------------- */
async function fetchBaselineThenRender() {
  if (isBaselineLoading) return; isBaselineLoading = true;
  try {
    const url = buildBaselineApiUrl();
    console.debug('[OSAS] fetchBaseline URL:', url);
    setDebugInfo(`Fetching baseline: ${url}`);
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    setDebugInfo(`Baseline response: ${response.status} ${response.statusText}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    baselineData = await response.json();
    setDebugInfo(`Baseline JSON received: ${Object.keys(baselineData || {}).length} top-level keys`);
    renderBaseline(baselineData);
    renderCharts(baselineData);
  } catch (err) {
    console.error('Failed to load baseline dashboard:', err);
    setDebugInfo(`Baseline error: ${err.message}`);
    alert('Sorry—failed to load the dashboard. Please refresh the page.');
  } finally {
    isBaselineLoading = false;
  }
}

async function fetchChartsThenRender() {
  if (isChartLoading) return; isChartLoading = true;
  markActiveChartMenu(chartRange.key); setChartRangeLabel();
  try {
    const url = buildChartApiUrl();
    console.debug('[OSAS] fetchChart URL:', url);
    setDebugInfo(`Fetching chart view: ${url}`);
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    setDebugInfo(`Chart response: ${response.status} ${response.statusText}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    chartData = await response.json();
    setDebugInfo(`Chart JSON received: ${Object.keys(chartData || {}).length} top-level keys`);
    renderCharts(chartData);
  } catch (err) {
    console.error('Failed to load chart data:', err);
    setDebugInfo(`Chart error: ${err.message}`);
    alert('Sorry—failed to load the chart view. Charts kept at previous view.');
  } finally {
    isChartLoading = false;
  }
}

/* ---------------- Range handling ---------------- */
function applyChartRange(key) {
  if (isChartLoading) return;
  const end = toISODate(today());
  let start = null;
  switch (key) {
    case '7d':        start = toISODate(daysAgo(6));           break;
    case '30d':       start = toISODate(daysAgo(29));          break;
    case 'this_month':start = toISODate(firstDayOfThisMonth());break;
    case '6m':        start = toISODate(monthsAgo(6));         break;
    case '1y':        start = toISODate(yearsAgo(1));          break;
    default:          start = null;
  }
  chartRange = { key, start, end: start ? end : null };
  fetchChartsThenRender();
}

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', function () {
  // Set up debug panel and theme change observer
  ensureDebugPanel();
  observeThemeChanges();
  
  // initial label state
  setChartRangeLabel(); markActiveChartMenu('all');

  fetchBaselineThenRender();
  fetchRecentFeedback();

  document.querySelectorAll('.osas-range').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const key = e.currentTarget.getAttribute('data-range') || 'all';
      applyChartRange(key);
    });
  });

  const exportBtn = document.getElementById('export-report-btn');
  if (exportBtn) exportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    try {
      if (!baselineData) { alert('Baseline data not loaded yet.'); return; }
      const csv = buildDashboardCsv(baselineData, 'All Time (Baseline)');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCsv(`osas-dashboard_baseline_${ts}.csv`, csv);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Sorry—failed to export the baseline report. Please try again.');
    }
  });

  function exportChartView() {
    try {
      const dataForChart = chartData || baselineData;
      if (!dataForChart) { alert('Chart data not available yet.'); return; }
      const labelText = document.getElementById('active-range-label')?.textContent || 'All Time';
      const csv = buildDashboardCsv(dataForChart, labelText);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const key = chartRange?.key || 'all';
      downloadCsv(`osas-dashboard_chartview_${key}_${ts}.csv`, csv);
    } catch (err) {
      console.error('Chart export failed:', err);
      alert('Sorry—failed to export the chart view. Please try again.');
    }
  }

  const exportDataItem = document.getElementById('osas-export-data');
  if (exportDataItem) exportDataItem.addEventListener('click', (e) => { e.preventDefault(); exportChartView(); });
  const genReportItem = document.getElementById('osas-generate-report');
  if (genReportItem) genReportItem.addEventListener('click', (e) => { e.preventDefault(); exportChartView(); });
});

function getPriorityColor(priority) {
  switch (priority) {
    case 'Urgent':   return '#ff6384'; // pastel red
    case 'Review':   return '#ffcd56'; // pastel yellow
    case 'Maintain': return '#4bc0c0'; // pastel blue-green
    default:         return '#cccccc'; // fallback
  }
}

function renderServicePriority(priorities) {
  const container = document.getElementById('service-priority-list');
  container.innerHTML = '';
  priorities.forEach(item => {
    const color = getPriorityColor(item.status);
    container.innerHTML += `
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="font-semibold">${item.name}</span>
          <span class="font-semibold" style="color:${color};">${item.status}</span>
        </div>
        <div class="progress" style="height: 6px;">
          <div class="progress-bar" role="progressbar"
            style="width: ${item.percent}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  });
}