CREATE TYPE "NotificationTemplateChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');
CREATE TYPE "NotificationTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "InsuranceClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

CREATE TABLE "NotificationTemplate" (
  "id" UUID NOT NULL,
  "hospitalId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "channel" "NotificationTemplateChannel" NOT NULL,
  "status" "NotificationTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationTemplate_hospitalId_name_key" ON "NotificationTemplate"("hospitalId", "name");
CREATE INDEX "NotificationTemplate_hospitalId_channel_status_idx" ON "NotificationTemplate"("hospitalId", "channel", "status");
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InsuranceClaim" (
  "id" UUID NOT NULL,
  "hospitalId" UUID NOT NULL,
  "patientId" UUID NOT NULL,
  "invoiceId" UUID,
  "claimNumber" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "InsuranceClaimStatus" NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "approvedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InsuranceClaim_hospitalId_claimNumber_key" ON "InsuranceClaim"("hospitalId", "claimNumber");
CREATE INDEX "InsuranceClaim_hospitalId_patientId_status_submittedAt_idx" ON "InsuranceClaim"("hospitalId", "patientId", "status", "submittedAt");
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Supplier" (
  "id" UUID NOT NULL,
  "hospitalId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Supplier_hospitalId_name_key" ON "Supplier"("hospitalId", "name");
CREATE INDEX "Supplier_hospitalId_isActive_idx" ON "Supplier"("hospitalId", "isActive");
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id" UUID NOT NULL,
  "hospitalId" UUID NOT NULL,
  "medicineId" UUID NOT NULL,
  "supplierName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMP(3),
  "supplierId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PurchaseOrder_hospitalId_medicineId_status_idx" ON "PurchaseOrder"("hospitalId", "medicineId", "status");

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "supplierId" UUID;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Shift" (
  "id" UUID NOT NULL,
  "hospitalId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Shift_hospitalId_name_key" ON "Shift"("hospitalId", "name");
CREATE INDEX "Shift_hospitalId_isActive_idx" ON "Shift"("hospitalId", "isActive");
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "UserShift" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "shiftId" UUID NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserShift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserShift_userId_shiftId_key" ON "UserShift"("userId", "shiftId");
CREATE INDEX "UserShift_userId_idx" ON "UserShift"("userId");
ALTER TABLE "UserShift" ADD CONSTRAINT "UserShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserShift" ADD CONSTRAINT "UserShift_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PerformanceNote" (
  "id" UUID NOT NULL,
  "hospitalId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "note" TEXT NOT NULL,
  "rating" INTEGER,
  "recordedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerformanceNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PerformanceNote_hospitalId_createdAt_idx" ON "PerformanceNote"("hospitalId", "createdAt");
ALTER TABLE "PerformanceNote" ADD CONSTRAINT "PerformanceNote_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PerformanceNote" ADD CONSTRAINT "PerformanceNote_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
