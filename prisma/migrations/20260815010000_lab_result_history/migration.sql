CREATE TABLE IF NOT EXISTS "LabResultHistory" (
  "id" UUID NOT NULL,
  "hospitalId" UUID NOT NULL,
  "labTestId" UUID NOT NULL,
  "recordedById" UUID NOT NULL,
  "result" TEXT NOT NULL,
  "referenceRange" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LabResultHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LabResultHistory_hospitalId_labTestId_recordedAt_idx" ON "LabResultHistory"("hospitalId", "labTestId", "recordedAt");
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='LabResultHistory_hospitalId_fkey') THEN ALTER TABLE "LabResultHistory" ADD CONSTRAINT "LabResultHistory_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='LabResultHistory_labTestId_fkey') THEN ALTER TABLE "LabResultHistory" ADD CONSTRAINT "LabResultHistory_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "LabTest"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='LabResultHistory_recordedById_fkey') THEN ALTER TABLE "LabResultHistory" ADD CONSTRAINT "LabResultHistory_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF;
END $$;
