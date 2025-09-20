import React from 'react';

export default function DocumentSearch({
  documents,
  query,
  onQueryChange,
  onSearch,
  isSearching = false,
  lastSearched
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    onSearch?.(query);
  };

  return (
    <div>
      <h2>Knowledge Graph</h2>
      <form className="search-bar" onSubmit={handleSubmit}>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange?.(event.target.value)}
          placeholder="Search documents, clauses, vendors..."
        />
        <button type="submit" className="button primary" disabled={isSearching}>
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {lastSearched && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
          Showing {documents.length} {documents.length === 1 ? 'result' : 'results'} for “{lastSearched}”.
        </div>
      )}

      <div className="document-list">
        {documents.map((doc) => (
          <div key={doc.media_object_id} className="document-card">
            <h4>{doc.filename ?? `Document ${doc.media_object_id}`}</h4>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {(doc.mime ?? 'Document').replace('/', ' · ')} · {(doc.score * 100).toFixed(1)}% match
            </span>
            <p style={{ marginTop: '12px' }}>{doc.excerpt || 'No excerpt available for this result.'}</p>
          </div>
        ))}
        {!documents.length && !isSearching && lastSearched && (
          <div className="document-card">
            <h4>No documents found</h4>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Try a broader term or ingest a new vendor packet to expand the knowledge graph.
            </p>
          </div>
        )}
        {!documents.length && !lastSearched && (
          <div className="document-card">
            <h4>Search the archive</h4>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Use keywords like vendor names, contract clauses, or claim IDs to surface relevant documentation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
