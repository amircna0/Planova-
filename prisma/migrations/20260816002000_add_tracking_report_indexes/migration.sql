-- CreateIndex
CREATE INDEX "Goal_userId_timeframe_idx" ON "Goal"("userId", "timeframe");

-- CreateIndex
CREATE INDEX "Goal_parentId_idx" ON "Goal"("parentId");

-- CreateIndex
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HabitLog_habitId_date_key" ON "HabitLog"("habitId", "date");

-- CreateIndex
CREATE INDEX "HabitLog_date_idx" ON "HabitLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Report_userId_type_weekStart_key" ON "Report"("userId", "type", "weekStart");

-- CreateIndex
CREATE INDEX "Report_userId_type_idx" ON "Report"("userId", "type");
