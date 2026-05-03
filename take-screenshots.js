import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

// Create screenshots directory if it doesn't exist
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function takeScreenshots() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Set viewport to Samsung Galaxy S20 Ultra dimensions
  await page.setViewport({ width: 412, height: 915, isMobile: true });
  
  console.log('Navigating to login page...');
  await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle2' });
  
  // Wait for login form
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('Logging in...');
  // Fill in email
  await page.type('input[type="email"], input[name="email"], input[placeholder*="email"], input[placeholder*="Email"]', 'sherlisoktaviani@gmail.com', { delay: 100 });
  
  // Fill in password
  await page.type('input[type="password"], input[name="password"], input[placeholder*="password"], input[placeholder*="Password"]', 'Rakha0224.', { delay: 100 });
  
  console.log('Credentials filled. Please press the Login button in the browser window...');
  console.log('Waiting for login to complete (waiting for URL change)...');
  
  // Wait for URL to change from /login to something else
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 60000 });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('Login successful, starting simulated store journey...');
  
  // Wait a bit for any animations to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 1: Navigate to store
  console.log('Step 1: Navigating to store...');
  await page.goto('http://localhost:5174/store', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-store-home.png'), fullPage: true });
  console.log('Screenshot saved: 01-store-home.png');
  
  // Step 2: Navigate to Halal Formosa Store (merchant page)
  console.log('Step 2: Navigating to Halal Formosa Store merchant page...');
  await page.goto('http://localhost:5174/store/merchant/5e92a788-59f7-4b5c-88d2-c39bf6eaff8a', { waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-vendor-halal-formosa.png'), fullPage: true });
  console.log('Screenshot saved: 02-vendor-halal-formosa.png');
  
  // Step 3: Click on a product
  console.log('Step 3: Clicking on a product...');
  console.log('Please click on a product in the browser window...');
  await page.waitForFunction(() => window.location.pathname.includes('/store/product'), { timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-product-detail.png'), fullPage: true });
  console.log('Screenshot saved: 03-product-detail.png');
  
  // Step 4: Add to cart and proceed to checkout
  console.log('Step 4: Adding to cart and proceeding to checkout...');
  console.log('Please add the product to cart and click checkout...');
  await page.waitForFunction(() => window.location.pathname.includes('/store/checkout'), { timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-checkout.png'), fullPage: true });
  console.log('Screenshot saved: 04-checkout.png');
  
  // Step 5: Complete checkout
  console.log('Step 5: Completing checkout...');
  console.log('Please complete the checkout process...');
  await page.waitForFunction(() => 
    window.location.pathname.includes('/store/order-success') || 
    window.location.pathname.includes('/store/payment-result') ||
    window.location.pathname.includes('/store/my-orders'), 
    { timeout: 60000 }
  );
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-order-result.png'), fullPage: true });
  console.log('Screenshot saved: 05-order-result.png');
  
  console.log('Simulated store journey completed!');
  
  await browser.close();
  console.log('Screenshots saved to:', SCREENSHOTS_DIR);
}

takeScreenshots().catch(console.error);
