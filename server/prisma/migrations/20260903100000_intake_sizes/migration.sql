-- Rename the two "glass" intake sizes to the generic "intake" naming and add a
-- medium size. RENAME VALUE carries existing HydrationLog rows across
-- automatically, so history is preserved.
ALTER TYPE "SourceType" RENAME VALUE 'small_glass' TO 'small_intake';
ALTER TYPE "SourceType" RENAME VALUE 'large_glass' TO 'large_intake';
ALTER TYPE "SourceType" ADD VALUE 'medium_intake' AFTER 'small_intake';

-- User: rename the configurable amounts and add the medium one.
ALTER TABLE "User" RENAME COLUMN "smallGlassMl" TO "smallIntakeMl";
ALTER TABLE "User" RENAME COLUMN "largeGlassMl" TO "largeIntakeMl";
ALTER TABLE "User" ADD COLUMN "mediumIntakeMl" INTEGER NOT NULL DEFAULT 300;

-- Bring the two seeded defaults in line with the new column default.
ALTER TABLE "User" ALTER COLUMN "smallIntakeMl" SET DEFAULT 200;
ALTER TABLE "User" ALTER COLUMN "largeIntakeMl" SET DEFAULT 400;
