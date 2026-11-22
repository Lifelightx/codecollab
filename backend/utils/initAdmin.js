const User = require('../models/User');
const Codespace = require('../models/codeSpace');
const logger = require('./logger');

async function initAdminAndSpace() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER || 'admin@codecollab.io';
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

    // 1. Ensure Admin User exists and has role: 'admin'
    let admin = await User.findOne({
      $or: [{ username: adminUsername }, { role: 'admin' }]
    });

    if (!admin) {
      admin = new User({
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        isVerified: true,
      });
      await admin.save();
      logger.info(`Admin account initialized: '${adminUsername}' (${adminEmail})`, null, 'ADMIN');
    } else {
      let changed = false;
      if (admin.role !== 'admin') {
        admin.role = 'admin';
        changed = true;
      }
      if (changed) {
        await admin.save();
        logger.info(`Ensured admin role for '${admin.username}'`, null, 'ADMIN');
      }
    }

    // 2. Ensure 'admin' space exists and is permanently private
    let adminSpace = await Codespace.findOne({ name: 'admin' });
    if (!adminSpace) {
      adminSpace = new Codespace({
        name: 'admin',
        isPublic: false,
        ownerId: admin._id,
        expiresAt: new Date('2099-12-31T23:59:59Z'), // Permanent lifetime
        files: [{
          name: 'README.md',
          language: 'markdown',
          content: '# Admin Workspace\n\nThis workspace is private and restricted strictly to the administrator.\nFile upload limit for admin is 2GB.\n',
          isFolder: false,
          path: '',
        }],
      });
      await adminSpace.save();
      logger.info(`Initialized permanently private 'admin' codespace (Owner: ${admin.username})`, null, 'ADMIN');
    } else {
      let updated = false;
      if (adminSpace.isPublic) {
        adminSpace.isPublic = false;
        updated = true;
      }
      if (!adminSpace.ownerId || adminSpace.ownerId.toString() !== admin._id.toString()) {
        adminSpace.ownerId = admin._id;
        updated = true;
      }
      if (!adminSpace.expiresAt || adminSpace.expiresAt < new Date('2090-01-01')) {
        adminSpace.expiresAt = new Date('2099-12-31T23:59:59Z');
        updated = true;
      }
      if (updated) {
        await adminSpace.save();
        logger.info(`Secured 'admin' codespace as private lifetime workspace`, null, 'ADMIN');
      }
    }
  } catch (err) {
    logger.error(`Error initializing admin and space: ${err.message}`, err, 'ADMIN');
  }
}

module.exports = initAdminAndSpace;
