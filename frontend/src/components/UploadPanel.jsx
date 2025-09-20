import React, { useState } from 'react';

const UPLOAD_TYPES = ['Purchase Order', 'Contract', 'Invoice', 'Statement of Work'];

export default function UploadPanel({ onUpload, uploads = [], isUploading = false }) {
  const [selected, setSelected] = useState(UPLOAD_TYPES[0]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    onUpload?.(fileList, selected);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    handleFiles(droppedFiles);
    event.dataTransfer.clearData();
  };

  const handleBrowse = (event) => {
    const chosen = Array.from(event.target.files ?? []);
    handleFiles(chosen);
    event.target.value = '';
  };

  return (
    <div>
      <h2>Universal Ingestion</h2>
      <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
        Drag and drop vendor packets, purchase orders, or contracts. Empire will parse, vectorize, and route to the
        correct agent pipeline.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
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

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `1px dashed ${isDragging ? 'var(--brand-primary)' : 'rgba(148, 163, 184, 0.4)'}`,
          borderRadius: '16px',
          padding: '28px',
          display: 'grid',
          gap: '16px',
          background: isDragging ? 'rgba(59, 130, 246, 0.08)' : 'rgba(15, 23, 42, 0.4)',
          transition: 'background 120ms ease, border 120ms ease'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label htmlFor="ingest-upload" className="button primary" style={{ cursor: 'pointer' }}>
            {isUploading ? 'Uploading…' : 'Browse Files'}
          </label>
          <input id="ingest-upload" type="file" multiple onChange={handleBrowse} style={{ display: 'none' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {isUploading ? 'Processing uploads in progress…' : 'Or drop files anywhere in this panel.'}
          </span>
        </div>

        {uploads.length > 0 ? (
          <div className="document-list">
            {uploads.slice(0, 6).map((upload) => (
              <div key={upload.id} className="document-card">
                <h4>{upload.name}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {upload.docType ?? selected}
                  </span>
                  {upload.status === 'complete' && <span className="status-chip success">Parsed</span>}
                  {upload.status === 'uploading' && <span className="status-chip pending">Uploading</span>}
                  {upload.status === 'error' && <span className="status-chip warning">Failed</span>}
                </div>
                {upload.message && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>{upload.message}</div>
                )}
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
