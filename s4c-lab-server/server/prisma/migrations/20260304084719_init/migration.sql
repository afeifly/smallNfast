-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CompanyUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "note" TEXT,
    "serviceTime" DATETIME NOT NULL,
    "passcode" TEXT NOT NULL,
    "deviceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serialNumber" TEXT NOT NULL,
    "sensorType" TEXT NOT NULL,
    "hwVersion" TEXT NOT NULL,
    "swVersion" TEXT NOT NULL,
    "calibrationDate" DATETIME NOT NULL,
    "calibrationLocation" TEXT NOT NULL,
    "currentSettings" TEXT NOT NULL,
    "calibrationPoints" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sensor_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUser_username_key" ON "CompanyUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUser_passcode_key" ON "CompanyUser"("passcode");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_serialNumber_key" ON "Sensor"("serialNumber");
