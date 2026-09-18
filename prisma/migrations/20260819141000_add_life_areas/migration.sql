-- AlterTable
ALTER TABLE "Task" ADD COLUMN "lifeArea" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "lifeArea" TEXT;

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN "lifeArea" TEXT;

-- CreateIndex
CREATE INDEX "Task_userId_lifeArea_idx" ON "Task"("userId", "lifeArea");

-- CreateIndex
CREATE INDEX "Goal_userId_lifeArea_idx" ON "Goal"("userId", "lifeArea");

-- CreateIndex
CREATE INDEX "Habit_userId_lifeArea_idx" ON "Habit"("userId", "lifeArea");
