import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function registerDocuments() {
  try {
    // 1. Get admin user and their tenant
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@sgi360.com' },
      include: { tenant: true }
    });

    if (!adminUser) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    const tenantId = adminUser.tenantId;
    console.log(`✅ Found admin user with tenant: ${tenantId}`);

    // 2. Read all files from uploads directory
    const uploadsDir = path.join(__dirname, '../../uploads');

    if (!fs.existsSync(uploadsDir)) {
      console.log('⚠️ Uploads directory does not exist');
      process.exit(0);
    }

    const files = fs.readdirSync(uploadsDir);
    const docFiles = files.filter(f => f.endsWith('.docx') || f.endsWith('.pdf') || f.endsWith('.xlsx'));

    console.log(`📁 Found ${docFiles.length} document files`);

    // 3. Register each file in the database
    let count = 0;
    for (const file of docFiles) {
      const filePath = `${uploadsDir}/${file}`;

      // Extract title from filename (remove timestamp at the end)
      const title = file.replace(/-\d+\.(docx|pdf|xlsx)$/, '');
      const type = file.split('.').pop() || 'unknown';

      // Check if document already exists
      const existing = await prisma.document.findFirst({
        where: {
          tenantId,
          title,
          filePath: `/uploads/${file}`
        }
      });

      if (existing) {
        console.log(`⏭️  Skipping (already exists): ${title}`);
        continue;
      }

      // Create document record
      await prisma.document.create({
        data: {
          tenantId,
          title,
          type,
          filePath: `/uploads/${file}`,
          status: 'PUBLISHED',
          version: 1
        }
      });

      console.log(`✅ Registered: ${title}`);
      count++;
    }

    console.log(`\n🎉 Successfully registered ${count} documents!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

registerDocuments();
