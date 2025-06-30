"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./generated/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new prisma_1.PrismaClient();
async function main() {
    const email = 'admin@example.com';
    const password = 'Admin123!';
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
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
