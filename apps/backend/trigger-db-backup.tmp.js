const { Queue } = require('bullmq');
const qmod = require('./src/lib/queue');
const { connection, QUEUE_NAMES } = qmod;
console.log('connection type:', typeof connection, 'isFn:', typeof connection === 'function');
console.log('REDIS_URL len:', (process.env.REDIS_URL || '').length);
(async () => {
  try {
    // queue.js exports connection as a function. Let's see.
    let conn;
    if (typeof connection === 'function') {
      conn = connection();
    } else {
      conn = connection;
    }
    const q = new Queue(QUEUE_NAMES.DB_BACKUP, { connection: conn });
    const job = await q.add('dump', { localDir: '/var/backups/vipos' });
    console.log('enqueued job id=', job.id);
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const j = await q.getJob(job.id);
      const state = j ? await j.getState() : 'gone';
      console.log(`t+${i+1}s state=${state}`);
      if (state === 'completed') {
        console.log('returnvalue=', JSON.stringify(j.returnvalue));
        break;
      }
      if (state === 'failed') {
        console.log('failedReason=', j.failedReason?.slice?.(0, 200));
        break;
      }
    }
    await q.close();
    process.exit(0);
  } catch (e) {
    console.error('ERR', e?.message || e);
    process.exit(1);
  }
})();
