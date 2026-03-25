import type { Review, ReviewsSettings } from '../types';

const REVIEWS_KEY = 'sos_reviews';
const SETTINGS_KEY = 'sos_reviews_settings';

const AVATAR_COLORS = [
  '#0284c7', '#7c3aed', '#059669', '#dc2626',
  '#d97706', '#db2777', '#2563eb', '#65a30d',
];

export const DEFAULT_REVIEWS_SETTINGS: ReviewsSettings = {
  enabled: true,
  displayOnBookingPage: true,
  showRating: true,
  showDate: true,
  showServiceName: true,
  maxDisplayed: 3,
  displayStyle: 'carousel',
  heading: 'What Our Clients Say',
  subheading: 'Join hundreds of happy clients who trust us with their care.',
};

const SAMPLE_REVIEWS: Review[] = [
  {
    id: 'sample-r1',
    clientName: 'Margaret T.',
    clientInitials: 'MT',
    avatarColor: '#0284c7',
    rating: 5,
    comment:
      "Absolutely wonderful experience! The staff is incredibly attentive and made me feel right at home. I've been coming every week for three months now.",
    serviceName: 'Physical Therapy Session',
    date: '2026-03-10',
    featured: true,
    approved: true,
    source: 'manual',
  },
  {
    id: 'sample-r2',
    clientName: 'Robert H.',
    clientInitials: 'RH',
    avatarColor: '#059669',
    rating: 5,
    comment:
      'Booking online was so easy! The reminder texts are really helpful. The service itself was exceptional — exactly what I needed.',
    serviceName: 'Wellness Consultation',
    date: '2026-03-15',
    featured: true,
    approved: true,
    source: 'post-booking',
  },
  {
    id: 'sample-r3',
    clientName: 'Eleanor V.',
    clientInitials: 'EV',
    avatarColor: '#7c3aed',
    rating: 5,
    comment:
      'I was nervous at first but the team put me completely at ease. Professional, caring, and highly skilled. Highly recommend!',
    serviceName: 'Physical Therapy Session',
    date: '2026-03-18',
    featured: true,
    approved: true,
    source: 'post-booking',
  },
  {
    id: 'sample-r4',
    clientName: 'James W.',
    clientInitials: 'JW',
    avatarColor: '#d97706',
    rating: 4,
    comment: 'Great service and easy to reschedule when I needed to. Will definitely be back.',
    serviceName: 'Follow-up Visit',
    date: '2026-02-28',
    featured: false,
    approved: true,
    source: 'post-booking',
  },
  {
    id: 'sample-r5',
    clientName: 'Patricia L.',
    clientInitials: 'PL',
    avatarColor: '#dc2626',
    rating: 5,
    comment:
      'Best decision I made this year. My quality of life has improved so much since starting these sessions.',
    serviceName: 'Wellness Consultation',
    date: '2026-01-20',
    featured: false,
    approved: true,
    source: 'manual',
  },
];

export function loadReviews(): Review[] {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    if (!raw) {
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(SAMPLE_REVIEWS));
      return SAMPLE_REVIEWS;
    }
    return JSON.parse(raw) as Review[];
  } catch {
    return SAMPLE_REVIEWS;
  }
}

export function saveReviews(reviews: Review[]): void {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

export function loadReviewsSettings(): ReviewsSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_REVIEWS_SETTINGS;
    return { ...DEFAULT_REVIEWS_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REVIEWS_SETTINGS;
  }
}

export function saveReviewsSettings(settings: ReviewsSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function addReview(
  review: Omit<Review, 'id' | 'clientInitials' | 'avatarColor'>,
): Review {
  const reviews = loadReviews();
  const newReview: Review = {
    ...review,
    id: `r${Date.now()}`,
    clientInitials: getInitials(review.clientName),
    avatarColor: getAvatarColor(review.clientName),
  };
  saveReviews([...reviews, newReview]);
  return newReview;
}

export function getPublicReviews(max: number): Review[] {
  return loadReviews()
    .filter((r) => r.approved && r.featured)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, max);
}
