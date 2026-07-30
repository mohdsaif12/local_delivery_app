-- ════════════════════════════════════════════════════════════════════════
-- Cash on Delivery — server-side enforcement (cannot be bypassed by the client)
--
-- The customer app inserts orders directly with the public anon key, so any
-- rule enforced only in JavaScript can be bypassed via the browser console.
-- This trigger enforces the COD rule inside Postgres, on every INSERT,
-- regardless of who sends it.
--
-- Two guards:
--   1. New orders MUST start as status 'pending'. This stops a client from
--      inserting fake 'delivered' rows to game the COD unlock. (Legit orders
--      are always created as 'pending' at checkout; only the restaurant/rider
--      can move an order to 'delivered' via their own UPDATE policies.)
--   2. A Cash-on-Delivery order (delivery_address->>'payment' = 'cod') is only
--      allowed once the customer has at least 3 DELIVERED orders.
--
-- The UI still shows the locked/unlocked COD card for good UX — this trigger
-- is the actual security layer behind it.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_cod_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delivered_count INT;
  min_orders CONSTANT INT := 3;
BEGIN
  -- Guard 1: orders always start pending (blocks fake 'delivered' inserts)
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'New orders must start with status pending (got %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Guard 2: COD requires >= 3 delivered orders for this customer
  IF (NEW.delivery_address->>'payment') = 'cod' THEN
    SELECT COUNT(*) INTO delivered_count
    FROM public.orders
    WHERE customer_id = NEW.customer_id
      AND status = 'delivered';

    IF delivered_count < min_orders THEN
      RAISE EXCEPTION
        'Cash on Delivery requires at least % delivered orders (customer has %)',
        min_orders, delivered_count
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cod_rules ON public.orders;

CREATE TRIGGER trg_enforce_cod_rules
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cod_rules();
