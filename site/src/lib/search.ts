import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { birthDateForAge } from "./validation";

export type SearchParams = {
  gender: "MALE" | "FEMALE" | "OTHER" | "ANY";
  city: string;
  minAge: number;
  maxAge: number;
  goal: "MARRIAGE" | "SERIOUS" | "CASUAL" | "FRIENDSHIP" | "UNSURE" | "ANY";
  withPhoto: boolean;
  page: number;
};

export const PAGE_SIZE = 12;

export type SearchResult = {
  userId: string;
  displayName: string;
  age: number;
  city: string;
  goal: string;
  bio: string;
  photoId: string | null;
  liked: boolean;
};

export async function searchProfiles(viewerId: string, params: SearchParams) {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const excludedIds = new Set<string>([viewerId]);
  for (const b of blocks) {
    excludedIds.add(b.blockerId);
    excludedIds.add(b.blockedId);
  }

  // מי שכבר דילגתי עליו לא חוזר בתוצאות
  const passed = await prisma.like.findMany({
    where: { fromUserId: viewerId, isLike: false },
    select: { toUserId: true },
  });
  for (const p of passed) excludedIds.add(p.toUserId);

  const where: Prisma.ProfileWhereInput = {
    isVisible: true,
    user: { status: "ACTIVE", id: { notIn: [...excludedIds] } },
    birthDate: {
      lte: birthDateForAge(params.minAge),
      gt: birthDateForAge(params.maxAge + 1),
    },
  };
  if (params.gender !== "ANY") where.gender = params.gender;
  if (params.city) where.city = params.city;
  if (params.goal !== "ANY") where.goal = params.goal;
  if (params.withPhoto) {
    where.user = {
      ...(where.user as Prisma.UserWhereInput),
      photos: { some: { kind: "PROFILE", status: "APPROVED" } },
    };
  }

  const skip = (params.page - 1) * PAGE_SIZE;

  const [total, profiles] = await Promise.all([
    prisma.profile.count({ where }),
    prisma.profile.findMany({
      where,
      orderBy: { user: { lastActiveAt: "desc" } },
      skip,
      take: PAGE_SIZE,
      select: {
        userId: true,
        displayName: true,
        birthDate: true,
        city: true,
        goal: true,
        bio: true,
        user: {
          select: {
            photos: {
              where: { kind: "PROFILE", status: "APPROVED" },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    }),
  ]);

  const ids = profiles.map((p) => p.userId);
  const myLikes = await prisma.like.findMany({
    where: { fromUserId: viewerId, toUserId: { in: ids }, isLike: true },
    select: { toUserId: true },
  });
  const likedSet = new Set(myLikes.map((l) => l.toUserId));

  const now = new Date();
  const results: SearchResult[] = profiles.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    age: ageOf(p.birthDate, now),
    city: p.city,
    goal: p.goal,
    bio: p.bio,
    photoId: p.user.photos[0]?.id ?? null,
    liked: likedSet.has(p.userId),
  }));

  return { total, results, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

function ageOf(birthDate: Date, now: Date) {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}
