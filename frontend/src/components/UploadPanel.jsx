import React, { useState } from 'react';

const UPLOAD_TYPES = ['Purchase Order', 'Contract', 'Invoice', 'Statement of Work'];

export default function UploadPanel() {
  const [selected, setSelected] = useState(UPLOAD_TYPES[0]);
  const [files, setFiles] = useState([]);

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    setFiles((prev) => [...prev, ...droppedFiles.map((file) => file.name)]);
  };

  const handleBrowse = (event) => {
    const chosen = Array.from(event.target.files ?? []);
    setFiles((prev) => [...prev, ...chosen.map((file) => file.name)]);
  };

  return (
    <div>
      <h2>Universal Ingestion</h2>
      <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
        Drag and drop vendor packets, purchase orders, or contracts. Empire will parse, vectorize, and route to the
        correct agent pipeline.
      </p>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: '1px dashed rgba(148, 163, 184, 0.4)',
          borderRadius: '16px',
          padding: '28px',
          display: 'grid',
          gap: '16px',
          background: 'rgba(15, 23, 42, 0.4)'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {UPLOAD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="button secondary"
              style={{
                borderColor: selected === type ? 'var(--brand-primary)' : undefined,
                color: selected === type ? 'var(--text-primary)' : undefined,
                background: selected === type ? 'rgba(59, 130, 246, 0.18)' : undefined
              }}
              onClick={() => setSelected(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <label
          htmlFor="ingest-upload"
          className="button primary"
          style={{ width: 'fit-content', cursor: 'pointer' }}
        >
          Browse Files
        </label>
        <input
          id="ingest-upload"
          type="file"
          multiple
          onChange={handleBrowse}
          style={{ display: 'none' }}
        />

        {files.length > 0 ? (
          <div className="document-list">
            {files.map((fileName, index) => (
              <div key={`${fileName}-${index}`} className="document-card">
                <h4>{fileName}</h4>
                <span>Queued as {selected}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Drop files here or browse to add supporting documents. Empire will extract structured data and surface
            follow-up actions automatically.
          </div>
        )}
      </div>
    </div>
  );
}
