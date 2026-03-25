import type { WaiverTemplate, SignedWaiver, WaiverFormField } from '../types';

// ── Storage keys ──────────────────────────────────────────────────────────────
const TEMPLATES_KEY = 'sos_waiver_templates';
const SIGNED_KEY = 'sos_signed_waivers';

// ── Default template ──────────────────────────────────────────────────────────
const DEFAULT_FIELDS: WaiverFormField[] = [
  {
    id: 'photo-opt-out',
    label: 'I opt out of photo/video capture during my sessions',
    type: 'checkbox',
    required: false,
  },
  {
    id: 'physician-name',
    label: 'Physician or Healthcare Provider Name',
    type: 'text',
    required: false,
    placeholder: 'Dr. Jane Smith',
    helpText: 'Optional — included in your health record',
  },
  {
    id: 'medical-conditions',
    label: 'Pre-existing medical conditions or recent surgeries',
    type: 'textarea',
    required: false,
    placeholder: 'List any conditions, injuries, or limitations we should know about…',
  },
];

const WAIVER_TEXT = `RELEASE OF LIABILITY, WAIVER OF CLAIMS AND INDEMNITY AGREEMENT

Please read this document carefully. By signing you are giving up legal rights.

1. ASSUMPTION OF RISK
I, the undersigned, voluntarily participate in fitness activities and services provided by this facility ("Provider"). I understand that participation in physical exercise involves inherent risks including, but not limited to, muscle strains, sprains, fractures, heart attack, and in extreme cases, death. I am fully aware of these risks and voluntarily choose to participate.

2. MEDICAL CLEARANCE & HEALTH DISCLOSURE
I represent that I am in good physical health and have no medical condition, injury, or disability that would prevent safe participation without risk of harm to myself or others. I agree to immediately inform my instructor of any changes to my health status. I understand it is my responsibility to consult a physician before beginning any exercise program.

3. RELEASE OF LIABILITY
In consideration of being allowed to participate, I hereby release, waive, and hold harmless the Provider, its owners, directors, officers, employees, volunteers, and agents from any and all claims, demands, actions, or causes of action arising from or related to my participation, whether caused by negligence or otherwise, except in cases of gross negligence or willful misconduct.

4. INDEMNIFICATION
I agree to indemnify and defend the Provider against any and all claims, losses, and expenses (including reasonable attorney's fees) arising from my participation or breach of this agreement.

5. HEALTH INFORMATION CONSENT
I consent to the collection, storage, and use of my health and personal information provided herein solely for the purpose of delivering safe, appropriate fitness services. I understand my information will be kept confidential and not shared with third parties except as required by law.

6. PHOTO & VIDEO CONSENT
I consent to the Provider capturing photographs or videos during sessions for promotional, educational, or social media purposes. I may opt out by selecting the option below.

7. GOVERNING LAW
This Agreement shall be governed by the laws of the applicable jurisdiction. If any provision is found invalid or unenforceable, the remaining provisions shall remain in full force and effect.

I have read and understood this entire agreement, I am signing it voluntarily, and I acknowledge that my typed name below constitutes a legally binding electronic signature.`;

export const DEFAULT_WAIVER_TEMPLATES: WaiverTemplate[] = [
  {
    id: 'waiver-general-liability',
    name: 'General Liability & Consent Waiver',
    description: 'Standard liability waiver and consent form required before all services.',
    waiverText: WAIVER_TEXT,
    requireSignature: true,
    requireInitials: false,
    serviceIds: [],   // empty = all services
    customFields: DEFAULT_FIELDS,
    active: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Load / save templates ─────────────────────────────────────────────────────
export function loadWaiverTemplates(): WaiverTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return DEFAULT_WAIVER_TEMPLATES;
    return JSON.parse(raw) as WaiverTemplate[];
  } catch {
    return DEFAULT_WAIVER_TEMPLATES;
  }
}

export function saveWaiverTemplates(templates: WaiverTemplate[]): void {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

// ── Load / save signed waivers ────────────────────────────────────────────────
export function loadSignedWaivers(): SignedWaiver[] {
  try {
    const raw = localStorage.getItem(SIGNED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SignedWaiver[];
  } catch {
    return [];
  }
}

export function saveSignedWaivers(waivers: SignedWaiver[]): void {
  localStorage.setItem(SIGNED_KEY, JSON.stringify(waivers));
}

/** Persist a newly signed waiver and return it with an assigned id */
export function submitSignedWaiver(entry: Omit<SignedWaiver, 'id'>): SignedWaiver {
  const signed: SignedWaiver = {
    ...entry,
    id: `SW-${Date.now().toString(36).toUpperCase()}`,
  };
  const existing = loadSignedWaivers();
  saveSignedWaivers([signed, ...existing]);
  return signed;
}

/** Update the bookingId on previously saved waivers */
export function linkWaiversToBooking(waiverIds: string[], bookingId: string): void {
  const all = loadSignedWaivers();
  const updated = all.map((w) =>
    waiverIds.includes(w.id) ? { ...w, bookingId } : w,
  );
  saveSignedWaivers(updated);
}

/** Return active waiver templates applicable to a given serviceId */
export function getWaiversForService(serviceId: string): WaiverTemplate[] {
  return loadWaiverTemplates().filter(
    (t) => t.active && (t.serviceIds.length === 0 || t.serviceIds.includes(serviceId)),
  );
}

/** Generate a blank field-response map for a template */
export function buildEmptyResponses(
  template: WaiverTemplate,
): Record<string, string | boolean> {
  const map: Record<string, string | boolean> = {};
  for (const field of template.customFields) {
    map[field.id] = field.type === 'checkbox' ? false : '';
  }
  return map;
}
