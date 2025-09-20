import React from 'react';

export default function DocumentSearch({ documents, query, onQueryChange }) {
  return (
    <div>
      <h2>Knowledge Graph</h2>
      <div className="search-bar">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search documents, clauses, vendors..."
        />
        <button type="button">Search</button>
      </div>
      <div className="document-list">
        {documents.map((doc) => (
          <div key={doc.id} className="document-card">
            <h4>{doc.title}</h4>
            <span>{doc.source}</span>
            <div className="inline-list">
              {doc.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <div className="document-card">
            <h4>No documents found</h4>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Try a broader term or ingest a new vendor packet to expand the knowledge graph.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
