import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardHeader from './components/DashboardHeader.jsx';
import MetricSummary from './components/MetricSummary.jsx';
import EventTimeline from './components/EventTimeline.jsx';
import VendorTable from './components/VendorTable.jsx';
import SuggestionBoard from './components/SuggestionBoard.jsx';
import DocumentSearch from './components/DocumentSearch.jsx';
import UploadPanel from './components/UploadPanel.jsx';
import PurchaseList from './components/PurchaseList.jsx';
import {
  approveSuggestion,
  fetchEvents,
  fetchPurchaseOrders,
  fetchSuggestions,
  ingestPurchase,
  searchDocuments
} from './api/client.js';

const DEFAULT_LLC_NAME = 'Empire LLC';

function toTimestamp(value) {
  if (!value) {
    return 0;
  }
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortByDateDesc(items, field) {
  return [...items].sort((a, b) => toTimestamp(b?.[field]) - toTimestamp(a?.[field]));
}

function mergeById(existing, incoming, key = 'id') {
  const ids = new Set((incoming ?? []).map((item) => item?.[key]));
  return [...(incoming ?? []), ...existing.filter((item) => !ids.has(item?.[key]))];
}

function formatCurrency(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(Number(amount ?? 0));
  } catch (error) {
    const value = Number(amount ?? 0);
    return `$${value.toFixed(2)}`;
  }
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearched, setLastSearched] = useState('');
  const [searching, setSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [approving, setApproving] = useState([]);
  const [error, setError] = useState(null);

  const refreshCore = useCallback(async () => {
    setError(null);
    const [latestPurchases, latestEvents, latestSuggestions] = await Promise.all([
      fetchPurchaseOrders(),
      fetchEvents(),
      fetchSuggestions()
    ]);
    setPurchases(sortByDateDesc(latestPurchases, 'created_at'));
    setEvents(sortByDateDesc(latestEvents, 'created_at'));
    setSuggestions(sortByDateDesc(latestSuggestions, 'created_at'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        await refreshCore();
      } catch (err) {
        if (!cancelled) {
          setError(err.message ?? 'Unable to load dashboard data.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCore]);

  const handleSearch = useCallback(
    async (term) => {
      const nextQuery = term ?? '';
      setSearchQuery(nextQuery);
      const trimmed = nextQuery.trim();
      if (!trimmed) {
        setDocuments([]);
        setLastSearched('');
        return;
      }
      setSearching(true);
      try {
        const results = await searchDocuments(trimmed);
        setDocuments(results);
        setLastSearched(trimmed);
      } catch (err) {
        setError(err.message ?? 'Document search failed.');
      } finally {
        setSearching(false);
      }
    },
    []
  );

  const handleQueryChange = useCallback((nextQuery) => {
    setSearchQuery(nextQuery);
    if (!nextQuery.trim()) {
      setDocuments([]);
      setLastSearched('');
    }
  }, []);

  const handleUpload = useCallback(
    async (files, docType) => {
      const fileList = Array.from(files ?? []);
      if (fileList.length === 0) {
        return;
      }
      setIsUploading(true);
      for (const file of fileList) {
        const uploadId = `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        setUploads((prev) =>
          [
            {
              id: uploadId,
              name: file.name,
              status: 'uploading',
              docType,
              startedAt: new Date().toISOString()
            },
            ...prev
          ].slice(0, 10)
        );
        try {
          const response = await ingestPurchase({ llcName: DEFAULT_LLC_NAME, file });
          setPurchases((prev) =>
            sortByDateDesc(
              mergeById(prev, [response.purchase_order]),
              'created_at'
            )
          );
          setEvents((prev) =>
            sortByDateDesc(
              mergeById(prev, response.events ?? []),
              'created_at'
            )
          );
          setSuggestions((prev) =>
            sortByDateDesc(
              mergeById(prev, response.suggestions ?? []),
              'created_at'
            )
          );
          const vendorName = response.purchase_order.vendor?.name ?? 'vendor';
          const formattedAmount = formatCurrency(
            response.purchase_order.total_amount,
            response.purchase_order.currency
          );
          setUploads((prev) =>
            prev.map((entry) =>
              entry.id === uploadId
                ? {
                    ...entry,
                    status: 'complete',
                    message: `Created PO #${response.purchase_order.id} for ${vendorName} (${formattedAmount})`,
                    finishedAt: new Date().toISOString()
                  }
                : entry
            )
          );
        } catch (err) {
          setError(err.message ?? 'Upload failed.');
          setUploads((prev) =>
            prev.map((entry) =>
              entry.id === uploadId
                ? {
                    ...entry,
                    status: 'error',
                    message: err.message ?? 'Upload failed',
                    finishedAt: new Date().toISOString()
                  }
                : entry
            )
          );
        }
      }
      try {
        await refreshCore();
      } catch (err) {
        setError(err.message ?? 'Unable to refresh dashboard after upload.');
      } finally {
        setIsUploading(false);
      }
    },
    [refreshCore]
  );

  const handleApprove = useCallback(
    async (suggestionId) => {
      if (!suggestionId) {
        return;
      }
      setApproving((prev) => [...prev, suggestionId]);
      try {
        await approveSuggestion(suggestionId);
        await refreshCore();
      } catch (err) {
        setError(err.message ?? 'Unable to approve suggestion.');
      } finally {
        setApproving((prev) => prev.filter((id) => id !== suggestionId));
      }
    },
    [refreshCore]
  );

  const openSuggestions = useMemo(
    () => suggestions.filter((suggestion) => !suggestion.approved),
    [suggestions]
  );

  const approvedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion.approved),
    [suggestions]
  );

  const vendorSummaries = useMemo(() => {
    const vendors = new Map();
    purchases.forEach((purchase) => {
      const vendorName = purchase.vendor?.name ?? 'Unknown Vendor';
      const vendorId = purchase.vendor?.id ?? vendorName;
      const existing = vendors.get(vendorId) ?? {
        name: vendorName,
        totalSpend: 0,
        openOrders: 0,
        lastPurchaseAt: null
      };
      existing.totalSpend += Number(purchase.total_amount ?? 0);
      const status = (purchase.status ?? '').toLowerCase();
      if (status !== 'paid') {
        existing.openOrders += 1;
      }
      const createdAt = purchase.created_at ? new Date(purchase.created_at) : null;
      if (createdAt && (!existing.lastPurchaseAt || createdAt > existing.lastPurchaseAt)) {
        existing.lastPurchaseAt = createdAt;
      }
      vendors.set(vendorId, existing);
    });

    return Array.from(vendors.values())
      .map((vendor) => ({
        ...vendor,
        lastPurchaseAt: vendor.lastPurchaseAt ? vendor.lastPurchaseAt.toISOString() : null,
        risk:
          vendor.openOrders >= 3 ? 'attention' : vendor.openOrders === 0 ? 'stable' : 'watch'
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
  }, [purchases]);

  const metrics = useMemo(() => {
    const currency = purchases[0]?.currency ?? 'USD';
    const totalSpend = purchases.reduce((sum, purchase) => sum + Number(purchase.total_amount ?? 0), 0);
    const openOrders = purchases.filter((purchase) => (purchase.status ?? '').toLowerCase() !== 'paid').length;
    const vendorCount = vendorSummaries.length;
    const vendorsNeedingAttention = vendorSummaries.filter((vendor) => vendor.risk !== 'stable').length;
    const openSuggestionCount = openSuggestions.length;
    const resolvedSuggestionCount = approvedSuggestions.length;
    const uniqueDocuments = new Set(
      purchases
        .map((purchase) => purchase.media_object?.id)
        .filter((value) => value !== undefined && value !== null)
    ).size;

    return [
      {
        label: 'Spend to Date',
        value: formatCurrency(totalSpend, currency),
        delta: `${openOrders} open orders`,
        tone: openOrders > 0 ? 'pending' : 'success'
      },
      {
        label: 'Active Vendors',
        value: vendorCount.toString(),
        delta: vendorsNeedingAttention ? `${vendorsNeedingAttention} needs review` : 'All clear',
        tone: vendorsNeedingAttention ? 'warning' : 'success'
      },
      {
        label: 'Open Suggestions',
        value: openSuggestionCount.toString(),
        delta: `${resolvedSuggestionCount} resolved`,
        tone: openSuggestionCount ? 'warning' : 'success'
      },
      {
        label: 'Documents Indexed',
        value: uniqueDocuments ? uniqueDocuments.toString() : '0',
        delta: lastSearched
          ? `${documents.length} results for “${lastSearched}”`
          : 'Search the knowledge graph',
        tone: uniqueDocuments ? 'success' : 'pending'
      }
    ];
  }, [approvedSuggestions.length, documents.length, lastSearched, openSuggestions.length, purchases, vendorSummaries]);

  return (
    <div className="app-shell">
      <DashboardHeader />
      {error && (
        <div
          style={{
            margin: '16px 0',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(248, 113, 113, 0.12)',
            border: '1px solid rgba(248, 113, 113, 0.35)',
            color: '#fecaca'
          }}
        >
          {error}
        </div>
      )}
      <div className="metrics-row">
        {metrics.map((metric) => (
          <MetricSummary key={metric.label} metric={metric} loading={isLoading} />
        ))}
      </div>

      <div className="app-grid">
        <div className="panel grid-span-8">
          <UploadPanel
            onUpload={handleUpload}
            uploads={uploads}
            isUploading={isUploading}
          />
        </div>
        <div className="panel grid-span-4">
          <EventTimeline events={events} isLoading={isLoading} />
        </div>
        <div className="panel grid-span-8">
          <PurchaseList purchases={purchases} isLoading={isLoading} />
        </div>
        <div className="panel grid-span-4">
          <VendorTable vendors={vendorSummaries} isLoading={isLoading} />
        </div>
        <div className="panel grid-span-6">
          <DocumentSearch
            documents={documents}
            query={searchQuery}
            onQueryChange={handleQueryChange}
            onSearch={handleSearch}
            isSearching={searching}
            lastSearched={lastSearched}
          />
        </div>
        <div className="panel grid-span-6">
          <SuggestionBoard
            open={openSuggestions}
            resolved={approvedSuggestions}
            onApprove={handleApprove}
            approving={approving}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
