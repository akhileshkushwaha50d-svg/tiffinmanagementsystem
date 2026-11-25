/**
 * prisma/seed.js - Production & Staging Database Seeding Script
 * Strictly adheres to prisma/schema.prisma models, enums, and fields.
 * Populates realistic demo accounts, menus, subscriptions, inventory, and staff.
 * Execute with: npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Prisma database seeding for Tiffin Platform...");

  // 1. Hash default passwords
  const ownerPasswordHash = await bcrypt.hash("owner123", 10);
  const studentPasswordHash = await bcrypt.hash("student123", 10);

  // 2. Upsert Demo Owner
  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@annapurnatiffin.com" },
    update: {},
    create: {
      name: "Rajesh Sharma",
      email: "owner@annapurnatiffin.com",
      phone: "+919826012345",
      passwordHash: ownerPasswordHash,
      role: "OWNER",
      isActive: true,
      ownedProvider: {
        create: {
          businessName: "Shree Annapurna Pure Veg Tiffin & Meals",
          address: "Plot 45, Near Holkar Science College, Bhawarkua, Indore, MP - 452001",
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

  const providerId = ownerUser.ownedProvider.id;
  console.log(`✅ Owner & Provider created: ${ownerUser.ownedProvider.businessName} (ID: ${providerId})`);

  // 3. Upsert Demo Student
  const studentUser = await prisma.user.upsert({
    where: { email: "student@tiffin.com" },
    update: {},
    create: {
      name: "Aman Verma",
      email: "student@tiffin.com",
      phone: "+919876543210",
      passwordHash: studentPasswordHash,
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
          noOnionGarlic: false,
          allergies: "None",
          specialInstructions: "Deliver before 1:00 PM on weekdays",
          boxesHeld: 1,
        },
      },
    },
    include: { studentProfile: true },
  });

  const studentId = studentUser.studentProfile.id;
  console.log(`✅ Student created: ${studentUser.name} (StudentProfile ID: ${studentId})`);

  // 4. Seed Menus with MenuItems for the current week (7 days)
  const mealConfigs = [
    {
      mealType: "BREAKFAST",
      mealTiming: "07:30 AM - 09:30 AM",
      items: [
        { name: "Indori Poha", description: "Steamed poha with mustard seeds, fennel, and coriander", isAvailable: true },
        { name: "Ratlami Sev", description: "Crispy clove-spiced sev garnish", isAvailable: true },
        { name: "Crispy Jalebi (2 pcs)", description: "Hot sugar-syrup dipped traditional jalebis", isAvailable: true },
        { name: "Masala Chai", description: "Freshly brewed ginger cardamom tea", isAvailable: true }
      ]
    },
    {
      mealType: "LUNCH",
      mealTiming: "12:30 PM - 02:30 PM",
      items: [
        { name: "Paneer Butter Masala", description: "Soft cottage cheese cubes in rich cashew-tomato gravy", isAvailable: true },
        { name: "Yellow Dal Tadka", description: "Arhar dal tempered with cumin, garlic and dry red chillies", isAvailable: true },
        { name: "Jeera Basmati Rice", description: "Long grain aromatic basmati rice tempered with ghee and cumin", isAvailable: true },
        { name: "4 Whole Wheat Phulkas", description: "Freshly puffed rotis with pure desi ghee", isAvailable: true },
        { name: "Boondi Raita", description: "Chilled yogurt with spiced boondi", isAvailable: true }
      ]
    },
    {
      mealType: "DINNER",
      mealTiming: "07:30 PM - 09:30 PM",
      items: [
        { name: "Aloo Gobhi Matar", description: "Dry spiced cauliflower, potato and green peas curry", isAvailable: true },
        { name: "Moong Dal Tadka", description: "Light and digestible yellow moong dal", isAvailable: true },
        { name: "3 Butter Phulkas", description: "Fresh warm whole wheat rotis", isAvailable: true },
        { name: "Steamed Rice", description: "Freshly steamed rice", isAvailable: true },
        { name: "Mango Pickle & Roasted Papad", description: "Traditional accompaniments", isAvailable: true }
      ]
    }
  ];

  // Populate today and next 6 days
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let offset = 0; offset < 7; offset++) {
    const menuDate = new Date(today);
    menuDate.setUTCDate(today.getUTCDate() + offset);

    for (const config of mealConfigs) {
      const existingMenu = await prisma.menu.findUnique({
        where: {
          providerId_menuDate_mealType: {
            providerId,
            menuDate,
            mealType: config.mealType,
          },
        },
      });

      if (!existingMenu) {
        await prisma.menu.create({
          data: {
            providerId,
            menuDate,
            mealType: config.mealType,
            status: "PUBLISHED",
            mealTiming: config.mealTiming,
            isSpecial: offset === 0 && config.mealType === "LUNCH",
            publishedAt: new Date(),
            items: {
              create: config.items,
            },
          },
        });
      }
    }
  }
  console.log("✅ Weekly menus with nested MenuItems created for next 7 days");

  // 5. Seed Active Subscription
  const startDate = new Date(today);
  const endDate = new Date(today);
  endDate.setUTCDate(today.getUTCDate() + 30);

  const existingSub = await prisma.subscription.findFirst({
    where: { studentId, providerId },
  });

  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        studentId,
        providerId,
        planType: "MONTHLY",
        includesBreakfast: true,
        includesLunch: true,
        includesDinner: true,
        startDate,
        endDate,
        totalPrice: 5200.0,
        status: "ACTIVE",
      },
    });
    console.log("✅ Active Monthly subscription seeded with totalPrice ₹5200.00");
  }

  // 6. Seed Deliveries for Today
  for (const config of mealConfigs) {
    const existingDel = await prisma.delivery.findUnique({
      where: {
        studentId_mealDate_mealType: {
          studentId,
          mealDate: today,
          mealType: config.mealType,
        },
      },
    });

    if (!existingDel) {
      await prisma.delivery.create({
        data: {
          studentId,
          providerId,
          mealDate: today,
          mealType: config.mealType,
          status: config.mealType === "BREAKFAST" ? "DELIVERED" : "ORDER_RECEIVED",
          deliveredAt: config.mealType === "BREAKFAST" ? new Date() : null,
          address: "Room 302, Royal Boys Hostel, Bhawarkua, Indore",
        },
      });
    }
  }
  console.log("✅ Scheduled deliveries seeded for today with unique QR tokens");

  // 7. Seed Inventory Items
  const inventoryItems = [
    { itemName: "Whole Wheat Atta (MP Sharbati)", quantity: 85.0, unit: "kg", minThreshold: 30.0, supplierName: "Kisan Mandi Indore" },
    { itemName: "Basmati Rice (Rozana)", quantity: 60.0, unit: "kg", minThreshold: 20.0, supplierName: "Lal Qila Traders" },
    { itemName: "Fresh Cow Milk / Curd", quantity: 12.0, unit: "L", minThreshold: 15.0, supplierName: "Sanchi Dairy Booth 4" },
    { itemName: "Fresh Paneer", quantity: 8.5, unit: "kg", minThreshold: 5.0, supplierName: "Sharma Dairy" },
    { itemName: "Refined Soyabean Oil", quantity: 45.0, unit: "L", minThreshold: 25.0, supplierName: "Mahakosh Distributors" },
    { itemName: "Commercial LPG Cylinders", quantity: 3.0, unit: "cylinders", minThreshold: 2.0, supplierName: "Indane Gas Agency" },
  ];

  for (const item of inventoryItems) {
    const existing = await prisma.inventoryItem.findFirst({
      where: { providerId, itemName: item.itemName },
    });
    if (!existing) {
      await prisma.inventoryItem.create({
        data: {
          providerId,
          itemName: item.itemName,
          quantity: item.quantity,
          unit: item.unit,
          minThreshold: item.minThreshold,
          supplierName: item.supplierName,
        },
      });
    }
  }
  console.log("✅ Kitchen inventory stock seeded with threshold levels");

  // 8. Seed Staff Members
  const staffMembers = [
    { name: "Rameshwar Gurjar", role: "COOK", phone: "9826099111", salary: 22000.0 },
    { name: "Sunil Yadav", role: "DELIVERY", phone: "9826099222", salary: 14000.0 },
    { name: "Kavita Bai", role: "HELPER", phone: "9826099333", salary: 9500.0 },
  ];

  for (const staff of staffMembers) {
    const existing = await prisma.staff.findFirst({
      where: { providerId, phone: staff.phone },
    });
    if (!existing) {
      await prisma.staff.create({
        data: {
          providerId,
          name: staff.name,
          role: staff.role,
          phone: staff.phone,
          salary: staff.salary,
          isActive: true,
        },
      });
    }
  }
  console.log("✅ Kitchen staff & delivery team seeded");

  // 9. Seed Sample Expense
  const existingExpense = await prisma.expense.findFirst({
    where: { providerId },
  });
  if (!existingExpense) {
    await prisma.expense.create({
      data: {
        providerId,
        category: "Raw Materials",
        amount: 3200.0,
        expenseDate: today,
        notes: "Weekly fresh vegetables and dairy from Mandi",
      },
    });
    console.log("✅ Sample kitchen expense recorded");
  }

  // 10. Seed Sample Food Suggestion & Vote
  const existingSug = await prisma.foodSuggestion.findFirst({
    where: { providerId, dishName: "Dal Baati Churma Special" },
  });
  if (!existingSug) {
    const sug = await prisma.foodSuggestion.create({
      data: {
        providerId,
        dishName: "Dal Baati Churma Special",
        status: "APPROVED",
      },
    });
    await prisma.vote.create({
      data: {
        suggestionId: sug.id,
        studentId,
      },
    });
    console.log("✅ Student food suggestion & vote seeded");
  }

  console.log("\n✨ DATABASE SEEDING COMPLETED 100% SUCCESSFULLY!");
  console.log("=================================================");
  console.log("DEMO CREDENTIALS FOR TESTING & DEPLOYMENT:");
  console.log("  👨‍🎓 Student: student@tiffin.com    | Password: student123");
  console.log("  👨‍🍳 Owner:   owner@annapurnatiffin.com | Password: owner123");
  console.log("=================================================");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
