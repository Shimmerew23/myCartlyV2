import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, Search, MapPin, Package, Truck, CheckCircle,
  Clock, AlertCircle, ChevronDown, RotateCcw, X
} from 'lucide-react';
import api from '@/api/axios';
import { Order, OrderStatus } from '@/types';
import toast from 'react-hot-toast';
import { Helmet } from 'react-helmet-async';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'badge-warning',
  confirmed: 'badge-primary',
  processing: 'badge-primary',
  shipped: 'badge-neutral',
  out_for_delivery: 'badge-neutral',
  delivered: 'badge-success',
  cancelled: 'badge-error',
  return_requested: 'badge-warning',
  returned: 'badge-warning',
  refunded: 'badge-error',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return_requested: 'Return Requested',
  returned: 'Returned',
  refunded: 'Refunded',
};

// Actions available per current status
const AVAILABLE_ACTIONS: Partial<Record<OrderStatus, Array<{ value: string; label: string }>>> = {
  confirmed: [{ value: 'mark_processing', label: 'Mark as Processing' }],
  processing: [{ value: 'mark_shipped', label: 'Mark as Shipped' }],
  shipped: [
    { value: 'mark_out_for_delivery', label: 'Mark as Out for Delivery' },
    { value: 'mark_delivered', label: 'Mark as Delivered' },
    { value: 'location_update', label: 'Update Location Only' },
  ],
  out_for_delivery: [
    { value: 'mark_delivered', label: 'Mark as Delivered' },
    { value: 'location_update', label: 'Update Location Only' },
  ],
};

const WarehouseScan = () => {
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [action, setAction] = useState('');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setScanning(true);
    setOrder(null);
    setAction('');
    try {
      const { data } = await api.get('/warehouse/scan', { params: { q: query.trim() } });
      setOrder(data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Order not found');
    } finally {
      setScanning(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setOrder(null);
    setAction('');
    setLocation('');
    setNote('');
    setTrackingNumber('');
    inputRef.current?.focus();
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !action) return;
    if (action === 'mark_shipped' && !trackingNumber.trim()) {
      toast.error('Tracking number is required to mark as Shipped');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.put(`/warehouse/orders/${order._id}/check-in`, {
        action,
        location: location.trim() || undefined,
        note: note.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
      });
      toast.success(data.message || 'Parcel updated');
      setOrder(data.data);
      setAction('');
      setLocation('');
      setNote('');
      setTrackingNumber('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const availableActions = order ? (AVAILABLE_ACTIONS[order.status] || []) : [];

  return (
    <>
      <Helmet><title>Scan Parcel | Warehouse — CartLy</title></Helmet>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-headline text-2xl font-black tracking-tighter">Parcel Scanner</h1>
          <p className="text-sm text-outline mt-0.5">Enter or scan an order number to look up a parcel</p>
        </div>

        {/* Scan Input */}
        <div className="card p-6">
          <form onSubmit={handleScan} className="flex gap-3">
            <div className="relative flex-1">
              <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Order number (e.g. CUR-1234567890-000001) or Order ID..."
                autoFocus
                className="w-full pl-9 pr-9 py-2.5 text-sm bg-surface-low border border-transparent rounded-md focus:outline-none focus:border-outline-variant transition-all font-mono"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={scanning || !query.trim()}
              className="btn-primary text-sm px-5 disabled:opacity-50"
            >
              {scanning ? (
                <RotateCcw size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              {scanning ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Order Result */}
        <AnimatePresence>
          {order && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Order Summary */}
              <div className="card p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-outline mb-1">{order.orderNumber}</p>
                    <h2 className="font-headline font-black text-xl tracking-tight">
                      {typeof order.user === 'object' ? order.user.name : '—'}
                    </h2>
                    <p className="text-sm text-outline">
                      {typeof order.user === 'object' ? order.user.email : ''}
                    </p>
                  </div>
                  <span className={`badge ${STATUS_COLORS[order.status]} text-sm`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>

                {/* Shipping address */}
                <div className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-low rounded-md p-3">
                  <MapPin size={14} className="flex-shrink-0 mt-0.5 text-outline" />
                  <span>
                    {order.shippingAddress.name} — {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                  </span>
                </div>

                {/* Items */}
                <div>
                  <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-2">Items ({order.items.length})</p>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item._id} className="flex items-center gap-3">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {item.variant && (
                            <p className="text-xs text-outline">{item.variant.name}: {item.variant.value}</p>
                          )}
                        </div>
                        <span className="text-sm text-outline flex-shrink-0">×{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracking */}
                {order.tracking?.trackingNumber && (
                  <div className="flex items-center gap-2 text-sm bg-surface-low rounded-md p-3">
                    <Truck size={14} className="text-outline flex-shrink-0" />
                    <span className="text-outline">Carrier:</span>
                    <span className="font-medium">{order.tracking.carrier || 'N/A'}</span>
                    <span className="text-outline ml-2">Tracking:</span>
                    <span className="font-mono text-xs">{order.tracking.trackingNumber}</span>
                  </div>
                )}

                {order.tracking?.lastLocation && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={13} className="text-outline" />
                    <span className="text-outline text-xs">Last location:</span>
                    <span className="text-sm font-medium">{order.tracking.lastLocation}</span>
                    {order.tracking.lastLocationUpdatedAt && (
                      <span className="text-xs text-outline ml-auto">
                        {new Date(order.tracking.lastLocationUpdatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Status History */}
              <div className="card p-6">
                <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-3">
                  Status History
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {[...order.statusHistory].reverse().map((h, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <Clock size={12} className="flex-shrink-0 mt-0.5 text-outline" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`badge text-[10px] ${STATUS_COLORS[h.status as OrderStatus] || 'badge-neutral'}`}>
                            {STATUS_LABELS[h.status as OrderStatus] || h.status}
                          </span>
                          {(h as any).warehouseName && (
                            <span className="text-xs text-outline">@ {(h as any).warehouseName}</span>
                          )}
                        </div>
                        {h.note && <p className="text-xs text-outline mt-0.5">{h.note}</p>}
                      </div>
                      <span className="text-xs text-outline flex-shrink-0">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Check-in Action Panel */}
              {availableActions.length > 0 ? (
                <div className="card p-6">
                  <p className="text-xs font-semibold text-outline uppercase tracking-wider mb-4">
                    Parcel Check-In
                  </p>
                  <form onSubmit={handleCheckIn} className="space-y-4">
                    {/* Action selector */}
                    <div className="relative">
                      <select
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        className="w-full appearance-none pl-3 pr-8 py-2.5 text-sm bg-surface-low border border-transparent rounded-md focus:outline-none focus:border-outline-variant transition-all cursor-pointer"
                      >
                        <option value="">— Select action —</option>
                        {availableActions.map((a) => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                    </div>

                    {/* Tracking number (required for shipped) */}
                    {action === 'mark_shipped' && (
                      <input
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Tracking number (required)"
                        className="w-full px-3 py-2.5 text-sm bg-surface-low border border-transparent rounded-md focus:outline-none focus:border-outline-variant transition-all font-mono"
                      />
                    )}

                    {/* Location */}
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Location (e.g. Warehouse NYC, Gate 3)"
                      className="w-full px-3 py-2.5 text-sm bg-surface-low border border-transparent rounded-md focus:outline-none focus:border-outline-variant transition-all"
                    />

                    {/* Note */}
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional note..."
                      rows={2}
                      className="w-full px-3 py-2.5 text-sm bg-surface-low border border-transparent rounded-md focus:outline-none focus:border-outline-variant transition-all resize-none"
                    />

                    <button
                      type="submit"
                      disabled={submitting || !action}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {submitting ? (
                        <RotateCcw size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle size={14} />
                      )}
                      {submitting ? 'Updating...' : 'Confirm Check-In'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="card p-5 flex items-center gap-3 text-sm text-outline">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  No further actions available for this order's current status ({STATUS_LABELS[order.status]}).
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!order && !scanning && (
          <div className="card p-12 flex flex-col items-center gap-3 text-outline">
            <Package size={36} className="opacity-30" />
            <p className="text-sm">Scan or enter an order number above to get started</p>
          </div>
        )}
      </div>
    </>
  );
};

export default WarehouseScan;
