const fs = require('fs');
const mongoose = require('mongoose');

const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx > -1) {
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
}

(async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    const db = mongoose.connection.db;
    const coll = db.collection('orders');
    const docs = await coll
      .find({ isAdminCreated: true }, {
        projection: {
          _id: 1,
          trackingNumber: 1,
          serviceType: 1,
          senderName: 1,
          senderPhone: 1,
          recipientName: 1,
          recipientPhone: 1,
          customer: 1,
          isAdminCreated: 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    console.log(JSON.stringify(docs, null, 2));
  } catch (error) {
    console.error('ERR', error);
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
  }
})();
