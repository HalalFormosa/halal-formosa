-- Migration: Add daily scan limit trigger for free users
-- Target table: public.ingredient_scan_logs

CREATE OR REPLACE FUNCTION public.check_daily_scan_limit()
RETURNS TRIGGER AS $$
DECLARE
    is_subscribed BOOLEAN;
    scan_count INTEGER;
    bonus_count INTEGER;
    today_utc_date DATE;
BEGIN
    -- 1. Check if user is logged in (authenticated)
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Only count successful scans
    IF NEW.success IS NOT TRUE THEN
        RETURN NEW;
    END IF;

    -- 3. Check if user has an active subscription/entitlement
    SELECT COALESCE(entitlement_active, false)
    INTO is_subscribed
    FROM public.user_subscriptions
    WHERE user_id = NEW.user_id;

    -- If the user is a subscriber (donor), they have unlimited scans
    IF is_subscribed THEN
        RETURN NEW;
    END IF;

    -- 4. Acquire transaction-level advisory lock on the user ID to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

    -- 5. Calculate current UTC date
    today_utc_date := (now() AT TIME ZONE 'UTC')::date;

    -- 6. Count successful scans for the current user today (UTC date)
    SELECT COUNT(*)
    INTO scan_count
    FROM public.ingredient_scan_logs
    WHERE user_id = NEW.user_id
      AND success = true
      AND (created_at AT TIME ZONE 'UTC')::date = today_utc_date;

    -- 7. Retrieve the current day's bonus scans from user_scan_bonus
    SELECT COALESCE(bonus_scans, 0)
    INTO bonus_count
    FROM public.user_scan_bonus
    WHERE user_id = NEW.user_id
      AND last_updated = today_utc_date;

    -- 8. Enforce limit (base limit of 5 + any bonus scans)
    IF scan_count >= (5 + COALESCE(bonus_count, 0)) THEN
        RAISE EXCEPTION 'Daily scan limit reached. Please watch an ad or contribute to earn more scans.'
            USING ERRCODE = 'D0001';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
-- Drop trigger if exists
DROP TRIGGER IF EXISTS before_insert_scan_limit_trigger ON public.ingredient_scan_logs;

-- Create BEFORE INSERT trigger
CREATE TRIGGER before_insert_scan_limit_trigger
    BEFORE INSERT ON public.ingredient_scan_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.check_daily_scan_limit();
