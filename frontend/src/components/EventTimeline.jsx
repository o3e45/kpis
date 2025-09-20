import React from 'react';

export default function EventTimeline({ events }) {
  return (
    <div>
      <h2>Operational Timeline</h2>
      <ul className="timeline">
        {events.map((event) => (
          <li key={event.id} className="timeline-item">
            <div className="timeline-meta">{event.date}</div>
            <div className="timeline-title">{event.title}</div>
            <p className="timeline-body">{event.description}</p>
            <div className="badge" style={{ marginTop: '8px' }}>
              {event.tag}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
