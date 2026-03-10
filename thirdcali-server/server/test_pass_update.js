const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function testUpdate() {
    const id = '77909d0a-e1af-48f9-a0c7-6cd98072ae19'; // The ID we found
    const newPass = 'new_password';

    try {
        console.log('Testing update for ID:', id);
        const admin = await prisma.admin.findUnique({ where: { id } });
        if (!admin) {
            console.error('Admin not found in test');
            return;
        }
        console.log('Admin found:', admin.username);

        const hashedPassword = await bcrypt.hash(newPass, 10);
        console.log('Hashed password generated');

        const updated = await prisma.admin.update({
            where: { id },
            data: { password: hashedPassword }
        });
        console.log('Update successful for:', updated.username);
    } catch (error) {
        console.error('Test failed with error:', error);
    } finally {
        await prisma.$disconnect();
        process.exit();
    }
}

testUpdate();
