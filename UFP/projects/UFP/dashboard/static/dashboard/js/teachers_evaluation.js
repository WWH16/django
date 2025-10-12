/* Teacher Evaluation Dashboard - FIXED Recommendations Loading
   - Fixed recommendations to use actual data sources (baselineData/cachedFilteredData)
   - Removed dependency on non-existent 'cache' object
   - Added proper data flow from API to recommendations
*/
(function () {
  'use strict';

  // ======================
  // GLOBAL STATE
  // ======================
  let teacherPieChart, teacherBarChart;
  let baselineData = null;
  let isBaselineLoading = false;
  let chartData = null;
  let isChartLoading = false;

  // Global cache object matching the working pattern
  const cache = {
    summary: null,
    programs: null,
    improvement: null,
    recent: null,
    teachers: null
  };

  // Filter state tracking - CRITICAL for export consistency
  let currentFilters = {
    year: 'all',
    semester: 'all'
  };

  // Cache for filtered data - ensures export uses the same data as display
  let cachedFilteredData = null;

  // Loading state tracker
  let isLoadingData = false;


  /* ---------------- API Functions ---------------- */
  async function fetchFilteredTeacherData(selectedYear = 'all', selectedSemester = 'all') {
    try {
      const apiUrl = '/api/teacher-evaluation-by-semester/';
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
      console.log('Teacher Filter API Request:', requestUrl);

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
      console.log('Teacher Filter API Response:', data);

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
      console.error('Teacher Filter API Error:', error);
      throw error;
    }
  }

  const RECENT_EVALUATIONS_URL = '/api/recent-teacher-evaluations/?limit=5';

  /* ---------------- Theme Detection & Chart Colors ---------------- */
  function detectDarkMode() {
    const html = document.documentElement;
    const body = document.body;

    if (html.classList.contains('dark') ||
      html.classList.contains('dark-mode') ||
      body.classList.contains('dark') ||
      body.classList.contains('dark-mode')) {
      return true;
    }

    if (html.getAttribute('data-theme') === 'dark' ||
      html.getAttribute('data-bs-theme') === 'dark' ||
      body.getAttribute('data-theme') === 'dark' ||
      body.getAttribute('data-bs-theme') === 'dark') {
      return true;
    }

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
    try {
      const totalDescEl = document.getElementById('teacher-total-description');
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
    } catch (error) {
      console.error('Error updating total description:', error);
    }
  }

  function updateTeacherCards(responseData) {
    try {
      console.log('updateTeacherCards received:', responseData);

      let totalPositive = 0;
      let totalNeutral = 0;
      let totalNegative = 0;
      let grandTotal = 0;

      // Calculate totals from programs array
      if (responseData && Array.isArray(responseData.programs)) {
        responseData.programs.forEach(programItem => {
          const p = Number(programItem.positive || 0);
          const n = Number(programItem.neutral || 0);
          const neg = Number(programItem.negative || 0);
          totalPositive += p;
          totalNeutral += n;
          totalNegative += neg;
          grandTotal += (p + n + neg); // Calculate from components
        });
      }

      console.log('Calculated totals:', { totalPositive, totalNeutral, totalNegative, grandTotal });

      // Update KPI cards
      const elements = {
        positive: document.getElementById('teacher-positive-count'),
        neutral: document.getElementById('teacher-neutral-count'),
        negative: document.getElementById('teacher-negative-count'),
        total: document.getElementById('teacher-total-count')
      };

      if (elements.positive) elements.positive.textContent = totalPositive.toLocaleString();
      if (elements.neutral) elements.neutral.textContent = totalNeutral.toLocaleString();
      if (elements.negative) elements.negative.textContent = totalNegative.toLocaleString();
      if (elements.total) elements.total.textContent = grandTotal.toLocaleString();

      // Update percentages (always update, even when zero)
      const posPercent = grandTotal > 0 ? Math.round((totalPositive / grandTotal) * 100) : 0;
      const neuPercent = grandTotal > 0 ? Math.round((totalNeutral / grandTotal) * 100) : 0;
      const negPercent = grandTotal > 0 ? Math.round((totalNegative / grandTotal) * 100) : 0;

      const percentTextElements = [
        { id: 'teacher-positive-percent', value: `${posPercent}% of evaluations` },
        { id: 'teacher-neutral-percent', value: `${neuPercent}% of evaluations` },
        { id: 'teacher-negative-percent', value: `${negPercent}% of evaluations` }
      ];

      percentTextElements.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) element.textContent = item.value;
      });

      const percentPieElements = [
        { id: 'teacher-pie-positive-percent', value: posPercent },
        { id: 'teacher-pie-neutral-percent', value: neuPercent },
        { id: 'teacher-pie-negative-percent', value: negPercent }
      ];

      percentPieElements.forEach(item => {
        const element = document.getElementById(item.id);
        if (element) element.textContent = item.value;
      });

      // Get programs array
      const programs = responseData?.programs || [];

      const programCardMapping = {
        bsit: ['bsit', 'information technology'],
        bscs: ['bscs', 'computer science'],
        bsemc: ['bsemc', 'entertainment', 'multimedia']
      };

      // FIRST: Reset all program cards to zero
      Object.keys(programCardMapping).forEach(cardPrefix => {
        const programEl = {
          positive: document.getElementById(`${cardPrefix}-positive`),
          neutral: document.getElementById(`${cardPrefix}-neutral`),
          negative: document.getElementById(`${cardPrefix}-negative`),
          rating: document.getElementById(`${cardPrefix}-rating`)
        };

        if (programEl.positive) programEl.positive.textContent = '0';
        if (programEl.neutral) programEl.neutral.textContent = '0';
        if (programEl.negative) programEl.negative.textContent = '0';
        if (programEl.rating) programEl.rating.textContent = '0% Positive Sentiments';
      });

      // SECOND: Update with actual data if available
      Object.keys(programCardMapping).forEach(cardPrefix => {
        const programEl = {
          positive: document.getElementById(`${cardPrefix}-positive`),
          neutral: document.getElementById(`${cardPrefix}-neutral`),
          negative: document.getElementById(`${cardPrefix}-negative`),
          rating: document.getElementById(`${cardPrefix}-rating`)
        };

        const matchingProgram = programs.find(program =>
          programCardMapping[cardPrefix].some(keyword =>
            (program.name || program.program || '').toLowerCase().includes(keyword)
          )
        );

        if (matchingProgram) {
          const pos = Number(matchingProgram.positive || 0);
          const neu = Number(matchingProgram.neutral || 0);
          const neg = Number(matchingProgram.negative || 0);
          const total = pos + neu + neg;
          const ratingPercent = total > 0 ? Math.round((pos / total) * 100) : 0;

          if (programEl.positive) programEl.positive.textContent = pos;
          if (programEl.neutral) programEl.neutral.textContent = neu;
          if (programEl.negative) programEl.negative.textContent = neg;
          if (programEl.rating) {
            programEl.rating.textContent = `${ratingPercent}% Positive Sentiments`;
          }
        }
      });

      updateTotalDescription();
    } catch (error) {
      console.error('Error updating teacher cards:', error);
    }
  }

  /* ---------------- Chart Rendering ---------------- */
  function renderCharts(data) {
    try {
      if (!data || !window.Chart) {
        console.warn('Missing data or Chart.js library');
        return;
      }

      const CHART_COLORS = getChartColors();

      let total = 0, pos = 0, neu = 0, neg = 0;
      if (data.programs && Array.isArray(data.programs)) {
        data.programs.forEach(program => {
          pos += Number(program.positive || 0);
          neu += Number(program.neutral || 0);
          neg += Number(program.negative || 0);
          total += Number(program.total || 0);
        });
      }

      const pieCanvas = document.getElementById('teacherPieChart');
      if (pieCanvas && pieCanvas.getContext) {
        const pieCtx = pieCanvas.getContext('2d');
        const pieData = [pos, neu, neg];

        if (teacherPieChart && typeof teacherPieChart.destroy === 'function') {
          teacherPieChart.destroy();
          teacherPieChart = null;
        }

        teacherPieChart = new Chart(pieCtx, {
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

      const barCanvas = document.getElementById('teacherBarChart');
      if (barCanvas && barCanvas.getContext && data.programs) {
        const ctx = barCanvas.getContext('2d');
        const programLabels = data.programs.map(p => p.name || p.program);
        const positiveData = data.programs.map(p => Number(p.positive || 0));
        const neutralData = data.programs.map(p => Number(p.neutral || 0));
        const negativeData = data.programs.map(p => Number(p.negative || 0));

        if (teacherBarChart && typeof teacherBarChart.destroy === 'function') {
          teacherBarChart.destroy();
          teacherBarChart = null;
        }

        teacherBarChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: programLabels,
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
    } catch (err) {
      console.error('Chart rendering error:', err);
    }
  }

  /* ---------------- Filter Management ---------------- */
  function showDrawer() {
    try {
      const filterDrawer = document.getElementById('filter-drawer');
      const blurOverlay = document.getElementById('blur-overlay');

      if (filterDrawer) filterDrawer.classList.add('show');
      if (blurOverlay) blurOverlay.classList.add('show');
      document.body.classList.add('filter-open');
    } catch (error) {
      console.error('Error showing drawer:', error);
    }
  }

  function hideDrawer() {
    try {
      const filterDrawer = document.getElementById('filter-drawer');
      const blurOverlay = document.getElementById('blur-overlay');

      if (filterDrawer) filterDrawer.classList.remove('show');
      if (blurOverlay) blurOverlay.classList.remove('show');
      document.body.classList.remove('filter-open');
    } catch (error) {
      console.error('Error hiding drawer:', error);
    }
  }

  function resetFilters() {
    try {
      const yearFilter = document.getElementById('year-filter');
      const semesterFilter = document.getElementById('semester-filter');

      if (yearFilter) {
        yearFilter.querySelectorAll('.filter-option').forEach(item => {
          item.classList.remove('active');
          if (item.getAttribute('data-value') === 'all') {
            item.classList.add('active');
          }
        });
      }

      if (semesterFilter) {
        semesterFilter.querySelectorAll('.filter-option').forEach(item => {
          item.classList.remove('active');
          if (item.getAttribute('data-value') === 'all') {
            item.classList.add('active');
          }
        });
      }

      currentFilters.year = 'all';
      currentFilters.semester = 'all';

      applyCurrentFilters();
      hideDrawer();
    } catch (error) {
      console.error('Error resetting filters:', error);
    }
  }

async function applyCurrentFilters() {
  if (isLoadingData) {
    console.log('Already loading data, skipping duplicate request');
    return;
  }

  try {
    isLoadingData = true;

    const yearFilter = document.getElementById('year-filter');
    const semesterFilter = document.getElementById('semester-filter');

    let activeYear = yearFilter?.querySelector('.filter-option.active')?.getAttribute('data-value') || 'all';
    let activeSemester = semesterFilter?.querySelector('.filter-option.active')?.getAttribute('data-value') || 'all';

    if (activeSemester && activeSemester !== 'all') {
      activeSemester = activeSemester.replace(/[^\d]/g, '');
      if (!activeSemester || activeSemester === '') {
        activeSemester = 'all';
      }
    }

    currentFilters.year = activeYear;
    currentFilters.semester = activeSemester;

    console.log('Applying Teacher filters:', currentFilters);

    // Fetch main data
    const data = await fetchFilteredTeacherData(activeYear, activeSemester);

    // Populate cache for recommendations
    cache.programs = { programs: data.programs || [] };
    cache.summary = data;

    // Update UI with main data
    updateTeacherCards(data);
    renderCharts(data);

    // Load all additional data in sequence with proper awaits
    await loadTeacherPerformanceData(activeYear, activeSemester);
    await fetchTeacherPriority(activeYear, activeSemester);
    await fetchRecentEvaluations();

    // Small delay to ensure cache is fully updated with filter keys
    await new Promise(resolve => setTimeout(resolve, 50));

    // Load recommendations after all data is ready and cached
    loadTeacherRecommendations();

    console.log('Teacher filters applied successfully');

  } catch (error) {
    console.error('Failed to apply Teacher filters:', error);
    alert('Failed to load Teacher data: ' + error.message);
  } finally {
    isLoadingData = false;
  }
}

  /* ---------------- Recent Evaluations ---------------- */
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

  function renderRecentEvaluations(items) {
    try {
      const list = document.getElementById('recent-evaluations-list');
      if (!list) return;

      // ✅ ADD THIS LINE - Always clear first (zero-out pattern)
      list.innerHTML = '';

      if (!items || !items.length) {
        list.innerHTML = `<li class="list-group-item text-muted">No recent evaluations.</li>`;
        return;
      }

      list.innerHTML = items.map(it => `
      <li class="list-group-item">
        <div class="row align-items-center">
          <div class="col me-2">
            <h6 class="mb-0"><strong>${it.teacher || 'Teacher'}${it.program ? ` - ${it.program}` : ''}</strong></h6>
            <span class="text-xs ${sentimentClass(it.sentiment)}">${it.sentiment || 'Unknown'} Sentiment</span>
            <p class="text-xs text-muted mb-0">"${truncate(it.comments || '', 90)}"</p>
          </div>
        </div>
      </li>`).join('');
    } catch (error) {
      console.error('Error rendering recent evaluations:', error);
    }
  }

  async function fetchRecentEvaluations() {
    try {
      // Build URL with current filters
      const url = new URL('/api/recent-teacher-evaluations/', window.location.origin);
      url.searchParams.set('limit', '5');

      // Add year filter
      if (currentFilters.year && currentFilters.year !== 'all') {
        url.searchParams.set('year', currentFilters.year);
        url.searchParams.set('all_time', 'false');
      } else {
        url.searchParams.set('all_time', 'true');
      }

      // Add semester filter
      if (currentFilters.semester && currentFilters.semester !== 'all') {
        url.searchParams.set('semester', currentFilters.semester);
      }

      console.log('Fetching recent evaluations with URL:', url.toString());

      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log('Recent evaluations received:', data);
      renderRecentEvaluations(data);
    } catch (err) {
      console.error('Failed to load recent evaluations:', err);
      renderRecentEvaluations([]);
    }
  }

  /* ---------------- Teacher Recommendations - COUNT-BASED VERSION ---------------- */
  /* ---------------- Helper Functions for Recommendations ---------------- */
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
/* ---------------- Teacher Recommendations - FIXED VERSION ---------------- */
function loadTeacherRecommendations() {
  const wrap = document.getElementById('static-recos');
  if (!wrap) {
    console.error('Recommendations container not found!');
    return;
  }

  wrap.innerHTML = '';

  const currentFilterKey = `${currentFilters.year}_${currentFilters.semester}`;
  let teachers = [];
  let programs = [];

  if (cachedFilteredData && cachedFilteredData.programs) {
    programs = cachedFilteredData.programs;
    
    // ✅ STRICT CHECK: Only use teachers if filter matches EXACTLY
    if (cache.teachers && 
        Array.isArray(cache.teachers) && 
        cache.teachers.length > 0 && 
        cache.teachers._filterKey === currentFilterKey) {
      teachers = cache.teachers;
      console.log('✅ Using teacher data matching filter:', currentFilterKey);
    } else {
      console.log('⚠️ Teacher data filter mismatch or empty. Current:', currentFilterKey, 'Cached:', cache.teachers?._filterKey);
      console.log('Showing only program-level recommendations until teacher data loads.');
      teachers = []; // ✅ Force empty to prevent wrong data
    }
  } else if (baselineData && baselineData.programs) {
    programs = baselineData.programs;
    if (cache.teachers && cache.teachers._filterKey === 'all_all') {
      teachers = cache.teachers;
    }
    console.log('Loading recommendations from BASELINE data:', { teachers: teachers.length, programs: programs.length });
  } else {
    programs = (cache.programs && cache.programs.programs) ? cache.programs.programs : [];
    console.log('Loading recommendations from CACHE data:', { teachers: teachers.length, programs: programs.length });
  }

  if (!teachers.length && !programs.length) {
    wrap.innerHTML = createRecommendationCard('info', 'Info',
      'Add evaluations to generate personalized recommendations for teacher improvements.',
      '#6c757d');
    return;
  }

  const REC_MIN_SAMPLE = 1;

  // Helper function to pick item with most count
  const pickMostByCount = (arr, keyName) => {
    let best = null;
    arr.forEach((it) => {
      const pos = Number(it.positive || 0);
      const neu = Number(it.neutral || 0);
      const neg = Number(it.negative || 0);
      const tot = pos + neu + neg;

      if (tot < REC_MIN_SAMPLE) return;

      let count = 0;
      if (keyName === 'positive') count = pos;
      if (keyName === 'neutral') count = neu;
      if (keyName === 'negative') count = neg;

      if (!best || count > best.count) {
        best = { ...it, total: tot, count };
      }
    });
    return best;
  };

  const mostNegTeacher = pickMostByCount(teachers, 'negative');
  const mostNeuTeacher = pickMostByCount(teachers, 'neutral');
  const mostPosTeacher = pickMostByCount(teachers, 'positive');
  const mostNegProgram = pickMostByCount(programs, 'negative');

  // Generate recommendations
  if (mostNegTeacher) {
    const tLabel = `${mostNegTeacher.teacher || mostNegTeacher.teacher_name || 'Teacher'}${mostNegTeacher.program ? `, ${mostNegTeacher.program}` : ''}`;
    const negCount = Number(mostNegTeacher.negative || 0);
    const countText = negCount === 1 ? 'negative evaluation' : 'negative evaluations';
    wrap.insertAdjacentHTML('beforeend',
      createRecommendationCard('urgent', 'Urgent',
        `Professor ${tLabel} has received the most negative feedback, with ${negCount} ${countText}. Immediate action is recommended to address concerns.`,
        '#ff6384', ' mb-3'));
  }

  if (mostNeuTeacher) {
    const tLabel = `${mostNeuTeacher.teacher || mostNeuTeacher.teacher_name || 'Teacher'}${mostNeuTeacher.program ? `, ${mostNeuTeacher.program}` : ''}`;
    const neuCount = Number(mostNeuTeacher.neutral || 0);
    const countText = neuCount === 1 ? 'neutral evaluation' : 'neutral evaluations';
    wrap.insertAdjacentHTML('beforeend',
      createRecommendationCard('review', 'Review',
        `Professor ${tLabel} stands out with the highest neutral feedback at ${neuCount} ${countText}. This suggests a need to review and provide guidance.`,
        '#ffcd56', ' mb-3'));
  }

  if (mostPosTeacher) {
    const tLabel = `${mostPosTeacher.teacher || mostPosTeacher.teacher_name || 'Teacher'}${mostPosTeacher.program ? `, ${mostPosTeacher.program}` : ''}`;
    const posCount = Number(mostPosTeacher.positive || 0);
    const countText = posCount === 1 ? 'positive evaluation' : 'positive evaluations';
    wrap.insertAdjacentHTML('beforeend',
      createRecommendationCard('recognize', 'Recognize',
        `Professor ${tLabel} has received the most positive evaluations, with ${posCount} ${countText}. Recognition is recommended.`,
        '#4bc0c0', ' mb-3'));
  }

  if (mostNegProgram) {
    const pLabel = mostNegProgram.name || mostNegProgram.program || 'Program';
    const negCount = Number(mostNegProgram.negative || 0);
    const countText = negCount === 1 ? 'negative evaluation' : 'negative evaluations';
    wrap.insertAdjacentHTML('beforeend',
      createRecommendationCard('support', 'Support',
        `The ${pLabel} Department received the highest negative evaluations, with ${negCount} ${countText}. Support initiatives are advised.`,
        '#3b82f6'));
  }

  // Fallback if no recommendations generated
  if (!wrap.children.length) {
    wrap.innerHTML = createRecommendationCard('info', 'Info',
      'Insufficient data for specific recommendations. Continue collecting evaluations.',
      '#6c757d');
  }
}

/* ---------------- Teacher Performance Data (for recommendations) ---------------- */
async function loadTeacherPerformanceData(year = 'all', semester = null) {
  let url = '/api/teacher-performance-by-teacher/';
  const params = [];

  if (year && year !== 'all') {
    params.push(`year=${encodeURIComponent(year)}`);
  }
  if (semester && semester !== 'all') {
    params.push(`semester=${encodeURIComponent(semester)}`);
  }

  if (params.length > 0) {
    url += '?' + params.join('&');
  }

  try {
    console.log('Fetching teacher performance data:', url);
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Teacher performance API failed:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // TAG THE DATA WITH FILTER KEY for matching
    const filterKey = `${year || 'all'}_${semester || 'all'}`;

    if (Array.isArray(data)) {
      cache.teachers = data;
      cache.teachers._filterKey = filterKey;
      console.log('Teacher performance data loaded (array):', data.length, 'filter:', filterKey);
    } else if (data.teachers && Array.isArray(data.teachers)) {
      cache.teachers = data.teachers;
      cache.teachers._filterKey = filterKey;
      console.log('Teacher performance data loaded (object):', data.teachers.length, 'filter:', filterKey);
    } else {
      console.error('Unexpected data format from API:', data);
      cache.teachers = [];
      cache.teachers._filterKey = filterKey;
    }

    return cache.teachers;
  } catch (error) {
    console.error('Teacher performance loading failed:', error);
    cache.teachers = [];
    return [];
  }
}

  /* ---------------- Teacher Priority List ---------------- */
  async function fetchTeacherPriority(year = 'all', semester = 'all') {
    try {
      let url = '/api/teacher-improvement-priority/';
      const params = [];

      // Add year parameter
      if (year && year !== 'all') {
        params.push(`year=${encodeURIComponent(year)}`);
        params.push('all_time=false');
      } else {
        params.push('all_time=true');
      }

      // Add semester parameter
      if (semester && semester !== 'all') {
        params.push(`semester=${encodeURIComponent(semester)}`);
      }

      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      console.log('Fetching teacher priority:', url);

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Priority API failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // Debug logs
      console.log('Priority API returned:', data);
      console.log('Is array?', Array.isArray(data));
      console.log('Length:', data?.length);

      renderTeacherPriority(data);
    } catch (err) {
      console.error('Failed to load teacher priority:', err);
      renderTeacherPriority([]);
    }
  }

  function renderTeacherPriority(priorityList) {
    try {
      const list = document.getElementById('teacher-priority-list');
      if (!list) return;

      // ✅ THIS LINE MUST BE HERE - Always clear first
      list.innerHTML = '';

      if (!priorityList || !priorityList.length) {
        list.innerHTML = '<p class="text-muted text-center py-4">No data available for selected filters.</p>';
        return;
      }

      // Rest of existing code...
      priorityList.forEach(item => {
        let priorityClass = '';
        let badgeText = '';

        if (item.priority === 'Urgent') {
          priorityClass = 'is-urgent';
          badgeText = 'Urgent';
        } else if (item.priority === 'Medium') {
          priorityClass = 'is-review';
          badgeText = 'Medium';
        } else if (item.priority === 'Low') {
          priorityClass = 'is-maintain';
          badgeText = 'Low';
        }

        const teacherLabel = item.teacher || 'Unknown Teacher';
        const programLabel = item.program ? ` (${item.program})` : '';
        const negativeCount = item.negative_count || 0;
        const countText = negativeCount === 1 ? 'negative evaluation' : 'negative evaluations';

        list.insertAdjacentHTML('beforeend', `
        <div class="priority-item ${priorityClass}">
          <div class="pri-left">
            <div class="teacher-name">${teacherLabel.toUpperCase()}</div>
            <div class="teacher-program">${programLabel}</div>
            <div class="teacher-feedback-info">${negativeCount} ${countText}</div>
          </div>
          <span class="priority-badge ${priorityClass}">${badgeText}</span>
        </div>
      `);
      });
    } catch (error) {
      console.error('Error rendering teacher priority:', error);
    }
  }

  /* ---------------- Baseline Dashboard Functions ---------------- */
  /* ---------------- Baseline Dashboard Functions ---------------- */
  async function fetchBaselineThenRender() {
    if (isBaselineLoading) return;
    isBaselineLoading = true;

    try {
      const data = await fetchFilteredTeacherData('all', 'all');

      if (!data) throw new Error('No data received');

      baselineData = data;

      // Populate cache for recommendations
      cache.programs = { programs: data.programs || [] };
      cache.summary = data;

      updateTeacherCards(data);
      renderCharts(data);

      // ✅ LOAD TEACHER DATA FIRST, THEN LOAD PRIORITY AND RECOMMENDATIONS
      await loadTeacherPerformanceData('all', 'all');
      await fetchTeacherPriority('all', 'all');  // ✅ Add await here
      loadTeacherRecommendations();

    } catch (err) {
      console.error('Failed to load baseline dashboard:', err);
      alert('Sorry—failed to load the dashboard. Please refresh the page.');
    } finally {
      isBaselineLoading = false;
    }
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

          const currentTheme = detectDarkMode();
          if (currentTheme !== previousTheme) {
            shouldRerender = true;
            previousTheme = currentTheme;
          }
        }
      });

      if (shouldRerender) {
        console.log('Theme changed, re-rendering charts');
        setTimeout(() => {
          try {
            if (baselineData) renderCharts(baselineData);
            if (chartData) renderCharts(chartData);
            if (cachedFilteredData) renderCharts(cachedFilteredData);
          } catch (error) {
            console.error('Error re-rendering charts after theme change:', error);
          }
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
    try {
      const filterBtn = document.getElementById('filter-btn');
      const filterDrawer = document.getElementById('filter-drawer');
      const blurOverlay = document.getElementById('blur-overlay');
      const yearFilter = document.getElementById('year-filter');
      const semesterFilter = document.getElementById('semester-filter');
      const applyFiltersBtn = document.getElementById('apply-filters');

      if (filterBtn) {
        filterBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showDrawer();
        });
      }

      if (blurOverlay) {
        blurOverlay.addEventListener('click', hideDrawer);
      }

      document.addEventListener('click', function (e) {
        if (filterDrawer && filterDrawer.classList.contains('show')) {
          if (!filterDrawer.contains(e.target) &&
            (!filterBtn || !filterBtn.contains(e.target))) {
            hideDrawer();
          }
        }
      });

      document.addEventListener('keydown', function (keyEvent) {
        if (keyEvent.key === 'Escape' &&
          filterDrawer &&
          filterDrawer.classList.contains('show')) {
          hideDrawer();
        }
      });

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

      if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', function () {
          applyCurrentFilters();
          hideDrawer();
        });
      }
    } catch (error) {
      console.error('Error initializing event handlers:', error);
    }
  }

  /* ---------------- Global Compatibility Functions ---------------- */
  window.applyYearFilter = function (yearValue, semesterValue) {
    try {
      const yearFilter = document.getElementById('year-filter');
      const semesterFilter = document.getElementById('semester-filter');

      if (yearFilter && semesterFilter) {
        yearFilter.querySelectorAll('.filter-option').forEach(option => {
          option.classList.remove('active');
          if (option.getAttribute('data-value') === yearValue) {
            option.classList.add('active');
          }
        });

        semesterFilter.querySelectorAll('.filter-option').forEach(option => {
          option.classList.remove('active');
          if (option.getAttribute('data-value') === semesterValue) {
            option.classList.add('active');
          }
        });

        currentFilters.year = yearValue;
        currentFilters.semester = semesterValue;
        applyCurrentFilters();
      }
    } catch (error) {
      console.error('Error applying year filter:', error);
    }
  };

  /* ---------------- Main Initialization ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    console.log('Teacher Evaluation Dashboard initializing...');

    try {
      observeThemeChanges();
      initializeEventHandlers();

      fetchBaselineThenRender();
      fetchRecentEvaluations();
      fetchTeacherPriority('all', 'all');  // ✅ Add parameters

      console.log('Teacher Evaluation Dashboard initialized successfully');
    } catch (error) {
      console.error('Fatal error during initialization:', error);
      alert('Failed to initialize dashboard. Please refresh the page.');
    }
  });

  window.addEventListener('beforeunload', function () {
    try {
      if (teacherPieChart && typeof teacherPieChart.destroy === 'function') {
        teacherPieChart.destroy();
      }
      if (teacherBarChart && typeof teacherBarChart.destroy === 'function') {
        teacherBarChart.destroy();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });

})();