/* OSAS dashboard scripts — fixed & polished */
let osasPieChart, osasBarChart;
let baselineData = null;
let isBaselineLoading = false;
let chartData = null;
let isChartLoading = false;
let chartRange = { key: 'all', start: null, end: null };

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
    blocks.push({ cls: 'is-urgent',  label: 'Urgent:',   text: `${worst.name} Services needs immediate attention – ${worst.pctNeg}% negative feedback` });
  }
  const mostNeutral = byNeutralDesc[0];
  if (mostNeutral && mostNeutral.neu > 0) {
    blocks.push({ cls: 'is-review',  label: 'Review:',   text: `${mostNeutral.name} Services has the most neutral comments, review to convert “meh” experiences into positives` });
  }
  const best = bySatisfactionDesc[0];
  if (best) {
    blocks.push({ cls: 'is-maintain', label: 'Maintain:', text: `${best.name} Services showing excellent performance – ${best.sat}% satisfaction` });
  }
  if (!blocks.length) {
    blocks.push({ cls: '', label: 'Info:', text: 'Not enough data to form recommendations yet.' });
  }

  target.innerHTML = blocks.map(b =>
    `<div class="action-item ${b.cls}"><span class="label">${b.label}</span>${b.text}</div>`
  ).join('');
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

/* ---------------- Charts ---------------- */
function renderCharts(data) {
  if (!data) return;

  const total = Number(data.total || 0),
        pos   = Number(data.positive || 0),
        neu   = Number(data.neutral  || 0),
        neg   = Number(data.negative || 0);
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

  // PIE
  const pieCanvas = document.getElementById('osasPieChart');
  if (pieCanvas) {
    const pieCtx = pieCanvas.getContext('2d');
    const pieData = [pos, neu, neg];
    if (!osasPieChart) {
      osasPieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: ['Positive', 'Neutral', 'Negative'],
          datasets: [{ backgroundColor: ['#198754', '#ffc107', '#dc3545'], data: pieData, borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    } else {
      osasPieChart.data.datasets[0].backgroundColor = ['#198754', '#ffc107', '#dc3545'];
      osasPieChart.data.datasets[0].data = pieData;
      osasPieChart.update();
    }
  }
  const pp = document.getElementById('osas-pie-positive-percent'); if (pp) pp.textContent = pct(pos, total);
  const np = document.getElementById('osas-pie-neutral-percent');  if (np) np.textContent = pct(neu, total);
  const np2= document.getElementById('osas-pie-negative-percent'); if (np2) np2.textContent = pct(neg, total);

  // BAR
  const barCanvas = document.getElementById('osasBarChart');
  if (barCanvas) {
    const serviceLabels = (data.services || []).map(s => s.name);
    const positiveData  = (data.services || []).map(s => Number(s.positive || 0));
    const neutralData   = (data.services || []).map(s => Number(s.neutral  || 0));
    const negativeData  = (data.services || []).map(s => Number(s.negative || 0));

    if (osasBarChart) { try { osasBarChart.destroy(); } catch { /* noop */ } osasBarChart = null; }
    osasBarChart = new Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: serviceLabels,
        datasets: [
          { label: 'Positive', data: positiveData, backgroundColor: '#198754', borderWidth: 0, maxBarThickness: 48 },
          { label: 'Neutral',  data: neutralData,  backgroundColor: '#ffc107', borderWidth: 0, maxBarThickness: 48 },
          { label: 'Negative', data: negativeData, backgroundColor: '#dc3545', borderWidth: 0, maxBarThickness: 48 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
        scales: {
          x: { grid: { display: false }, stacked: false, offset: true },
          y: { beginAtZero: true, min: 0, stacked: false, ticks: { precision: 0 }, grid: { drawBorder: false } }
        }
      }
    });
  }

  setChartRangeLabel();
  renderActionItems(data);
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
    const response = await fetch(buildBaselineApiUrl(), { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    baselineData = await response.json();
    renderBaseline(baselineData);
    renderCharts(baselineData);
  } catch (err) {
    console.error('Failed to load baseline dashboard:', err);
    alert('Sorry—failed to load the dashboard. Please refresh the page.');
  } finally {
    isBaselineLoading = false;
  }
}

async function fetchChartsThenRender() {
  if (isChartLoading) return; isChartLoading = true;
  markActiveChartMenu(chartRange.key); setChartRangeLabel();
  try {
    const response = await fetch(buildChartApiUrl(), { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    chartData = await response.json();
    renderCharts(chartData);
  } catch (err) {
    console.error('Failed to load chart data:', err);
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
