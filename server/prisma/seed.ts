/**
 * Development seed: the two users, their bottles, the bird catalogue, a small
 * curated fact library and a few sample logs so the app is immediately usable.
 * Safe to re-run — everything is upserted.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { localDateKey } from '../src/lib/time.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const BIRDS = [
  {
    id: 'henna',
    name: 'Henna',
    emoji: '🐦',
    description: 'The default. A long white bird with warm henna-coloured feathers — orange-red, like the dye. Yours from the start.',
    priceCoins: 0,
    isDefault: true,
    sortOrder: 0,
  },
  {
    id: 'princesa',
    name: 'Princesa',
    emoji: '🕊️',
    description: 'Pure white from head to tail, with a bright orange beak.',
    priceCoins: 30,
    isDefault: false,
    sortOrder: 1,
  },
  {
    id: 'prince',
    name: 'Prince',
    emoji: '🐦‍⬛',
    description: 'Placeholder companion. Artwork to come.',
    priceCoins: 60,
    isDefault: false,
    sortOrder: 2,
  },
  {
    id: 'paloma',
    name: 'Paloma',
    emoji: '🦢',
    description: 'Placeholder companion. Artwork to come.',
    priceCoins: 120,
    isDefault: false,
    sortOrder: 3,
  },
];

// Placeholder library. Deliberately conservative, general wording — these are
// stand-ins to be replaced with properly researched and cited facts later.
const FACTS = [
  {
    text: 'Water helps your body regulate its temperature.',
    sourceReference: 'placeholder — to verify',
    category: 'physiology',
  },
  {
    text: 'Most of your daily fluid comes from drinks, but food contributes too.',
    sourceReference: 'placeholder — to verify',
    category: 'intake',
  },
  {
    text: 'Thirst tends to lag behind your body’s actual need, so small regular sips help.',
    sourceReference: 'placeholder — to verify',
    category: 'behaviour',
  },
  {
    text: 'Warm weather and exercise both increase how much fluid you use.',
    sourceReference: 'placeholder — to verify',
    category: 'context',
  },
  {
    text: 'Spreading water through the day is usually easier than drinking a lot at once.',
    sourceReference: 'placeholder — to verify',
    category: 'behaviour',
  },
  {
    text: 'Pale straw-coloured urine is a rough everyday sign of decent hydration.',
    sourceReference: 'placeholder — to verify',
    category: 'signals',
  },
];

const PEOPLE = [
  {
    key: 'principe',
    name: 'Principe',
    dailyTargetMl: 2500,
    timezone: 'Europe/Rome',
    coinBalance: 40,
    smallIntakeMl: 200,
    mediumIntakeMl: 300,
    largeIntakeMl: 400,
    bottles: [
      { name: 'Work Bottle', capacityMl: 1000, isActive: true },
      { name: 'Big Bottle', capacityMl: 2000, isActive: false },
    ],
    sampleLogs: [
      { hour: 9, minute: 13, amountMl: 200, sourceType: 'small_intake' as const, label: 'Small intake' },
      { hour: 11, minute: 40, amountMl: 1000, sourceType: 'bottle' as const, label: 'Work Bottle' },
    ],
  },
  {
    key: 'principessa',
    name: 'Principessa',
    dailyTargetMl: 2000,
    timezone: 'Europe/Rome',
    coinBalance: 70,
    smallIntakeMl: 250,
    mediumIntakeMl: 325,
    largeIntakeMl: 400,
    bottles: [
      { name: 'Small Bottle', capacityMl: 750, isActive: true },
      { name: 'Desk Bottle', capacityMl: 1500, isActive: false },
    ],
    sampleLogs: [
      { hour: 8, minute: 30, amountMl: 250, sourceType: 'small_intake' as const, label: 'Small intake' },
      { hour: 10, minute: 5, amountMl: 750, sourceType: 'bottle' as const, label: 'Small Bottle' },
      { hour: 14, minute: 8, amountMl: 400, sourceType: 'large_intake' as const, label: 'Large intake' },
    ],
  },
];

async function main() {
  for (const bird of BIRDS) {
    await prisma.bird.upsert({ where: { id: bird.id }, create: bird, update: bird });
  }

  // Drop birds from earlier seeds that are no longer in the catalogue. Move any
  // user still pointing at one back to the default first so the FK is happy.
  const keepIds = BIRDS.map((bird) => bird.id);
  await prisma.user.updateMany({
    where: { activeBirdId: { notIn: keepIds } },
    data: { activeBirdId: 'henna' },
  });
  await prisma.bird.deleteMany({ where: { id: { notIn: keepIds } } });

  await prisma.hydrationFact.deleteMany({});
  await prisma.hydrationFact.createMany({
    data: FACTS.map((fact, index) => ({ ...fact, sortOrder: index })),
  });

  const now = new Date();

  for (const person of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { key: person.key },
      create: {
        key: person.key,
        name: person.name,
        dailyTargetMl: person.dailyTargetMl,
        timezone: person.timezone,
        coinBalance: person.coinBalance,
        smallIntakeMl: person.smallIntakeMl,
        mediumIntakeMl: person.mediumIntakeMl,
        largeIntakeMl: person.largeIntakeMl,
        activeBirdId: 'henna',
      },
      update: {
        name: person.name,
        smallIntakeMl: person.smallIntakeMl,
        mediumIntakeMl: person.mediumIntakeMl,
        largeIntakeMl: person.largeIntakeMl,
      },
    });

    await prisma.ownedBird.upsert({
      where: { userId_birdId: { userId: user.id, birdId: 'henna' } },
      create: { userId: user.id, birdId: 'henna' },
      update: {},
    });

    await prisma.notificationSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        enabled: true,
        intervalMinutes: 120,
        wakeMinute: 8 * 60,
        sleepMinute: 22 * 60 + 30,
      },
      update: {},
    });

    const existingBottles = await prisma.bottle.count({ where: { userId: user.id } });
    if (existingBottles === 0) {
      for (const bottle of person.bottles) {
        await prisma.bottle.create({ data: { ...bottle, userId: user.id } });
      }
    }

    const localDate = localDateKey(now, person.timezone);
    const existingLogs = await prisma.hydrationLog.count({
      where: { userId: user.id, localDate },
    });
    if (existingLogs === 0) {
      const activeBottle = await prisma.bottle.findFirst({
        where: { userId: user.id, isActive: true },
      });
      for (const entry of person.sampleLogs) {
        const loggedAt = new Date(now);
        loggedAt.setHours(entry.hour, entry.minute, 0, 0);
        if (loggedAt > now) continue; // do not seed logs in the future
        await prisma.hydrationLog.create({
          data: {
            userId: user.id,
            amountMl: entry.amountMl,
            sourceType: entry.sourceType,
            label: entry.label,
            bottleId: entry.sourceType === 'bottle' ? activeBottle?.id ?? null : null,
            bottleCapacityMl: entry.sourceType === 'bottle' ? activeBottle?.capacityMl ?? null : null,
            loggedAt,
            localDate,
          },
        });
      }
    }

    console.log(`seeded ${person.name}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
