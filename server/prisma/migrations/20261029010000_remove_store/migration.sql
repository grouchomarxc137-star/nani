-- DropIndex
DROP INDEX "DailyReward_userId_date_key";

-- DropIndex
DROP INDEX "OwnedBird_userId_birdId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DailyReward";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Bird";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OwnedBird";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dailyTargetMl" INTEGER NOT NULL DEFAULT 2500,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome',
    "smallIntakeMl" INTEGER NOT NULL DEFAULT 200,
    "mediumIntakeMl" INTEGER NOT NULL DEFAULT 300,
    "largeIntakeMl" INTEGER NOT NULL DEFAULT 400,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "dailyTargetMl", "id", "key", "largeIntakeMl", "mediumIntakeMl", "name", "smallIntakeMl", "timezone", "updatedAt") SELECT "createdAt", "dailyTargetMl", "id", "key", "largeIntakeMl", "mediumIntakeMl", "name", "smallIntakeMl", "timezone", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_key_key" ON "User"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
