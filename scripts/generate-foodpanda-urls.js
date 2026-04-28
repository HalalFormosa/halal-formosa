/**
 * Generate Foodpanda search URLs for all Fried Chicken Master locations
 * This creates a JSON file with search URLs you can manually check
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://svmlwnzmheiishkdwafk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function generateFoodpandaSearchUrl(name, lat, lng) {
  const encodedName = encodeURIComponent(name);
  return `https://www.foodpanda.com.tw/?query=${encodedName}&lat=${lat}&lng=${lng}`;
}

async function main() {
  console.log('Fetching Fried Chicken Master locations...\n');
  
  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, lat, lng, address, foodpanda_url')
    .or('name.ilike.%炸鷄%,name.ilike.%Fried Chicken Master%')
    .eq('approved', true)
    .is('is_archived', false)
    .order('name');

  if (error) {
    console.error('Database error:', error);
    return;
  }

  console.log(`Found ${locations.length} Fried Chicken Master locations\n`);
  
  // Generate search URLs for locations without foodpanda_url
  const withoutUrl = locations.filter(l => !l.foodpanda_url);
  
  const searchLinks = withoutUrl.map(l => ({
    id: l.id,
    name: l.name,
    address: l.address,
    lat: l.lat,
    lng: l.lng,
    foodpanda_search_url: generateFoodpandaSearchUrl(l.name, l.lat, l.lng),
    manual_search_url: `https://www.foodpanda.com.tw/?query=${encodeURIComponent('炸鷄大獅')}&lat=${l.lat}&lng=${l.lng}`
  }));

  // Save to JSON
  const output = {
    generated_at: new Date().toISOString(),
    total_locations: locations.length,
    without_foodpanda_url: withoutUrl.length,
    locations: searchLinks
  };
  
  const filename = `foodpanda-search-urls-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  
  console.log(`✓ Generated ${searchLinks.length} search URLs`);
  console.log(`✓ Saved to: ${filename}\n`);
  
  // Print first 5 for quick review
  console.log('First 5 locations to check:');
  console.log('='.repeat(80));
  searchLinks.slice(0, 5).forEach((loc, i) => {
    console.log(`\n${i + 1}. ${loc.name}`);
    console.log(`   Address: ${loc.address}`);
    console.log(`   Search URL: ${loc.foodpanda_search_url}`);
    console.log(`   (Try simplified: ${loc.manual_search_url})`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\nNext steps:');
  console.log('1. Open the JSON file to see all URLs');
  console.log('2. Visit each URL in your browser');
  console.log('3. Find the correct restaurant and copy its Foodpanda URL');
  console.log('4. Update your database with the correct URLs');
}

main().catch(console.error);
