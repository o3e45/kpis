import React from 'react';

const severityTone = {
  high: {
    label: 'High Impact',
    className: 'status-chip warning'
  },
  medium: {
    label: 'Review Soon',
    className: 'status-chip pending'
  },
  low: {
    label: 'Optional',
    className: 'status-chip success'
  }
};

function SuggestionCard({ suggestion, onAction }) {
  const tone = severityTone[suggestion.severity] ?? severityTone.medium;

  return (
    <div className="suggestion-card">
      <header>
        <h3>{suggestion.title}</h3>
        <span className={tone.className}>{tone.label}</span>
      </header>
      <p>{suggestion.description}</p>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Proposed by {suggestion.owner}</div>
      {suggestion.actionTaken ? (
        <div className="status-chip success">
          {suggestion.actionTaken} · {new Date(suggestion.actionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      ) : (
        <footer>
          <button className="button primary" onClick={() => onAction(suggestion.id, 'approved')}>
            Approve
          </button>
          <button className="button secondary" onClick={() => onAction(suggestion.id, 'snoozed')}>
            Snooze
          </button>
        </footer>
      )}
    </div>
  );
}

export default function SuggestionBoard({ active, completed, onAction }) {
  return (
    <div>
      <h2>Agent Suggestions</h2>
      <div style={{ display: 'grid', gap: '16px' }}>
        {active.length === 0 ? (
          <div className="document-card">
            <h4>No open actions</h4>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Agents are monitoring your workstreams. You will be notified when a new opportunity appears.
            </p>
          </div>
        ) : (
          active.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} onAction={onAction} />
          ))
        )}
      </div>

      {completed.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Recently actioned</h3>
          <div className="document-list">
            {completed.map((suggestion) => (
              <div key={suggestion.id} className="suggestion-card">
                <header>
                  <h3>{suggestion.title}</h3>
                  <div className="status-chip success">{suggestion.actionTaken}</div>
                </header>
                <p>{suggestion.description}</p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Handled at{' '}
                  {new Date(suggestion.actionAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
