import React from 'react';

const toneToChip = {
  success: {
    label: 'positive',
    className: 'status-chip success'
  },
  warning: {
    label: 'attention',
    className: 'status-chip warning'
  },
  pending: {
    label: 'tracking',
    className: 'status-chip pending'
  }
};

export default function MetricSummary({ metric }) {
  const tone = toneToChip[metric.tone] ?? toneToChip.pending;

  return (
    <div className="metric-card">
      <h3>{metric.label}</h3>
      <strong>{metric.value}</strong>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{metric.delta}</span>
        <span className={tone.className}>{tone.label}</span>
      </div>
    </div>
  );
}
