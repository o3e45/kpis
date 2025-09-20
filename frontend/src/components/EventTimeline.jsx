import React from 'react';

function describeEvent(event) {
  const created = event.created_at ? new Date(event.created_at) : null;
  const dateLabel = created
    ? created.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown time';

  const tag = event.event_type?.split('.')[0]?.replace(/[_-]/g, ' ') ?? 'event';
  const payload = event.payload ?? {};
  let title = event.event_type?.replace('.', ' · ') ?? 'Event';
  let description = '';

  switch (event.event_type) {
    case 'ingest.received':
      title = 'Document received';
      description = `Media object #${payload.media_object_id ?? payload.id ?? '—'} captured for LLC ${payload.llc_id ?? '—'}.`;
      break;
    case 'ingest.parsed':
      title = 'Packet parsed';
      if (payload.vendor_name) {
        const amount = payload.total_amount ? `${payload.currency ?? 'USD'} ${payload.total_amount}` : 'Invoice';
        description = `Extracted ${amount} for ${payload.vendor_name}. Confidence ${Math.round((payload.confidence ?? 0) * 100)}%.`;
      } else {
        description = 'Structured purchase order details extracted from upload.';
      }
      break;
    case 'purchase_order.created':
      title = 'Purchase order created';
      description = `Purchase order #${payload.purchase_order_id ?? '—'} created from ingestion.`;
      break;
    case 'agent_suggestion.approved':
      title = 'Agent suggestion approved';
      description = payload.message ?? 'Suggestion approved by operator.';
      break;
    default:
      description = typeof payload === 'object' ? JSON.stringify(payload) : String(payload ?? '');
      break;
  }

  return {
    id: event.id,
    dateLabel,
    title,
    description,
    tag
  };
}

export default function EventTimeline({ events, isLoading = false }) {
  const timeline = events.map(describeEvent);

  return (
    <div>
      <h2>Operational Timeline</h2>
      <ul className="timeline">
        {timeline.map((item) => (
          <li key={item.id} className="timeline-item">
            <div className="timeline-meta">{item.dateLabel}</div>
            <div className="timeline-title">{item.title}</div>
            <p className="timeline-body">{item.description}</p>
            <div className="badge" style={{ marginTop: '8px', textTransform: 'capitalize' }}>
              {item.tag}
            </div>
          </li>
        ))}
        {!timeline.length && !isLoading && (
          <li className="timeline-item">
            <div className="timeline-title">No activity yet</div>
            <p className="timeline-body" style={{ color: 'var(--text-muted)' }}>
              Ingest a vendor packet to populate the operational timeline.
            </p>
          </li>
        )}
      </ul>
    </div>
  );
}
