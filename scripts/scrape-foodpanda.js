import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load .env file
config();

// Supabase config - use VITE_ prefixed vars from .env or fallback
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://svmlwnzmheiishkdwafk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2bWx3bnptaGVpaXNoa2R3YWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDk3OTUsImV4cCI6MjA2ODkyNTc5NX0.DQ5Xuq0F2x_5EJAMzUQreAWY9ecyTCd3mORl-Fo0Ydo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Scrape Foodpanda search results for a restaurant
 * @param {string} name - Restaurant name to search
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Array>} - Array of restaurant results
 */
async function scrapeFoodpandaSearch(name, lat, lng) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Construct search URL
    const encodedName = encodeURIComponent(name);
    const searchUrl = `https://www.foodpanda.com.tw/?query=${encodedName}&lat=${lat}&lng=${lng}`;
    
    console.log(`Searching: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for page to fully load and any dynamic content
    await new Promise(r => setTimeout(r, 5000));
    
    // Try to scroll to load more results (lazy loading)
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Extract restaurant data - try multiple selectors
    const restaurants = await page.evaluate(() => {
      const results = [];
      
      // Try multiple selectors for restaurant cards
      const selectors = [
        '[data-testid="vendor-card"]',
        '.vendor-card',
        '[class*="vendor-list"] > div',
        '[class*="restaurant"]',
        'a[href*="/restaurant/"]'
      ];
      
      let cards = [];
      for (const selector of selectors) {
        cards = document.querySelectorAll(selector);
        if (cards.length > 0) break;
      }
      
      cards.forEach(card => {
        // Try to extract name from various elements
        const nameEl = card.querySelector('h3, h2, [class*="name"], [data-testid*="name"]') || card;
        
        // Try to extract link
        const linkEl = card.tagName === 'A' ? card : card.querySelector('a[href*="/restaurant/"]');
        
        // Get text content, avoiding nested elements
        const name = nameEl.childNodes[0]?.textContent?.trim() || 
                    nameEl.textContent?.trim() || 
                    'Unknown';
        
        if (linkEl) {
          const fullUrl = linkEl.href.startsWith('http') 
            ? linkEl.href 
            : `https://www.foodpanda.com.tw${linkEl.href}`;
            
          results.push({
            name: name,
            url: fullUrl,
            restaurantId: fullUrl.match(/\/restaurant\/([^/]+)/)?.[1] || null
          });
        }
      });
      
      return results;
    });
    
    console.log(`  Found ${restaurants.length} restaurant(s)`);
    
    return restaurants;
    
  } catch (error) {
    console.error('Scraping error:', error);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * Find best matching restaurant from search results
 * @param {Array} results - Search results
 * @param {string} targetName - Original restaurant name
 * @returns {Object|null} - Best match or null
 */
function findBestMatch(results, targetName) {
  if (!results.length) return null;
  
  const targetLower = targetName.toLowerCase();
  
  // Simple matching - can be improved with fuzzy matching
  return results.find(r => 
    r.name.toLowerCase().includes(targetLower) || 
    targetLower.includes(r.name.toLowerCase())
  ) || results[0]; // Return first result if no exact match
}

/**
 * Main function: Process all locations without foodpanda_url
 */
async function main() {
  // Fetch locations without foodpanda_url
  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, lat, lng, address')
    .is('foodpanda_url', null)
    .eq('approved', true)
    .is('is_archived', false)
    .limit(10); // Process in batches

  if (error) {
    console.error('Database error:', error);
    return;
  }

  console.log(`Found ${locations.length} locations without Foodpanda URL`);

  for (const location of locations) {
    console.log(`\n--- Processing: ${location.name} ---`);
    
    const results = await scrapeFoodpandaSearch(
      location.name,
      location.lat,
      location.lng
    );
    
    if (results.length > 0) {
      console.log(`Found ${results.length} results:`);
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name}`);
        console.log(`     URL: ${r.url}`);
      });
      
      // Find best match
      const bestMatch = findBestMatch(results, location.name);
      
      if (bestMatch) {
        console.log(`\n✓ Best match: ${bestMatch.name}`);
        
        // Uncomment to auto-update database
        // await supabase
        //   .from('locations')
        //   .update({ foodpanda_url: bestMatch.url })
        //   .eq('id', location.id);
        // console.log('✓ Updated database');
      }
    } else {
      console.log('No results found');
    }
    
    // Rate limiting - be nice to Foodpanda
    await new Promise(r => setTimeout(r, 2000));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { scrapeFoodpandaSearch, findBestMatch };
