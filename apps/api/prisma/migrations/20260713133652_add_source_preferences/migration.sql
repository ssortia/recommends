-- CreateTable
CREATE TABLE "source_preferences" (
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "interestsDescription" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_preferences_pkey" PRIMARY KEY ("userId","sourceId")
);

-- AddForeignKey
ALTER TABLE "source_preferences" ADD CONSTRAINT "source_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_preferences" ADD CONSTRAINT "source_preferences_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
