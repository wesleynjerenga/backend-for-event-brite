import { PrismaClient } from './generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@example.com';
  const password = 'Admin123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists:', email);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log('Admin user created:', user.email);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect()); 