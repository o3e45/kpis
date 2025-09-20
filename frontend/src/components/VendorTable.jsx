import React from 'react';

const riskTone = {
  stable: {
    label: 'Stable',
    className: 'status-chip success'
  },
  watch: {
    label: 'Monitor',
    className: 'status-chip pending'
  },
  attention: {
    label: 'Needs Attention',
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

export default function VendorTable({ vendors, isLoading = false }) {
  return (
    <div>
      <h2>Vendor Portfolio</h2>
      <table className="table">
        <thead>
          <tr>
            <th align="left">Vendor</th>
            <th align="right">Open Orders</th>
            <th align="right">Lifetime Spend</th>
            <th align="right">Last Purchase</th>
            <th align="center">Risk</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => {
            const tone = riskTone[vendor.risk] ?? riskTone.watch;
            const lastPurchase = vendor.lastPurchaseAt
              ? new Date(vendor.lastPurchaseAt).toLocaleDateString()
              : '—';
            return (
              <tr key={vendor.name}>
                <td>{vendor.name}</td>
                <td align="right">{vendor.openOrders}</td>
                <td align="right">{formatCurrency(vendor.totalSpend)}</td>
                <td align="right">{lastPurchase}</td>
                <td align="center">
                  <span className={tone.className}>{tone.label}</span>
                </td>
              </tr>
            );
          })}
          {!vendors.length && !isLoading && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                Vendor portfolio will populate as purchase orders are ingested.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
