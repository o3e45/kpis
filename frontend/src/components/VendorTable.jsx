import React from 'react';

const healthTone = {
  stable: {
    label: 'Stable',
    className: 'status-chip success'
  },
  watch: {
    label: 'Watch',
    className: 'status-chip warning'
  },
  attention: {
    label: 'Needs Attention',
    className: 'status-chip pending'
  }
};

export default function VendorTable({ vendors }) {
  return (
    <div>
      <h2>Vendor Portfolio</h2>
      <table className="table">
        <thead>
          <tr>
            <th align="left">Vendor</th>
            <th align="left">Category</th>
            <th align="right">Spend</th>
            <th align="center">Health</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((vendor) => {
            const tone = healthTone[vendor.health] ?? healthTone.stable;
            return (
              <tr key={vendor.name}>
                <td>{vendor.name}</td>
                <td>{vendor.category}</td>
                <td align="right">{vendor.spend}</td>
                <td align="center">
                  <span className={tone.className}>{tone.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
