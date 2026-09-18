-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "weeklyFocusId" INTEGER;

-- CreateTable
CREATE TABLE "Milestone" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "goalId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetMonth" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyFocus" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "goalId" INTEGER NOT NULL,
    "milestoneId" INTEGER,
    "title" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyFocus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_userId_goalId_idx" ON "Milestone"("userId", "goalId");

-- CreateIndex
CREATE INDEX "Milestone_userId_targetMonth_idx" ON "Milestone"("userId", "targetMonth");

-- CreateIndex
CREATE INDEX "Milestone_goalId_order_idx" ON "Milestone"("goalId", "order");

-- CreateIndex
CREATE INDEX "WeeklyFocus_userId_weekStart_idx" ON "WeeklyFocus"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyFocus_goalId_weekStart_idx" ON "WeeklyFocus"("goalId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyFocus_milestoneId_idx" ON "WeeklyFocus"("milestoneId");

-- CreateIndex
CREATE INDEX "Task_weeklyFocusId_idx" ON "Task"("weeklyFocusId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_weeklyFocusId_fkey" FOREIGN KEY ("weeklyFocusId") REFERENCES "WeeklyFocus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyFocus" ADD CONSTRAINT "WeeklyFocus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyFocus" ADD CONSTRAINT "WeeklyFocus_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyFocus" ADD CONSTRAINT "WeeklyFocus_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
