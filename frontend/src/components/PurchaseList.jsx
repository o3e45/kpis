import React from 'react';

const statusTone = {
  paid: {
    label: 'Paid',
    className: 'status-chip success'
  },
  pending: {
    label: 'Pending',
    className: 'status-chip pending'
  },
  processing: {
    label: 'Processing',
    className: 'status-chip pending'
  },
  overdue: {
    label: 'Overdue',
    className: 'status-chip warning'
  },
  'past-due': {
    label: 'Past Due',
    className: 'status-chip warning'
  },
  partial: {
    label: 'Partially Paid',
    className: 'status-chip warning'
  }
};

function formatCurrency(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount ?? 0));
  } catch (error) {
    return `$${Number(amount ?? 0).toFixed(2)}`;
  }
}

export default function PurchaseList({ purchases, isLoading = false }) {
  return (
    <div>
      <h2>Recent Purchase Orders</h2>
      <table className="table">
        <thead>
          <tr>
            <th align="left">PO</th>
            <th align="left">Vendor</th>
            <th align="right">Amount</th>
            <th align="center">Status</th>
            <th align="right">Created</th>
            <th align="right">Due</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase) => {
            const statusKey = (purchase.status ?? 'processing').toLowerCase();
            const tone = statusTone[statusKey] ?? statusTone.processing;
            const createdAt = purchase.created_at
              ? new Date(purchase.created_at).toLocaleDateString()
              : '—';
            const dueDate = purchase.due_date ? new Date(purchase.due_date).toLocaleDateString() : '—';
            return (
              <tr key={purchase.id}>
                <td>{`PO-${purchase.id}`}</td>
                <td>{purchase.vendor?.name ?? 'Unknown Vendor'}</td>
                <td align="right">{formatCurrency(purchase.total_amount, purchase.currency)}</td>
                <td align="center">
                  <span className={tone.className}>{tone.label}</span>
                </td>
                <td align="right">{createdAt}</td>
                <td align="right">{dueDate}</td>
              </tr>
            );
          })}
          {!purchases.length && !isLoading && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                Ingest a purchase order to populate this list.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
