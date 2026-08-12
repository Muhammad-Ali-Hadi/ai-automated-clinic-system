-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'MERGED', 'DECEASED');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "HospitalSettings" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "preferences" JSONB,
    "configuration" JSONB,
    "subscriptionPlan" TEXT,
    "subscriptionEndsAt" TIMESTAMP(3),
    "logoKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingHour" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "opensAt" TEXT NOT NULL,
    "closesAt" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientInsurance" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientAllergy" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "substance" TEXT NOT NULL,
    "severity" TEXT,
    "reaction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientAllergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChronicDisease" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "diagnosedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChronicDisease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientVital" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "recordedById" UUID NOT NULL,
    "temperature" DECIMAL(5,2),
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "pulse" INTEGER,
    "weightKg" DECIMAL(6,2),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientVital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientNote" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorAvailability" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DoctorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueEntry" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "queueNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalSettings_hospitalId_key" ON "HospitalSettings"("hospitalId");

-- CreateIndex
CREATE INDEX "Branch_hospitalId_isActive_idx" ON "Branch"("hospitalId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_hospitalId_name_key" ON "Branch"("hospitalId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingHour_branchId_weekday_key" ON "WorkingHour"("branchId", "weekday");

-- CreateIndex
CREATE INDEX "EmergencyContact_hospitalId_patientId_idx" ON "EmergencyContact"("hospitalId", "patientId");

-- CreateIndex
CREATE INDEX "PatientInsurance_hospitalId_patientId_idx" ON "PatientInsurance"("hospitalId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientInsurance_hospitalId_provider_policyNumber_key" ON "PatientInsurance"("hospitalId", "provider", "policyNumber");

-- CreateIndex
CREATE INDEX "PatientAllergy_hospitalId_patientId_idx" ON "PatientAllergy"("hospitalId", "patientId");

-- CreateIndex
CREATE INDEX "ChronicDisease_hospitalId_patientId_idx" ON "ChronicDisease"("hospitalId", "patientId");

-- CreateIndex
CREATE INDEX "PatientVital_hospitalId_patientId_recordedAt_idx" ON "PatientVital"("hospitalId", "patientId", "recordedAt");

-- CreateIndex
CREATE INDEX "PatientNote_hospitalId_patientId_createdAt_idx" ON "PatientNote"("hospitalId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorAvailability_hospitalId_doctorId_weekday_idx" ON "DoctorAvailability"("hospitalId", "doctorId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorAvailability_doctorId_weekday_startsAt_key" ON "DoctorAvailability"("doctorId", "weekday", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_appointmentId_key" ON "QueueEntry"("appointmentId");

-- CreateIndex
CREATE INDEX "QueueEntry_hospitalId_status_createdAt_idx" ON "QueueEntry"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QueueEntry_hospitalId_queueNumber_key" ON "QueueEntry"("hospitalId", "queueNumber");

-- AddForeignKey
ALTER TABLE "HospitalSettings" ADD CONSTRAINT "HospitalSettings_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingHour" ADD CONSTRAINT "WorkingHour_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAllergy" ADD CONSTRAINT "PatientAllergy_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAllergy" ADD CONSTRAINT "PatientAllergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicDisease" ADD CONSTRAINT "ChronicDisease_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChronicDisease" ADD CONSTRAINT "ChronicDisease_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVital" ADD CONSTRAINT "PatientVital_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVital" ADD CONSTRAINT "PatientVital_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVital" ADD CONSTRAINT "PatientVital_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
