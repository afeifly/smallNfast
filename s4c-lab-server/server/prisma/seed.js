const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const adminUsername = 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'SUTOuser1234';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.admin.upsert({
        where: { username: adminUsername },
        update: {},
        create: {
            username: adminUsername,
            password: hashedPassword,
        },
    });

    console.log('Seed completed successfully');
    console.log({ adminId: admin.id, username: admin.username });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
