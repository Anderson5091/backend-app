import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, take: 10, select: { id: true, email: true, fullName: true, createdAt: true } });
  console.log("Users:", JSON.stringify(users, null, 2));
} finally {
  await prisma.$disconnect();
}
