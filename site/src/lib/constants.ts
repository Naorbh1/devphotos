export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "פגישה";

/** ערים ויישובים לבחירה בפרופיל ובחיפוש */
export const CITIES = [
  "תל אביב-יפו",
  "ירושלים",
  "חיפה",
  "ראשון לציון",
  "פתח תקווה",
  "אשדוד",
  "נתניה",
  "באר שבע",
  "בני ברק",
  "חולון",
  "רמת גן",
  "אשקלון",
  "רחובות",
  "בת ים",
  "בית שמש",
  "כפר סבא",
  "הרצליה",
  "חדרה",
  "מודיעין",
  "נצרת",
  "רעננה",
  "רהט",
  "לוד",
  "רמלה",
  "גבעתיים",
  "קריית גת",
  "נהריה",
  "אום אל-פחם",
  "אילת",
  "עפולה",
  "טבריה",
  "כרמיאל",
  "צפת",
  "דימונה",
  "יבנה",
  "נס ציונה",
  "קריית שמונה",
  "אחר",
] as const;

export const GENDER_LABELS: Record<string, string> = {
  MALE: "גבר",
  FEMALE: "אישה",
  OTHER: "אחר",
};

export const SEEKING_LABELS: Record<string, string> = {
  MEN: "גברים",
  WOMEN: "נשים",
  EVERYONE: "כולם",
};

export const GOAL_LABELS: Record<string, string> = {
  MARRIAGE: "נישואין",
  SERIOUS: "קשר רציני",
  CASUAL: "משהו קליל",
  FRIENDSHIP: "חברות",
  UNSURE: "עדיין בודק/ת",
};

export const REPORT_REASONS = [
  "פרופיל מזויף / התחזות",
  "תוכן מיני לא רצוי",
  "הטרדה או איומים",
  "ספאם או פרסום",
  "חשד לקטין",
  "הונאה כספית",
  "אחר",
] as const;

export const MIN_AGE = 18;
export const MAX_AGE = 99;

/** מגבלות העלאת תמונות */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_PROFILE_PHOTOS = 6;
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

/** מסלולי תשלום (מדומים — ראה README) */
export const PLANS = [
  { id: "premium_1m", label: "פרימיום — חודש", amountAgorot: 4900 },
  { id: "premium_3m", label: "פרימיום — 3 חודשים", amountAgorot: 11900 },
  { id: "premium_12m", label: "פרימיום — שנה", amountAgorot: 34900 },
] as const;

export const REFERRAL_COOKIE = "ref";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 יום
export const SESSION_COOKIE = "session";
