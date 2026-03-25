import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { Review, ReviewsSettings } from '../types';
import {
  loadReviews,
  saveReviews,
  loadReviewsSettings,
  saveReviewsSettings,
  DEFAULT_REVIEWS_SETTINGS,
  addReview,
} from '../services/reviewsService';

// ── Star display ──────────────────────────────────────────────────────────────
function StarRow({ rating, interactive = false, onChange }: {
  rating: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => interactive && setHover(n)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`text-xl leading-none transition-colors ${
            interactive ? 'cursor-pointer' : 'cursor-default'
          } ${n <= (hover || rating) ? 'text-amber-400' : 'text-gray-300'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ initials, color, size = 'sm' }: { initials: string; color: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md'
    ? 'h-12 w-12 text-base'
    : 'h-8 w-8 text-xs';
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

// ── Review card preview ───────────────────────────────────────────────────────
function ReviewCard({ review, settings }: { review: Review; settings: ReviewsSettings }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar initials={review.clientInitials} color={review.avatarColor} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-900">{review.clientName}</span>
            {settings.showDate && (
              <span className="text-xs text-gray-400">{format(parseISO(review.date), 'MMM d, yyyy')}</span>
            )}
          </div>
          {settings.showRating && <StarRow rating={review.rating} />}
          {settings.showServiceName && review.serviceName && (
            <span className="mt-1 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
              {review.serviceName}
            </span>
          )}
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{review.comment}</p>
        </div>
      </div>
    </div>
  );
}

// ── Add review modal ──────────────────────────────────────────────────────────
interface AddFormState {
  clientName: string;
  serviceName: string;
  rating: number;
  comment: string;
  date: string;
  featured: boolean;
  approved: boolean;
}

const EMPTY_FORM: AddFormState = {
  clientName: '',
  serviceName: '',
  rating: 5,
  comment: '',
  date: new Date().toISOString().slice(0, 10),
  featured: true,
  approved: true,
};

function AddReviewModal({ onClose, onSave }: { onClose: () => void; onSave: (r: Review) => void }) {
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof AddFormState, string>>>({});

  function update<K extends keyof AddFormState>(key: K, value: AddFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.clientName.trim()) e.clientName = 'Client name is required.';
    if (!form.comment.trim()) e.comment = 'Review text is required.';
    if (form.rating < 1) e.rating = 'Please select a rating.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const saved = addReview({ ...form, source: 'manual' });
    onSave(saved);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Testimonial</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {/* Client name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Client Name <span className="text-red-500">*</span></label>
            <input
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.clientName ? 'border-red-400' : 'border-gray-300'}`}
              value={form.clientName}
              onChange={(e) => update('clientName', e.target.value)}
              placeholder="e.g. Jane D."
            />
            {errors.clientName && <p className="mt-1 text-xs text-red-500">{errors.clientName}</p>}
          </div>
          {/* Service */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Service Name</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.serviceName}
              onChange={(e) => update('serviceName', e.target.value)}
              placeholder="e.g. Wellness Consultation"
            />
          </div>
          {/* Rating */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Rating <span className="text-red-500">*</span></label>
            <StarRow rating={form.rating} interactive onChange={(r) => update('rating', r)} />
            {errors.rating && <p className="mt-1 text-xs text-red-500">{errors.rating}</p>}
          </div>
          {/* Comment */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Review Text <span className="text-red-500">*</span></label>
            <textarea
              rows={4}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.comment ? 'border-red-400' : 'border-gray-300'}`}
              value={form.comment}
              onChange={(e) => update('comment', e.target.value)}
              placeholder="What did the client say?"
            />
            {errors.comment && <p className="mt-1 text-xs text-red-500">{errors.comment}</p>}
          </div>
          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
            />
          </div>
          {/* Toggles */}
          <div className="flex gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.approved}
                onChange={(e) => update('approved', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-sky-600"
              />
              Approved
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => update('featured', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-sky-600"
              />
              Featured (show on booking page)
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={handleSubmit} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">Save Testimonial</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════
export function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'reviews'>('reviews');
  const [reviews, setReviews] = useState<Review[]>(() => loadReviews());
  const [settings, setSettings] = useState<ReviewsSettings>(() => loadReviewsSettings());
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');
  const [previewStyle, setPreviewStyle] = useState<ReviewsSettings['displayStyle']>(settings.displayStyle);

  function updateSetting<K extends keyof ReviewsSettings>(key: K, value: ReviewsSettings[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'displayStyle') setPreviewStyle(value as ReviewsSettings['displayStyle']);
      return next;
    });
  }

  function handleSaveSettings() {
    saveReviewsSettings(settings);
    toast.success('Settings saved!');
  }

  function handleResetSettings() {
    setSettings(DEFAULT_REVIEWS_SETTINGS);
    saveReviewsSettings(DEFAULT_REVIEWS_SETTINGS);
    toast.success('Settings reset to defaults.');
  }

  function toggleApproved(id: string) {
    const updated = reviews.map((r) => r.id === id ? { ...r, approved: !r.approved } : r);
    setReviews(updated);
    saveReviews(updated);
    toast.success('Review updated.');
  }

  function toggleFeatured(id: string) {
    const updated = reviews.map((r) => r.id === id ? { ...r, featured: !r.featured } : r);
    setReviews(updated);
    saveReviews(updated);
    toast.success('Review updated.');
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this review?')) return;
    const updated = reviews.filter((r) => r.id !== id);
    setReviews(updated);
    saveReviews(updated);
    toast.success('Review deleted.');
  }

  function handleAddSaved(r: Review) {
    setReviews((prev) => [...prev, r]);
    setShowAddModal(false);
    toast.success('Testimonial added!');
  }

  const filtered = reviews.filter((r) => {
    if (filterStatus === 'approved') return r.approved;
    if (filterStatus === 'pending') return !r.approved;
    return true;
  });

  const featuredApproved = reviews.filter((r) => r.approved && r.featured);
  const pendingCount = reviews.filter((r) => !r.approved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Testimonials & Reviews</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage client feedback and control what appears on your booking page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          + Add Testimonial
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Reviews', value: reviews.length, icon: '💬' },
          { label: 'Approved', value: reviews.filter((r) => r.approved).length, icon: '✅' },
          { label: 'Featured', value: featuredApproved.length, icon: '⭐' },
          { label: 'Pending Approval', value: pendingCount, icon: pendingCount > 0 ? '🔔' : '✓' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-2xl">{icon}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {(['reviews', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'reviews' ? `Reviews (${reviews.length})` : 'Display Settings'}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Reviews ── */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Filter:</span>
            {(['all', 'approved', 'pending'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterStatus(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filterStatus === f
                    ? 'bg-sky-100 text-sky-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f} {f === 'all' ? `(${reviews.length})` : f === 'approved' ? `(${reviews.filter(r=>r.approved).length})` : `(${pendingCount})`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white py-12 text-center">
              <span className="text-4xl">💬</span>
              <p className="mt-3 text-sm font-medium text-gray-600">No reviews in this category.</p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="mt-4 text-sm text-sky-600 hover:underline"
              >
                Add the first testimonial →
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Review</th>
                    <th className="hidden px-4 py-3 text-left sm:table-cell">Service</th>
                    <th className="px-4 py-3 text-center">Rating</th>
                    <th className="px-4 py-3 text-center">Approved</th>
                    <th className="px-4 py-3 text-center">Featured</th>
                    <th className="hidden px-4 py-3 text-left sm:table-cell">Source</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: r.avatarColor }}
                          >
                            {r.clientInitials}
                          </div>
                          <span className="font-medium text-gray-900 whitespace-nowrap">{r.clientName}</span>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="line-clamp-2 text-gray-600">{r.comment}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-gray-500 sm:table-cell whitespace-nowrap">{r.serviceName || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-amber-400">{'★'.repeat(r.rating)}<span className="text-gray-200">{'★'.repeat(5 - r.rating)}</span></span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleApproved(r.id)}
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {r.approved ? '✓ Yes' : 'No'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleFeatured(r.id)}
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.featured ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {r.featured ? '⭐ Yes' : 'No'}
                        </button>
                      </td>
                      <td className="hidden px-4 py-3 text-gray-400 sm:table-cell text-xs capitalize whitespace-nowrap">{r.source}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Settings ── */}
      {activeTab === 'settings' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Settings form */}
          <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">Display Settings</h2>

            {/* Enable toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
              <div>
                <div className="font-medium text-gray-900">Enable Reviews Feature</div>
                <div className="text-xs text-gray-500">Turn on/off the entire reviews system</div>
              </div>
              <div
                onClick={() => updateSetting('enabled', !settings.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enabled ? 'bg-sky-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>

            {/* Show on booking page toggle */}
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
              <div>
                <div className="font-medium text-gray-900">Show on Booking Page</div>
                <div className="text-xs text-gray-500">Display testimonials to clients while booking</div>
              </div>
              <div
                onClick={() => updateSetting('displayOnBookingPage', !settings.displayOnBookingPage)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.displayOnBookingPage ? 'bg-sky-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings.displayOnBookingPage ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>

            {/* Heading */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Section Heading</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={settings.heading}
                onChange={(e) => updateSetting('heading', e.target.value)}
              />
            </div>

            {/* Subheading */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Subheading</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={settings.subheading}
                onChange={(e) => updateSetting('subheading', e.target.value)}
              />
            </div>

            {/* Display style */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Display Style</label>
              <div className="grid grid-cols-3 gap-2">
                {(['carousel', 'grid', 'list'] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => updateSetting('displayStyle', style)}
                    className={`rounded-lg border py-2 text-sm font-medium capitalize transition-colors ${
                      settings.displayStyle === style
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {style === 'carousel' ? '🎠' : style === 'grid' ? '⊞' : '☰'} {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Max displayed */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Max Testimonials Displayed: <span className="font-bold text-sky-600">{settings.maxDisplayed}</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={settings.maxDisplayed}
                onChange={(e) => updateSetting('maxDisplayed', Number(e.target.value))}
                className="w-full accent-sky-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>1</span><span>10</span>
              </div>
            </div>

            {/* Metadata toggles */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Show in each review:</p>
              {[
                { key: 'showRating' as const, label: 'Star Rating' },
                { key: 'showDate' as const, label: 'Review Date' },
                { key: 'showServiceName' as const, label: 'Service Name' },
              ].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => updateSetting(key, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-sky-600"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={handleResetSettings}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset Defaults
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-6">
            <h2 className="font-semibold text-gray-900">Preview</h2>
            <p className="text-xs text-gray-500">Showing up to {settings.maxDisplayed} featured, approved reviews.</p>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-1 text-center text-base font-bold text-gray-900">{settings.heading}</p>
              {settings.subheading && (
                <p className="mb-4 text-center text-xs text-gray-500">{settings.subheading}</p>
              )}
              {(() => {
                const publicReviews = reviews
                  .filter((r) => r.approved && r.featured)
                  .slice(0, settings.maxDisplayed);
                if (publicReviews.length === 0) {
                  return (
                    <p className="py-6 text-center text-sm text-gray-400">
                      No featured, approved reviews yet.
                    </p>
                  );
                }
                if (previewStyle === 'list') {
                  return (
                    <div className="space-y-3">
                      {publicReviews.map((r) => <ReviewCard key={r.id} review={r} settings={settings} />)}
                    </div>
                  );
                }
                if (previewStyle === 'grid') {
                  return (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {publicReviews.map((r) => <ReviewCard key={r.id} review={r} settings={settings} />)}
                    </div>
                  );
                }
                // Carousel — show first card only in preview
                return (
                  <div className="relative">
                    <ReviewCard review={publicReviews[0]} settings={settings} />
                    {publicReviews.length > 1 && (
                      <p className="mt-2 text-center text-xs text-gray-400">
                        + {publicReviews.length - 1} more in carousel
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddReviewModal onClose={() => setShowAddModal(false)} onSave={handleAddSaved} />
      )}
    </div>
  );
}
