/*
  Warnings:

  - Added the required column `email` to the `CompanyUser` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanyUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "note" TEXT,
    "serviceTime" DATETIME NOT NULL,
    "passcode" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CompanyUser" ("companyName", "createdAt", "deviceId", "id", "note", "passcode", "serviceTime", "updatedAt", "username") SELECT "companyName", "createdAt", "deviceId", "id", "note", "passcode", "serviceTime", "updatedAt", "username" FROM "CompanyUser";
DROP TABLE "CompanyUser";
ALTER TABLE "new_CompanyUser" RENAME TO "CompanyUser";
CREATE UNIQUE INDEX "CompanyUser_username_key" ON "CompanyUser"("username");
CREATE UNIQUE INDEX "CompanyUser_email_key" ON "CompanyUser"("email");
CREATE UNIQUE INDEX "CompanyUser_passcode_key" ON "CompanyUser"("passcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
