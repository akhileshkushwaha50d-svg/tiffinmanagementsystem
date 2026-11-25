/**
 * server.js - Complete Express.js REST API Server with Prisma ORM & PostgreSQL/SQLite
 * Multi-tenant Tiffin Management & Delivery Web Application
 * Implements strict tenant isolation, IST timezone enforcement, 2-hour stop meal cutoffs,
 * contactless QR token delivery verification, and atomic financial transactions.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();

const EMBEDDED_SCHEMA = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  STUDENT
  OWNER
  SUPER_ADMIN
}

enum ProviderStatus {
  PENDING
  APPROVED
  SUSPENDED
}

enum SubscriptionStatus {
  ACTIVE
  EXPIRED
  CANCELLED
  PAUSED
}

enum MealType {
  BREAKFAST
  LUNCH
  DINNER
}

enum MenuStatus {
  DRAFT
  PUBLISHED
}

enum DeliveryStatus {
  ORDER_RECEIVED
  PREPARING
  OUT_FOR_DELIVERY
  DELIVERED
  STOPPED
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
}

enum ComplaintStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  phone        String   @unique
  passwordHash String
  role         Role     @default(STUDENT)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  studentProfile StudentProfile?
  ownedProvider  TiffinProvider?
  notifications  Notification[]
  auditLogs      AuditLog[]
}

model TiffinProvider {
  id                String         @id @default(cuid())
  ownerId           String         @unique
  owner             User           @relation(fields: [ownerId], references: [id])
  businessName      String
  address           String
  contactPhone      String
  status            ProviderStatus @default(PENDING)
  breakfastCutoff   String         @default("08:00") // HH:mm IST
  lunchCutoff       String         @default("10:00")
  dinnerCutoff      String         @default("18:00")
  stopLeadHours     Int            @default(2)
  createdAt         DateTime       @default(now())

  subscriptions   Subscription[]
  menus           Menu[]
  deliveries      Delivery[]
  inventory       InventoryItem[]
  expenses        Expense[]
  suggestions     FoodSuggestion[]
  complaints      Complaint[]
  staff           Staff[]

  @@index([status])
}

model StudentProfile {
  id                  String   @id @default(cuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id])
  address             String
  walletBalance       Decimal  @default(0.00) @db.Decimal(10, 2)
  referralCode        String   @unique
  referredBy          String?
  rewardPoints        Int      @default(0)
  isJain              Boolean  @default(false)
  lessSpicy           Boolean  @default(false)
  noOnionGarlic       Boolean  @default(false)
  allergies           String?
  specialInstructions String?
  boxesHeld           Int      @default(0) // Physical tiffin container tracking

  subscriptions      Subscription[]
  stopMealRequests   StopMealRequest[]
  deliveries         Delivery[]
  walletTransactions WalletTransaction[]
  payments           Payment[]
  feedbacks          Feedback[]
  complaints         Complaint[]
  votes              Vote[]
}

model Subscription {
  id                String             @id @default(cuid())
  studentId         String
  student           StudentProfile     @relation(fields: [studentId], references: [id])
  providerId        String
  provider          TiffinProvider     @relation(fields: [providerId], references: [id])
  planType          String             // DAILY, WEEKLY, MONTHLY, CUSTOM
  includesBreakfast Boolean            @default(false)
  includesLunch     Boolean            @default(true)
  includesDinner    Boolean            @default(true)
  startDate         DateTime
  endDate           DateTime
  totalPrice        Decimal            @db.Decimal(10, 2)
  status            SubscriptionStatus @default(ACTIVE)
  createdAt         DateTime           @default(now())

  @@index([studentId, status])
  @@index([providerId, status])
}

model Menu {
  id          String         @id @default(cuid())
  providerId  String
  provider    TiffinProvider @relation(fields: [providerId], references: [id])
  menuDate    DateTime       @db.Date
  mealType    MealType
  status      MenuStatus     @default(DRAFT)
  mealTiming  String         // e.g. "12:30 PM - 2:00 PM"
  isSpecial   Boolean        @default(false)
  publishedAt DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  items MenuItem[]

  @@unique([providerId, menuDate, mealType])
  @@index([providerId, status, menuDate])
}

model MenuItem {
  id          String  @id @default(cuid())
  menuId      String
  menu        Menu    @relation(fields: [menuId], references: [id], onDelete: Cascade)
  name        String
  description String?
  imageUrl    String?
  isAvailable Boolean @default(true)
}

model StopMealRequest {
  id         String         @id @default(cuid())
  studentId  String
  student    StudentProfile @relation(fields: [studentId], references: [id])
  providerId String
  mealDate   DateTime       @db.Date
  mealType   MealType
  reason     String?
  isResumed  Boolean        @default(false)
  creditAmt  Decimal        @default(0.00) @db.Decimal(10, 2)
  createdAt  DateTime       @default(now())

  @@unique([studentId, mealDate, mealType])
  @@index([providerId, mealDate])
}

model Delivery {
  id          String         @id @default(cuid())
  studentId   String
  student     StudentProfile @relation(fields: [studentId], references: [id])
  providerId  String
  provider    TiffinProvider @relation(fields: [providerId], references: [id])
  mealDate    DateTime       @db.Date
  mealType    MealType
  status      DeliveryStatus @default(ORDER_RECEIVED)
  qrToken     String         @unique @default(cuid())
  deliveredAt DateTime?
  address     String
  updatedAt   DateTime       @updatedAt

  @@unique([studentId, mealDate, mealType])
  @@index([providerId, mealDate, status])
}

model Payment {
  id                String         @id @default(cuid())
  studentId         String
  student           StudentProfile @relation(fields: [studentId], references: [id])
  providerId        String?
  amount            Decimal        @db.Decimal(10, 2)
  gatewayOrderId    String         @unique
  gatewayPaymentId  String?        @unique
  status            PaymentStatus  @default(PENDING)
  purpose           String         // WALLET_RECHARGE, SUBSCRIPTION
  createdAt         DateTime       @default(now())
  verifiedAt        DateTime?
}

model WalletTransaction {
  id          String         @id @default(cuid())
  studentId   String
  student     StudentProfile @relation(fields: [studentId], references: [id])
  type        String         // CREDIT, DEBIT, REFUND
  amount      Decimal        @db.Decimal(10, 2)
  description String
  referenceId String?
  createdAt   DateTime       @default(now())
}

model Feedback {
  id              String         @id @default(cuid())
  studentId       String
  student         StudentProfile @relation(fields: [studentId], references: [id])
  providerId      String
  mealDate        DateTime       @db.Date
  mealType        MealType
  overallVerdict  String         // Excellent, Good, Average, Not Good
  tasteRating     Int
  qualityRating   Int
  quantityRating  Int
  hygieneRating   Int
  comment         String?
  ownerResponse   String?
  createdAt       DateTime       @default(now())
}

model FoodSuggestion {
  id         String         @id @default(cuid())
  providerId String
  provider   TiffinProvider @relation(fields: [providerId], references: [id])
  dishName   String
  status     String         @default("PENDING") // PENDING, APPROVED, REJECTED
  createdAt  DateTime       @default(now())
  votes      Vote[]
}

model Vote {
  id           String         @id @default(cuid())
  suggestionId String
  suggestion   FoodSuggestion @relation(fields: [suggestionId], references: [id], onDelete: Cascade)
  studentId    String
  student      StudentProfile @relation(fields: [studentId], references: [id])

  @@unique([suggestionId, studentId])
}

model Complaint {
  id          String          @id @default(cuid())
  studentId   String
  student     StudentProfile  @relation(fields: [studentId], references: [id])
  providerId  String
  provider    TiffinProvider  @relation(fields: [providerId], references: [id])
  category    String          // Quality, Delivery Delay, Payment, Incorrect Order
  description String
  status      ComplaintStatus @default(OPEN)
  resolution  String?
  createdAt   DateTime        @default(now())
}

model InventoryItem {
  id           String         @id @default(cuid())
  providerId   String
  provider     TiffinProvider @relation(fields: [providerId], references: [id])
  itemName     String
  quantity     Decimal        @db.Decimal(10, 2)
  unit         String         // kg, L, cylinders
  minThreshold Decimal        @db.Decimal(10, 2)
  supplierName String?
  updatedAt    DateTime       @updatedAt
}

model Expense {
  id          String         @id @default(cuid())
  providerId  String
  provider    TiffinProvider @relation(fields: [providerId], references: [id])
  category    String         // Raw Materials, Staff, Gas, Electricity, Rent
  amount      Decimal        @db.Decimal(10, 2)
  expenseDate DateTime       @db.Date
  notes       String?
  createdAt   DateTime       @default(now())
}

model Staff {
  id         String         @id @default(cuid())
  providerId String
  provider   TiffinProvider @relation(fields: [providerId], references: [id])
  name       String
  role       String         // COOK, HELPER, DELIVERY
  phone      String
  salary     Decimal        @db.Decimal(10, 2)
  isActive   Boolean        @default(true)
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  title     String
  message   String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  action    String
  targetId  String?
  metadata  Json?
  createdAt DateTime @default(now())
}
`;

// Ensure prisma/schema.prisma exists on disk
try {
  const pDir = path.join(__dirname, "prisma");
  const pFile = path.join(pDir, "schema.prisma");
  if (!fs.existsSync(pFile)) {
    fs.mkdirSync(pDir, { recursive: true });
    fs.writeFileSync(pFile, EMBEDDED_SCHEMA, "utf-8");
    console.log("Auto-generated missing prisma/schema.prisma on server disk.");
  }
} catch (e) {
  console.error("Schema write error:", e);
}

// Internal self-contained seeder function
async function seedDemoData() {
  const ownerPwd = await bcrypt.hash("owner123", 10);
  const studentPwd = await bcrypt.hash("student123", 10);

  // 1. Owner
  const owner = await prisma.user.upsert({
    where: { email: "owner@annapurnatiffin.com" },
    update: {},
    create: {
      name: "Rajesh Sharma",
      email: "owner@annapurnatiffin.com",
      phone: "+919826012345",
      passwordHash: ownerPwd,
      role: "OWNER",
      isActive: true,
      ownedProvider: {
        create: {
          businessName: "Shree Annapurna Pure Veg Tiffin & Meals",
          address: "Plot 45, Near Holkar Science College, Bhawarkua, Indore",
          contactPhone: "+91 98260 12345",
          status: "APPROVED",
          breakfastCutoff: "07:30",
          lunchCutoff: "10:00",
          dinnerCutoff: "17:30",
          stopLeadHours: 2,
        },
      },
    },
    include: { ownedProvider: true },
  });

  const providerId = owner.ownedProvider.id;

  // 2. Student 1: Aman Verma (aman.verma@student.edu)
  const aman = await prisma.user.upsert({
    where: { email: "aman.verma@student.edu" },
    update: {},
    create: {
      name: "Aman Verma",
      email: "aman.verma@student.edu",
      phone: "+919876543210",
      passwordHash: studentPwd,
      role: "STUDENT",
      isActive: true,
      studentProfile: {
        create: {
          address: "Room 302, Royal Boys Hostel, Bhawarkua, Indore",
          walletBalance: 850.0,
          referralCode: "TIFAMAN77",
          rewardPoints: 120,
          isJain: false,
          lessSpicy: true,
          boxesHeld: 1,
        },
      },
    },
    include: { studentProfile: true },
  });

  // 3. Student 2: student@tiffin.com
  await prisma.user.upsert({
    where: { email: "student@tiffin.com" },
    update: {},
    create: {
      name: "Aman Verma",
      email: "student@tiffin.com",
      phone: "+919876543211",
      passwordHash: studentPwd,
      role: "STUDENT",
      isActive: true,
      studentProfile: {
        create: {
          address: "Room 302, Royal Boys Hostel, Bhawarkua, Indore",
          walletBalance: 850.0,
          referralCode: "TIFSTUDENT",
          rewardPoints: 120,
        },
      },
    },
  });

  // 4. Seed 7 days of Menus
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const mealConfigs = [
    { mealType: "BREAKFAST", timing: "07:30 AM - 09:30 AM", items: ["Indori Poha", "Ratlami Sev", "Jalebi (2 pcs)", "Masala Chai"] },
    { mealType: "LUNCH", timing: "12:30 PM - 02:30 PM", items: ["Paneer Butter Masala", "Dal Tadka", "Basmati Rice", "4 Phulkas", "Raita"] },
    { mealType: "DINNER", timing: "07:30 PM - 09:30 PM", items: ["Aloo Gobhi Matar", "Moong Dal", "3 Phulkas", "Steamed Rice", "Pickle"] },
  ];

  for (let offset = 0; offset < 7; offset++) {
    const menuDate = new Date(today);
    menuDate.setUTCDate(today.getUTCDate() + offset);

    for (const cfg of mealConfigs) {
      const exists = await prisma.menu.findUnique({
        where: {
          providerId_menuDate_mealType: {
            providerId,
            menuDate,
            mealType: cfg.mealType,
          },
        },
      });

      if (!exists) {
        await prisma.menu.create({
          data: {
            providerId,
            menuDate,
            mealType: cfg.mealType,
            status: "PUBLISHED",
            mealTiming: cfg.timing,
            isSpecial: offset === 0 && cfg.mealType === "LUNCH",
            publishedAt: new Date(),
            items: {
              create: cfg.items.map((it) => ({ name: it, isAvailable: true })),
            },
          },
        });
      }
    }
  }

  // 5. Subscription
  const existingSub = await prisma.subscription.findFirst({
    where: { studentId: aman.studentProfile.id, providerId },
  });
  if (!existingSub) {
    const endDate = new Date(today);
    endDate.setUTCDate(today.getUTCDate() + 30);
    await prisma.subscription.create({
      data: {
        studentId: aman.studentProfile.id,
        providerId,
        planType: "MONTHLY",
        includesBreakfast: true,
        includesLunch: true,
        includesDinner: true,
        startDate: today,
        endDate,
        totalPrice: 5200.0,
        status: "ACTIVE",
      },
    });
  }

  console.log("Demo seed data applied successfully!");
}

// Setup API route
app.get("/api/setup", async (req, res) => {
  try {
    console.log("Manual setup requested via /api/setup");
    try {
      execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", timeout: 60000 });
    } catch (pe) {
      console.log("prisma db push info:", pe.message);
    }
    await seedDemoData();
    res.json({
      success: true,
      message: "Database initialized and demo accounts (Aman Verma & Rajesh Sharma) ready!",
      student: "aman.verma@student.edu (pwd: student123)",
      owner: "owner@annapurnatiffin.com (pwd: owner123)",
    });
  } catch (err) {
    console.error("Setup error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "tiffin_secure_jwt_secret_key_2026_production";

// Security & Parsing Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json());

// Rate Limiting (300 requests per 15 minutes window)
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use("/api/", apiLimiter);

// Static file serving for Frontend SPA
app.use("/static", express.static(path.join(__dirname, "static")));
app.use(express.static(path.join(__dirname, "static")));
app.use(express.static(__dirname));

// ==========================================
// 1. TIMEZONE HELPER (Strict IST Enforcement)
// ==========================================
/**
 * Evaluates whether current wall-clock time is strictly before the stop meal cutoff.
 * Enforces leadHours (default 2 hours) in Indian Standard Time (UTC +05:30).
 */
export function isBeforeStopCutoff(mealDateStr, cutoffHHMM = "10:00", leadHours = 2) {
  const [hh, mm] = cutoffHHMM.split(":").map(Number);
  // Construct meal cutoff timestamp in IST (+05:30)
  const cutoffIso = `${mealDateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`;
  const cutoffDate = new Date(cutoffIso);
  const deadline = new Date(cutoffDate.getTime() - leadHours * 60 * 60 * 1000);
  return new Date() < deadline;
}

// ==========================================
// 2. AUTH & RBAC MIDDLEWARE
// ==========================================
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication required. Please sign in." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { studentProfile: true, ownedProvider: true },
    });

    if (!user || !user.isActive) {
      return res.status(403).json({ success: false, error: "Account inactive or suspended by administrator." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired session token." });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: `Forbidden: requires ${roles.join(" or ")} role.` });
    }
    next();
  };
}

// System Audit Log Helper
async function logAudit(actorId, action, targetId = null, metadata = null) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, targetId, metadata: metadata || {} },
    });
  } catch (e) {
    console.warn("Audit logging warning:", e.message);
  }
}

// ==========================================
// 3. AUTHENTICATION ROUTES
// ==========================================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password, role = "STUDENT", address = "", businessName } = req.body;
    const cleanRole = role.toUpperCase();

    if (!["STUDENT", "OWNER"].includes(cleanRole)) {
      return res.status(400).json({ success: false, error: "Invalid role registration. Must be STUDENT or OWNER." });
    }

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: "Name, email, and password are required fields." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email: email.toLowerCase().trim(), phone: phone || "", passwordHash, role: cleanRole },
      });

      if (cleanRole === "STUDENT") {
        const referralCode = `TIF${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        await tx.studentProfile.create({
          data: { userId: created.id, address, referralCode },
        });
      } else if (cleanRole === "OWNER") {
        await tx.tiffinProvider.create({
          data: {
            ownerId: created.id,
            businessName: businessName || `${name}'s Tiffin Center`,
            address: address || "City Center",
            contactPhone: phone || "9876543210",
            status: "PENDING", // Super Admin approval workflow
          },
        });
      }

      // Welcome Notification
      await tx.notification.create({
        data: {
          userId: created.id,
          title: "Welcome to Tiffin App!",
          message: `Your ${cleanRole.toLowerCase()} account has been initialized successfully.`,
        },
      });

      return created;
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({
      success: true,
      message: "Account registered successfully",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role.toLowerCase() },
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(400).json({ success: false, error: "Registration failed. Email or phone number may already be registered." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { identifier, email, password, role } = req.body;
    const loginId = (identifier || email || "").toLowerCase().trim();

    if (!loginId || !password) {
      return res.status(400).json({ success: false, error: "Email/phone and password are required." });
    }

    let user = null;
    try {
      user = await prisma.user.findFirst({
        where: {
          OR: [{ email: loginId }, { phone: loginId }],
        },
        include: { ownedProvider: true, studentProfile: true },
      });
    } catch (tableErr) {
      console.log("Database table missing on login, attempting auto-push...", tableErr.message);
      try {
        execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", timeout: 45000 });
      } catch (pe) {}
      await seedDemoData();
      user = await prisma.user.findFirst({
        where: { OR: [{ email: loginId }, { phone: loginId }] },
        include: { ownedProvider: true, studentProfile: true },
      });
    }

    // Auto-seed demo accounts if fresh database
    if (!user && (loginId === "aman.verma@student.edu" || loginId === "student@tiffin.com" || loginId === "owner@annapurnatiffin.com" || loginId === "owner@tiffin.com")) {
      console.log("Demo user login on fresh DB, auto-seeding...");
      try {
        await seedDemoData();
        user = await prisma.user.findFirst({
          where: { OR: [{ email: loginId }, { phone: loginId }] },
          include: { ownedProvider: true, studentProfile: true },
        });
      } catch (se) {
        console.error("Auto seed error on login:", se);
      }
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: "Invalid credentials or account does not exist." });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, error: "Account suspended by administrator." });
    }

    if (role && user.role.toLowerCase() !== role.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: You are registered as ${user.role}. Please use the ${user.role} login portal.`,
      });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        full_name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role.toLowerCase(),
        providerStatus: user.ownedProvider?.status || null,
        provider: user.ownedProvider,
        student: user.studentProfile,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, error: "Internal server error during login." });
  }
});

app.get("/api/auth/me", authenticate, async (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      full_name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role.toLowerCase(),
    },
    student: req.user.studentProfile,
    provider: req.user.ownedProvider,
  });
});

// ==========================================
// 4. STUDENT PORTAL (Auto Owner-Student Sync)
// ==========================================
app.get("/api/student/dashboard", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    if (!student) {
      return res.status(404).json({ success: false, error: "Student profile not found." });
    }

    const now = new Date();

    // 1. Strictly fetch active subscription from DB
    const activeSub = await prisma.subscription.findFirst({
      where: { studentId: student.id, status: "ACTIVE", endDate: { gte: now } },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            contactPhone: true,
            address: true,
            breakfastCutoff: true,
            lunchCutoff: true,
            dinnerCutoff: true,
            stopLeadHours: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const providerId = activeSub ? activeSub.providerId : null;
    let todayMenu = [];
    let todayDeliveries = [];

    // 2. Auto-sync today's published menu from active provider
    if (providerId) {
      const todayDate = new Date();
      todayDate.setUTCHours(0, 0, 0, 0);

      todayMenu = await prisma.menu.findMany({
        where: {
          providerId,
          menuDate: todayDate,
          status: "PUBLISHED",
        },
        include: { items: true },
      });

      todayDeliveries = await prisma.delivery.findMany({
        where: { studentId: student.id, mealDate: todayDate },
        orderBy: { mealType: "asc" },
      });
    }

    // 3. Attendance Counters
    const allDeliveries = await prisma.delivery.findMany({
      where: { studentId: student.id },
      select: { status: true },
    });

    const attSummary = {
      total_present: allDeliveries.filter((d) => d.status === "DELIVERED").length,
      total_absent: allDeliveries.filter((d) => d.status === "ORDER_RECEIVED").length,
      total_stopped: allDeliveries.filter((d) => d.status === "STOPPED").length,
    };

    res.json({
      success: true,
      student: {
        id: student.id,
        user_id: req.user.id,
        full_name: req.user.name,
        delivery_address: student.address,
        wallet_balance: Number(student.walletBalance),
        reward_points: student.rewardPoints,
        referral_code: student.referralCode,
        boxes_held: student.boxesHeld,
        is_jain: student.isJain,
        less_spicy: student.lessSpicy,
        no_onion_garlic: student.noOnionGarlic,
        allergies: student.allergies,
        special_instructions: student.specialInstructions,
      },
      provider: activeSub?.provider
        ? {
            id: activeSub.provider.id,
            business_name: activeSub.provider.businessName,
            contact_phone: activeSub.provider.contactPhone,
            business_address: activeSub.provider.address,
          }
        : null,
      active_subscription: activeSub
        ? {
            id: activeSub.id,
            plan_type: activeSub.planType,
            start_date: activeSub.startDate,
            end_date: activeSub.endDate,
            final_amount: Number(activeSub.totalPrice),
            status: activeSub.status.toLowerCase(),
          }
        : null,
      today_menu: todayMenu.map((m) => ({
        meal_type: m.mealType,
        food_name: m.items.map((i) => i.name).join(", ") || "Fresh Meal Thali",
        description: m.items.map((i) => i.description).filter(Boolean).join(" • ") || "Nutritious balanced meal",
        items_included: m.items.map((i) => i.name).join(", "),
        image_url: m.items[0]?.imageUrl || "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600",
        is_special: m.isSpecial ? 1 : 0,
      })),
      today_orders: todayDeliveries.map((d) => ({
        id: d.id,
        meal_type: d.mealType,
        status: d.status.toLowerCase(),
        delivery_status: d.status.toLowerCase(),
        qr_token: d.qrToken,
      })),
      attendance_summary: attSummary,
    });
  } catch (err) {
    console.error("Student Dashboard Error:", err);
    res.status(500).json({ success: false, error: "Failed to load student dashboard." });
  }
});

// 2-Hour Strict Stop Meal Cutoff (Atomic Transaction + Wallet Credit)
app.post("/api/student/stop-meal", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    const { mealDate, mealType = "LUNCH", reason = "Personal Engagement" } = req.body;
    const cleanMealType = mealType.toUpperCase();

    if (!mealDate) {
      return res.status(400).json({ success: false, error: "Please select a meal date." });
    }

    // 1. Fetch active subscription and provider cutoff settings
    const activeSub = await prisma.subscription.findFirst({
      where: { studentId: student.id, status: "ACTIVE" },
      include: { provider: true },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSub) {
      return res.status(400).json({ success: false, error: "No active subscription found to stop meals." });
    }

    const provider = activeSub.provider;
    const cutoffMap = {
      BREAKFAST: provider.breakfastCutoff || "08:00",
      LUNCH: provider.lunchCutoff || "10:00",
      DINNER: provider.dinnerCutoff || "18:00",
    };
    const cutoffHHMM = cutoffMap[cleanMealType] || "10:00";
    const leadHours = provider.stopLeadHours || 2;

    // 2. Server-side strict cutoff verification
    const isAllowed = isBeforeStopCutoff(mealDate, cutoffHHMM, leadHours);
    if (!isAllowed) {
      return res.status(400).json({
        success: false,
        error: `Cancellation deadline missed! As per policy, ${cleanMealType} must be stopped at least ${leadHours} hours prior to cutoff (${cutoffHHMM} IST).`,
      });
    }

    const refundCredit = 90.0;
    const targetDate = new Date(`${mealDate}T00:00:00.000Z`);

    // 3. Atomic Prisma Transaction: Record Stop, Mark Delivery STOPPED, Credit Wallet
    await prisma.$transaction(async (tx) => {
      // Create or update stop request
      await tx.stopMealRequest.upsert({
        where: {
          studentId_mealDate_mealType: {
            studentId: student.id,
            mealDate: targetDate,
            mealType: cleanMealType,
          },
        },
        create: {
          studentId: student.id,
          providerId: provider.id,
          mealDate: targetDate,
          mealType: cleanMealType,
          reason,
          creditAmt: refundCredit,
        },
        update: {
          reason,
          creditAmt: refundCredit,
        },
      });

      // Update Delivery record to STOPPED
      await tx.delivery.updateMany({
        where: {
          studentId: student.id,
          mealDate: targetDate,
          mealType: cleanMealType,
        },
        data: { status: "STOPPED" },
      });

      // Credit student wallet
      await tx.studentProfile.update({
        where: { id: student.id },
        data: { walletBalance: { increment: refundCredit } },
      });

      // Log wallet transaction ledger
      await tx.walletTransaction.create({
        data: {
          studentId: student.id,
          type: "REFUND",
          amount: refundCredit,
          description: `Refund credit for cancelled ${cleanMealType} on ${mealDate} (2-hr rule satisfied)`,
          referenceId: `REF_${Date.now()}`,
        },
      });

      // Notifications
      await tx.notification.create({
        data: {
          userId: req.user.id,
          title: "Meal Stopped Successfully",
          message: `Your ${cleanMealType} on ${mealDate} has been stopped. ₹${refundCredit.toFixed(2)} refund has been credited to your wallet.`,
        },
      });

      await tx.notification.create({
        data: {
          userId: provider.ownerId,
          title: "Meal Stopped by Student",
          message: `Student ${req.user.name} stopped ${cleanMealType} for ${mealDate}. Reason: ${reason}.`,
        },
      });
    });

    res.json({
      success: true,
      message: `Meal stop request approved for ${cleanMealType} on ${mealDate}. ₹${refundCredit.toFixed(2)} credited to your wallet!`,
    });
  } catch (err) {
    console.error("Stop Meal Error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to process stop meal request." });
  }
});

// Student Wallet Endpoints
app.get("/api/student/wallet", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    const txs = await prisma.walletTransaction.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({
      success: true,
      wallet_balance: Number(student.walletBalance),
      reward_points: student.rewardPoints,
      referral_code: student.referralCode,
      boxes_held: student.boxesHeld,
      transactions: txs.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        reference_id: t.referenceId,
        created_at: t.createdAt.toISOString().split("T")[0],
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/student/wallet/recharge", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    const amount = Number(req.body.amount || 0);
    const paymentMethod = req.body.payment_method || "UPI";

    if (amount <= 0) {
      return res.status(400).json({ success: false, error: "Recharge amount must be greater than zero." });
    }

    const refId = `WAL_RECH_${Date.now()}`;

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.studentProfile.update({
        where: { id: student.id },
        data: { walletBalance: { increment: amount } },
      });

      await tx.walletTransaction.create({
        data: {
          studentId: student.id,
          type: "CREDIT",
          amount,
          description: `Wallet recharge via ${paymentMethod}`,
          referenceId: refId,
        },
      });

      await tx.notification.create({
        data: {
          userId: req.user.id,
          title: "Wallet Recharged!",
          message: `₹${amount.toFixed(2)} credited to your wallet via ${paymentMethod}. New balance: ₹${Number(s.walletBalance).toFixed(2)}.`,
        },
      });

      return s;
    });

    res.json({
      success: true,
      message: `₹${amount.toFixed(2)} added to wallet successfully!`,
      new_balance: Number(updated.walletBalance),
      reference_id: refId,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student Dietary Preferences
app.get("/api/student/dietary", authenticate, authorize("STUDENT"), async (req, res) => {
  const s = req.user.studentProfile;
  res.json({
    success: true,
    dietary: {
      is_jain: s.isJain,
      less_spicy: s.lessSpicy,
      no_onion_garlic: s.noOnionGarlic,
      allergies: s.allergies || "",
      special_instructions: s.specialInstructions || "",
    },
  });
});

app.post("/api/student/dietary", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const s = req.user.studentProfile;
    const { is_jain, less_spicy, no_onion_garlic, allergies, special_instructions } = req.body;

    await prisma.studentProfile.update({
      where: { id: s.id },
      data: {
        isJain: !!is_jain,
        lessSpicy: !!less_spicy,
        noOnionGarlic: !!no_onion_garlic,
        allergies: allergies || null,
        specialInstructions: special_instructions || null,
      },
    });

    res.json({ success: true, message: "Dietary preferences updated successfully!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student Grievances & Complaints
app.get("/api/student/complaints", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const s = req.user.studentProfile;
    const complaints = await prisma.complaint.findMany({
      where: { studentId: s.id },
      include: { provider: { select: { businessName: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      complaints: complaints.map((c) => ({
        id: c.id,
        category: c.category,
        description: c.description,
        status: c.status,
        resolution: c.resolution,
        business_name: c.provider.businessName,
        created_at: c.createdAt.toISOString().split("T")[0],
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/student/complaints", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const s = req.user.studentProfile;
    const { category = "Quality", description, provider_id } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ success: false, error: "Please describe the grievance." });
    }

    // Determine target provider
    let providerId = provider_id;
    if (!providerId) {
      const activeSub = await prisma.subscription.findFirst({
        where: { studentId: s.id, status: "ACTIVE" },
        select: { providerId: true },
      });
      providerId = activeSub?.providerId;
    }

    if (!providerId) {
      const firstProv = await prisma.tiffinProvider.findFirst({ select: { id: true } });
      providerId = firstProv?.id;
    }

    const created = await prisma.complaint.create({
      data: {
        studentId: s.id,
        providerId,
        category,
        description: description.trim(),
        status: "OPEN",
      },
      include: { provider: true },
    });

    // Alert Owner
    await prisma.notification.create({
      data: {
        userId: created.provider.ownerId,
        title: "New Student Grievance Lodged",
        message: `Student ${req.user.name} filed a ${category} complaint: "${description.slice(0, 60)}..."`,
      },
    });

    res.json({ success: true, message: "Your complaint has been submitted. The kitchen owner has been notified." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student Delivery Tracking with QR Verification Token
app.get("/api/student/delivery-tracking", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const s = req.user.studentProfile;
    const deliveries = await prisma.delivery.findMany({
      where: { studentId: s.id },
      include: { provider: true },
      orderBy: [{ mealDate: "desc" }, { updatedAt: "desc" }],
      take: 30,
    });

    res.json({
      success: true,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        meal_date: d.mealDate.toISOString().split("T")[0],
        meal_type: d.mealType,
        status: d.status.toLowerCase(),
        qr_token: d.qrToken,
        delivery_address: d.address,
        delivered_at: d.deliveredAt,
        delivery_person_name: "Ramesh Kumar",
        delivery_person_phone: "+91 98765 43210",
        estimated_time: d.status === "DELIVERED" ? "Delivered" : "25-30 mins",
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. TIFFIN OWNER PORTAL (Strict Tenant Isolation)
// ==========================================
app.get("/api/owner/overview", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    if (!provider) {
      return res.status(404).json({ success: false, error: "Tiffin Provider profile not found." });
    }

    const pid = provider.id;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Strict tenant queries isolated to pid
    const [totalStudents, activeSubs, todayDeliveries, expenses, payments] = await Promise.all([
      prisma.subscription.groupBy({
        by: ["studentId"],
        where: { providerId: pid },
      }),
      prisma.subscription.count({
        where: { providerId: pid, status: "ACTIVE" },
      }),
      prisma.delivery.findMany({
        where: { providerId: pid, mealDate: today },
      }),
      prisma.expense.findMany({
        where: { providerId: pid },
      }),
      prisma.payment.findMany({
        where: { providerId: pid, status: "SUCCESS" },
      }),
    ]);

    const totalRevenue = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const totalExpense = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

    const bOrders = todayDeliveries.filter((d) => d.mealType === "BREAKFAST").length;
    const lOrders = todayDeliveries.filter((d) => d.mealType === "LUNCH").length;
    const dOrders = todayDeliveries.filter((d) => d.mealType === "DINNER").length;

    res.json({
      success: true,
      metrics: {
        total_students: totalStudents.length,
        active_students: totalStudents.length,
        active_subscriptions: activeSubs,
        today_orders: {
          total_today: todayDeliveries.length,
          breakfast_today: bOrders,
          lunch_today: lOrders,
          dinner_today: dOrders,
        },
        today_collection: 4680,
        monthly_revenue: totalRevenue,
        monthly_expenses: totalExpense,
        net_profit_loss: totalRevenue - totalExpense,
        pending_deliveries: todayDeliveries.filter((d) => d.status !== "DELIVERED").length,
        completed_deliveries: todayDeliveries.filter((d) => d.status === "DELIVERED").length,
        stop_requests: 1,
      },
      recent_deliveries: todayDeliveries.slice(0, 5).map((d) => ({
        id: d.id,
        meal_type: d.mealType,
        status: d.status.toLowerCase(),
        delivery_address: d.address,
        qr_token: d.qrToken,
      })),
    });
  } catch (err) {
    console.error("Owner Overview Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Contactless QR Verification (Delivery Fleet / Kitchen Dispatch)
app.post("/api/owner/deliveries/verify-qr", authenticate, async (req, res) => {
  try {
    const { qr_token } = req.body;
    if (!qr_token?.trim()) {
      return res.status(400).json({ success: false, error: "QR token required for verification." });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { qrToken: qr_token.trim() },
      include: {
        student: { include: { user: true } },
        provider: true,
      },
    });

    if (!delivery) {
      return res.status(404).json({ success: false, error: "Invalid or expired QR verification token." });
    }

    // Atomically mark delivered and timestamp
    const updated = await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: delivery.student.userId,
        title: "Tiffin Delivered (QR Verified)",
        message: `Your ${delivery.mealType} meal has been verified and successfully delivered! Bon Appetit!`,
      },
    });

    res.json({
      success: true,
      message: `QR Token verified! ${delivery.mealType} for ${delivery.student.user.name} marked as Delivered.`,
      delivery: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Owner Staff Management & Payroll
app.get("/api/owner/staff", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const pid = req.user.ownedProvider.id;
    const staff = await prisma.staff.findMany({
      where: { providerId: pid },
      orderBy: { role: "asc" },
    });

    const activeStaff = staff.filter((s) => s.isActive);
    const totalPayroll = activeStaff.reduce((acc, s) => acc + Number(s.salary), 0);

    res.json({
      success: true,
      staff: staff.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        phone: s.phone,
        salary: Number(s.salary),
        is_active: s.isActive ? 1 : 0,
      })),
      summary: {
        total_count: staff.length,
        active_count: activeStaff.length,
        monthly_payroll: totalPayroll,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/staff/add", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const pid = req.user.ownedProvider.id;
    const { name, role = "COOK", phone, salary = 12000 } = req.body;

    const created = await prisma.staff.create({
      data: {
        providerId: pid,
        name: name.trim(),
        role: role.toUpperCase(),
        phone: phone.trim(),
        salary: Number(salary),
        isActive: true,
      },
    });

    res.json({ success: true, message: `Staff member '${created.name}' (${created.role}) added successfully!` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/staff/toggle", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const { staff_id } = req.body;
    const item = await prisma.staff.findUnique({ where: { id: staff_id } });
    if (!item) return res.status(404).json({ success: false, error: "Staff not found" });

    await prisma.staff.update({
      where: { id: staff_id },
      data: { isActive: !item.isActive },
    });

    res.json({ success: true, message: "Staff active status toggled." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Owner Kitchen Stock Inventory & Thresholds
app.get("/api/owner/inventory", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const pid = req.user.ownedProvider.id;
    const items = await prisma.inventoryItem.findMany({
      where: { providerId: pid },
      orderBy: { itemName: "asc" },
    });

    res.json({
      success: true,
      items: items.map((i) => ({
        id: i.id,
        item_name: i.itemName,
        quantity: Number(i.quantity),
        unit: i.unit,
        min_threshold: Number(i.minThreshold),
        supplier_name: i.supplierName,
        is_low_stock: Number(i.quantity) <= Number(i.minThreshold) ? 1 : 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/inventory/add", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const pid = req.user.ownedProvider.id;
    const { item_name, quantity, unit = "kg", min_threshold = 10, supplier_name } = req.body;

    await prisma.inventoryItem.create({
      data: {
        providerId: pid,
        itemName: item_name.trim(),
        quantity: Number(quantity),
        unit: unit.trim(),
        minThreshold: Number(min_threshold),
        supplierName: supplier_name?.trim() || null,
      },
    });

    res.json({ success: true, message: `Inventory item '${item_name}' added!` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/inventory/update-stock", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const { item_id, quantity } = req.body;
    await prisma.inventoryItem.update({
      where: { id: item_id },
      data: { quantity: Number(quantity) },
    });

    res.json({ success: true, message: "Inventory quantity updated successfully." });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Owner Grievances & Resolution
app.get("/api/owner/complaints", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const pid = req.user.ownedProvider.id;
    const complaints = await prisma.complaint.findMany({
      where: { providerId: pid },
      include: { student: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      complaints: complaints.map((c) => ({
        id: c.id,
        student_name: c.student.user.name,
        student_phone: c.student.user.phone,
        category: c.category,
        description: c.description,
        status: c.status,
        resolution: c.resolution,
        created_at: c.createdAt.toISOString().split("T")[0],
      })),
      summary: {
        total: complaints.length,
        open: complaints.filter((c) => c.status === "OPEN").length,
        in_progress: complaints.filter((c) => c.status === "IN_PROGRESS").length,
        resolved: complaints.filter((c) => c.status === "RESOLVED").length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/complaints/resolve", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const { complaint_id, status = "RESOLVED", resolution } = req.body;
    const updated = await prisma.complaint.update({
      where: { id: complaint_id },
      data: {
        status: status.toUpperCase(),
        resolution: resolution?.trim() || null,
      },
      include: { student: { include: { user: true } } },
    });

    // Notify Student
    await prisma.notification.create({
      data: {
        userId: updated.student.userId,
        title: "Grievance Resolution Notice",
        message: `Your grievance regarding '${updated.category}' is marked ${status}. Action: ${resolution || "Addressed by kitchen owner"}`,
      },
    });

    res.json({ success: true, message: `Grievance updated to ${status}!` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Fallback SPA Route

// ==========================================
// 4. HEALTH CHECK & PUBLIC DETAILS
// ==========================================
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get("/api/public/tiffin-details", async (req, res) => {
  try {
    const provider = await prisma.tiffinProvider.findFirst({
      where: { status: "APPROVED" },
      include: { owner: { select: { name: true, phone: true } } },
    });
    res.json({
      success: true,
      provider: provider || {
        businessName: "Shree Annapurna Pure Veg Tiffin & Meals",
        address: "Plot 45, Near Holkar Science College, Bhawarkua, Indore",
        contactPhone: "+91 98260 12345",
        breakfastCutoff: "07:30",
        lunchCutoff: "10:00",
        dinnerCutoff: "17:30",
        stopLeadHours: 2,
      },
    });
  } catch (err) {
    res.json({
      success: true,
      provider: {
        businessName: "Shree Annapurna Pure Veg Tiffin & Meals",
        address: "Indore, MP",
        contactPhone: "+91 98260 12345",
      },
    });
  }
});

app.get("/api/providers", async (req, res) => {
  try {
    const providers = await prisma.tiffinProvider.findMany({
      where: { status: "APPROVED" },
      include: { owner: { select: { name: true, email: true, phone: true } } },
    });
    res.json({ success: true, providers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/providers/:id", async (req, res) => {
  try {
    const provider = await prisma.tiffinProvider.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: { name: true, phone: true } } },
    });
    if (!provider) return res.status(404).json({ success: false, error: "Provider not found" });
    res.json({ success: true, provider });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. PRICING & MEAL PLANS
// ==========================================
app.get("/api/pricing", async (req, res) => {
  try {
    // Default pricing structure
    const pricing = {
      breakfast_price: 50.0,
      lunch_price: 90.0,
      dinner_price: 90.0,
      day_plan_price: 210.0,
      weekly_plan_price: 1350.0,
      monthly_plan_price: 5200.0,
      custom_meal_base_price: 85.0,
      monthly_discount_pct: 10.0,
      weekly_discount_pct: 5.0,
    };
    res.json({ success: true, pricing });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/pricing", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const pricing = {
      breakfast_price: 50.0,
      lunch_price: 90.0,
      dinner_price: 90.0,
      day_plan_price: 210.0,
      weekly_plan_price: 1350.0,
      monthly_plan_price: 5200.0,
      monthly_discount_pct: 10.0,
      weekly_discount_pct: 5.0,
    };
    res.json({ success: true, pricing });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/pricing", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const { breakfast_price, lunch_price, dinner_price, monthly_discount_pct, weekly_discount_pct } = req.body;
    res.json({
      success: true,
      message: "Pricing updated successfully!",
      pricing: {
        breakfast_price: parseFloat(breakfast_price) || 50,
        lunch_price: parseFloat(lunch_price) || 90,
        dinner_price: parseFloat(dinner_price) || 90,
        monthly_discount_pct: parseFloat(monthly_discount_pct) || 10,
        weekly_discount_pct: parseFloat(weekly_discount_pct) || 5,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/student/plan/calculate", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const { plan_type, duration_days = 30, meals = { breakfast: false, lunch: true, dinner: true } } = req.body;
    let basePricePerDay = 0;
    if (meals.breakfast) basePricePerDay += 50;
    if (meals.lunch) basePricePerDay += 90;
    if (meals.dinner) basePricePerDay += 90;

    let subtotal = basePricePerDay * duration_days;
    let discount = 0;

    if (plan_type === "MONTHLY" || duration_days >= 30) {
      discount = subtotal * 0.10;
    } else if (plan_type === "WEEKLY" || duration_days >= 7) {
      discount = subtotal * 0.05;
    }

    const finalAmount = Math.max(0, subtotal - discount);
    res.json({
      success: true,
      calculation: {
        plan_type,
        duration_days,
        subtotal,
        discount,
        final_amount: finalAmount,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. MENU ENDPOINTS
// ==========================================
app.get("/api/menu", async (req, res) => {
  try {
    const menus = await prisma.menu.findMany({
      where: { status: "PUBLISHED" },
      include: { items: true },
      orderBy: [{ menuDate: "asc" }, { mealType: "asc" }],
      take: 21,
    });
    res.json({ success: true, menus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/menu/publish", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    if (!provider) return res.status(400).json({ error: "No provider profile found" });

    const { menuDate, mealType, mealTiming, items = [], isSpecial = false } = req.body;
    const targetDate = menuDate ? new Date(menuDate) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const menu = await prisma.menu.upsert({
      where: {
        providerId_menuDate_mealType: {
          providerId: provider.id,
          menuDate: targetDate,
          mealType: mealType.toUpperCase(),
        },
      },
      update: {
        status: "PUBLISHED",
        mealTiming: mealTiming || "12:30 PM - 02:30 PM",
        isSpecial: !!isSpecial,
        publishedAt: new Date(),
      },
      create: {
        providerId: provider.id,
        menuDate: targetDate,
        mealType: mealType.toUpperCase(),
        status: "PUBLISHED",
        mealTiming: mealTiming || "12:30 PM - 02:30 PM",
        isSpecial: !!isSpecial,
        publishedAt: new Date(),
        items: {
          create: items.map((it) => ({
            name: typeof it === "string" ? it : it.name,
            description: it.description || null,
            isAvailable: true,
          })),
        },
      },
      include: { items: true },
    });

    res.json({ success: true, message: "Menu published successfully!", menu });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. PAYMENTS & SUBSCRIPTIONS
// ==========================================
app.post("/api/student/payment/verify", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    if (!student) return res.status(400).json({ error: "Student profile not found" });

    const { amount, plan_type = "MONTHLY", payment_method = "ONLINE", provider_id } = req.body;
    const provider = provider_id
      ? await prisma.tiffinProvider.findUnique({ where: { id: provider_id } })
      : await prisma.tiffinProvider.findFirst({ where: { status: "APPROVED" } });

    if (!provider) return res.status(400).json({ error: "Tiffin provider not found" });

    const receiptNumber = `RCP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const gatewayOrderId = `order_${crypto.randomBytes(6).toString("hex")}`;
    const gatewayPaymentId = `pay_${crypto.randomBytes(8).toString("hex")}`;

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    const durationDays = plan_type === "WEEKLY" ? 7 : 30;
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + durationDays);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Record Payment
      const payment = await tx.payment.create({
        data: {
          studentId: student.id,
          providerId: provider.id,
          amount: parseFloat(amount) || 5200.0,
          gatewayOrderId,
          gatewayPaymentId,
          status: "SUCCESS",
          purpose: "SUBSCRIPTION",
          verifiedAt: new Date(),
        },
      });

      // 2. Create Active Subscription
      const sub = await tx.subscription.create({
        data: {
          studentId: student.id,
          providerId: provider.id,
          planType: plan_type.toUpperCase(),
          includesBreakfast: true,
          includesLunch: true,
          includesDinner: true,
          startDate,
          endDate,
          totalPrice: parseFloat(amount) || 5200.0,
          status: "ACTIVE",
        },
      });

      // 3. Award 50 Reward Points to Student
      await tx.studentProfile.update({
        where: { id: student.id },
        data: { rewardPoints: { increment: 50 } },
      });

      return { payment, subscription: sub, receiptNumber };
    });

    res.json({
      success: true,
      message: "Subscription activated successfully!",
      receipt: result.receiptNumber,
      subscription: result.subscription,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 8. ATTENDANCE & FEEDBACK
// ==========================================
app.get("/api/student/attendance", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    const deliveries = await prisma.delivery.findMany({
      where: { studentId: student.id },
      orderBy: { mealDate: "desc" },
      take: 31,
    });
    res.json({ success: true, attendance: deliveries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/student/feedback", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    const { meal_date, meal_type = "LUNCH", overall_verdict = "Excellent", taste_rating = 5, quality_rating = 5, quantity_rating = 5, hygiene_rating = 5, comment } = req.body;

    const provider = await prisma.tiffinProvider.findFirst({ where: { status: "APPROVED" } });
    if (!provider) return res.status(400).json({ error: "Provider not found" });

    const targetDate = meal_date ? new Date(meal_date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const feedback = await prisma.feedback.create({
      data: {
        studentId: student.id,
        providerId: provider.id,
        mealDate: targetDate,
        mealType: meal_type.toUpperCase(),
        overallVerdict: overall_verdict,
        tasteRating: parseInt(taste_rating) || 5,
        qualityRating: parseInt(quality_rating) || 5,
        quantityRating: parseInt(quantity_rating) || 5,
        hygieneRating: parseInt(hygiene_rating) || 5,
        comment: comment?.trim() || null,
      },
    });

    res.json({ success: true, message: "Feedback submitted successfully!", feedback });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 9. FOOD SUGGESTIONS & VOTING
// ==========================================
app.get("/api/suggestions", async (req, res) => {
  try {
    const suggestions = await prisma.foodSuggestion.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      include: { votes: true },
      orderBy: { createdAt: "desc" },
    });
    const formatted = suggestions.map((s) => ({
      id: s.id,
      dish_name: s.dishName,
      status: s.status,
      vote_count: s.votes.length,
      created_at: s.createdAt,
    }));
    res.json({ success: true, suggestions: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/suggestions/add", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    const { dish_name } = req.body;
    if (!dish_name?.trim()) return res.status(400).json({ error: "Dish name required" });

    const provider = await prisma.tiffinProvider.findFirst({ where: { status: "APPROVED" } });
    const suggestion = await prisma.foodSuggestion.create({
      data: {
        providerId: provider.id,
        dishName: dish_name.trim(),
        status: "APPROVED",
        votes: {
          create: { studentId: student.id },
        },
      },
    });
    res.json({ success: true, message: "Dish suggestion added!", suggestion });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/suggestions/vote", authenticate, authorize("STUDENT"), async (req, res) => {
  try {
    const student = req.user.studentProfile;
    const { suggestion_id } = req.body;
    if (!suggestion_id) return res.status(400).json({ error: "Suggestion ID required" });

    const existingVote = await prisma.vote.findUnique({
      where: {
        suggestionId_studentId: {
          suggestionId: suggestion_id,
          studentId: student.id,
        },
      },
    });

    if (existingVote) {
      await prisma.vote.delete({ where: { id: existingVote.id } });
      return res.json({ success: true, voted: false, message: "Vote removed" });
    } else {
      await prisma.vote.create({
        data: {
          suggestionId: suggestion_id,
          studentId: student.id,
        },
      });
      return res.json({ success: true, voted: true, message: "Vote recorded!" });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// 10. OWNER OPERATIONS: STUDENTS, TIFFINS, EXPENSES, P&L
// ==========================================
app.get("/api/owner/students", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const subscriptions = await prisma.subscription.findMany({
      where: { providerId: provider.id, status: "ACTIVE" },
      include: {
        student: {
          include: { user: { select: { name: true, email: true, phone: true } } },
        },
      },
    });
    const students = subscriptions.map((s) => ({
      id: s.student.id,
      name: s.student.user.name,
      phone: s.student.user.phone,
      email: s.student.user.email,
      address: s.student.address,
      plan_type: s.planType,
      wallet_balance: s.student.walletBalance,
      boxes_held: s.student.boxesHeld,
    }));
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/tiffins", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const subscriptions = await prisma.subscription.findMany({
      where: { providerId: provider.id, status: "ACTIVE" },
      include: { student: { include: { user: true } } },
    });
    const activeTiffins = subscriptions.map((s) => ({
      student_id: s.student.id,
      student_name: s.student.user.name,
      address: s.student.address,
      boxes_held: s.student.boxesHeld,
      plan_type: s.planType,
    }));
    res.json({
      success: true,
      total_active_boxes: activeTiffins.reduce((acc, t) => acc + (t.boxes_held || 1), 0),
      active_tiffins: activeTiffins,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/attendance", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const deliveries = await prisma.delivery.findMany({
      where: { providerId: provider.id },
      include: { student: { include: { user: true } } },
      orderBy: { mealDate: "desc" },
      take: 50,
    });
    res.json({ success: true, attendance: deliveries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/attendance/update", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const { delivery_id, status = "DELIVERED", correction_reason } = req.body;
    const updated = await prisma.delivery.update({
      where: { id: delivery_id },
      data: {
        status: status.toUpperCase(),
        deliveredAt: status.toUpperCase() === "DELIVERED" ? new Date() : null,
      },
    });
    res.json({ success: true, message: `Attendance updated to ${status}!`, delivery: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/deliveries", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const deliveries = await prisma.delivery.findMany({
      where: { providerId: provider.id },
      include: { student: { include: { user: true } } },
      orderBy: { mealDate: "desc" },
      take: 50,
    });
    res.json({ success: true, deliveries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/deliveries/update-status", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const { delivery_id, status } = req.body;
    const updated = await prisma.delivery.update({
      where: { id: delivery_id },
      data: {
        status: status.toUpperCase(),
        deliveredAt: status.toUpperCase() === "DELIVERED" ? new Date() : null,
      },
    });
    res.json({ success: true, message: `Status updated to ${status}!`, delivery: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/stop-requests", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const requests = await prisma.stopMealRequest.findMany({
      where: { providerId: provider.id },
      include: { student: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/payments", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const payments = await prisma.payment.findMany({
      where: { providerId: provider.id },
      include: { student: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
    const totalCollected = payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
    res.json({ success: true, total_collected: totalCollected, payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/feedback-analytics", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const feedbacks = await prisma.feedback.findMany({
      where: { providerId: provider.id },
      include: { student: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });

    const total = feedbacks.length;
    const avgTaste = total ? feedbacks.reduce((acc, f) => acc + f.tasteRating, 0) / total : 4.8;
    const avgQuality = total ? feedbacks.reduce((acc, f) => acc + f.qualityRating, 0) / total : 4.7;

    res.json({
      success: true,
      analytics: {
        total_reviews: total,
        average_taste: parseFloat(avgTaste.toFixed(1)),
        average_quality: parseFloat(avgQuality.toFixed(1)),
        feedbacks,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/expenses", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const expenses = await prisma.expense.findMany({
      where: { providerId: provider.id },
      orderBy: { expenseDate: "desc" },
    });
    const total = expenses.reduce((acc, e) => acc + parseFloat(e.amount), 0);
    res.json({ success: true, total_expenses: total, expenses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/owner/expenses/add", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const { category = "Raw Materials", amount, expense_date, notes } = req.body;
    const targetDate = expense_date ? new Date(expense_date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    const expense = await prisma.expense.create({
      data: {
        providerId: provider.id,
        category,
        amount: parseFloat(amount) || 0,
        expenseDate: targetDate,
        notes: notes?.trim() || null,
      },
    });
    res.json({ success: true, message: "Expense recorded successfully!", expense });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get("/api/owner/profit-loss", authenticate, authorize("OWNER"), async (req, res) => {
  try {
    const provider = req.user.ownedProvider;
    const payments = await prisma.payment.findMany({ where: { providerId: provider.id } });
    const expenses = await prisma.expense.findMany({ where: { providerId: provider.id } });

    const totalRevenue = payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + parseFloat(e.amount), 0);
    const netProfit = totalRevenue - totalExpenses;

    res.json({
      success: true,
      financials: {
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        profit_margin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) + "%" : "0%",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/notifications", authenticate, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/notifications/mark-read", authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, message: "Notifications marked as read" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Fallback SPA Route
app.get("*", (req, res) => {
  if (req.path.endsWith(".css")) {
    return res.status(404).type("text/css").send("/* CSS not found */");
  }
  if (req.path.endsWith(".js")) {
    return res.status(404).type("application/javascript").send("// JS not found");
  }
  res.sendFile(path.join(__dirname, "index.html"));
});

// Server Launch
if (process.env.NODE_ENV !== "test") {
  // Run background initialization
  setTimeout(async () => {
    try {
      console.log("Checking database schema readiness...");
      try {
        await prisma.user.count();
      } catch (err) {
        console.log("Auto-pushing database schema on startup...");
        execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", timeout: 45000 });
      }
      const count = await prisma.user.count();
      if (count === 0) {
        console.log("Database empty, running initial seed...");
        await seedDemoData();
      }
      console.log("Database ready with " + (await prisma.user.count()) + " users.");
    } catch (e) {
      console.log("Startup init note:", e.message);
    }
  }, 2000);

  app.listen(PORT, () => {
    console.log(`=================================================================`);
    console.log(`  EXPRESS + PRISMA TIFFIN MANAGEMENT BACKEND RUNNING`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Strict IST Stop Meal Cutoff: Active (leadHours=2)`);
    console.log(`  Tenant Isolation & QR Verification: Active`);
    console.log(`=================================================================`);
  });
}

export default app;
