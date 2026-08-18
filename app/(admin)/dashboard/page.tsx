// app/(admin)/dashboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useAdminStats, useAdminStorage } from "@/hooks/swr/use-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, UserCheck, UserX, TrendingUp, Shield,
  ChevronRight, Crown, Database, Image, HardDrive, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { fmtBytes } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  TRIAL:     "Prueba",
  ACTIVE:    "Activa",
  CANCELLED: "Cancelada",
  EXPIRED:   "Vencida",
  PAST_DUE:  "Pago pendiente",
};

const STATUS_COLOR: Record<string, string> = {
  TRIAL:     "bg-blue-100 text-blue-700 border-blue-200",
  ACTIVE:    "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  EXPIRED:   "bg-gray-100 text-gray-600 border-gray-200",
  PAST_DUE:  "bg-amber-100 text-amber-700 border-amber-200",
};

export default function AdminDashboardPage() {
  const { push } = useRouter();
  const { counts, planStats, recentUsers, isLoading } = useAdminStats();
  const { storage, isLoading: loadingStorage } = useAdminStorage();

  const topTables = (storage?.table_sizes ?? []).slice(0, 10).map((t) => ({
    name:  t.tablename.replace(/_/g, " "),
    bytes: t.size_bytes,
    label: fmtBytes(t.size_bytes),
  }));

  const topUsers = storage?.top_users ?? [];
  const maxRows  = topUsers[0]?.total_rows ?? 1;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panel de administración</h1>
          <p className="text-sm text-muted-foreground">Gestión de usuarios y suscripciones</p>
        </div>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : counts ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Users      className="size-5 text-primary" />} label="Usuarios totales"       value={counts.total_users}   bg="bg-primary/5" />
          <StatCard icon={<UserCheck className="size-5 text-primary" />} label="Con suscripción activa" value={counts.active_count}  bg="bg-primary/5" />
          <StatCard icon={<TrendingUp className="size-5 text-primary" />} label="En período de prueba"  value={counts.trial_count}   bg="bg-primary/5" />
          <StatCard icon={<TrendingUp className="size-5 text-primary" />} label="Nuevos este mes"       value={counts.new_this_month} bg="bg-primary/5" />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Plans breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="size-4 text-muted-foreground" />
              Usuarios por plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8" />)}</div>
            ) : planStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              planStats.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <Badge variant="secondary">{p.user_count} usuario{p.user_count !== 1 ? "s" : ""}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Subscription status breakdown */}
        {counts && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserX className="size-4 text-muted-foreground" />
                Estado de suscripciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(["TRIAL","ACTIVE","PAST_DUE","CANCELLED","EXPIRED"] as const).map((s) => {
                const countKey = `${s.toLowerCase()}_count` as keyof typeof counts;
                const val = counts[countKey] as number;
                return (
                  <div key={s} className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
                    <Badge className={`${STATUS_COLOR[s]} border text-xs font-medium`}>{val}</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── DB Storage section ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-2">
        <Database className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Base de datos</h2>
      </div>

      {/* DB size summary cards */}
      {loadingStorage ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : storage && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-1.5">
                <HardDrive className="size-4 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">
                {fmtBytes(storage.db_size_bytes)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Tamaño total de la BD</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-1.5">
                <Image className="size-4 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">
                {storage.image_counts.user_photos + storage.image_counts.logos + storage.image_counts.product_images}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Imágenes almacenadas</p>
            </CardContent>
          </Card>
          <Card >
            <CardContent>
              <div className="flex items-center gap-2 mb-1.5">
                <BarChart2 className="size-4 text-primary" />
              </div>
              <p className="text-xl font-bold text-foreground">
                {storage.table_sizes.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Tablas en la BD</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Table size chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="size-4 text-muted-foreground" />
              Tamaño por tabla
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStorage ? (
              <Skeleton className="h-52 mx-4 rounded-xl" />
            ) : topTables.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={topTables}
                  layout="vertical"
                  margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v) => fmtBytes(v)}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [fmtBytes(value), "Tamaño"]}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="bytes" radius={[0, 4, 4, 0]} fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top users by rows */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Usuarios con más registros
            </CardTitle>
          </CardHeader>
          <CardContent >
            {loadingStorage ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8" />)}</div>
            ) : topUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : (
              topUsers.slice(0, 8).map((u) => {
                const pct = maxRows > 0 ? Math.round((u.total_rows / maxRows) * 100) : 0;
                return (
                  <div
                    key={u.id}
                    className="cursor-pointer"
                    onClick={() => push(`/users/${u.id}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate max-w-45">{u.display_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {u.total_rows.toLocaleString("es-HN")} filas
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Image breakdown */}
        {storage && (
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="size-4 text-muted-foreground" />
                Imágenes almacenadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{storage.image_counts.logos}</p>
                  <p className="text-xs text-muted-foreground mt-1">Logos de negocio</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{storage.image_counts.product_images}</p>
                  <p className="text-xs text-muted-foreground mt-1">Imágenes de productos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{storage.image_counts.user_photos}</p>
                  <p className="text-xs text-muted-foreground mt-1">Fotos de perfil</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent users */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Usuarios recientes</CardTitle>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => push("/users")}>
            Ver todos <ChevronRight className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="divide-y">
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-3 gap-3 cursor-pointer hover:bg-muted/30 px-2 -mx-2 rounded-lg transition-colors"
                  onClick={() => push(`/users/${u.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(u as any).business_name || u.display_name || u.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(u as any).subscription_status && (
                      <Badge className={`${STATUS_COLOR[(u as any).subscription_status] ?? ""} border text-xs hidden sm:flex`}>
                        {STATUS_LABEL[(u as any).subscription_status] ?? (u as any).subscription_status}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                      {new Date(u.created_at).toLocaleDateString("es-HN", { day: "numeric", month: "short" })}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: {
  icon: React.ReactNode; label: string; value: number; bg: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 mb-2">{icon}</div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
