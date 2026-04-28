/**
 * Test script to scrape a single location
 * Usage: node test-scrape.js "Restaurant Name" lat lng
 */

const { scrapeFoodpandaSearch } = require('./scrape-foodpanda');

async function test() {
  // Test with command line args or default values
  const name = process.argv[2] || '炸鷄大獅公館店';
  const lat = parseFloat(process.argv[3]) || 25.00843;
  const lng = parseFloat(process.argv[4]) || 121.53789;
  
  console.log(`Testing scrape for: ${name}`);
  console.log(`Location: ${lat}, ${lng}\n`);
  
  const results = await scrapeFoodpandaSearch(name, lat, lng);
  
  if (results.length === 0) {
    console.log('No results found');
    return;
  }
  
  console.log(`\nFound ${results.length} restaurant(s):\n`);
  
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.name}`);
    console.log(`   URL: ${r.url}`);
    console.log(`   ID: ${r.restaurantId}`);
    console.log('');
  });
}

test().catch(console.error);
