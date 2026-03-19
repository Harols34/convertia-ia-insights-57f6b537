
-- Tabla principal de leads/gestiones ingestada desde n8n
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cliente TEXT,
  id_lead TEXT,
  id_llave TEXT,
  campana_inconcert TEXT,
  campana_mkt TEXT,
  categoria_mkt TEXT,
  tipo_llamada TEXT,
  fch_creacion TIMESTAMP WITH TIME ZONE,
  fch_prim_resultado_marcadora TIMESTAMP WITH TIME ZONE,
  prim_resultado_marcadora TEXT,
  fch_prim_gestion TIMESTAMP WITH TIME ZONE,
  agente_prim_gestion TEXT,
  result_prim_gestion TEXT,
  fch_ultim_gestion TIMESTAMP WITH TIME ZONE,
  agente_ultim_gestion TEXT,
  result_ultim_gestion TEXT,
  fch_negocio TIMESTAMP WITH TIME ZONE,
  agente_negocio TEXT,
  result_negocio TEXT,
  ciudad TEXT,
  email TEXT,
  keyword TEXT,
  bpo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX idx_leads_cliente ON public.leads(cliente);
CREATE INDEX idx_leads_id_lead ON public.leads(id_lead);
CREATE INDEX idx_leads_id_llave ON public.leads(id_llave);
CREATE INDEX idx_leads_fch_creacion ON public.leads(fch_creacion);
CREATE INDEX idx_leads_campana_mkt ON public.leads(campana_mkt);
CREATE INDEX idx_leads_bpo ON public.leads(bpo);

-- RLS: usuarios autenticados solo ven leads de su tenant
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View tenant leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant(auth.uid()));

CREATE POLICY "Insert tenant leads"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant(auth.uid()));

-- Permitir insert desde service_role (n8n usará service_role key)
CREATE POLICY "Service role full access"
  ON public.leads FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
