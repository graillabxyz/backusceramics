-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'INQUIRY',
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactLocation" TEXT NOT NULL,
    "pieces" TEXT NOT NULL,
    "preferences" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderUpdate_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "workshopId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "preferredDate" TEXT,
    "participants" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClassBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResidencyApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "programId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "experience" TEXT,
    "goals" TEXT,
    "preferredDate" TEXT,
    "notes" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResidencyApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
