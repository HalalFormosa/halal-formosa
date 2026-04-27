import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const googleMapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;

if (!supabaseUrl || !supabaseKey || !googleMapsApiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File to store Chinese semantic matches for manual review
const CHINESE_MATCHES_FILE = path.join(__dirname, 'chinese-matches-for-review.md');

// Initialize the matches file
function initializeMatchesFile() {
  const header = `# Chinese Semantic Matches for Manual Review\n\n`;
  const timestamp = `Generated: ${new Date().toISOString()}\n\n`;
  const instructions = `## Instructions\n`;
  const instructionsText = `This file contains location matches that were found using semantic similarity (Chinese/English keyword matching).\n`;
  const instructionsText2 = `Please review each match and confirm if it's correct before processing.\n\n`;
  const instructionsText3 = `Format: [Location ID] Database Name → Google Places Name (similarity%, distance)\n\n`;
  const separator = `---\n\n`;
  
  fs.writeFileSync(CHINESE_MATCHES_FILE, header + timestamp + instructions + instructionsText + instructionsText2 + instructionsText3 + separator);
}

// Append a match to the file
function appendMatchToFile(location, googlePlace, nameSimilarity, distance, semanticSimilarity) {
  const entry = `## Location ID: ${location.id}\n\n`;
  const dbName = `**Database Name:** ${location.name}\n`;
  const dbCoords = `**Coordinates:** ${location.lat}, ${location.lng}\n`;
  const googleName = `**Google Places Name:** ${googlePlace.name}\n`;
  const googleId = `**Place ID:** ${googlePlace.place_id}\n`;
  const similarity = `**Similarity:** ${nameSimilarity.toFixed(2)} (semantic: ${semanticSimilarity.toFixed(2)})\n`;
  const dist = `**Distance:** ${distance.toFixed(1)}m\n`;
  const googleMapsLink = `**Google Maps:** https://www.google.com/maps/place/?q=place_id:${googlePlace.place_id}\n`;
  const status = `**Status:** pending (change to "approved" or "rejected")\n\n`;
  const separator = `---\n\n`;
  
  fs.appendFileSync(CHINESE_MATCHES_FILE, entry + dbName + dbCoords + googleName + googleId + similarity + dist + googleMapsLink + status + separator);
}

// Taiwan bounds
const TAIWAN_BOUNDS = {
  minLat: 21.9,
  maxLat: 25.3,
  minLng: 119.3,
  maxLng: 122.0
};

// Matching thresholds
const NAME_SIMILARITY_THRESHOLD = 0.8;
const DISTANCE_THRESHOLD_METERS = 50;

// Batch processing
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 2000;

// Calculate Haversine distance between two coordinates (in meters)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate Levenshtein distance
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// Calculate string similarity using Levenshtein distance
function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

// Check if location is within Taiwan bounds
function isInTaiwan(lat, lng) {
  return lat >= TAIWAN_BOUNDS.minLat && lat <= TAIWAN_BOUNDS.maxLat &&
         lng >= TAIWAN_BOUNDS.minLng && lng <= TAIWAN_BOUNDS.maxLng;
}

// Sleep function for batch delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if string contains Chinese characters
function containsChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

// Extract keywords from name (for Chinese/English cross-matching)
function extractKeywords(name) {
  const keywords = [];
  
  // Common food terms mapping
  const foodTerms = {
    'sweet potato': '地瓜',
    'potato': '土豆',
    'ball': '球',
    'noodle': '麵',
    'rice': '飯',
    'chicken': '雞',
    'beef': '牛',
    'indian': '印度',
    'thai': '泰式',
    'halal': '清真',
    'mosque': '清真寺',
    'restaurant': '餐廳',
    'shop': '店',
    'store': '店'
  };
  
  const lowerName = name.toLowerCase();
  
  // Check for Chinese food terms
  if (containsChinese(name)) {
    if (name.includes('地瓜')) keywords.push('sweet potato');
    if (name.includes('球')) keywords.push('ball');
    if (name.includes('麵')) keywords.push('noodle');
    if (name.includes('飯')) keywords.push('rice');
    if (name.includes('雞')) keywords.push('chicken');
    if (name.includes('牛')) keywords.push('beef');
    if (name.includes('印度')) keywords.push('indian');
    if (name.includes('泰式')) keywords.push('thai');
    if (name.includes('清真')) keywords.push('halal');
    if (name.includes('清真寺')) keywords.push('mosque');
    if (name.includes('餐廳')) keywords.push('restaurant');
    if (name.includes('店')) keywords.push('shop');
  }
  
  // Check for English food terms
  for (const [english] of Object.entries(foodTerms)) {
    if (lowerName.includes(english)) {
      keywords.push(english);
    }
  }
  
  return keywords;
}

// Calculate semantic similarity for Chinese/English cross-matching
function calculateSemanticSimilarity(name1, name2) {
  const keywords1 = extractKeywords(name1);
  const keywords2 = extractKeywords(name2);
  
  if (keywords1.length === 0 && keywords2.length === 0) {
    return 0;
  }
  
  // Count matching keywords
  let matches = 0;
  for (const kw1 of keywords1) {
    for (const kw2 of keywords2) {
      if (kw1 === kw2) {
        matches++;
        break;
      }
    }
  }
  
  const totalKeywords = Math.max(keywords1.length, keywords2.length);
  return totalKeywords === 0 ? 0 : matches / totalKeywords;
}

// Convert Google Places price_level to NTD price range
function convertPriceLevelToRange(priceLevel) {
  if (priceLevel === undefined || priceLevel === null) {
    return null;
  }
  
  const priceRanges = {
    0: 'Free',
    1: '100-300 NTD',
    2: '300-600 NTD',
    3: '600-1000 NTD',
    4: '1000+ NTD'
  };
  
  return priceRanges[priceLevel] || null;
}

// Fetch locations with missing phone, opening_hours, or price_range
async function fetchLocationsNeedingData() {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, lat, lng, phone, opening_hours, price_range')
    .or('phone.is.null,opening_hours.is.null,price_range.is.null');

  if (error) {
    console.error('Error fetching locations:', error);
    return [];
  }

  // Filter by Taiwan bounds
  const taiwanLocations = data.filter(loc => 
    loc.lat && loc.lng && isInTaiwan(loc.lat, loc.lng)
  );

  console.log(`Found ${taiwanLocations.length} locations in Taiwan with missing data`);
  return taiwanLocations;
}

// Search Google Places for a location using REST API
async function searchGooglePlaces(name, lat, lng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=100&keyword=${encodeURIComponent(name)}&key=${googleMapsApiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error(`Google Places API error for "${name}": ${data.status}`);
      return [];
    }

    return data.results;
  } catch (error) {
    console.error(`Google Places API error for "${name}":`, error.message);
    return [];
  }
}

// Get detailed place information using Place Details API
async function getPlaceDetails(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,opening_hours,price_level&key=${googleMapsApiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error(`Google Place Details API error for place_id ${placeId}: ${data.status}`);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error(`Google Place Details API error:`, error.message);
    return null;
  }
}

// Find best matching place from Google results
function findBestMatch(locationName, locationLat, locationLng, googleResults) {
  let bestMatch = null;
  let bestScore = 0;
  const DISTANCE_THRESHOLD_WITH_SEMANTIC = 150; // More lenient for semantic matches

  for (const result of googleResults) {
    const googleName = result.name;
    const googleLat = result.geometry.location.lat;
    const googleLng = result.geometry.location.lng;

    // Calculate name similarity
    const nameSimilarity = calculateSimilarity(
      locationName.toLowerCase(),
      googleName.toLowerCase()
    );

    // Calculate semantic similarity for Chinese/English cross-matching
    const semanticSimilarity = calculateSemanticSimilarity(locationName, googleName);

    // Use the higher of the two similarities
    const effectiveSimilarity = Math.max(nameSimilarity, semanticSimilarity);

    // Calculate distance
    const distance = haversineDistance(locationLat, locationLng, googleLat, googleLng);

    // Adjust threshold based on semantic similarity
    const hasSemanticMatch = semanticSimilarity > 0.5;
    const distanceThreshold = hasSemanticMatch ? DISTANCE_THRESHOLD_WITH_SEMANTIC : DISTANCE_THRESHOLD_METERS;
    const similarityThreshold = hasSemanticMatch ? 0.5 : NAME_SIMILARITY_THRESHOLD;

    // Only consider if within distance threshold
    if (distance <= distanceThreshold) {
      // Combined score: weight name similarity more heavily
      const score = (effectiveSimilarity * 0.7) + ((1 - distance / distanceThreshold) * 0.3);

      if (score > bestScore && effectiveSimilarity >= similarityThreshold) {
        bestScore = score;
        bestMatch = {
          place: result,
          nameSimilarity: effectiveSimilarity,
          distance
        };
      }
    }
  }

  return bestMatch;
}

// Update location with Google Places data
async function updateLocation(locationId, phone, openingHours, priceRange) {
  const updateData = {};
  
  if (phone) {
    updateData.phone = phone;
  }
  
  if (openingHours) {
    updateData.opening_hours = openingHours;
  }

  if (priceRange !== undefined && priceRange !== null) {
    updateData.price_range = priceRange;
  }

  const { error } = await supabase
    .from('locations')
    .update(updateData)
    .eq('id', locationId);

  if (error) {
    console.error(`Error updating location ${locationId}:`, error);
    return false;
  }

  return true;
}

// Main execution function
async function main() {
  console.log('Starting Google Places data fetch...');
  console.log(`Batch size: ${BATCH_SIZE}, Delay: ${BATCH_DELAY_MS}ms`);
  console.log(`Name similarity threshold: ${NAME_SIMILARITY_THRESHOLD * 100}%`);
  console.log(`Distance threshold: ${DISTANCE_THRESHOLD_METERS}m\n`);

  // Initialize the matches file
  initializeMatchesFile();

  // Fetch locations needing data
  const locations = await fetchLocationsNeedingData();
  
  if (locations.length === 0) {
    console.log('No locations to process');
    return;
  }

  // Statistics
  let processed = 0;
  let updated = 0;
  let noMatch = 0;
  let errors = 0;
  let manualReview = 0;

  // Process in batches
  for (let i = 0; i < locations.length; i += BATCH_SIZE) {
    const batch = locations.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(locations.length / BATCH_SIZE)} (${batch.length} locations)`);

    for (const location of batch) {
      processed++;
      
      // Skip if both phone and opening_hours already exist
      if (location.phone && location.opening_hours) {
        console.log(`[${processed}/${locations.length}] Skipping ${location.name} - already has data`);
        continue;
      }

      console.log(`[${processed}/${locations.length}] Processing: ${location.name} (${location.lat}, ${location.lng})`);

      try {
        // Search Google Places
        const googleResults = await searchGooglePlaces(location.name, location.lat, location.lng);

        if (googleResults.length === 0) {
          console.log(`  → No Google Places results found`);
          noMatch++;
          continue;
        }

        // Find best match
        const bestMatch = findBestMatch(location.name, location.lat, location.lng, googleResults);

        if (!bestMatch) {
          console.log(`  → No matching result found (within 50m and 80% name similarity)`);
          console.log(`  → Potential matches in the area (for manual review):`);
          
          for (const result of googleResults) {
            const googleName = result.name;
            const googleLat = result.geometry.location.lat;
            const googleLng = result.geometry.location.lng;
            
            const nameSimilarity = calculateSimilarity(
              location.name.toLowerCase(),
              googleName.toLowerCase()
            );
            
            const semanticSimilarity = calculateSemanticSimilarity(location.name, googleName);
            
            const distance = haversineDistance(location.lat, location.lng, googleLat, googleLng);
            
            console.log(`    - "${googleName}" (${(nameSimilarity * 100).toFixed(1)}% similarity, ${(semanticSimilarity * 100).toFixed(1)}% semantic, ${distance.toFixed(1)}m)`);
          }
          
          noMatch++;
          continue;
        }

        // Check if this is a semantic match (Chinese/English cross-match)
        const semanticSimilarity = calculateSemanticSimilarity(location.name, bestMatch.place.name);
        const isSemanticMatch = semanticSimilarity > 0.5;

        if (isSemanticMatch) {
          console.log(`  → Semantic match found (Chinese/English cross-match) - saving to review file`);
          appendMatchToFile(location, bestMatch.place, bestMatch.nameSimilarity, bestMatch.distance, semanticSimilarity);
          manualReview++;
          continue;
        }

        console.log(`  → Match found: "${bestMatch.place.name}" (${bestMatch.nameSimilarity.toFixed(2)} similarity, ${bestMatch.distance.toFixed(1)}m)`);

        // Get detailed place information using Place Details API
        const placeDetails = await getPlaceDetails(bestMatch.place.place_id);

        if (!placeDetails) {
          console.log(`  → Failed to get place details`);
          errors++;
          continue;
        }

        // Extract data
        const phone = placeDetails.formatted_phone_number || null;
        const openingHours = placeDetails.opening_hours ? {
          periods: placeDetails.opening_hours.periods,
          weekday_text: placeDetails.opening_hours.weekday_text
        } : null;
        const priceRange = convertPriceLevelToRange(placeDetails.price_level);

        // Determine what to update
        const updates = [];
        if (phone && !location.phone) updates.push('phone');
        if (openingHours && !location.opening_hours) updates.push('opening_hours');
        if (priceRange && location.price_range === null) updates.push('price_range');

        if (updates.length === 0) {
          console.log(`  → No new data to update`);
          noMatch++;
          continue;
        }

        // Update database
        const success = await updateLocation(location.id, phone, openingHours, priceRange);

        if (success) {
          console.log(`  → Updated: ${updates.join(', ')}`);
          updated++;
        } else {
          errors++;
        }

      } catch (error) {
        console.error(`  → Error processing location:`, error.message);
        errors++;
      }

      // Small delay between individual requests to be safe
      await sleep(100);
    }

    // Delay between batches
    if (i + BATCH_SIZE < locations.length) {
      console.log(`\nWaiting ${BATCH_DELAY_MS}ms before next batch...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Print summary
  console.log('\n==================================================');
  console.log('SUMMARY');
  console.log('==================================================');
  console.log(`Total locations processed: ${processed}`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`No match found: ${noMatch}`);
  console.log(`Chinese semantic matches for review: ${manualReview}`);
  console.log(`Errors: ${errors}`);
  console.log('==================================================');
  
  if (manualReview > 0) {
    console.log(`\nChinese semantic matches saved to: ${CHINESE_MATCHES_FILE}`);
    console.log('Please review the matches and confirm before processing.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
