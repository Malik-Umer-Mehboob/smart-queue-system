const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking Doctors table...');
    const doctors = await prisma.doctor.findMany().catch(e => {
        console.log('Error querying doctors table:', e.message);
        return null;
    });
    if (doctors) console.log('Doctors table exists and has', doctors.length, 'records.');

    console.log('Checking Appointment columns via raw query...');
    const columns = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'appointments'`;
    console.log('Columns in appointments:', columns.map(c => c.column_name).join(', '));

  } catch (e) {
    console.error('Core error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
