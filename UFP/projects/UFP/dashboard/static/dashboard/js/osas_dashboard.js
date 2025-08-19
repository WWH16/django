// OSAS Dashboard JavaScript
// Save this file as: static/dashboard/js/osas_dashboard.js

document.addEventListener('DOMContentLoaded', function() {
  fetch('/api/osas-sentiment-dashboard/')
    .then(response => response.json())
    .then(data => {
      // KPI Cards
      document.getElementById('osas-positive-count').textContent = data.positive;
      document.getElementById('osas-neutral-count').textContent = data.neutral;
      document.getElementById('osas-negative-count').textContent = data.negative;
      document.getElementById('osas-total-count').textContent = data.total;

      // Percentages
      function percent(val, total) {
        return total ? Math.round((val / total) * 100) : 0;
      }
      document.getElementById('osas-positive-percent').textContent = percent(data.positive, data.total);
      document.getElementById('osas-neutral-percent').textContent = percent(data.neutral, data.total);
      document.getElementById('osas-negative-percent').textContent = percent(data.negative, data.total);

      // Pie chart percentages
      document.getElementById('osas-pie-positive-percent').textContent = percent(data.positive, data.total);
      document.getElementById('osas-pie-neutral-percent').textContent = percent(data.neutral, data.total);
      document.getElementById('osas-pie-negative-percent').textContent = percent(data.negative, data.total);

      // Bar Chart: Three bars per service (positive, neutral, negative)
      new Chart(document.getElementById('osasBarChart'), {
        type: 'bar',
        data: {
          labels: data.services.map(s => s.name),
          datasets: [
            {
              label: 'Positive',
              data: data.services.map(s => s.positive),
              backgroundColor: 'rgba(54, 162, 235, 0.5)',
              borderColor: 'rgba(54, 162, 235, 0.1)',
              borderWidth: 0,
              barPercentage: 0.98,         // Maximum thickness
              categoryPercentage: 0.98,    // Minimum space between service groups
              borderRadius: 0
            },
            {
              label: 'Neutral',
              data: data.services.map(s => s.neutral),
              backgroundColor: 'rgba(255, 206, 86, 0.5)',
              borderColor: 'rgba(255, 206, 86, 0.1)',
              borderWidth: 0,
              barPercentage: 0.98,
              categoryPercentage: 0.98,
              borderRadius: 0
            },
            {
              label: 'Negative',
              data: data.services.map(s => s.negative),
              backgroundColor: 'rgba(255, 99, 132, 0.5)',
              borderColor: 'rgba(255, 99, 132, 0.1)',
              borderWidth: 0,
              barPercentage: 0.98,
              categoryPercentage: 0.98,
              borderRadius: 0
            }
          ]
        },
        options: {
          indexAxis: 'x', // vertical bars
          plugins: {
            legend: { display: true }
          },
          scales: {
            x: { beginAtZero: true },
            y: { grid: { display: false } }
          }
        }
      });

      // Pie Chart (unchanged)
      new Chart(document.getElementById('osasPieChart'), {
        type: 'pie',
        data: {
          labels: ['Positive', 'Neutral', 'Negative'],
          datasets: [{
            data: [data.positive, data.neutral, data.negative],
            backgroundColor: [
              'rgba(54, 162, 235, 0.5)',   // blue
              'rgba(255, 206, 86, 0.5)',   // yellow
              'rgba(255, 99, 132, 0.5)'    // red
            ],
            borderColor: [
              'rgba(54, 162, 235, 0.1)',
              'rgba(255, 206, 86, 0.1)',
              'rgba(255, 99, 132, 0.1)'
            ],
            borderWidth: 0
          }]
        },
        options: {
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });

      // Service Cards
      function nameToId(n) {
        const s = (n || '').toLowerCase().trim();
        if (s === 'wi-fi') return 'wifi';
        if (s === 'college admission tests') return 'admission';
        if (s === 'scholarship') return 'scholarship';
        if (s === 'library facility') return 'library';
        return null;
      }

      (data.services || []).forEach(svc => {
        const id = nameToId(svc.name);
        if (!id) return;
        const p = Number(svc.positive || 0);
        const u = Number(svc.neutral || 0);
        const n = Number(svc.negative || 0);
        const t = p + u + n;
        const sat = t ? Math.round((p / t) * 100) : 0;

        const posEl = document.getElementById(`${id}-positive`);
        const neuEl = document.getElementById(`${id}-neutral`);
        const negEl = document.getElementById(`${id}-negative`);
        const satEl = document.getElementById(`${id}-satisfaction`);

        if (posEl) posEl.textContent = p.toLocaleString();
        if (neuEl) neuEl.textContent = u.toLocaleString();
        if (negEl) negEl.textContent = n.toLocaleString();
        if (satEl) satEl.textContent = `${sat}% Satisfaction`;
      });

      // Service Improvement Priority
      function renderServicePriority(services) {
        const container = document.getElementById('service-priority-list');
        if (!container) return;
        container.innerHTML = '';
        const sorted = [...services].sort((a, b) => b.percent_negative - a.percent_negative);
        sorted.forEach(svc => {
          const pctNeg = svc.percent_negative;
          const barClass = pctNeg >= 20 ? 'bg-danger' : pctNeg >= 10 ? 'bg-warning' : pctNeg >= 5 ? 'bg-info' : 'bg-success';
          const priority = pctNeg >= 20 ? 'Urgent' : pctNeg >= 10 ? 'Medium' : pctNeg >= 5 ? 'Low' : 'Excellent';
          container.insertAdjacentHTML('beforeend', `
            <h4 class="small fw-bold">${svc.name}<span class="float-end">${priority}</span></h4>
            <div class="progress mb-4"><div class="progress-bar ${barClass}" style="width:${pctNeg}%"></div></div>
          `);
        });
      }
      renderServicePriority(data.services);

      // Recent Feedback
      function sentimentClass(label) {
        const l = (label || '').toLowerCase();
        if (l === 'positive') return 'text-success';
        if (l === 'neutral')  return 'text-warning';
        if (l === 'negative') return 'text-danger';
        return 'text-muted';
      }
      function truncate(str, n) {
        if (!str) return '';
        const s = String(str);
        return s.length > n ? s.slice(0, n - 1) + '…' : s;
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
            <div class="row align-items-center no-gutters">
              <div class="col me-2">
                <h6 class="mb-0"><strong>${it.service || 'Unknown Service'}</strong></h6>
                <span class="text-xs ${sentimentClass(it.sentiment)}">${it.sentiment || 'Unknown'} Sentiment</span>
                <p class="text-xs text-muted mb-0">"${truncate(it.comments || '', 90)}"</p>
              </div>
            </div>
          </li>
        `).join('');
      }
      fetch('/api/recent-osas-feedback/?limit=3')
        .then(response => response.json())
        .then(renderRecentFeedback);

      // Action Items & Recommendations
      function renderActionItems(data) {
        const target = document.getElementById('action-items');
        if (!target) return;

        const svcs = (data?.services || []).map(s => ({
          name: s.name || 'Unknown',
          pos: Number(s.positive || 0),
          neu: Number(s.neutral || 0),
          neg: Number(s.negative || 0),
          pctNeg: Number(s.percent_negative || 0),
          sat: (() => {
            const t = Number(s.positive || 0) + Number(s.neutral || 0) + Number(s.negative || 0);
            return t ? Math.round((Number(s.positive || 0) / t) * 100) : 0;
          })()
        }));

        if (!svcs.length || svcs.every(s => (s.pos + s.neu + s.neg) === 0)) {
          target.innerHTML = `
            <div class="alert alert-info" role="alert">
              <strong>No data:</strong> Add feedback to generate recommendations.
            </div>`;
          return;
        }

        const byPctNegDesc = [...svcs].sort((a,b) => b.pctNeg - a.pctNeg);
        const bySatisfactionDesc = [...svcs].sort((a,b) => b.sat - a.sat || a.pctNeg - b.pctNeg);
        const byNeutralDesc = [...svcs].sort((a,b) => b.neu - a.neu || a.pctNeg - b.pctNeg);
        const URGENT_MIN = 14;

        const alerts = [];
        const worst = byPctNegDesc[0];
        if (worst && worst.pctNeg >= URGENT_MIN) {
          alerts.push({
            level: 'danger',
            title: 'Urgent:',
            text: `${worst.name} needs immediate attention – ${worst.pctNeg}% negative feedback`
          });
        }
        const mostNeutral = byNeutralDesc[0];
        if (mostNeutral && mostNeutral.neu > 0) {
          alerts.push({
            level: 'warning',
            title: 'Review:',
            text: `${mostNeutral.name} has the most neutral feedback (${mostNeutral.neu} comments) – review to convert “meh” experiences into positives`
          });
        }
        const best = bySatisfactionDesc[0];
        if (best) {
          alerts.push({
            level: 'success',
            title: 'Maintain:',
            text: `${best.name} showing excellent performance – ${best.sat}% satisfaction`
          });
        }
        if (!alerts.length) {
          alerts.push({
            level: 'secondary',
            title: 'Info:',
            text: 'Not enough data to form recommendations yet.'
          });
        }
        target.innerHTML = alerts.map(a => `
          <div class="alert alert-${a.level}" role="alert">
            <strong>${a.title}</strong> ${a.text}
          </div>
        `).join('');
      }
      renderActionItems(data);
    })
    .catch(err => {
      console.error('Dashboard data fetch error:', err);
    });
});