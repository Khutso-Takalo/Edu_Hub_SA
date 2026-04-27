import db from './schema.js';
import seedBursaries from '../../../data/seed/bursaries.json';
import seedInstitutions from '../../../data/seed/institutions.json';
import seedProgrammes from '../../../data/seed/programmes.json';

export async function seedDatabase() {
  const count = await db.bursaries.count();
  if (count === 0) {
    console.log('🌱 Seeding database...');
    await db.bursaries.bulkAdd(seedBursaries);
    // Add institutions and programmes if needed
    console.log('✅ Seeding complete');
  }
}