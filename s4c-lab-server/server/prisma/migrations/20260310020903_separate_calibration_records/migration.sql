/*
  Warnings:

  - You are about to drop the column `calibrationDate` on the `Sensor` table. All the data in the column will be lost.
  - You are about to drop the column `calibrationLocation` on the `Sensor` table. All the data in the column will be lost.
  - You are about to drop the column `calibrationPoints` on the `Sensor` table. All the data in the column will be lost.
  - You are about to drop the column `currentSettings` on the `Sensor` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CalibrationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calibrationDate" DATETIME NOT NULL,
    "calibrationLocation" TEXT NOT NULL,
    "currentSettings" TEXT NOT NULL,
    "calibrationPoints" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalibrationRecord_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sensor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "sensorType" TEXT NOT NULL,
    "hwVersion" TEXT NOT NULL,
    "swVersion" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sensor_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Sensor" ("companyUserId", "createdAt", "hwVersion", "id", "sensorType", "serialNumber", "swVersion", "updatedAt") SELECT "companyUserId", "createdAt", "hwVersion", "id", "sensorType", "serialNumber", "swVersion", "updatedAt" FROM "Sensor";
DROP TABLE "Sensor";
ALTER TABLE "new_Sensor" RENAME TO "Sensor";
CREATE UNIQUE INDEX "Sensor_serialNumber_key" ON "Sensor"("serialNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
