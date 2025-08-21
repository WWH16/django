// Enhanced OSAS Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function () {
  // ---------------- State ----------------
  let osasPieChart, osasBarChart;
  let baselineData = null;
  let isBaselineLoading = false;
  let chartData = null;
  let isChartLoading = false;
  let chartRange = { key: 'all', start: null, end: null };

  // ---------------- Date Utilities ----------------
  const pad = n => String(n).padStart(2, '0');
  const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => new Date();
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const firstDayOfThisMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
  const monthsAgo = n => { const d = new Date(); const day = d.getDate(); d.setMonth(d.getMonth() - n); if (d.getDate() !== day) d.setDate(0); return d; };
  const yearsAgo = n => { const d = new Date(); const m = d.getMonth(), day = d.getDate(); d.setFullYear(d.getFullYear() - n); if (d.getMonth() !== m) d.setDate(0); return d; };

  // ---------------- CSV helpers ----------------
  const csvEscape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const arrayToCsv = rows => rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
  function downloadCsv(filename, csvString) {
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function buildDashboardCsv(data, labelText) {
    const stamp = new Date().toISOString();
    const total = Number(data.total || 0), pos = Number(data.positive || 0), neu = Number(data.neutral || 0), neg = Number(data.negative || 0);
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
      [total, pos, neu, neg, pct(pos, total), pct(neu, total), pct(neg, total)],
      []
    ];

    const servicesHeader = [['Per-Service Breakdown']];
    const servicesColumns = [['Service', 'Positive', 'Neutral', 'Negative', 'Total', 'Positive %', 'Neutral %', 'Negative %']];
    const rows = (data.services || []).map(s => {
      const p = Number(s.positive || 0), u = Number(s.neutral || 0), n = Number(s.negative || 0), t = p + u + n;
      return [s.name ?? '', p, u, n, t, t ? Math.round((p / t) * 100) : 0, t ? Math.round((u / t) * 100) : 0, t ? Math.round((n / t) * 100) : 0];
    });

    return arrayToCsv([...header, ...summary, ...servicesHeader, ...servicesColumns, ...rows]);
  }

  // ---------------- API URLs ----------------
  const buildBaselineApiUrl = () => new URL('/api/osas-sentiment-dashboard/', window.location.origin).toString();
  function buildChartApiUrl() {
    const url = new URL('/api/osas-sentiment-dashboard/', window.location.origin);
    if (chartRange.key && chartRange.key !== 'all') url.searchParams.set('range', chartRange.key);
    if (chartRange.start) url.searchParams.set('start', chartRange.start);
    if (chartRange.end) url.searchParams.set('end', chartRange.end);
    return url.toString();
  }
  const RECENT_FEEDBACK_URL = '/api/recent-osas-feedback/?limit=5';

  // ---------------- UI helpers ----------------
  function setChartRangeLabel() {
    const el = document.getElementById('active-range-label'); if (!el) return;
    const key = chartRange.key;
    const map = { '7d': '· Last 7 Days', '30d': '· Last 30 Days', 'this_month': '· This Month', '6m': '· Last 6 Months', '1y': '· Last Year', 'all': '· All Time' };
    el.textContent = map[key] || '· All Time';
  }
  function markActiveChartMenu(key) {
    document.querySelectorAll('.osas-range').forEach(a => {
      const k = a.getAttribute('data-range') || 'all';
      a.classList.toggle('active', k === key);
    });
  }
  const percent = (v, t) => t ? Math.round((v / t) * 100) : 0;

  function nameToId(n) {
    const s = (n || '').toLowerCase().trim();
    if (s.includes('wi-fi') || s.includes('wifi')) return 'wifi';
    if (s.includes('admission')) return 'admission';
    if (s.includes('scholar')) return 'scholarship';
    if (s.includes('library')) return 'library';
    return null;
  }

  // ---------------- Charts (CARD-MATCHED palette: Green / Yellow / Red) ----------------
  function renderCharts(data) {
    if (!data) return;

    const total = Number(data.total || 0), pos = Number(data.positive || 0), neu = Number(data.neutral || 0), neg = Number(data.negative || 0);

    // Match card colors exactly (success, warning, danger)
    const GREEN_BG = '#198754';   const GREEN_BR = '#198754';
    const YELL_BG = '#ffc107';    const YELL_BR = '#ffc107';
    const RED_BG  = '#dc3545';    const RED_BR  = '#dc3545';

    // PIE
    const pieCtx = document.getElementById('osasPieChart').getContext('2d');
    const pieData = [pos, neu, neg];
    if (!osasPieChart) {
      osasPieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: ['Positive', 'Neutral', 'Negative'],
          datasets: [{
            data: pieData,
            backgroundColor: [GREEN_BG, YELL_BG, RED_BG],
            borderColor: [GREEN_BR, YELL_BR, RED_BR],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,  // ★ allow canvas to fill container
          resizeDelay: 0,
          layout: { padding: 0 },
          plugins: { legend: { position: 'bottom' } }
        }
      });
    } else {
      osasPieChart.data.datasets[0].data = pieData;
      osasPieChart.data.datasets[0].backgroundColor = [GREEN_BG, YELL_BG, RED_BG];
      osasPieChart.update();
    }
    document.getElementById('osas-pie-positive-percent').textContent = percent(pos, total);
    document.getElementById('osas-pie-neutral-percent').textContent = percent(neu, total);
    document.getElementById('osas-pie-negative-percent').textContent = percent(neg, total);

    // BAR
    const labels = (data.services || []).map(s => s.name);
    const posData = (data.services || []).map(s => Number(s.positive || 0));
    const neuData = (data.services || []).map(s => Number(s.neutral || 0));
    const negData = (data.services || []).map(s => Number(s.negative || 0));

    const barCtx = document.getElementById('osasBarChart').getContext('2d');
    if (!osasBarChart) {
      osasBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Positive',
              data: posData,
              backgroundColor: GREEN_BG,
              borderColor: GREEN_BR,
              borderWidth: 0,
              categoryPercentage: 1.0, // ★ fill category width
              barPercentage: 0.95,      // ★ thicker bars
              borderRadius: 6
            },
            {
              label: 'Neutral',
              data: neuData,
              backgroundColor: YELL_BG,
              borderColor: YELL_BR,
              borderWidth: 0,
              categoryPercentage: 1.0,
              barPercentage: 0.95,
              borderRadius: 6
            },
            {
              label: 'Negative',
              data: negData,
              backgroundColor: RED_BG,
              borderColor: RED_BR,
              borderWidth: 0,
              categoryPercentage: 1.0,
              barPercentage: 0.95,
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,   // ★ allow canvas to fill container
          resizeDelay: 0,
          layout: { padding: 0 },
          indexAxis: 'x',
          plugins: { legend: { display: true } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { display: false }, min: 0 }
          }
        }
      });
    } else {
      osasBarChart.data.labels = labels;
      osasBarChart.data.datasets[0].data = posData;
      osasBarChart.data.datasets[1].data = neuData;
      osasBarChart.data.datasets[2].data = negData;

      // keep colors in sync if chart already existed
      osasBarChart.data.datasets[0].backgroundColor = GREEN_BG;
      osasBarChart.data.datasets[0].borderColor = GREEN_BR;
      osasBarChart.data.datasets[1].backgroundColor = YELL_BG;
      osasBarChart.data.datasets[1].borderColor = YELL_BR;
      osasBarChart.data.datasets[2].backgroundColor = RED_BG;
      osasBarChart.data.datasets[2].borderColor = RED_BR;

      // also keep width style on updates
      osasBarChart.data.datasets.forEach(ds => {
        ds.categoryPercentage = 1.0;
        ds.barPercentage = 0.95;
        ds.borderRadius = 6;
      });

      osasBarChart.update();
    }

    setChartRangeLabel();
    renderActionItems(data);
  }

  // ---------------- Baseline rendering ----------------
  function renderBaseline(data) {
    if (!data) return;
    const total = Number(data.total || 0), pos = Number(data.positive || 0), neu = Number(data.neutral || 0), neg = Number(data.negative || 0);

    // KPI
    document.getElementById('osas-positive-count').textContent = pos.toLocaleString();
    document.getElementById('osas-neutral-count').textContent = neu.toLocaleString();
    document.getElementById('osas-negative-count').textContent = neg.toLocaleString();
    document.getElementById('osas-total-count').textContent = total.toLocaleString();

    document.getElementById('osas-positive-percent').textContent = percent(pos, total);
    document.getElementById('osas-neutral-percent').textContent = percent(neu, total);
    document.getElementById('osas-negative-percent').textContent = percent(neg, total);

    renderServicePriority(data.services);
    updateServiceCards(data.services);
    renderActionItems(data);
  }

  function renderServicePriority(services) {
    const container = document.getElementById('service-priority-list'); if (!container) return;
    container.innerHTML = '';
    const sorted = [...(services || [])].sort((a, b) => Number(b.percent_negative || 0) - Number(a.percent_negative || 0));
    sorted.forEach(svc => {
      const pctNeg = Number(svc.percent_negative || 0);
      const barClass = pctNeg >= 20 ? 'bg-danger' : pctNeg >= 10 ? 'bg-warning' : pctNeg >= 5 ? 'bg-primary' : 'bg-success';
      const label = pctNeg >= 20 ? 'Urgent' : pctNeg >= 10 ? 'Medium' : pctNeg >= 5 ? 'Low' : 'Excellent';
      container.insertAdjacentHTML('beforeend', `
        <h4 class="small fw-bold">${svc.name}<span class="float-end">${label}</span></h4>
        <div class="progress mb-4"><div class="progress-bar ${barClass}" style="width:${pctNeg}%"></div></div>
      `);
    });
  }

  function updateServiceCards(services) {
    ['wifi', 'admission', 'scholarship', 'library'].forEach(id => {
      ['positive', 'neutral', 'negative'].forEach(kind => {
        const el = document.getElementById(`${id}-${kind}`); if (el) el.textContent = '0';
      });
      const sEl = document.getElementById(`${id}-satisfaction`); if (sEl) sEl.textContent = '0% Satisfaction';
    });

    (services || []).forEach(svc => {
      const id = nameToId(svc.name); if (!id) return;
      const p = Number(svc.positive || 0), u = Number(svc.neutral || 0), n = Number(svc.negative || 0);
      const t = p + u + n, sat = t ? Math.round((p / t) * 100) : 0;
      const posEl = document.getElementById(`${id}-positive`);
      const neuEl = document.getElementById(`${id}-neutral`);
      const negEl = document.getElementById(`${id}-negative`);
      const satEl = document.getElementById(`${id}-satisfaction`);
      if (posEl) posEl.textContent = p.toLocaleString();
      if (neuEl) neuEl.textContent = u.toLocaleString();
      if (negEl) negEl.textContent = n.toLocaleString();
      if (satEl) satEl.textContent = `${sat}% Satisfaction`;
    });
  }

  // ===== Recent Feedback
  function truncate(str, n) { if (!str) return ''; const s = String(str); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function sentimentClass(label) {
    const l = (label || '').toLowerCase();
    if (l === 'positive') return 'text-success';
    if (l === 'neutral') return 'text-warning';
    if (l === 'negative') return 'text-danger';
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
        <div class="row align-items-center no-gutters">
          <div class="col me-2">
            <h6 class="mb-0"><strong>${it.service || 'Unknown Service'}</strong></h6>
            <span class="text-xs ${sentimentClass(it.sentiment)}">${it.sentiment || 'Unknown'} Sentiment</span>
            <p class="text-xs text-muted mb-0">"${truncate(it.comments || '', 120)}"</p>
            <small class="text-muted">${it.timestamp ? new Date(it.timestamp).toLocaleString() : ''}</small>
          </div>
        </div>
      </li>
    `).join('');
  }

  // ===== Action Items (pastel cards)
  function renderActionItems(data) {
    const target = document.getElementById('action-items'); if (!target) return;
    const svcs = (data?.services || []).map(s => {
      const pos = Number(s.positive || 0), neu = Number(s.neutral || 0), neg = Number(s.negative || 0);
      const tot = pos + neu + neg;
      return {
        name: s.name || 'Unknown',
        pos, neu, neg,
        pctNeg: Number(s.percent_negative || (tot ? Math.round((neg / tot) * 100) : 0)),
        sat: tot ? Math.round((pos / tot) * 100) : 0
      };
    });

    if (!svcs.length || svcs.every(s => (s.pos + s.neu + s.neg) === 0)) {
      target.innerHTML = `<div class="action-item"><span class="label">Info:</span> Add feedback to generate recommendations.</div>`;
      return;
    }

    const byPctNegDesc = [...svcs].sort((a, b) => b.pctNeg - a.pctNeg);
    const byNeutralDesc = [...svcs].sort((a, b) => b.neu - a.neu || a.pctNeg - b.pctNeg);
    const bySatisfactionDesc = [...svcs].sort((a, b) => b.sat - a.sat || a.pctNeg - b.pctNeg);

    const URGENT_MIN = 14;

    const alerts = [];
    const worst = byPctNegDesc[0];
    if (worst && worst.pctNeg >= URGENT_MIN) {
      alerts.push({ cls: 'is-urgent', label: 'Urgent:', text: `${worst.name} needs immediate attention – ${worst.pctNeg}% negative feedback` });
    }
    const mostNeutral = byNeutralDesc[0];
    if (mostNeutral && mostNeutral.neu > 0) {
      alerts.push({ cls: 'is-review', label: 'Review:', text: `${mostNeutral.name} has the most neutral feedback (${mostNeutral.neu} comments) – review to convert “meh” experiences into positives` });
    }
    const best = bySatisfactionDesc[0];
    if (best) {
      alerts.push({ cls: 'is-maintain', label: 'Maintain:', text: `${best.name} showing excellent performance – ${best.sat}% satisfaction` });
    }
    if (!alerts.length) {
      alerts.push({ cls: '', label: 'Info:', text: 'Not enough data to form recommendations yet.' });
    }

    target.innerHTML = alerts.map(a => `
      <div class="action-item ${a.cls}"><span class="label">${a.label}</span>${a.text}</div>
    `).join('');
  }

  // ---------------- Fetchers ----------------
  async function fetchBaselineThenRender() {
    if (isBaselineLoading) return; isBaselineLoading = true;
    try {
      const r = await fetch(buildBaselineApiUrl(), { headers: { 'Accept': 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      baselineData = await r.json();
      renderBaseline(baselineData);
      renderCharts(baselineData);
    } catch (err) {
      console.error('Failed to load baseline dashboard:', err);
      alert('Sorry—failed to load the dashboard. Please refresh the page.');
    } finally { isBaselineLoading = false; }
  }

  async function fetchChartsThenRender() {
    if (isChartLoading) return; isChartLoading = true;
    markActiveChartMenu(chartRange.key); setChartRangeLabel();
    try {
      const r = await fetch(buildChartApiUrl(), { headers: { 'Accept': 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      chartData = await r.json();
      renderCharts(chartData);
    } catch (err) {
      console.error('Failed to load chart data:', err);
      alert('Sorry—failed to load the chart view. Charts kept at previous view.');
    } finally { isChartLoading = false; }
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

  // ---------------- Range / Export ----------------
  function applyChartRange(key) {
    if (isChartLoading) return;
    const end = toISODate(today()); let start = null;
    switch (key) {
      case '7d': start = toISODate(daysAgo(6)); break;
      case '30d': start = toISODate(daysAgo(29)); break;
      case 'this_month': start = toISODate(firstDayOfThisMonth()); break;
      case '6m': start = toISODate(monthsAgo(6)); break;
      case '1y': start = toISODate(yearsAgo(1)); break;
      default: start = null;
    }
    chartRange = { key, start, end: start ? end : null };
    fetchChartsThenRender();
  }

  function exportChartView() {
    try {
      const data = chartData || baselineData; if (!data) { alert('Chart data not available yet.'); return; }
      const labelText = document.getElementById('active-range-label')?.textContent || 'All Time';
      const csv = buildDashboardCsv(data, labelText);
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const key = chartRange?.key || 'all';
      downloadCsv(`osas-dashboard_chartview_${key}_${ts}.csv`, csv);
    } catch (err) {
      console.error('Chart export failed:', err);
      alert('Sorry—failed to export the chart view. Please try again.');
    }
  }

  // ---------------- Events ----------------
  function setupEventHandlers() {
    document.querySelectorAll('.osas-range').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const key = e.currentTarget.getAttribute('data-range') || 'all';
        applyChartRange(key);
      });
    });

    const exportBtn = document.getElementById('export-report-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', e => {
        e.preventDefault();
        if (!baselineData) { alert('Baseline data not loaded yet.'); return; }
        const csv = buildDashboardCsv(baselineData, 'All Time (Baseline)');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCsv(`osas-dashboard_baseline_${ts}.csv`, csv);
      });
    }

    const exportDataItem = document.getElementById('osas-export-data');
    if (exportDataItem) exportDataItem.addEventListener('click', e => { e.preventDefault(); exportChartView(); });
    const genReportItem = document.getElementById('osas-generate-report');
    if (genReportItem) genReportItem.addEventListener('click', e => { e.preventDefault(); exportChartView(); });
  }

  // ---------------- Init ----------------
  (function init() {
    setupEventHandlers();
    fetchBaselineThenRender();
    fetchRecentFeedback();
  })();
});
