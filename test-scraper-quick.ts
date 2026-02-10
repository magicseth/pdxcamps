import { Stagehand } from '@anthropic-ai/stagehand';
import { scrape } from './.scraper-development/scraper-mx7exdz4bsqhyxj8qwzb3wzpg980q708';

async function main() {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    verbose: 1,
    debugDom: true,
  });

  try {
    await stagehand.init();
    const page = stagehand.page;

    console.log('Starting scraper...');
    const sessions = await scrape(page);

    console.log(`\n✅ Found ${sessions.length} sessions`);

    if (sessions.length > 0) {
      console.log('\n📋 Sample sessions:');
      sessions.slice(0, 3).forEach((session, i) => {
        console.log(`\n${i + 1}. ${session.name}`);
        console.log(`   Dates: ${session.startDate} to ${session.endDate}`);
        console.log(`   Time: ${session.timeRaw || 'N/A'}`);
        console.log(`   Price: ${session.priceRaw || 'N/A'}`);
        console.log(`   Age/Grade: ${session.ageGradeRaw || 'N/A'}`);
      });
    }

    await stagehand.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Scraper failed:', error);
    await stagehand.close();
    process.exit(1);
  }
}

main();
