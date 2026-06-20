-- CreateEnum
CREATE TYPE "ModeratorApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ModeratorApplication" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "motivation" TEXT NOT NULL,
    "status" "ModeratorApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeratorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorApplication_userId_key" ON "ModeratorApplication"("userId");

-- AddForeignKey
ALTER TABLE "ModeratorApplication" ADD CONSTRAINT "ModeratorApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorApplication" ADD CONSTRAINT "ModeratorApplication_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
