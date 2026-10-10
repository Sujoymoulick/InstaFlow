/**
 * Instaflow SEO Suite - Scorecard Charts (Grade Rings & 5-Axis Radar Pentagram)
 * Zero external chart dependencies - 100% native inline SVG with full accessibility.
 */

import { SCORECARD_GROUPS } from '../lib/score/scorecard.js';

/**
 * Pure SVG generator for standalone reports, PDF prints, and embeds
 */
export function renderScorecardSVG(scorecard, options = {}) {
  const width = options.width || 760;
  const height = options.height || 260;
  const categories = scorecard.categories || [];

  // Left: 5 Grade Rings (width ~420), Right: 5-Axis Radar (width ~300)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" class="seo-scorecard-svg" role="img" aria-label="SEO Audit Scorecard and Category Balance Chart">`;
  svg += `<style>
    .ring-track { fill: none; stroke: #e2e8f0; stroke-width: 7; }
    .ring-arc { fill: none; stroke-width: 7; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; }
    .ring-grade { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; font-weight: 800; fill: #1e293b; text-anchor: middle; dominant-baseline: central; }
    .ring-score { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 600; fill: #64748b; text-anchor: middle; }
    .ring-label { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; font-weight: 700; text-anchor: middle; fill: #475569; }
    .radar-grid { fill: none; stroke: #cbd5e1; stroke-dasharray: 3,3; stroke-width: 1; }
    .radar-axis { stroke: #94a3b8; stroke-width: 1; stroke-dasharray: 2,2; }
    .radar-polygon { fill: rgba(99, 102, 241, 0.25); stroke: #6366f1; stroke-width: 2.5; stroke-linejoin: round; }
    .radar-point { fill: #4f46e5; stroke: #ffffff; stroke-width: 2; }
    .radar-label { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 10px; font-weight: 700; fill: #334155; }
    .timestamp { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; fill: #94a3b8; }
  </style>`;

  // Render 5 rings on the left
  const ringRadius = 26;
  const circumference = 2 * Math.PI * ringRadius;
  const startX = 45;
  const stepX = 74;
  const ringCenterY = 70;

  categories.forEach((cat, idx) => {
    const cx = startX + (idx * stepX);
    const cy = ringCenterY;
    const isNA = cat.score === null || cat.grade === 'N/A';
    const scoreVal = isNA ? 0 : Math.max(0, Math.min(100, cat.score));
    const strokeColor = isNA ? '#94a3b8' : cat.color || '#6366f1';
    const arcLength = (scoreVal / 100) * circumference;
    const dashOffset = circumference - arcLength;

    svg += `<g class="ring-group" data-cat="${cat.id}">`;
    // Track circle
    svg += `<circle cx="${cx}" cy="${cy}" r="${ringRadius}" class="ring-track" />`;
    
    // Colored Progress Arc
    if (!isNA && scoreVal > 0) {
      svg += `<circle cx="${cx}" cy="${cy}" r="${ringRadius}" class="ring-arc" stroke="${strokeColor}" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" style="transform-origin: ${cx}px ${cy}px;" />`;
    }

    // Centered Grade Text
    svg += `<text x="${cx}" y="${cy - 2}" class="ring-grade">${isNA ? 'N/A' : cat.grade}</text>`;
    svg += `<text x="${cx}" y="${cy + 13}" class="ring-score">${isNA ? '-' : cat.score + '%'}</text>`;

    // Label below
    svg += `<text x="${cx}" y="${cy + 46}" class="ring-label">${cat.name}</text>`;
    svg += `</g>`;
  });

  // Overall Ring / Headline badge at top-left
  const overallScore = scorecard.overallScore;
  const overallGrade = scorecard.overallGrade;
  svg += `<g transform="translate(45, 155)">`;
  svg += `<rect width="320" height="42" rx="8" fill="#f1f5f9" stroke="#e2e8f0"/>`;
  svg += `<text x="15" y="26" font-family="-apple-system, sans-serif" font-size="13" font-weight="700" fill="#1e293b">Overall SEO Health Score:</text>`;
  svg += `<text x="210" y="26" font-family="-apple-system, sans-serif" font-size="15" font-weight="900" fill="#4f46e5">${overallScore !== null ? overallScore + '/100' : 'N/A'}</text>`;
  svg += `<rect x="270" y="8" width="36" height="26" rx="6" fill="${overallScore >= 80 ? '#10b981' : overallScore >= 60 ? '#f59e0b' : '#ef4444'}"/>`;
  svg += `<text x="288" y="25" font-family="-apple-system, sans-serif" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle">${overallGrade}</text>`;
  svg += `</g>`;

  // Render 5-Axis Radar on the right
  const radarCx = width - 150;
  const radarCy = 110;
  const radarRadius = 75;

  // 5 concentric pentagon grids (20, 40, 60, 80, 100)
  for (let gridLevel = 1; gridLevel <= 5; gridLevel++) {
    const r = (gridLevel / 5) * radarRadius;
    const gridPoints = [];
    for (let a = 0; a < 5; a++) {
      const angle = (Math.PI * 2 * a) / 5 - Math.PI / 2; // Start at 12 o'clock
      const gx = radarCx + r * Math.cos(angle);
      const gy = radarCy + r * Math.sin(angle);
      gridPoints.push(`${gx.toFixed(1)},${gy.toFixed(1)}`);
    }
    svg += `<polygon points="${gridPoints.join(' ')}" class="radar-grid" />`;
  }

  // Draw 5 axes lines
  for (let a = 0; a < 5; a++) {
    const angle = (Math.PI * 2 * a) / 5 - Math.PI / 2;
    const ax = radarCx + radarRadius * Math.cos(angle);
    const ay = radarCy + radarRadius * Math.sin(angle);
    svg += `<line x1="${radarCx}" y1="${radarCy}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" class="radar-axis" />`;

    // Category Label placement
    const cat = categories[a] || SCORECARD_GROUPS[a];
    const labelDistance = radarRadius + 18;
    const lx = radarCx + labelDistance * Math.cos(angle);
    const ly = radarCy + labelDistance * Math.sin(angle) + 4;
    const anchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="radar-label" text-anchor="${anchor}">${cat ? cat.name : ''}</text>`;
  }

  // Data Polygon
  const polygonPoints = [];
  const pointElements = [];

  for (let a = 0; a < 5; a++) {
    const angle = (Math.PI * 2 * a) / 5 - Math.PI / 2;
    const cat = categories[a];
    const scoreVal = (cat && cat.score !== null) ? cat.score : 0;
    const r = (scoreVal / 100) * radarRadius;
    const px = radarCx + r * Math.cos(angle);
    const py = radarCy + r * Math.sin(angle);

    polygonPoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    pointElements.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5" class="radar-point" />`);
  }

  svg += `<polygon points="${polygonPoints.join(' ')}" class="radar-polygon" />`;
  svg += pointElements.join('');

  // Timestamp footer
  const dateFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(scorecard.generatedAt || Date.now()));

  svg += `<text x="45" y="${height - 18}" class="timestamp">Report Generated: ${dateFormatted} UTC</text>`;
  svg += `</svg>`;

  return svg;
}

/**
 * Interactive DOM Scorecard Component with accessibility, tooltips, click events, and animations
 */
export function renderScorecard(containerEl, scorecard, options = {}) {
  if (!containerEl) return;
  const locale = options.locale || 'en';
  const categories = scorecard.categories || [];
  const onCategoryClick = options.onCategoryClick || (() => {});

  const dateFormatted = new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : locale === 'fr' ? 'fr-FR' : locale === 'de' ? 'de-DE' : 'en-US', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(scorecard.generatedAt || Date.now()));

  const html = `
    <div class="seo-scorecard-wrap" role="region" aria-label="SEO Audit Scorecard">
      <div class="seo-scorecard-header">
        <div class="seo-overall-badge">
          <div class="seo-overall-label">Overall Health</div>
          <div class="seo-overall-val">
            <span class="seo-overall-num">${scorecard.overallScore !== null ? scorecard.overallScore : 'N/A'}</span>
            <span class="seo-overall-grade grade-${(scorecard.overallGrade || 'na').toLowerCase().replace('+', 'plus').replace('-', 'minus')}">${scorecard.overallGrade}</span>
          </div>
        </div>
      </div>

      <div class="seo-scorecard-grid">
        <div class="seo-scorecard-rings" role="list">
          ${categories.map(cat => {
            const isNA = cat.score === null || cat.grade === 'N/A';
            const ringRadius = 32;
            const circum = 2 * Math.PI * ringRadius;
            const scoreVal = isNA ? 0 : Math.max(0, Math.min(100, cat.score));
            const dashOffset = circum - ((scoreVal / 100) * circum);
            const color = cat.color || '#6366f1';

            return `
              <div class="seo-ring-card ${isNA ? 'is-na' : ''}" role="listitem" tabindex="0" data-group="${cat.id}" title="${cat.name}: ${isNA ? 'Not evaluated' : cat.score + '/100 (' + cat.grade + ')'}">
                <div class="seo-ring-svg-wrap">
                  <svg class="seo-ring-svg" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
                    <circle class="ring-bg-track" cx="40" cy="40" r="${ringRadius}"></circle>
                    ${!isNA ? `
                      <circle class="ring-fg-arc" cx="40" cy="40" r="${ringRadius}"
                        stroke="${color}"
                        stroke-dasharray="${circum}"
                        stroke-dashoffset="${dashOffset}"
                        style="--circumference: ${circum}; --offset: ${dashOffset};">
                      </circle>
                    ` : ''}
                  </svg>
                  <div class="seo-ring-center">
                    <span class="seo-ring-grade">${isNA ? 'N/A' : cat.grade}</span>
                    <span class="seo-ring-score-val">${isNA ? '-' : cat.score + '%'}</span>
                  </div>
                </div>
                <button type="button" class="seo-ring-btn" data-group="${cat.id}">
                  ${cat.name}
                </button>
                ${cat.note ? `<div class="seo-ring-note">${cat.note}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div class="seo-scorecard-radar-wrap">
          <div class="seo-radar-title">Category Balance Radar</div>
          <div class="seo-radar-container">
            ${renderRadarSVG(categories, 260, 200)}
          </div>
          <!-- Screen reader accessible table fallback -->
          <table class="sr-only" aria-label="Category Scores Data Table">
            <thead>
              <tr><th>Category</th><th>Score</th><th>Grade</th><th>Passed</th><th>Failed</th></tr>
            </thead>
            <tbody>
              ${categories.map(c => `<tr><td>${c.name}</td><td>${c.score || 'N/A'}</td><td>${c.grade}</td><td>${c.passed}</td><td>${c.failed}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="seo-scorecard-footer">
        <span class="seo-timestamp-text">Report Generated: ${dateFormatted} UTC</span>
        ${scorecard.excludedCategories && scorecard.excludedCategories.length > 0 ? `
          <span class="seo-excluded-note">• Excluded from overall score: ${scorecard.excludedCategories.join(', ')}</span>
        ` : ''}
      </div>
    </div>
  `;

  containerEl.innerHTML = html;

  // Add event listeners for ring buttons
  const buttons = containerEl.querySelectorAll('.seo-ring-btn, .seo-ring-card');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const group = btn.getAttribute('data-group') || btn.closest('.seo-ring-card')?.getAttribute('data-group');
      if (group) onCategoryClick(group);
    });
  });
}

function renderRadarSVG(categories, width = 240, height = 200) {
  const cx = width / 2;
  const cy = height / 2 - 5;
  const radius = 65;

  let svg = `<svg viewBox="0 0 ${width} ${height}" class="seo-radar-svg" role="img">`;

  // Concentric pentagons
  for (let i = 1; i <= 5; i++) {
    const r = (i / 5) * radius;
    const pts = [];
    for (let a = 0; a < 5; a++) {
      const angle = (Math.PI * 2 * a) / 5 - Math.PI / 2;
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
    }
    svg += `<polygon points="${pts.join(' ')}" fill="none" stroke="#e2e8f0" stroke-dasharray="2,2" stroke-width="1"/>`;
  }

  // Axes and labels
  for (let a = 0; a < 5; a++) {
    const angle = (Math.PI * 2 * a) / 5 - Math.PI / 2;
    const ax = cx + radius * Math.cos(angle);
    const ay = cy + radius * Math.sin(angle);
    svg += `<line x1="${cx}" y1="${cy}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="#cbd5e1" stroke-dasharray="2,2" stroke-width="1"/>`;

    const cat = categories[a] || SCORECARD_GROUPS[a];
    const labelDist = radius + 15;
    const lx = cx + labelDist * Math.cos(angle);
    const ly = cy + labelDist * Math.sin(angle) + 3;
    const anchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="9" font-weight="700" fill="#475569" text-anchor="${anchor}">${cat ? cat.name : ''}</text>`;
  }

  // Polygon
  const polygonPoints = [];
  const markers = [];

  for (let a = 0; a < 5; a++) {
    const angle = (Math.PI * 2 * a) / 5 - Math.PI / 2;
    const cat = categories[a];
    const scoreVal = (cat && cat.score !== null) ? cat.score : 0;
    const r = (scoreVal / 100) * radius;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);

    polygonPoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    markers.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="#6366f1" stroke="#ffffff" stroke-width="1.5" />`);
  }

  svg += `<polygon points="${polygonPoints.join(' ')}" fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" stroke-width="2" />`;
  svg += markers.join('');
  svg += `</svg>`;

  return svg;
}
