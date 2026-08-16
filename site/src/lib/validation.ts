import { z } from "zod";
import { CITIES, MAX_AGE, MIN_AGE, REPORT_REASONS } from "./constants";

const cityValues = CITIES as readonly string[];

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("כתובת אימייל לא תקינה"),
  password: z
    .string()
    .min(8, "הסיסמה חייבת להיות באורך 8 תווים לפחות")
    .max(200, "הסיסמה ארוכה מדי"),
  displayName: z.string().trim().min(2, "שם קצר מדי").max(40, "שם ארוך מדי"),
  birthDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "תאריך לידה לא תקין"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  seeking: z.enum(["MEN", "WOMEN", "EVERYONE"]),
  city: z.string().refine((v) => cityValues.includes(v), "יש לבחור עיר מהרשימה"),
  goal: z.enum(["MARRIAGE", "SERIOUS", "CASUAL", "FRIENDSHIP", "UNSURE"]),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "יש לאשר את תנאי השימוש" }) }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("כתובת אימייל לא תקינה"),
  password: z.string().min(1, "יש להזין סיסמה"),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  city: z.string().refine((v) => cityValues.includes(v), "יש לבחור עיר מהרשימה"),
  bio: z.string().max(1000, "הטקסט ארוך מדי (עד 1000 תווים)").default(""),
  goal: z.enum(["MARRIAGE", "SERIOUS", "CASUAL", "FRIENDSHIP", "UNSURE"]),
  seeking: z.enum(["MEN", "WOMEN", "EVERYONE"]),
  heightCm: z.coerce.number().int().min(120).max(230).nullish(),
  hasKids: z.boolean().nullish(),
  smokes: z.boolean().nullish(),
  prefMinAge: z.coerce.number().int().min(MIN_AGE).max(MAX_AGE),
  prefMaxAge: z.coerce.number().int().min(MIN_AGE).max(MAX_AGE),
  prefCities: z.array(z.string()).max(10).default([]),
  isVisible: z.boolean().default(true),
});

export const searchSchema = z.object({
  gender: z.enum(["MALE", "FEMALE", "OTHER", "ANY"]).default("ANY"),
  city: z.string().default(""),
  minAge: z.coerce.number().int().min(MIN_AGE).max(MAX_AGE).default(MIN_AGE),
  maxAge: z.coerce.number().int().min(MIN_AGE).max(MAX_AGE).default(MAX_AGE),
  goal: z.enum(["MARRIAGE", "SERIOUS", "CASUAL", "FRIENDSHIP", "UNSURE", "ANY"]).default("ANY"),
  withPhoto: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).max(200).default(1),
});

export const messageSchema = z
  .object({
    conversationId: z.string().min(1),
    body: z.string().trim().max(2000).optional(),
    photoId: z.string().optional(),
  })
  .refine((v) => (v.body && v.body.length > 0) || v.photoId, {
    message: "אי אפשר לשלוח הודעה ריקה",
  });

export const reportSchema = z.object({
  reportedUserId: z.string().min(1),
  reason: z.string().refine((v) => (REPORT_REASONS as readonly string[]).includes(v), "סיבה לא תקינה"),
  details: z.string().max(1000).default(""),
  messageId: z.string().optional(),
  photoId: z.string().optional(),
});

export const affiliateApplySchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "הקוד קצר מדי")
    .max(24, "הקוד ארוך מדי")
    .regex(/^[a-z0-9-]+$/, "מותרים אותיות לועזיות קטנות, ספרות ומקף בלבד"),
  payoutNotes: z.string().max(500).default(""),
});

/** גיל מתאריך לידה */
export function ageFrom(birthDate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

/** תאריך הלידה המאוחר ביותר שעדיין נחשב לגיל `age` */
export function birthDateForAge(age: number, now = new Date()): Date {
  return new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
}
