import React from 'react';

const typeTone = {
  'flag-overdue': {
    label: 'Overdue',
    className: 'status-chip warning'
  },
  'create-repayment-plan': {
    label: 'Plan',
    className: 'status-chip pending'
  },
  'reconcile-payment-status': {
    label: 'Status',
    className: 'status-chip warning'
  },
  'review-vendor-history': {
    label: 'Vendor History',
    className: 'status-chip pending'
  },
  'review-related-claim': {
    label: 'Claim Link',
    className: 'status-chip warning'
  }
};

function SuggestionCard({ suggestion, onApprove, isApproving }) {
  const tone = typeTone[suggestion.suggestion_type] ?? typeTone['review-vendor-history'];
  const createdAt = suggestion.created_at
    ? new Date(suggestion.created_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';
  const approvedAt = suggestion.approved_at
    ? new Date(suggestion.approved_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  return (
    <div className="suggestion-card">
      <header>
        <h3>{suggestion.message}</h3>
        <span className={tone.className}>{tone.label}</span>
      </header>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {suggestion.agent_name} • {createdAt}
      </div>
      {suggestion.approved ? (
        <div className="status-chip success">Approved {approvedAt}</div>
      ) : (
        <footer>
          <button
            className="button primary"
            onClick={() => onApprove?.(suggestion.id)}
            disabled={isApproving}
          >
            {isApproving ? 'Approving…' : 'Approve'}
          </button>
        </footer>
      )}
    </div>
  );
}

export default function SuggestionBoard({ open, resolved, onApprove, approving = [], isLoading = false }) {
  return (
    <div>
      <h2>Agent Suggestions</h2>
      <div style={{ display: 'grid', gap: '16px' }}>
        {open.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onApprove={onApprove}
            isApproving={approving.includes(suggestion.id)}
          />
        ))}
        {!open.length && !isLoading && (
          <div className="document-card">
            <h4>No open actions</h4>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Agents are monitoring your workstreams. You will be notified when a new opportunity appears.
            </p>
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Recently approved</h3>
          <div className="document-list">
            {resolved.map((suggestion) => (
              <SuggestionCard key={suggestion.id} suggestion={suggestion} onApprove={onApprove} isApproving={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
