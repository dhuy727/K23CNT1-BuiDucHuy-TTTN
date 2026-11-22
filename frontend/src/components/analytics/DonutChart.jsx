import React, { useState } from 'react';

const DonutChart = ({ items = [], totalFormatted = '', totalLabel = 'Tổng dung lượng' }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const validItems = items.filter((it) => it.size > 0);
  const totalBytes = validItems.reduce((acc, cur) => acc + cur.size, 0);

  if (validItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Chưa có dữ liệu dung lượng tài liệu để vẽ biểu đồ
      </div>
    );
  }

  // Cấu hình vòng tròn SVG Donut
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const segments = validItems.map((item, index) => {
    const fraction = totalBytes > 0 ? item.size / totalBytes : 0;
    const strokeDasharray = `${fraction * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += fraction * circumference;

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      index
    };
  });

  const activeItem = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div className="donut-chart-container">
      {/* Vòng tròn Donut SVG */}
      <div className="donut-svg-wrapper">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Vòng đệm nền */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-surface-hover)"
            strokeWidth={strokeWidth}
          />
          {/* Các phân đoạn theo loại tệp */}
          {segments.map((seg) => {
            const isHovered = hoveredIdx === seg.index;
            return (
              <circle
                key={seg.type || seg.index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color || '#3B82F6'}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setHoveredIdx(seg.index)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Nội dung trung tâm vòng tròn */}
        <div className="donut-svg-center">
          <div className="donut-svg-percent">
            {activeItem ? `${activeItem.percent}%` : totalFormatted}
          </div>
          <div className="donut-svg-label">
            {activeItem ? activeItem.label : totalLabel}
          </div>
        </div>
      </div>

      {/* Chú giải bảng màu & số liệu chi tiết */}
      <div className="donut-legend">
        {segments.map((seg) => {
          const isHovered = hoveredIdx === seg.index;
          return (
            <div
              key={seg.type || seg.index}
              className="donut-legend-item"
              style={{
                cursor: 'pointer',
                opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                transform: isHovered ? 'translateX(4px)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={() => setHoveredIdx(seg.index)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="donut-legend-left">
                <span
                  className="donut-legend-dot"
                  style={{ backgroundColor: seg.color || '#3B82F6' }}
                />
                <span>{seg.label}</span>
              </div>
              <div className="donut-legend-right">
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {seg.formattedSize}
                </span>
                <span>({seg.count} tệp)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DonutChart;
