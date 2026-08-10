-- ════════════════════════════════════════════════════════════════════════
-- Cash on Delivery — open to every customer
--
-- Migration 019 required 3 delivered orders before COD was allowed, enforced
-- by a BEFORE INSERT trigger on orders. That restriction is removed: any
-- customer may now place a COD order on their first visit.
--
-- Guard 1 from 019 is KEPT: new orders must still start as status 'pending'.
-- That guard is not about COD — it stops a client using the public anon key
-- from inserting rows that are already 'delivered'. Only the restaurant and
-- rider may move an order forward, via their own UPDATE policies.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_cod_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Orders always start pending (blocks fake 'delivered' inserts)
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'New orders must start with status pending (got %)', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- No COD eligibility check: Cash on Delivery is available to everyone.

  RETURN NEW;
END;
$$;

-- The trigger itself is unchanged; recreated here so this migration is
-- self-contained if it is ever replayed on a fresh database.
DROP TRIGGER IF EXISTS trg_enforce_cod_rules ON public.orders;

CREATE TRIGGER trg_enforce_cod_rules
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cod_rules();
