-- PostgreSQL DDL for Tiffin Management & Delivery Web Application
-- Generated from prisma/schema.prisma

-- ENUMS
CREATE TYPE "Role" AS ENUM ('STUDENT', 'OWNER', 'SUPER_ADMIN');
CREATE TYPE "ProviderStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PAUSED');
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');
CREATE TYPE "MenuStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "DeliveryStatus" AS ENUM ('ORDER_RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'STOPPED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- TABLE: User
CREATE TABLE "User" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "phone" TEXT UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: TiffinProvider
CREATE TABLE "TiffinProvider" (
    "id" TEXT PRIMARY KEY,
    "ownerId" TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "businessName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'PENDING',
    "breakfastCutoff" TEXT NOT NULL DEFAULT '08:00',
    "lunchCutoff" TEXT NOT NULL DEFAULT '10:00',
    "dinnerCutoff" TEXT NOT NULL DEFAULT '18:00',
    "stopLeadHours" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "idx_provider_status" ON "TiffinProvider"("status");

-- TABLE: StudentProfile
CREATE TABLE "StudentProfile" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "address" TEXT NOT NULL,
    "walletBalance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "referralCode" TEXT UNIQUE NOT NULL,
    "referredBy" TEXT,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "isJain" BOOLEAN NOT NULL DEFAULT false,
    "lessSpicy" BOOLEAN NOT NULL DEFAULT false,
    "noOnionGarlic" BOOLEAN NOT NULL DEFAULT false,
    "allergies" TEXT,
    "specialInstructions" TEXT,
    "boxesHeld" INTEGER NOT NULL DEFAULT 0
);

-- TABLE: Subscription
CREATE TABLE "Subscription" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "planType" TEXT NOT NULL,
    "includesBreakfast" BOOLEAN NOT NULL DEFAULT false,
    "includesLunch" BOOLEAN NOT NULL DEFAULT true,
    "includesDinner" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "idx_subscription_student_status" ON "Subscription"("studentId", "status");
CREATE INDEX "idx_subscription_provider_status" ON "Subscription"("providerId", "status");

-- TABLE: Menu
CREATE TABLE "Menu" (
    "id" TEXT PRIMARY KEY,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "menuDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "status" "MenuStatus" NOT NULL DEFAULT 'DRAFT',
    "mealTiming" TEXT NOT NULL,
    "isSpecial" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_menu_provider_date_type" UNIQUE ("providerId", "menuDate", "mealType")
);
CREATE INDEX "idx_menu_provider_status_date" ON "Menu"("providerId", "status", "menuDate");

-- TABLE: MenuItem
CREATE TABLE "MenuItem" (
    "id" TEXT PRIMARY KEY,
    "menuId" TEXT NOT NULL REFERENCES "Menu"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true
);

-- TABLE: StopMealRequest
CREATE TABLE "StopMealRequest" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "mealDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "reason" TEXT,
    "isResumed" BOOLEAN NOT NULL DEFAULT false,
    "creditAmt" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_stop_student_date_meal" UNIQUE ("studentId", "mealDate", "mealType")
);
CREATE INDEX "idx_stop_provider_date" ON "StopMealRequest"("providerId", "mealDate");

-- TABLE: Delivery
CREATE TABLE "Delivery" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "mealDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'ORDER_RECEIVED',
    "qrToken" TEXT UNIQUE NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "address" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_delivery_student_date_type" UNIQUE ("studentId", "mealDate", "mealType")
);
CREATE INDEX "idx_delivery_provider_date_status" ON "Delivery"("providerId", "mealDate", "status");

-- TABLE: Payment
CREATE TABLE "Payment" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
    "providerId" TEXT REFERENCES "TiffinProvider"("id") ON DELETE SET NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "gatewayOrderId" TEXT UNIQUE NOT NULL,
    "gatewayPaymentId" TEXT UNIQUE,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3)
);

-- TABLE: WalletTransaction
CREATE TABLE "WalletTransaction" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Feedback
CREATE TABLE "Feedback" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "mealDate" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "overallVerdict" TEXT NOT NULL,
    "tasteRating" INTEGER NOT NULL,
    "qualityRating" INTEGER NOT NULL,
    "quantityRating" INTEGER NOT NULL,
    "hygieneRating" INTEGER NOT NULL,
    "comment" TEXT,
    "ownerResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: FoodSuggestion
CREATE TABLE "FoodSuggestion" (
    "id" TEXT PRIMARY KEY,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "dishName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Vote
CREATE TABLE "Vote" (
    "id" TEXT PRIMARY KEY,
    "suggestionId" TEXT NOT NULL REFERENCES "FoodSuggestion"("id") ON DELETE CASCADE,
    "studentId" TEXT NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
    CONSTRAINT "uq_vote_suggestion_student" UNIQUE ("suggestionId", "studentId")
);

-- TABLE: Complaint
CREATE TABLE "Complaint" (
    "id" TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: InventoryItem
CREATE TABLE "InventoryItem" (
    "id" TEXT PRIMARY KEY,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "minThreshold" DECIMAL(10,2) NOT NULL,
    "supplierName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Expense
CREATE TABLE "Expense" (
    "id" TEXT PRIMARY KEY,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expenseDate" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: Staff
CREATE TABLE "Staff" (
    "id" TEXT PRIMARY KEY,
    "providerId" TEXT NOT NULL REFERENCES "TiffinProvider"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "salary" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- TABLE: Notification
CREATE TABLE "Notification" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- TABLE: AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT PRIMARY KEY,
    "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
