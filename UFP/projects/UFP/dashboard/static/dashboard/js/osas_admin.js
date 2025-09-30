/* OSAS Dashboard - Production Implementation
   - Proper filter state management
   - Cached filtered data for consistent exports
   - Theme-responsive charts with dark mode support
   - Comprehensive error handling
*/
(function () {
  'use strict';

  // ======================
  // GLOBAL STATE
  // ======================
  let osasPieChart, osasBarChart;
  let baselineData = null;
  let isBaselineLoading = false;
  let chartData = null;
  let isChartLoading = false;
  let chartRange = { key: 'all', start: null, end: null };

  // Filter state tracking - CRITICAL for export consistency
  let currentFilters = {
    year: 'all',
    semester: 'all'
  };

  // Cache for filtered data - ensures export uses the same data as display
  let cachedFilteredData = null;

  /* ---------------- Date Helpers ---------------- */
  function toISODate(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function today() { return new Date(); }
  function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
  function firstDayOfThisMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }
  function monthsAgo(n) {
    const d = new Date();
    const day = d.getDate();
    d.setMonth(d.getMonth() - n);
    if (d.getDate() !== day) d.setDate(0);
    return d;
  }
  function yearsAgo(n) {
    const d = new Date();
    const m = d.getMonth(), day = d.getDate();
    d.setFullYear(d.getFullYear() - n);
    if (d.getMonth() !== m) d.setDate(0);
    return d;
  }

  /* ---------------- CSV Export Utilities ---------------- */
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

  /* ---------------- API Functions ---------------- */
  function buildBaselineApiUrl() {
    return new URL('/api/osas-sentiment-dashboard/', window.location.origin).toString();
  }

  function buildChartApiUrl() {
    const url = new URL('/api/osas-sentiment-dashboard/', window.location.origin);
    if (chartRange.key && chartRange.key !== 'all') url.searchParams.set('range', chartRange.key);
    if (chartRange.start) url.searchParams.set('start', chartRange.start);
    if (chartRange.end) url.searchParams.set('end', chartRange.end);
    return url.toString();
  }

  // FILTER-SPECIFIC API - This uses the semester-based filtering
  async function fetchFilteredOsasData(selectedYear = 'all', selectedSemester = 'all') {
    try {
      const apiUrl = '/api/service-feedback-by-semester/';
      const queryParams = new URLSearchParams();

      if (selectedYear === 'all') {
        queryParams.append('all_time', 'true');
      } else {
        queryParams.append('year', selectedYear);
        queryParams.append('all_time', 'false');
      }

      if (selectedSemester !== 'all') {
        queryParams.append('semester', selectedSemester);
      }

      const requestUrl = apiUrl + '?' + queryParams.toString();
      console.log('OSAS Filter API Request:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('OSAS Filter API Response:', data);
      
      // Cache with filter metadata for export consistency
      cachedFilteredData = {
        ...data,
        _filterMeta: {
          year: selectedYear,
          semester: selectedSemester,
          timestamp: new Date().toISOString(),
          apiUrl: requestUrl
        }
      };

      return data;

    } catch (error) {
      console.error('OSAS Filter API Error:', error);
      throw error;
    }
  }

  const RECENT_FEEDBACK_URL = '/api/recent-osas-feedback/?limit=5';

  /* ---------------- Theme Detection & Chart Colors ---------------- */
  function detectDarkMode() {
    const html = document.documentElement;
    const body = document.body;
    
    // Check for dark mode classes
    if (html.classList.contains('dark') || 
        html.classList.contains('dark-mode') ||
        body.classList.contains('dark') || 
        body.classList.contains('dark-mode')) {
      return true;
    }
    
    // Check data attributes
    if (html.getAttribute('data-theme') === 'dark' || 
        html.getAttribute('data-bs-theme') === 'dark' ||
        body.getAttribute('data-theme') === 'dark' ||
        body.getAttribute('data-bs-theme') === 'dark') {
      return true;
    }
    
    // Check computed background color
    const htmlBg = window.getComputedStyle(html).backgroundColor;
    const bodyBg = window.getComputedStyle(body).backgroundColor;
    
    const isDarkBackground = (bgColor) => {
      if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') return false;
      const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const [, r, g, b] = match.map(Number);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
      }
      return false;
    };
    
    return isDarkBackground(bodyBg) || isDarkBackground(htmlBg);
  }

  function getChartColors() {
    const isDark = detectDarkMode();
    
    return {
      textColor: isDark ? '#e5e7eb' : '#374151',
      axisColor: isDark ? '#d1d5db' : '#374151',
      legendColor: isDark ? '#f3f4f6' : '#374151',
      gridColor: isDark ? 'rgba(209, 213, 219, 0.2)' : 'rgba(55, 65, 81, 0.2)',
      tooltipBackground: isDark ? '#1f2937' : '#ffffff',
      tooltipTextColor: isDark ? '#f9fafb' : '#0f172a',
      tooltipBorderColor: isDark ? 'rgba(209, 213, 219, 0.3)' : 'rgba(55, 65, 81, 0.2)',
      
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

  /* ---------------- UI Update Functions ---------------- */
  function updateTotalDescription() {
    const totalDescEl = document.getElementById('osas-total-description');
    if (!totalDescEl) return;

    let description = '';
    if (currentFilters.year === 'all' && currentFilters.semester === 'all') {
      description = 'All Time';
    } else if (currentFilters.year !== 'all' && currentFilters.semester === 'all') {
      description = currentFilters.year;
    } else if (currentFilters.year === 'all' && currentFilters.semester !== 'all') {
      const semesterText = currentFilters.semester === '1' ? '1st' : currentFilters.semester === '2' ? '2nd' : `${currentFilters.semester}th`;
      description = `${semesterText} Semester`;
    } else if (currentFilters.year !== 'all' && currentFilters.semester !== 'all') {
      const semesterText = currentFilters.semester === '1' ? '1st' : currentFilters.semester === '2' ? '2nd' : `${currentFilters.semester}th`;
      description = `${currentFilters.year}, ${semesterText} Semester`;
    }

    totalDescEl.textContent = description;
  }

  function setChartRangeLabel() {
    const el = document.getElementById('active-range-label');
    if (!el) return;
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

  /* ---------------- Dashboard Update Functions ---------------- */
  function updateOsasCards(responseData) {
    if (!responseData || !Array.isArray(responseData.services)) {
      return;
    }

    // Calculate totals from services array
    let totalPositive = 0;
    let totalNeutral = 0;
    let totalNegative = 0;
    let grandTotal = 0;

    responseData.services.forEach(serviceItem => {
      totalPositive += Number(serviceItem.positive || 0);
      totalNeutral += Number(serviceItem.neutral || 0);
      totalNegative += Number(serviceItem.negative || 0);
      grandTotal += Number(serviceItem.total || 0);
    });

    // Update KPI cards
    const elements = {
      positive: document.getElementById('osas-positive-count'),
      neutral: document.getElementById('osas-neutral-count'),
      negative: document.getElementById('osas-negative-count'),
      total: document.getElementById('osas-total-count')
    };

    if (elements.positive) elements.positive.textContent = totalPositive.toLocaleString();
    if (elements.neutral) elements.neutral.textContent = totalNeutral.toLocaleString();
    if (elements.negative) elements.negative.textContent = totalNegative.toLocaleString();
    if (elements.total) elements.total.textContent = grandTotal.toLocaleString();

    // Update percentages
    if (grandTotal > 0) {
      const posPercent = Math.round((totalPositive / grandTotal) * 100);
      const neuPercent = Math.round((totalNeutral / grandTotal) * 100);
      const negPercent = Math.round((totalNegative / grandTotal) * 100);

      const percentElements = [
        { id: 'osas-positive-percent', value: `${posPercent}% of the feedbacks` },
        { id: 'osas-neutral-percent', value: `${neuPercent}% of the feedbacks` },
        { id: 'osas-negative-percent', value: `${negPercent}% of the feedbacks` },
        { id: 'osas-pie-positive-percent', value: posPercent },
        { id: 'osas-pie-neutral-percent', value: neuPercent },
        { id: 'osas-pie-negative-percent', value: negPercent }
      ];

      percentElements.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) element.textContent = item.value;
      });
    }

    // Update service-specific cards
    const serviceCardMapping = {
      wifi: ['wifi', 'internet', 'wi-fi'],
      admission: ['admission'],
      scholarship: ['scholarship'],
      library: ['library']
    };

    Object.keys(serviceCardMapping).forEach(cardPrefix => {
      const serviceEl = {
        positive: document.getElementById(`${cardPrefix}-positive`),
        neutral: document.getElementById(`${cardPrefix}-neutral`),
        negative: document.getElementById(`${cardPrefix}-negative`),
        satisfaction: document.getElementById(`${cardPrefix}-satisfaction`)
      };

      // Find matching service
      const matchingService = responseData.services.find(service => 
        serviceCardMapping[cardPrefix].some(keyword => 
          (service.service || service.name || '').toLowerCase().includes(keyword)
        )
      );

      if (matchingService) {
        if (serviceEl.positive) serviceEl.positive.textContent = matchingService.positive || 0;
        if (serviceEl.neutral) serviceEl.neutral.textContent = matchingService.neutral || 0;
        if (serviceEl.negative) serviceEl.negative.textContent = matchingService.negative || 0;
        if (serviceEl.satisfaction) {
          const satisfactionRate = matchingService.positive_percent || 0;
          serviceEl.satisfaction.textContent = `${satisfactionRate}% Satisfaction`;
        }
      }
    });

    updateTotalDescription();
  }

  /* ---------------- Chart Rendering ---------------- */
  function renderCharts(data) {
    try {
      if (!data) return;

      const CHART_COLORS = getChartColors();

      // Calculate totals for pie chart
      let total = 0, pos = 0, neu = 0, neg = 0;
      if (data.services && Array.isArray(data.services)) {
        data.services.forEach(service => {
          pos += Number(service.positive || 0);
          neu += Number(service.neutral || 0);
          neg += Number(service.negative || 0);
          total += Number(service.total || 0);
        });
      }

      // PIE CHART: destroy and recreate for animation
const pieCanvas = document.getElementById('osasPieChart');
if (pieCanvas && pieCanvas.getContext && window.Chart) {
  const pieCtx = pieCanvas.getContext('2d');
  const pieData = [pos, neu, neg];

  // Always destroy and recreate for animation
  if (osasPieChart) {
    osasPieChart.destroy();
  }

  osasPieChart = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [{
        backgroundColor: [
          CHART_COLORS.positive.background,
          CHART_COLORS.neutral.background,
          CHART_COLORS.negative.background
        ],
        borderColor: [
          CHART_COLORS.positive.border,
          CHART_COLORS.neutral.border,
          CHART_COLORS.negative.border
        ],
        data: pieData,
        borderWidth: 1,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: CHART_COLORS.textColor,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: CHART_COLORS.legendColor,
            font: { weight: '600', size: 12 },
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 12,
            padding: 20
          }
        },
        tooltip: {
          titleColor: CHART_COLORS.tooltipTextColor,
          bodyColor: CHART_COLORS.tooltipTextColor,
          backgroundColor: CHART_COLORS.tooltipBackground,
          borderColor: CHART_COLORS.tooltipBorderColor,
          borderWidth: 1,
          padding: 8
        }
      }
    }
  });
}

// BAR CHART: destroy and recreate for animation
const barCanvas = document.getElementById('osasBarChart');
if (barCanvas && barCanvas.getContext && window.Chart && data.services) {
  const ctx = barCanvas.getContext('2d');
  const serviceLabels = data.services.map(s => s.service || s.name);
  const positiveData = data.services.map(s => Number(s.positive || 0));
  const neutralData = data.services.map(s => Number(s.neutral || 0));
  const negativeData = data.services.map(s => Number(s.negative || 0));

  // Always destroy and recreate for animation
  if (osasBarChart) {
    osasBarChart.destroy();
  }

  osasBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: serviceLabels,
      datasets: [
        {
          label: 'Positive',
          data: positiveData,
          backgroundColor: CHART_COLORS.positive.backgroundLight,
          borderColor: CHART_COLORS.positive.border,
          borderWidth: 1,
          maxBarThickness: 48
        },
        {
          label: 'Neutral',
          data: neutralData,
          backgroundColor: CHART_COLORS.neutral.backgroundLight,
          borderColor: CHART_COLORS.neutral.border,
          borderWidth: 1,
          maxBarThickness: 48
        },
        {
          label: 'Negative',
          data: negativeData,
          backgroundColor: CHART_COLORS.negative.backgroundLight,
          borderColor: CHART_COLORS.negative.border,
          borderWidth: 1,
          maxBarThickness: 48
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      color: CHART_COLORS.textColor,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: CHART_COLORS.legendColor,
            font: { weight: '600', size: 12 },
            usePointStyle: false,
            padding: 20
          }
        },
        tooltip: {
          titleColor: CHART_COLORS.tooltipTextColor,
          bodyColor: CHART_COLORS.tooltipTextColor,
          backgroundColor: CHART_COLORS.tooltipBackground,
          borderColor: CHART_COLORS.tooltipBorderColor,
          borderWidth: 1,
          padding: 8
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: CHART_COLORS.axisColor,
            font: { weight: '600', size: 11 },
            precision: 0
          },
          grid: {
            color: CHART_COLORS.gridColor,
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: CHART_COLORS.axisColor,
            font: { weight: '600', size: 11 }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

      renderActionItems(data);

    } catch (err) {
      console.error('Chart rendering error:', err);
    }
  }

/* ---------------- Filter Management ---------------- */
function showDrawer() {
  console.log('showDrawer called - NOT rendering charts');
  const filterDrawer = document.getElementById('filter-drawer');
  const blurOverlay = document.getElementById('blur-overlay');
  
  if (filterDrawer) filterDrawer.classList.add('show');
  if (blurOverlay) blurOverlay.classList.add('show');
  document.body.classList.add('filter-open');
}

function hideDrawer() {
  const filterDrawer = document.getElementById('filter-drawer');
  const blurOverlay = document.getElementById('blur-overlay');
  
  if (filterDrawer) filterDrawer.classList.remove('show');
  if (blurOverlay) blurOverlay.classList.remove('show');
  document.body.classList.remove('filter-open');
}

function resetFilters() {
  const yearFilter = document.getElementById('year-filter');
  const semesterFilter = document.getElementById('semester-filter');
  
  // Reset year filter to "All Time"
  if (yearFilter) {
    yearFilter.querySelectorAll('.filter-option').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-value') === 'all') {
        item.classList.add('active');
      }
    });
  }

  // Reset semester filter to "All Semesters"
  if (semesterFilter) {
    semesterFilter.querySelectorAll('.filter-option').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-value') === 'all') {
        item.classList.add('active');
      }
    });
  }

  // Update filter state
  currentFilters.year = 'all';
  currentFilters.semester = 'all';

  applyCurrentFilters();
  hideDrawer();
}

async function applyCurrentFilters() {
  try {
    const yearFilter = document.getElementById('year-filter');
    const semesterFilter = document.getElementById('semester-filter');
    
    let activeYear = yearFilter?.querySelector('.filter-option.active')?.getAttribute('data-value') || 'all';
    let activeSemester = semesterFilter?.querySelector('.filter-option.active')?.getAttribute('data-value') || 'all';

    // Clean semester value - convert display values to API values
    if (activeSemester && activeSemester !== 'all') {
      // Convert display values like "1st", "2nd", "3rd" to numeric values
      activeSemester = activeSemester.replace(/[^\d]/g, ''); // Remove non-digits
      if (!activeSemester || activeSemester === '') {
        activeSemester = 'all';
      }
    }

    // CRITICAL: Update current filters state
    currentFilters.year = activeYear;
    currentFilters.semester = activeSemester;

    console.log('Applying OSAS filters:', currentFilters);

    const data = await fetchFilteredOsasData(activeYear, activeSemester);
    updateOsasCards(data);
    renderCharts(data);

  } catch (error) {
    console.error('Failed to apply OSAS filters:', error);
    alert('Failed to load OSAS data: ' + error.message);
  }
}

  /* ---------------- CSV Export - FIXED FOR FILTERED DATA ---------------- */
  function buildFilteredCsvExport(data) {
    const timestamp = new Date().toISOString();
    const csvRows = [];

    // Report metadata
    csvRows.push(['OSAS Service Feedback Export']);
    csvRows.push([`Generated: ${timestamp}`]);

    // Filter information
    let filterInfo = `Data Filter: Year ${currentFilters.year === 'all' ? 'All Years' : currentFilters.year}`;
    if (currentFilters.semester && currentFilters.semester !== 'all') {
      filterInfo += `, Semester ${currentFilters.semester}`;
    } else {
      filterInfo += ', All Semesters';
    }
    csvRows.push([filterInfo]);
    csvRows.push([]); // Empty row

    if (!data || !data.services || !data.services.length) {
      csvRows.push(['No data available for the selected filters']);
      return arrayToCsv(csvRows);
    }

    // Calculate summary totals
    let totalPositive = 0, totalNeutral = 0, totalNegative = 0, grandTotal = 0;
    data.services.forEach(service => {
      totalPositive += Number(service.positive || 0);
      totalNeutral += Number(service.neutral || 0);
      totalNegative += Number(service.negative || 0);
      grandTotal += Number(service.total || 0);
    });

    const overallSatisfaction = grandTotal > 0 ? Math.round((totalPositive / grandTotal) * 100) : 0;

    // Summary section
    csvRows.push(['Summary']);
    csvRows.push(['Total Feedback', 'Positive', 'Neutral', 'Negative', 'Overall Satisfaction %']);
    csvRows.push([grandTotal, totalPositive, totalNeutral, totalNegative, overallSatisfaction]);
    csvRows.push([]);

    // Service breakdown header
    csvRows.push(['Service Breakdown']);
    csvRows.push(['Service', 'Positive', 'Neutral', 'Negative', 'Total', 'Satisfaction %']);

    // Service data
    data.services.forEach(service => {
      const serviceName = service.service || service.name || 'Unknown Service';
      const positive = service.positive || 0;
      const neutral = service.neutral || 0;
      const negative = service.negative || 0;
      const total = service.total || 0;
      const satisfaction = service.positive_percent || (total > 0 ? Math.round((positive / total) * 100) : 0);

      csvRows.push([serviceName, positive, neutral, negative, total, satisfaction]);
    });

    return arrayToCsv(csvRows);
  }

  async function exportFilteredOsasData() {
    try {
      console.log('Exporting OSAS data with filters:', currentFilters);

      // Use cached data if available and matches current filters
      let exportData = cachedFilteredData;

      if (!exportData || 
          !exportData._filterMeta ||
          exportData._filterMeta.year !== currentFilters.year ||
          exportData._filterMeta.semester !== currentFilters.semester) {
        
        exportData = await fetchFilteredOsasData(currentFilters.year, currentFilters.semester);
      }

      if (!exportData || !exportData.services || !exportData.services.length) {
        alert('No data available to export for the selected filters.');
        return;
      }

      // Generate CSV content
      const csvContent = buildFilteredCsvExport(exportData);

      // Generate filename with filter context
      const date = new Date().toISOString().slice(0, 10);
      let filename = 'osas_service_feedback_report';
      
      if (currentFilters.year !== 'all') {
        filename += `_${currentFilters.year}`;
      }
      if (currentFilters.semester !== 'all') {
        filename += `_sem${currentFilters.semester}`;
      }
      if (currentFilters.year === 'all' && currentFilters.semester === 'all') {
        filename += '_all_time';
      }
      filename += `_${date}.csv`;

      // Download CSV
      downloadCsv(filename, csvContent);

      console.log('OSAS export completed successfully:', filename);

    } catch (error) {
      console.error('OSAS export failed:', error);
      alert(`Export failed: ${error.message}. Please try again.`);
    }
  }

  /* ---------------- Recent Feedback ---------------- */
  function truncate(str, n) {
    if (!str) return '';
    const s = String(str);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function sentimentClass(label) {
    const l = (label || '').toLowerCase();
    if (l === 'positive') return 'text-success';
    if (l === 'neutral') return 'text-warning';
    if (l === 'negative') return 'text-danger';
    return 'text-muted';
  }

  function renderRecentFeedback(items) {
    const list = document.getElementById('recent-feedback-list');
    if (!list) return;
    
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
      const response = await fetch(RECENT_FEEDBACK_URL, { 
        headers: { 'Accept': 'application/json' } 
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderRecentFeedback(data);
    } catch (err) {
      console.error('Failed to load recent feedback:', err);
      renderRecentFeedback([]);
    }
  }

  /* ---------------- Action Items & Recommendations ---------------- */
  function renderActionItems(data) {
    const dynamicTarget = document.getElementById('dynamic-action-items');
    const staticTarget = document.getElementById('action-items');
    const target = dynamicTarget || staticTarget;
    
    if (!target) {
      console.warn('No action items container found');
      return;
    }

    const services = (data?.services || []).map(s => {
      const p = Number(s.positive || 0);
      const u = Number(s.neutral || 0);
      const n = Number(s.negative || 0);
      const t = p + u + n;
      return {
        name: s.service || s.name || 'Unknown',
        pos: p,
        neu: u,
        neg: n,
        total: t,
        pctNeg: Number(s.percent_negative || (t ? Math.round((n / t) * 100) : 0)),
        pctNeu: t ? Math.round((u / t) * 100) : 0,
        pctPos: t ? Math.round((p / t) * 100) : 0,
        sat: t ? Math.round((p / t) * 100) : 0
      };
    }).filter(s => s.total > 0);

    if (!services.length) {
      target.innerHTML = createRecommendationCard('info', 'Info', 
        'Add feedback to generate personalized recommendations for service improvements.', 
        '#6c757d');
      return;
    }

    const recommendations = generateOSASRecommendations(services);

    if (!recommendations.length) {
      target.innerHTML = createRecommendationCard('excellent', 'Excellent', 
        'All OSAS services are performing within acceptable ranges. Continue maintaining current service quality standards.', 
        '#4bc0c0');
      return;
    }

    target.innerHTML = recommendations.map((rec, index) => {
      const isLast = index === recommendations.length - 1;
      const marginClass = isLast ? '' : ' mb-3';
      return createRecommendationCard(rec.type, rec.label, rec.message, rec.color, marginClass);
    }).join('');
  }

  function createRecommendationCard(type, label, message, color, extraClass = '') {
    const rgbaBackground = hexToRgba(color, 0.08);
    return `
      <div class="p-3 rounded-default border-start${extraClass}" 
           style="border-left: 8px solid ${color}; background: ${rgbaBackground};">
        <strong style="color: ${color};">${label}:</strong>
        ${message}
      </div>
    `;
  }

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function generateOSASRecommendations(services) {
    const recommendations = [];
    const config = {
      urgent: { negativeThreshold: 15, minSample: 3 },
      review: { neutralThreshold: 20, minSample: 5 }, 
      maintain: { positiveThreshold: 50, minSample: 3 },
      engagement: { totalFeedbackMin: 30 }
    };

    const byNegativeDesc = [...services].sort((a, b) => b.pctNeg - a.pctNeg);
    const byNeutralDesc = [...services].sort((a, b) => b.pctNeu - a.pctNeu);
    const byPositiveDesc = [...services].sort((a, b) => b.sat - a.sat);

    const mostNegative = byNegativeDesc[0];
    if (mostNegative && mostNegative.pctNeg >= config.urgent.negativeThreshold && mostNegative.total >= config.urgent.minSample) {
      recommendations.push({ 
        type: 'urgent', 
        priority: 1, 
        label: 'Urgent', 
        message: `${mostNegative.name} needs immediate attention, receiving ${mostNegative.pctNeg}% negative feedback. Address concerns as soon as possible to improve service quality.`, 
        color: '#ff6384' 
      });
    }

    const mostNeutral = byNeutralDesc[0];
    if (mostNeutral && mostNeutral.pctNeu >= config.review.neutralThreshold && mostNeutral.total >= config.review.minSample && !recommendations.find(r => r.message.includes(mostNeutral.name))) {
      recommendations.push({ 
        type: 'review', 
        priority: 2, 
        label: 'Review', 
        message: `${mostNeutral.name} has ${mostNeutral.pctNeu}% neutral feedback. Focus on converting these average experiences into positive outcomes through targeted improvements and engagement.`, 
        color: '#ffcd56' 
      });
    }

    const mostPositive = byPositiveDesc[0];
    if (mostPositive && mostPositive.total >= config.maintain.minSample) {
      recommendations.push({ 
        type: 'maintain', 
        priority: 3, 
        label: 'Maintain', 
        message: `${mostPositive.name} is showing excellent performance with ${mostPositive.sat}% satisfaction. Maintain current practices and recognize this achievement to sustain success.`, 
        color: '#4bc0c0' 
      });
    }

    const totalFeedback = services.reduce((sum, s) => sum + s.total, 0);
    if (totalFeedback < config.engagement.totalFeedbackMin) {
      recommendations.push({ 
        type: 'engagement', 
        priority: 4, 
        label: 'Engagement', 
        message: `Limited feedback participation detected (${totalFeedback} total responses). Consider implementing strategies to increase student engagement and feedback collection across all services.`, 
        color: '#8b5cf6' 
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /* ---------------- Baseline Dashboard Functions ---------------- */
  async function fetchBaselineThenRender() {
    if (isBaselineLoading) return;
    isBaselineLoading = true;
    
    try {
      const url = buildBaselineApiUrl();
      
      const response = await fetch(url, { 
        headers: { 'Accept': 'application/json' } 
      });
      
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
    if (isChartLoading) return;
    isChartLoading = true;
    
    markActiveChartMenu(chartRange.key);
    setChartRangeLabel();
    
    try {
      const url = buildChartApiUrl();
      
      const response = await fetch(url, { 
        headers: { 'Accept': 'application/json' } 
      });
      
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

  function renderBaseline(data) {
    if (!data) return;

    const total = Number(data.total || 0);
    const pos = Number(data.positive || 0);
    const neu = Number(data.neutral || 0);
    const neg = Number(data.negative || 0);
    const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

    const el = id => document.getElementById(id);

    // Update KPI cards
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
        const el = document.getElementById(`${id}-${kind}`);
        if (el) el.textContent = '0';
      });
      const sEl = document.getElementById(`${id}-satisfaction`);
      if (sEl) sEl.textContent = '0% Satisfaction';
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
      const id = nameToId(svc.name);
      if (!id) return;
      
      const p = Number(svc.positive || 0);
      const u = Number(svc.neutral || 0);
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

  /* ---------------- Range Handling ---------------- */
  function applyChartRange(key) {
    if (isChartLoading) return;
    
    const end = toISODate(today());
    let start = null;
    
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

  /* ---------------- Theme Change Observer ---------------- */
function observeThemeChanges() {
  let previousTheme = detectDarkMode();
  
  const observer = new MutationObserver((mutations) => {
    let shouldRerender = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && 
          (mutation.attributeName === 'class' || 
           mutation.attributeName === 'data-theme' || 
           mutation.attributeName === 'data-bs-theme')) {
        
        // Only rerender if the ACTUAL theme changed, not just any class
        const currentTheme = detectDarkMode();
        if (currentTheme !== previousTheme) {
          shouldRerender = true;
          previousTheme = currentTheme;
        }
      }
    });
    
    if (shouldRerender) {
      setTimeout(() => {
        if (baselineData) renderCharts(baselineData);
        if (chartData) renderCharts(chartData);
        if (cachedFilteredData) renderCharts(cachedFilteredData);
      }, 100);
    }
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-bs-theme']
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-bs-theme']
  });
}

/* ---------------- Event Handlers & Initialization ---------------- */
  function initializeEventHandlers() {
    const filterBtn = document.getElementById('filter-btn');
    const filterDrawer = document.getElementById('filter-drawer');
    const blurOverlay = document.getElementById('blur-overlay');
    const yearFilter = document.getElementById('year-filter');
    const semesterFilter = document.getElementById('semester-filter');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const exportBtn = document.getElementById('export-report-btn');

    // Drawer controls
    if (filterBtn) {
      filterBtn.addEventListener('click', showDrawer);
    }

    if (blurOverlay) {
      blurOverlay.addEventListener('click', hideDrawer);
    }

    // Close drawer when clicking outside of it
    document.addEventListener('click', function (e) {
      if (filterDrawer && filterDrawer.classList.contains('show')) {
        // Check if click is outside both the drawer and the filter button
        if (!filterDrawer.contains(e.target) && !filterBtn.contains(e.target)) {
          hideDrawer();
        }
      }
    });

    // Close drawer with ESC key
    document.addEventListener('keydown', function (keyEvent) {
      if (keyEvent.key === 'Escape' && filterDrawer && filterDrawer.classList.contains('show')) {
        hideDrawer();
      }
    });

    // Year filter selection
    if (yearFilter) {
      yearFilter.addEventListener('click', function (clickEvent) {
        if (clickEvent.target.classList.contains('filter-option')) {
          const clickedValue = clickEvent.target.getAttribute('data-value');

          if (clickedValue === '-') {
            resetFilters();
            return;
          }

          yearFilter.querySelectorAll('.filter-option').forEach(option => {
            option.classList.remove('active');
          });
          clickEvent.target.classList.add('active');
        }
      });
    }

    // Semester filter selection
    if (semesterFilter) {
      semesterFilter.addEventListener('click', function (clickEvent) {
        if (clickEvent.target.classList.contains('filter-option')) {
          semesterFilter.querySelectorAll('.filter-option').forEach(option => {
            option.classList.remove('active');
          });
          clickEvent.target.classList.add('active');
        }
      });
    }

    // Apply filters button
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', function () {
        applyCurrentFilters();
        hideDrawer();
      });
    }

    // Export button - FIXED TO USE FILTERED DATA
    if (exportBtn) {
      exportBtn.addEventListener('click', async function (exportEvent) {
        exportEvent.preventDefault();
        await exportFilteredOsasData();
      });
    }

    // Chart range selectors
    document.querySelectorAll('.osas-range').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const key = e.currentTarget.getAttribute('data-range') || 'all';
        applyChartRange(key);
      });
    });

    // Additional export buttons
    const exportDataItem = document.getElementById('osas-export-data');
    if (exportDataItem) {
      exportDataItem.addEventListener('click', async (e) => {
        e.preventDefault();
        await exportFilteredOsasData();
      });
    }

    const genReportItem = document.getElementById('osas-generate-report');
    if (genReportItem) {
      genReportItem.addEventListener('click', async (e) => {
        e.preventDefault();
        await exportFilteredOsasData();
      });
    }
  }

  /* ---------------- Global Compatibility Functions ---------------- */
  window.applyYearFilter = function (yearValue, semesterValue) {
    const yearFilter = document.getElementById('year-filter');
    const semesterFilter = document.getElementById('semester-filter');
    
    if (yearFilter && semesterFilter) {
      // Set year filter
      yearFilter.querySelectorAll('.filter-option').forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('data-value') === yearValue) {
          option.classList.add('active');
        }
      });

      // Set semester filter
      semesterFilter.querySelectorAll('.filter-option').forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('data-value') === semesterValue) {
          option.classList.add('active');
        }
      });

      // Update filter state and apply
      currentFilters.year = yearValue;
      currentFilters.semester = semesterValue;
      applyCurrentFilters();
    }
  };

  /* ---------------- Alpine.js Integration ---------------- */
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    document.addEventListener('alpine:init', () => {
      Alpine.data('searchCommand', () => ({
        openCommandResults: false,
        items: [],
        query: '',

        handleOpen() {
          this.openCommandResults = true;
          setTimeout(() => {
            const el = document.querySelector('[data-command-input]');
            if (el) el.focus();
          }, 50);
        },

        handleShortcut(event) {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            this.openCommandResults = true;
            setTimeout(() => {
              const el = document.querySelector('[data-command-input]');
              if (el) el.focus();
            }, 50);
          } else if (event.key === 'Escape') {
            this.openCommandResults = false;
          }
        },

        handleContentLoaded(ev) {
          try {
            if (typeof SimpleBar !== 'undefined') {
              document.querySelectorAll('[data-simplebar]').forEach(el => {
                if (!el.SimpleBar) new SimpleBar(el);
              });
            }
          } catch (e) { /* ignore */ }
        },

        async performSearch() {
          if (!this.query || this.query.trim().length < 1) {
            this.items = [];
            return;
          }
          
          const q = this.query.toLowerCase();
          const services = (cachedFilteredData?.services || baselineData?.services || [])
            .filter(s => (s.name || s.service || '').toLowerCase().includes(q));
          
          this.items = services.map(s => ({ 
            title: s.name || s.service, 
            subtitle: `${s.positive || 0} / ${s.negative || 0}` 
          }));
        },

        addItem(item) { this.items.push(item); },
        close() { this.openCommandResults = false; }
      }));
    });
  }

  /* ---------------- Main Initialization ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    console.log('OSAS Dashboard initializing...');

    // Initialize systems
    observeThemeChanges();
    initializeEventHandlers();
    setChartRangeLabel();
    markActiveChartMenu('all');

    // Load initial data
    fetchBaselineThenRender();
    fetchRecentFeedback();

    console.log('OSAS Dashboard initialized successfully');
  });

})();