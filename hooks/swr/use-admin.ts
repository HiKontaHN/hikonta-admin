// hooks/swr/use-admin.ts
"use client";

import useSWR from "swr";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

// A diferencia de la versión original en yelifin-sistema (que llama
// `firebaseUser?.getIdToken()` en cada request), acá se reutiliza el
// `token` ya cacheado por useAuth() — mismo patrón que hikonta-partners.
// Esto también hace que el modo bypass funcione (no hay firebaseUser real
// en bypass, pero sí un `token` fijo que el servidor ignora).
function useAuthFetch() {
  const { token } = useAuth();
  return async (url: string, options: RequestInit = {}) => {
    if (!token) throw new Error("No autenticado");
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error en la solicitud");
    }
    return res.json();
  };
}

// ── Types ─────────────────────────────────────────────────────────────

export type AdminUserRow = {
  id: number;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  business_name: string | null;
  business_logo_url: string | null;
  currency: string | null;
  // Rol dentro de su organización — puede ser el dueño o un miembro de
  // equipo (cajero, bodeguero, etc., agregado desde /settings/members en
  // yelifin-sistema). `null` si el usuario no pertenece a ninguna org.
  role_name: string | null;
  is_owner: boolean | null;
  subscription_id: number | null;
  subscription_status: string | null;
  trial_end_date: string | null;
  current_period_end: string | null;
  plan_id: number | null;
  plan_name: string | null;
  plan_slug: string | null;
  price_usd: number | null;
  last_sign_in_time: string | null;
  last_refresh_time: string | null;
};

export type AdminUserDetail = AdminUserRow & {
  org_id: number | null;
  org_name: string | null;
  role_id: number | null;
  photo_url: string | null;
  timezone: string;
  locale: string;
  onboarding_completed: boolean;
  trial_start_date: string | null;
  current_period_start: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  provider: string | null;
  billing_interval: string | null;
  max_products: number | null;
  max_sales_per_month: number | null;
};

export type AdminTeamMember = {
  user_id: number;
  email: string;
  display_name: string | null;
  user_is_active: boolean;
  role_name: string;
  is_owner: boolean;
  membership_is_active: boolean;
  joined_at: string | null;
};

export type AdminUserActivity = {
  total_sales: number;
  total_products: number;
  total_transactions: number;
};

// Actividad de ESTA persona puntual (created_by), no de toda la org — ver
// AdminUserActivity de arriba para el total de la organización.
export type AdminPersonalActivity = {
  total_sales: number;
  total_sales_amount: number;
  total_products: number;
  total_transactions: number;
};

export type AdminRecentSale = {
  id: number;
  sale_number: string | null;
  total: number;
  sold_at: string;
  status: string;
  payment_method: string | null;
};

export type AdminModulePermission = {
  module: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  show_costs: boolean;
  show_profit: boolean;
};

export type AdminUserStorage = {
  products: number;
  sales: number;
  transactions: number;
  customers: number;
  accounts: number;
  credit_cards: number;
  cc_transactions: number;
  inventory_batches: number;
  inventory_movements: number;
  events: number;
  image_count: number;
};

export type AdminStorageStats = {
  db_size_bytes: number;
  table_sizes: { tablename: string; size_bytes: number }[];
  top_users: { id: number; email: string; display_name: string; total_rows: number }[];
  image_counts: { user_photos: number; logos: number; product_images: number };
};

export type AdminPlan = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_usd: number;
  billing_interval: string | null;
  max_products: number | null;
  max_sales_per_month: number | null;
  max_storage_mb: number | null;
  max_transactions_per_month: number | null;
  max_accounts: number | null;
  max_supplies: number | null;
  is_active: boolean;
  user_count: number;
};

export type PlanFeatureRow = {
  id: number;
  feature_key: string;
  feature_name: string;
  category: string;
  is_enabled: boolean;
};

export type AdminAdminRow = {
  id: number;
  is_active: boolean;
  created_at: string;
  user_id: number;
  email: string;
  display_name: string | null;
};

export type AdminStats = {
  total_users: number;
  active_users: number;
  inactive_users: number;
  new_this_month: number;
  trial_count: number;
  active_count: number;
  cancelled_count: number;
  expired_count: number;
  past_due_count: number;
};

// ── Hooks ─────────────────────────────────────────────────────────────

export function useAdminStats() {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error, mutate } = useSWR(
    token ? "/api/admin/stats" : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );
  return {
    counts: (data?.counts ?? null) as AdminStats | null,
    planStats: (data?.planStats ?? []) as { id: number; name: string; slug: string; user_count: number }[],
    recentUsers: (data?.recentUsers ?? []) as AdminUserRow[],
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export function useAdminUsers(params: { search?: string; status?: string; page?: number } = {}) {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { search = "", status = "all", page = 1 } = params;
  const key = token
    ? `/api/admin/users?search=${encodeURIComponent(search)}&status=${status}&page=${page}`
    : null;

  const { data, isLoading, error, mutate } = useSWR(
    key,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false, dedupingInterval: 15_000 }
  );
  return {
    users: (data?.data ?? []) as AdminUserRow[],
    total: (data?.total ?? 0) as number,
    pages: (data?.pages ?? 1) as number,
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export function useAdminUser(id: number | null) {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error, mutate } = useSWR(
    token && id ? `/api/admin/users/${id}` : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false }
  );
  return {
    user: (data?.user ?? null) as AdminUserDetail | null,
    activity: (data?.activity ?? null) as AdminUserActivity | null,
    storage: (data?.storage ?? null) as AdminUserStorage | null,
    teamMembers: (data?.teamMembers ?? []) as AdminTeamMember[],
    personalActivity: (data?.personalActivity ?? null) as AdminPersonalActivity | null,
    recentSales: (data?.recentSales ?? []) as AdminRecentSale[],
    permissions: (data?.permissions ?? []) as AdminModulePermission[],
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export function useAdminStorage() {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error, mutate } = useSWR(
    token ? "/api/admin/storage" : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  return {
    storage: (data ?? null) as AdminStorageStats | null,
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export function useAdminPlans() {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error, mutate } = useSWR(
    token ? "/api/admin/plans" : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  return {
    plans: (data?.data ?? []) as AdminPlan[],
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export type PlanInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  price_usd?: number;
  billing_interval?: string;
  max_products?: number | null;
  max_sales_per_month?: number | null;
  max_storage_mb?: number | null;
  max_transactions_per_month?: number | null;
  max_accounts?: number | null;
  max_supplies?: number | null;
  is_active?: boolean;
};

export function useAdminPlanFeatures(planId: number | null) {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error, mutate } = useSWR(
    token && planId ? `/api/admin/plans/${planId}/features` : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false }
  );
  return {
    plan: (data?.plan ?? null) as { id: number; name: string; slug: string } | null,
    features: (data?.data ?? []) as PlanFeatureRow[],
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export function useAdminUpdatePlanFeatures(planId: number | null) {
  const authFetch = useAuthFetch();
  const [isSaving, setIsSaving] = useState(false);
  const updateFeatures = async (features: Record<number, boolean>) => {
    if (!planId) throw new Error("ID requerido");
    setIsSaving(true);
    try {
      return await authFetch(`/api/admin/plans/${planId}/features`, {
        method: "PUT",
        body: JSON.stringify({ features }),
      });
    } finally {
      setIsSaving(false);
    }
  };
  return { updateFeatures, isSaving };
}

export function useAdminCreatePlan() {
  const authFetch = useAuthFetch();
  const [isCreating, setIsCreating] = useState(false);
  const createPlan = async (input: PlanInput) => {
    setIsCreating(true);
    try {
      return await authFetch("/api/admin/plans", { method: "POST", body: JSON.stringify(input) });
    } finally {
      setIsCreating(false);
    }
  };
  return { createPlan, isCreating };
}

export function useAdminUpdatePlan() {
  const authFetch = useAuthFetch();
  const [isSaving, setIsSaving] = useState(false);
  const updatePlan = async (id: number, input: PlanInput) => {
    setIsSaving(true);
    try {
      return await authFetch(`/api/admin/plans/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    } finally {
      setIsSaving(false);
    }
  };
  return { updatePlan, isSaving };
}

export function useAdminDeletePlan() {
  const authFetch = useAuthFetch();
  const [isDeleting, setIsDeleting] = useState(false);
  const deletePlan = async (id: number) => {
    setIsDeleting(true);
    try {
      return await authFetch(`/api/admin/plans/${id}`, { method: "DELETE" });
    } finally {
      setIsDeleting(false);
    }
  };
  return { deletePlan, isDeleting };
}

export function useAdminUpdateUser(id: number | null) {
  const authFetch = useAuthFetch();
  const [isSaving, setIsSaving] = useState(false);
  const updateUser = async (payload: Record<string, unknown>) => {
    if (!id) throw new Error("ID requerido");
    setIsSaving(true);
    try {
      return await authFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } finally {
      setIsSaving(false);
    }
  };
  return { updateUser, isSaving };
}

export type CreateUserInput = {
  email: string;
  password: string;
  display_name?: string;
  business_name?: string;
  timezone?: string;
  currency?: string;
  locale?: string;
  plan_id?: number;
  email_verified?: boolean;
};

// ── Administradores (tabla `admins`) ────────────────────────────────────

export function useAdminAdmins() {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error, mutate } = useSWR(
    token ? "/api/admin/admins" : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false, dedupingInterval: 15_000 }
  );
  return {
    admins: (data?.data ?? []) as AdminAdminRow[],
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export function useAdminAddAdmin() {
  const authFetch = useAuthFetch();
  const [isAdding, setIsAdding] = useState(false);
  const addAdmin = async (email: string) => {
    setIsAdding(true);
    try {
      return await authFetch("/api/admin/admins", { method: "POST", body: JSON.stringify({ email }) });
    } finally {
      setIsAdding(false);
    }
  };
  return { addAdmin, isAdding };
}

export function useAdminUpdateAdmin() {
  const authFetch = useAuthFetch();
  const [isSaving, setIsSaving] = useState(false);
  const updateAdmin = async (id: number, is_active: boolean) => {
    setIsSaving(true);
    try {
      return await authFetch(`/api/admin/admins/${id}`, { method: "PATCH", body: JSON.stringify({ is_active }) });
    } finally {
      setIsSaving(false);
    }
  };
  return { updateAdmin, isSaving };
}

export function useAdminRemoveAdmin() {
  const authFetch = useAuthFetch();
  const [isRemoving, setIsRemoving] = useState(false);
  const removeAdmin = async (id: number) => {
    setIsRemoving(true);
    try {
      return await authFetch(`/api/admin/admins/${id}`, { method: "DELETE" });
    } finally {
      setIsRemoving(false);
    }
  };
  return { removeAdmin, isRemoving };
}

export function useAdminCreateUser() {
  const authFetch = useAuthFetch();
  const [isCreating, setIsCreating] = useState(false);
  const createUser = async (input: CreateUserInput) => {
    setIsCreating(true);
    try {
      return await authFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } finally {
      setIsCreating(false);
    }
  };
  return { createUser, isCreating };
}

// ── Organizaciones (búsqueda, para pickers) ─────────────────────────────

export type AdminOrgSearchResult = {
  id: number;
  name: string;
  currency: string;
  owner_email: string;
  owner_display_name: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  plan_name: string | null;
};

export function useAdminOrgSearch(query: string) {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error } = useSWR(
    token ? `/api/admin/organizations?search=${encodeURIComponent(query)}` : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false, dedupingInterval: 10_000 }
  );
  return {
    results: (data?.data ?? []) as AdminOrgSearchResult[],
    isLoading,
    error: (error as any)?.message ?? null,
  };
}

// ── Pagos ─────────────────────────────────────────────────────────────

export type AdminPayment = {
  id: number;
  org_id: number;
  amount_usd: number;
  currency: string;
  status: string;
  provider: string | null;
  months_purchased: number | null;
  covers_period_start: string | null;
  covers_period_end: string | null;
  paid_at: string | null;
  created_at: string;
  receipt_url: string | null;
  paid_by_partner_id: number | null;
  org_name: string | null;
  owner_email: string | null;
  partner_name: string | null;
};

export function useAdminPayments(params: { search?: string; status?: string; page?: number } = {}) {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { search = "", status = "all", page = 1 } = params;
  const key = token
    ? `/api/admin/payments?search=${encodeURIComponent(search)}&status=${status}&page=${page}`
    : null;

  const { data, isLoading, error, mutate } = useSWR(
    key,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false, dedupingInterval: 15_000 }
  );
  return {
    payments: (data?.data ?? []) as AdminPayment[],
    total: (data?.total ?? 0) as number,
    pages: (data?.pages ?? 1) as number,
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export type RegisterPaymentInput = {
  org_id: number;
  amount_usd: number;
  months_purchased: number;
  provider?: "MANUAL" | "STRIPE" | "PAYPAL";
  currency?: string;
  receipt_url?: string;
  // Opcional — solo si un partner vinculado a esta org está patrocinando
  // este pago puntual. NULL/ausente = paga la propia org. No hay estado
  // "esta org está patrocinada" que arrastrar entre pagos: cada uno se
  // marca aparte, así que un pago propio después de que se acabe el
  // patrocinio nunca hereda el partner por accidente.
  paid_by_partner_id?: number;
};

// Partners vinculados a una org — para el selector "Patrocinado por" al
// registrar un pago. Solo puede elegirse uno ya vinculado (ver Partners).
export type AdminOrgPartner = { id: number; name: string };

export function useAdminOrgPartners(orgId: number | null) {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading } = useSWR(
    token && orgId ? `/api/admin/organizations/${orgId}/partners` : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false }
  );
  return {
    orgPartners: (data?.data ?? []) as AdminOrgPartner[],
    isLoading,
  };
}

export function useAdminRegisterPayment() {
  const authFetch = useAuthFetch();
  const [isSaving, setIsSaving] = useState(false);
  const registerPayment = async (input: RegisterPaymentInput) => {
    setIsSaving(true);
    try {
      return await authFetch("/api/admin/payments", { method: "POST", body: JSON.stringify(input) });
    } finally {
      setIsSaving(false);
    }
  };
  return { registerPayment, isSaving };
}

// ── Partners ─────────────────────────────────────────────────────────

export type AdminPartner = {
  id: number;
  name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  user_email: string | null;
  org_count: number;
};

export type AdminPartnerOrgLink = {
  link_id: number;
  org_id: number;
  share_financials: boolean;
  linked_at: string;
  org_name: string;
  currency: string;
  owner_email: string;
  // De subscription_payments donde este partner pagó puntualmente — no un
  // estado guardado en el vínculo. 0 / null si nunca patrocinó un pago
  // (aunque la org sí esté vinculada para monitoreo).
  months_sponsored: number;
  sponsored_until: string | null;
  // true si sponsored_until sigue en el futuro — o sea, el período de
  // suscripción vigente de la org AHORA MISMO lo pagó este partner. Si la
  // org ya renovó por su cuenta después de que el patrocinio venció, esto
  // pasa a false aunque months_sponsored/sponsored_until sigan mostrando
  // el historial de lo que el partner sí pagó en su momento.
  currently_sponsored: boolean;
};

export function useAdminPartners() {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error, mutate } = useSWR(
    token ? "/api/admin/partners" : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false, dedupingInterval: 15_000 }
  );
  return {
    partners: (data?.data ?? []) as AdminPartner[],
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export function useAdminPartner(id: number | null) {
  const { token } = useAuth();
  const authFetch = useAuthFetch();
  const { data, isLoading, error, mutate } = useSWR(
    token && id ? `/api/admin/partners/${id}` : null,
    (u: string) => authFetch(u),
    { revalidateOnFocus: false }
  );
  return {
    partner: (data?.data ?? null) as (AdminPartner & { user_id: number | null; updated_at: string }) | null,
    organizations: (data?.organizations ?? []) as AdminPartnerOrgLink[],
    activeSponsorships: (data?.activeSponsorships ?? 0) as number,
    isLoading,
    error: (error as any)?.message ?? null,
    mutate,
  };
}

export type PartnerInput = {
  name?: string;
  contact_name?: string | null;
  email?: string;
  phone?: string | null;
  is_active?: boolean;
  user_email?: string | null;
};

export function useAdminCreatePartner() {
  const authFetch = useAuthFetch();
  const [isCreating, setIsCreating] = useState(false);
  const createPartner = async (input: PartnerInput) => {
    setIsCreating(true);
    try {
      return await authFetch("/api/admin/partners", { method: "POST", body: JSON.stringify(input) });
    } finally {
      setIsCreating(false);
    }
  };
  return { createPartner, isCreating };
}

export function useAdminUpdatePartner() {
  const authFetch = useAuthFetch();
  const [isSaving, setIsSaving] = useState(false);
  const updatePartner = async (id: number, input: PartnerInput) => {
    setIsSaving(true);
    try {
      return await authFetch(`/api/admin/partners/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    } finally {
      setIsSaving(false);
    }
  };
  return { updatePartner, isSaving };
}

export function useAdminDeletePartner() {
  const authFetch = useAuthFetch();
  const [isDeleting, setIsDeleting] = useState(false);
  const deletePartner = async (id: number) => {
    setIsDeleting(true);
    try {
      return await authFetch(`/api/admin/partners/${id}`, { method: "DELETE" });
    } finally {
      setIsDeleting(false);
    }
  };
  return { deletePartner, isDeleting };
}

export type SponsorBatchInput = {
  org_ids: number[];
  amount_usd: number;
  months_purchased: number;
  provider?: "MANUAL" | "STRIPE" | "PAYPAL";
  currency?: string;
  receipt_url?: string;
};

export type SponsorBatchResultRow = {
  org_id: number;
  org_name: string | null;
  success: boolean;
  error?: string;
};

// Patrocinar varias organizaciones de una — el caso de "el partner compra
// N suscripciones para N orgs". Cada una queda como un pago independiente
// (ver POST /api/admin/partners/[id]/sponsor); esto solo evita repetir el
// diálogo de registrar pago N veces.
export function useAdminBulkSponsor(partnerId: number | null) {
  const authFetch = useAuthFetch();
  const [isSponsoring, setIsSponsoring] = useState(false);
  const bulkSponsor = async (input: SponsorBatchInput) => {
    if (!partnerId) throw new Error("ID requerido");
    setIsSponsoring(true);
    try {
      return await authFetch(`/api/admin/partners/${partnerId}/sponsor`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    } finally {
      setIsSponsoring(false);
    }
  };
  return { bulkSponsor, isSponsoring };
}

export function useAdminLinkPartnerOrg(partnerId: number | null) {
  const authFetch = useAuthFetch();
  const [isLinking, setIsLinking] = useState(false);
  const linkOrg = async (orgId: number, shareFinancials: boolean) => {
    if (!partnerId) throw new Error("ID requerido");
    setIsLinking(true);
    try {
      return await authFetch(`/api/admin/partners/${partnerId}/organizations`, {
        method: "POST",
        body: JSON.stringify({ org_id: orgId, share_financials: shareFinancials }),
      });
    } finally {
      setIsLinking(false);
    }
  };
  return { linkOrg, isLinking };
}

export function useAdminUpdatePartnerOrgLink(partnerId: number | null) {
  const authFetch = useAuthFetch();
  const [isSaving, setIsSaving] = useState(false);
  const updateLink = async (orgId: number, shareFinancials: boolean) => {
    if (!partnerId) throw new Error("ID requerido");
    setIsSaving(true);
    try {
      return await authFetch(`/api/admin/partners/${partnerId}/organizations/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({ share_financials: shareFinancials }),
      });
    } finally {
      setIsSaving(false);
    }
  };
  return { updateLink, isSaving };
}

export function useAdminUnlinkPartnerOrg(partnerId: number | null) {
  const authFetch = useAuthFetch();
  const [isRemoving, setIsRemoving] = useState(false);
  const unlinkOrg = async (orgId: number) => {
    if (!partnerId) throw new Error("ID requerido");
    setIsRemoving(true);
    try {
      return await authFetch(`/api/admin/partners/${partnerId}/organizations/${orgId}`, { method: "DELETE" });
    } finally {
      setIsRemoving(false);
    }
  };
  return { unlinkOrg, isRemoving };
}
