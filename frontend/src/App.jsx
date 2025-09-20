import React, { useMemo, useState } from 'react';
import DashboardHeader from './components/DashboardHeader.jsx';
import MetricSummary from './components/MetricSummary.jsx';
import EventTimeline from './components/EventTimeline.jsx';
import VendorTable from './components/VendorTable.jsx';
import SuggestionBoard from './components/SuggestionBoard.jsx';
import DocumentSearch from './components/DocumentSearch.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import PurchaseList from './components/PurchaseList.jsx';

const MOCK_DATA = {
  metrics: [
    { label: 'Monthly Spend', value: '$182k', delta: '+12.4%', tone: 'success' },
    { label: 'Active Vendors', value: '34', delta: '+4 new', tone: 'pending' },
    { label: 'Open Claims', value: '5', delta: '-2', tone: 'success' },
    { label: 'Suggestions', value: '12', delta: '3 urgent', tone: 'warning' }
  ],
  events: [
    {
      id: 'evt-01',
      date: 'Mar 18 · 4:25 PM',
      title: 'Purchase Order Approved',
      description: 'Empire LLC · MacBook Pro Inventory replenishment',
      tag: 'procurement'
    },
    {
      id: 'evt-02',
      date: 'Mar 18 · 2:02 PM',
      title: 'Risk Flag Cleared',
      description: 'Media spend variance back within 3% of forecast',
      tag: 'compliance'
    },
    {
      id: 'evt-03',
      date: 'Mar 17 · 9:11 AM',
      title: 'Vendor Renewal',
      description: 'Signed annual contract extension with Nova Cloud',
      tag: 'legal'
    }
  ],
  purchases: [
    {
      id: 'PO-49021',
      vendor: 'Nova Cloud',
      amount: '$42,120',
      status: 'paid',
      category: 'Cloud',
      createdAt: 'Mar 11'
    },
    {
      id: 'PO-48977',
      vendor: 'Argo Media',
      amount: '$16,400',
      status: 'pending',
      category: 'Media',
      createdAt: 'Mar 10'
    },
    {
      id: 'PO-48941',
      vendor: 'Rapid Logistics',
      amount: '$9,870',
      status: 'processing',
      category: 'Operations',
      createdAt: 'Mar 8'
    }
  ],
  vendors: [
    { name: 'Nova Cloud', category: 'Cloud Services', spend: '$112k', health: 'stable' },
    { name: 'Argo Media', category: 'Growth Marketing', spend: '$89k', health: 'watch' },
    { name: 'Rapid Logistics', category: 'Operations', spend: '$54k', health: 'stable' },
    { name: 'Gold Finch Consulting', category: 'Finance', spend: '$33k', health: 'attention' }
  ],
  documents: [
    {
      id: 'doc-01',
      title: 'Nova Cloud FY24 Renewal.pdf',
      source: 'Contract Library',
      tags: ['contract', 'cloud', '2024']
    },
    {
      id: 'doc-02',
      title: 'Argo Media Campaign Brief.docx',
      source: 'Drive Upload',
      tags: ['brief', 'media', 'q1']
    },
    {
      id: 'doc-03',
      title: 'Empire LLC Spending Report.xlsx',
      source: 'Finance Workspace',
      tags: ['report', 'finance', 'variance']
    }
  ],
  suggestions: [
    {
      id: 'sug-01',
      title: 'Shift 15% of media spend to performance channels',
      description: 'Variance analysis shows underperformance in awareness campaigns. Reallocate $12k from Argo Media to Nova Cloud programmatic line items to regain 8% ROAS.',
      owner: 'Finance Agent',
      severity: 'high'
    },
    {
      id: 'sug-02',
      title: 'Schedule compliance review for Rapid Logistics',
      description: 'Logistics vendor flagged twice for late SLAs. Recommend 30-minute audit with operations lead before approving next invoice.',
      owner: 'Ops Agent',
      severity: 'medium'
    },
    {
      id: 'sug-03',
      title: 'Consolidate SaaS renewals in April',
      description: 'Combine Nova Cloud and Gold Finch renewals to unlock bundled rate. Estimated savings: $4.2k.',
      owner: 'Strategy Agent',
      severity: 'low'
    }
  ]
};

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents] = useState(MOCK_DATA.documents);
  const [suggestions, setSuggestions] = useState(MOCK_DATA.suggestions);

  const filteredDocuments = useMemo(() => {
    if (!searchQuery) {
      return documents;
    }

    return documents.filter((doc) => {
      const haystack = `${doc.title} ${doc.source} ${doc.tags.join(' ')}`.toLowerCase();
      return haystack.includes(searchQuery.toLowerCase());
    });
  }, [documents, searchQuery]);

  const handleSuggestionAction = (id, action) => {
    setSuggestions((prev) =>
      prev.map((suggestion) =>
        suggestion.id === id
          ? {
              ...suggestion,
              actionTaken: action,
              actionAt: new Date().toISOString()
            }
          : suggestion
      )
    );
  };

  const activeSuggestions = useMemo(
    () => suggestions.filter((suggestion) => !suggestion.actionTaken),
    [suggestions]
  );

  const completedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion.actionTaken),
    [suggestions]
  );

  return (
    <div className="app-shell">
      <DashboardHeader />
      <div className="metrics-row">
        {MOCK_DATA.metrics.map((metric) => (
          <MetricSummary key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="app-grid">
        <div className="panel grid-span-8">
          <UploadPanel />
        </div>
        <div className="panel grid-span-4">
          <EventTimeline events={MOCK_DATA.events} />
        </div>
        <div className="panel grid-span-8">
          <PurchaseList purchases={MOCK_DATA.purchases} />
        </div>
        <div className="panel grid-span-4">
          <VendorTable vendors={MOCK_DATA.vendors} />
        </div>
        <div className="panel grid-span-6">
          <DocumentSearch
            documents={filteredDocuments}
            query={searchQuery}
            onQueryChange={setSearchQuery}
          />
        </div>
        <div className="panel grid-span-6">
          <SuggestionBoard
            active={activeSuggestions}
            completed={completedSuggestions}
            onAction={handleSuggestionAction}
          />
        </div>
      </div>
    </div>
  );
}
