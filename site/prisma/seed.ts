/**
 * זרעי נתונים לפיתוח: מנהל, שותף מאושר ומשתמשי דמו עם התאמות ושיחה.
 * הרצה: npm run db:seed
 */
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient, type Gender, type RelationshipGoal, type Seeking } from "@prisma/client";

const prisma = new PrismaClient();
const scrypt = promisify(_scrypt) as (p: string, s: Buffer, l: number) => Promise<Buffer>;

async function hash(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

const DEMO_PASSWORD = "demo1234";

type DemoUser = {
  email: string;
  name: string;
  age: number;
  gender: Gender;
  seeking: Seeking;
  city: string;
  goal: RelationshipGoal;
  bio: string;
};

const DEMO_USERS: DemoUser[] = [
  {
    email: "noa@example.com",
    name: "נועה",
    age: 29,
    gender: "FEMALE",
    seeking: "MEN",
    city: "תל אביב-יפו",
    goal: "SERIOUS",
    bio: "מעצבת גרפית, רצה בפארק הירקון בבקרים ומבשלת יותר מדי בערבים.",
  },
  {
    email: "yossi@example.com",
    name: "יוסי",
    age: 34,
    gender: "MALE",
    seeking: "WOMEN",
    city: "תל אביב-יפו",
    goal: "SERIOUS",
    bio: "מהנדס תוכנה, חובב טיולים בצפון ומוזיקה חיה.",
  },
  {
    email: "maya@example.com",
    name: "מאיה",
    age: 26,
    gender: "FEMALE",
    seeking: "MEN",
    city: "חיפה",
    goal: "MARRIAGE",
    bio: "סטודנטית לרפואה, אוהבת ים, ספרים ושקט.",
  },
  {
    email: "avi@example.com",
    name: "אבי",
    age: 41,
    gender: "MALE",
    seeking: "WOMEN",
    city: "ירושלים",
    goal: "MARRIAGE",
    bio: "מורה להיסטוריה, אבא לשניים, מחפש שותפה לדרך.",
  },
  {
    email: "dana@example.com",
    name: "דנה",
    age: 31,
    gender: "FEMALE",
    seeking: "EVERYONE",
    city: "באר שבע",
    goal: "FRIENDSHIP",
    bio: "פיזיותרפיסטית, רוכבת אופניים, מחפשת קודם כל חברים טובים.",
  },
  {
    email: "omer@example.com",
    name: "עומר",
    age: 27,
    gender: "MALE",
    seeking: "WOMEN",
    city: "רמת גן",
    goal: "CASUAL",
    bio: "ברמן וסטנדאפיסט חובב. מבטיח לפחות צחוק אחד.",
  },
  {
    email: "shirin@example.com",
    name: "שירין",
    age: 30,
    gender: "FEMALE",
    seeking: "MEN",
    city: "נצרת",
    goal: "SERIOUS",
    bio: "אדריכלית, מטיילת בגליל בכל הזדמנות.",
  },
  {
    email: "eitan@example.com",
    name: "איתן",
    age: 38,
    gender: "MALE",
    seeking: "EVERYONE",
    city: "נתניה",
    goal: "UNSURE",
    bio: "צלם עצמאי, גר מול הים, אוהב שיחות ארוכות.",
  },
];

function birthDateFor(age: number) {
  const now = new Date();
  return new Date(now.getFullYear() - age, (age * 7) % 12, ((age * 3) % 27) + 1);
}

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { role: "ADMIN" },
    create: {
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
      profile: {
        create: {
          displayName: "מנהל האתר",
          birthDate: birthDateFor(35),
          gender: "OTHER",
          seeking: "EVERYONE",
          city: "תל אביב-יפו",
          goal: "UNSURE",
          isVisible: false,
          completedAt: new Date(),
        },
      },
    },
    select: { id: true },
  });

  const users: Record<string, string> = {};
  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {},
      create: {
        email: demo.email,
        passwordHash,
        profile: {
          create: {
            displayName: demo.name,
            birthDate: birthDateFor(demo.age),
            gender: demo.gender,
            seeking: demo.seeking,
            city: demo.city,
            goal: demo.goal,
            bio: demo.bio,
            prefMinAge: Math.max(18, demo.age - 8),
            prefMaxAge: demo.age + 8,
            completedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });
    users[demo.email] = user.id;
  }

  // שותף מאושר עם קוד לדוגמה
  await prisma.affiliate.upsert({
    where: { userId: users["dana@example.com"] },
    update: { status: "ACTIVE" },
    create: {
      userId: users["dana@example.com"],
      code: "dana",
      status: "ACTIVE",
      ratePercent: 30,
      signupBountyAgorot: 500,
      payoutNotes: "העברה בנקאית",
    },
  });

  // התאמה הדדית + שיחה לדוגמה בין נועה ליוסי
  const [a, b] = [users["noa@example.com"], users["yossi@example.com"]].sort();
  await prisma.like.upsert({
    where: { fromUserId_toUserId: { fromUserId: a, toUserId: b } },
    update: {},
    create: { fromUserId: a, toUserId: b, isLike: true },
  });
  await prisma.like.upsert({
    where: { fromUserId_toUserId: { fromUserId: b, toUserId: a } },
    update: {},
    create: { fromUserId: b, toUserId: a, isLike: true },
  });
  await prisma.match.upsert({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    update: {},
    create: { userAId: a, userBId: b },
  });
  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    update: {},
    create: { userAId: a, userBId: b },
    select: { id: true },
  });

  const hasMessages = await prisma.message.count({
    where: { conversationId: conversation.id },
  });
  if (hasMessages === 0) {
    await prisma.message.createMany({
      data: [
        { conversationId: conversation.id, senderId: a, body: "היי! ראיתי שגם את/ה אוהב/ת טיולים בצפון 🙂" },
        { conversationId: conversation.id, senderId: b, body: "היי! נכון, הייתי בשבוע שעבר בנחל כזיב. את מכירה?" },
      ],
    });
  }

  // לייקים נכנסים שממתינים לתשובה של נועה
  for (const email of ["omer@example.com", "eitan@example.com"]) {
    await prisma.like.upsert({
      where: {
        fromUserId_toUserId: { fromUserId: users[email], toUserId: users["noa@example.com"] },
      },
      update: {},
      create: { fromUserId: users[email], toUserId: users["noa@example.com"], isLike: true },
    });
  }

  console.log("נוצרו נתוני דמו.");
  console.log(`מנהל: admin@example.com / ${DEMO_PASSWORD} (id: ${admin.id})`);
  console.log(`משתמשי דמו: ${DEMO_USERS.map((u) => u.email).join(", ")} — אותה סיסמה`);
  console.log("שותף לדוגמה: dana@example.com, קישור /r/dana");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
