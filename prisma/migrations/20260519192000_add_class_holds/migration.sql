CREATE TABLE "ClassHold" (
    "id" TEXT NOT NULL,
    "createdBy" TEXT,
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT,
    "workshopId" TEXT NOT NULL,
    "timeLabel" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "weekdays" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassHold_workshopId_startDate_endDate_idx" ON "ClassHold"("workshopId", "startDate", "endDate");
CREATE INDEX "ClassHold_status_idx" ON "ClassHold"("status");

ALTER TABLE "ClassHold" ADD CONSTRAINT "ClassHold_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClassSchedule" (
    "id" TEXT NOT NULL,
    "createdBy" TEXT,
    "offeringId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'class',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "timeLabel" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "weekdays" TEXT,
    "maxParticipants" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassSchedule_offeringId_startDate_endDate_idx" ON "ClassSchedule"("offeringId", "startDate", "endDate");
CREATE INDEX "ClassSchedule_status_idx" ON "ClassSchedule"("status");

ALTER TABLE "ClassSchedule" ADD CONSTRAINT "ClassSchedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClassBooking" ADD COLUMN "scheduleId" TEXT;
ALTER TABLE "ClassBooking" ADD CONSTRAINT "ClassBooking_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ClassSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
