-- Add computed column "es_venta" to leads table
ALTER TABLE public.leads ADD COLUMN es_venta boolean GENERATED ALWAYS AS (id_llave IS NOT NULL AND id_llave <> '') STORED;
