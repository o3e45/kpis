import React from 'react';

const statusTone = {
  paid: {
    label: 'Paid',
    className: 'status-chip success'
  },
  pending: {
    label: 'Pending',
    className: 'status-chip warning'
  },
  processing: {
    label: 'Processing',
    className: 'status-chip pending'
  }
};

export default function PurchaseList({ purchases }) {
  return (
    <div>
      <h2>Recent Purchase Orders</h2>
      <table className="table">
        <thead>
          <tr>
            <th align="left">PO</th>
            <th align="left">Vendor</th>
            <th align="left">Category</th>
            <th align="right">Amount</th>
            <th align="center">Status</th>
            <th align="right">Created</th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase) => {
            const tone = statusTone[purchase.status] ?? statusTone.processing;
            return (
              <tr key={purchase.id}>
                <td>{purchase.id}</td>
                <td>{purchase.vendor}</td>
                <td>{purchase.category}</td>
                <td align="right">{purchase.amount}</td>
                <td align="center">
                  <span className={tone.className}>{tone.label}</span>
                </td>
                <td align="right">{purchase.createdAt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
