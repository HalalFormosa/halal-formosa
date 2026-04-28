/**
 * Test scraper on all Fried Chicken Master branches
 * Fetches locations matching "炸鷄" or "Fried Chicken Master" from database
 * and scrapes Foodpanda for each one
 */

import { createClient } from '@supabase/supabase-js';
import { scrapeFoodpandaSearch, findBestMatch } from './scrape-foodpanda.js';
import fs from 'fs';
import { config } from 'dotenv';

// Load .env file
config();

// Supabase config - use VITE_ prefixed vars from .env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://svmlwnzmheiishkdwafk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || 'your-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getFriedChickenMasterLocations() {
  console.log('Fetching Fried Chicken Master locations from database...\n');
  
  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, lat, lng, address, foodpanda_url')
    .or('name.ilike.%炸鷄%,name.ilike.%Fried Chicken Master%')
    .eq('approved', true)
    .is('is_archived', false)
    .order('name')
    .limit(2);

  if (error) {
    console.error('Database error:', error);
    return [];
  }

  console.log(`Found ${locations.length} Fried Chicken Master locations\n`);
  
  // Separate into with/without foodpanda_url
  const withUrl = locations.filter(l => l.foodpanda_url);
  const withoutUrl = locations.filter(l => !l.foodpanda_url);
  
  console.log(`- With Foodpanda URL: ${withUrl.length}`);
  console.log(`- Without Foodpanda URL: ${withoutUrl.length}\n`);
  
  return { all: locations, withUrl, withoutUrl };
}

async function scrapeLocation(location) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${location.name}`);
  console.log(`Address: ${location.address || 'N/A'}`);
  console.log(`Coords: ${location.lat}, ${location.lng}`);
  
  if (location.foodpanda_url) {
    console.log(`\n✓ Already has Foodpanda URL:`);
    console.log(`  ${location.foodpanda_url}`);
    return { location, skipped: true, reason: 'Already has URL' };
  }
  
  const results = await scrapeFoodpandaSearch(
    location.name,
    location.lat,
    location.lng
  );
  
  if (results.length === 0) {
    console.log('\n✗ No results found on Foodpanda');
    return { location, success: false, reason: 'No results' };
  }
  
  console.log(`\n✓ Found ${results.length} result(s):`);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}`);
    console.log(`     URL: ${r.url}`);
  });
  
  const bestMatch = findBestMatch(results, location.name);
  
  if (bestMatch) {
    console.log(`\n→ Best match: ${bestMatch.name}`);
    console.log(`→ URL: ${bestMatch.url}`);
    
    return {
      location,
      success: true,
      match: bestMatch,
      allResults: results
    };
  }
  
  return { location, success: false, reason: 'No good match', allResults: results };
}

async function main() {
  const { withUrl, withoutUrl } = await getFriedChickenMasterLocations();
  
  if (withoutUrl.length === 0) {
    console.log('No locations without Foodpanda URL to scrape!');
    return;
  }
  
  console.log(`\nWill scrape ${withoutUrl.length} locations...\n`);
  
  const results = {
    success: [],
    failed: [],
    skipped: []
  };
  
  // Process each location
  for (let i = 0; i < withoutUrl.length; i++) {
    const location = withoutUrl[i];
    console.log(`\n[${i + 1}/${withoutUrl.length}]`);
    
    const result = await scrapeLocation(location);
    
    if (result.skipped) {
      results.skipped.push(result);
    } else if (result.success) {
      results.success.push(result);
    } else {
      results.failed.push(result);
    }
    
    // Rate limiting - wait between requests
    if (i < withoutUrl.length - 1) {
      console.log('\nWaiting 3 seconds before next request...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total processed: ${withoutUrl.length}`);
  console.log(`Success: ${results.success.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  
  if (results.success.length > 0) {
    console.log(`\n✓ Successfully found matches for:`);
    results.success.forEach(r => {
      console.log(`  - ${r.location.name}`);
      console.log(`    ${r.match.url}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log(`\n✗ Failed to find matches for:`);
    results.failed.forEach(r => {
      console.log(`  - ${r.location.name} (${r.reason})`);
    });
  }
  
  // Optional: Save results to file for review
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      total: withoutUrl.length,
      success: results.success.length,
      failed: results.failed.length
    },
    successfulMatches: results.success.map(r => ({
      id: r.location.id,
      name: r.location.name,
      address: r.location.address,
      foodpandaUrl: r.match.url,
      confidence: r.match.name.toLowerCase().includes(r.location.name.toLowerCase()) ? 'high' : 'medium'
    })),
    failed: results.failed.map(r => ({
      id: r.location.id,
      name: r.location.name,
      reason: r.reason
    }))
  };
  
  const filename = `foodpanda-scrape-results-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to: ${filename}`);
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
