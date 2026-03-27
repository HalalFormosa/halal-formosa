-- ==========================================
-- Halal Formosa Store — Seed Data
-- ==========================================
-- ⚠️ Replace YOUR_ADMIN_UUID below with your actual admin user UUID
-- You can find it via: SELECT id FROM auth.users LIMIT 1;

-- 1. Categories
INSERT INTO store_product_categories (name, name_zh, emoji, sort_order) VALUES
  ('Food', '食品', '🍱', 1),
  ('Beverages', '飲料', '🧃', 2),
  ('Snacks', '零食', '🍿', 3),
  ('Spices & Sauces', '香料與醬料', '🌶️', 4),
  ('Health & Beauty', '健康美容', '💄', 5),
  ('Gifts & Hampers', '禮品組合', '🎁', 6),
  ('Others', '其他', '📦', 7)
ON CONFLICT DO NOTHING;

-- 2. Promo Banners
INSERT INTO store_promo_banners (title, title_zh, subtitle, image_url, link_type, link_value, is_active, sort_order) VALUES
  ('Ramadan Special 🌙', '齋戒月特惠 🌙', 'Up to 30% off selected items', 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800&h=300&fit=crop', 'category', '1', true, 1),
  ('New Arrivals ✨', '新品上架 ✨', 'Check out the latest halal products', 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800&h=300&fit=crop', 'category', '3', true, 2);

-- 3. Sample Products (replace YOUR_ADMIN_UUID)
DO $$
DECLARE
  admin_id UUID;
BEGIN
  -- Auto-detect admin: pick the first user with admin role
  SELECT user_id INTO admin_id FROM user_roles WHERE role = 'admin' LIMIT 1;

  -- Fallback: use the first user if no admin found
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id FROM auth.users LIMIT 1;
  END IF;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'No users found. Please create a user first.';
    RETURN;
  END IF;

  -- Food
  INSERT INTO store_products (user_id, category_id, name, name_zh, description, description_zh, price, stock_quantity, is_active, is_featured, images, sale_count, view_count, tags) VALUES
  (admin_id, 1, 'Halal Beef Rendang', '清真牛肉仁當', 'Authentic Indonesian-style beef rendang, slow-cooked with halal beef and rich coconut spices. Ready to heat and serve.', '道地印尼風味牛肉仁當，使用清真牛肉與濃郁椰子香料慢燉，加熱即食。', 320, 50, true, true,
   ARRAY['https://images.unsplash.com/photo-1545247181-516773cae754?w=400&h=400&fit=crop'], 128, 890, ARRAY['halal', 'beef', 'rendang', 'indonesian']),

  (admin_id, 1, 'Halal Chicken Biryani Mix', '清真雞肉比爾亞尼香料包', 'Complete biryani spice mix with basmati rice seasoning. Just add chicken and cook!', '完整比爾亞尼香料包附印度香米調味，只需加入雞肉即可烹煮！', 180, 75, true, false,
   ARRAY['https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=400&fit=crop'], 67, 450, ARRAY['halal', 'chicken', 'biryani', 'indian']),

  (admin_id, 1, 'Halal Lamb Sausages (6 pcs)', '清真羊肉香腸 (6入)', 'Premium halal lamb sausages made in Taiwan. No pork, no alcohol.', '台灣製造的優質清真羊肉香腸，不含豬肉與酒精。', 280, 30, true, false,
   ARRAY['https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop'], 42, 310, ARRAY['halal', 'lamb', 'sausage']),

  -- Beverages
  (admin_id, 2, 'Turkish Apple Tea (15 sachets)', '土耳其蘋果茶 (15包)', 'Imported Turkish apple tea sachets. Sweet and fragrant, perfect for any time of day.', '進口土耳其蘋果茶包，香甜芬芳，隨時享用。', 150, 100, true, true,
   ARRAY['https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop'], 203, 1200, ARRAY['tea', 'turkish', 'apple', 'drink']),

  (admin_id, 2, 'Date Milk Drink (250ml × 6)', '椰棗牛奶飲品 (250ml × 6)', 'Creamy date-flavored milk drink. Halal certified, made in Malaysia.', '奶香椰棗風味飲品，馬來西亞清真認證。', 220, 40, true, false,
   ARRAY['https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop'], 89, 560, ARRAY['date', 'milk', 'drink', 'malaysia']),

  -- Snacks
  (admin_id, 3, 'Halal Dried Mango Slices', '清真芒果乾片', 'No added sugar, naturally sweet dried mango slices. Halal certified from Thailand.', '無添加糖，天然甜味芒果乾片，泰國清真認證。', 120, 200, true, false,
   ARRAY['https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=400&h=400&fit=crop'], 156, 980, ARRAY['snack', 'mango', 'dried', 'thailand']),

  (admin_id, 3, 'Halal Honey Roasted Almonds', '清真蜂蜜烤杏仁', '200g pack of crunchy honey-roasted almonds. Perfect Ramadan snack!', '200g 香脆蜂蜜烤杏仁，齋戒月完美零嘴！', 190, 80, true, true,
   ARRAY['https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400&h=400&fit=crop'], 95, 720, ARRAY['snack', 'almond', 'honey', 'nuts']),

  -- Spices & Sauces
  (admin_id, 4, 'Sambal Oelek (Halal)', '清真參巴辣椒醬', 'Authentic Indonesian chili paste. Halal certified, 250ml jar.', '道地印尼辣椒醬，清真認證，250ml 玻璃罐。', 95, 120, true, false,
   ARRAY['https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop'], 178, 830, ARRAY['sauce', 'sambal', 'chili', 'indonesian']),

  (admin_id, 4, 'Halal Curry Powder (200g)', '清真咖哩粉 (200g)', 'Premium blend curry powder, perfect for chicken or lamb curry. No animal-derived ingredients.', '優質混合咖哩粉，適合雞肉或羊肉咖哩，不含動物性成分。', 85, 90, true, false,
   ARRAY['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop'], 112, 650, ARRAY['spice', 'curry', 'powder']),

  -- Health & Beauty
  (admin_id, 5, 'Miswak Natural Toothbrush (5 pcs)', '天然牙刷木 (5入)', 'Traditional miswak sticks for natural dental care. Sunnah-compliant oral hygiene.', '傳統天然牙刷木，符合伊斯蘭傳統的口腔保健方式。', 160, 60, true, false,
   ARRAY['https://images.unsplash.com/photo-1559591937-2a9b5e7b0e8e?w=400&h=400&fit=crop'], 34, 280, ARRAY['health', 'miswak', 'dental']),

  -- Gifts
  (admin_id, 6, 'Ramadan Gift Box (Premium)', '齋戒月禮盒 (精裝版)', 'Curated halal gift box with dates, tea, honey, and snacks. Perfect for Eid gifts!', '精選清真禮盒含椰棗、茶葉、蜂蜜與零食，送禮最佳選擇！', 880, 15, true, true,
   ARRAY['https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=400&h=400&fit=crop'], 23, 410, ARRAY['gift', 'ramadan', 'eid', 'hamper']);

  RAISE NOTICE 'Seed complete! Inserted 11 products for admin user %', admin_id;
END $$;
