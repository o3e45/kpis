import React from 'react';

export default function DashboardHeader() {
  return (
    <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <div className="badge">Empire OS Prototype</div>
        <h1 style={{ margin: '12px 0 4px', fontSize: '1.6rem' }}>Empire Command Deck</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          Monitor spend, surface insights, and coordinate actions across every LLC in minutes.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button className="button secondary">Create Workspace</button>
        <button className="button primary">New Automation</button>
      </div>
    </header>
  );
}
