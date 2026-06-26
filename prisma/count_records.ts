import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const tables = [
    "user", "agent", "adminUser", "partner",
    "transfer", "payoutOrder", "walletTransaction",
    "beneficiary", "agentWallet", "agentTransaction",
    "treasuryWallet", "agentKpi",
  ] as const;
  for (const t of tables) {
    const count = await (p as any)[t].count();
    console.log(`${t}: ${count}`);
  }
  await p.$disconnect();
}

main().catch(console.error);
