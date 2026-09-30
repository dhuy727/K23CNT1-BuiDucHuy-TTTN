import React, { useState } from 'react';

const TrendChart = ({ data = [] }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="timeline-bar-chart">
      {data.map((item, idx) => {
        const heightPercent = Math.max(8, Math.round((item.count / maxCount) * 100));
        const isHovered = hoveredIdx === idx;

        return (
          <div
            key={item.date || idx}
            className="timeline-bar-col"
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div className="timeline-bar-count">
              {item.count > 0 ? item.count : ''}
            </div>

            <div className="timeline-bar-fill-wrap" title={`${item.label}: ${item.count} tệp (${item.formattedSize})`}>
              <div
                className="timeline-bar-fill"
                style={{
                  height: `${heightPercent}%`,
                  filter: isHovered ? 'brightness(1.2)' : 'none'
                }}
              />
            </div>

            <div
              className="timeline-bar-label"
              style={{
                color: isHovered ? 'var(--primary-600)' : 'var(--text-muted)',
                fontWeight: isHovered ? 700 : 500
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrendChart;
