"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type Resolver,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { MoneyField } from "@/components/cotizador/MoneyField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formToFormulaInput } from "@/lib/cotizador/build-input";
import {
  type CatalogExcursion,
  DESTINOS,
  filterExcursions,
} from "@/lib/cotizador/catalog";
import {
  calcularCotizacion,
  FormulaError,
  type FormulaResult,
} from "@/lib/cotizador/formula";
import { generateItinerary } from "@/lib/cotizador/itinerary";
import { FORMULA_PARAMS } from "@/lib/cotizador/params";
import {
  type CotizacionFormInput,
  cotizacionFormSchema,
  defaultCotizacionValues,
  EQUIPAJES,
  emptyDestino,
  HOTEL_CATEGORIAS,
  METODOS_PAGO,
  PAISES,
  PERFILES,
} from "@/lib/validations/cotizacion";

const STEPS = [
  "Cliente + viaje",
  "Costos por destino",
  "Confirmación",
] as const;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function money(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function moneyDec(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function CotizadorWizard() {
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FormulaResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<CotizacionFormInput>({
    resolver: standardSchemaResolver(
      cotizacionFormSchema,
    ) as Resolver<CotizacionFormInput>,
    defaultValues: defaultCotizacionValues,
    mode: "onBlur",
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = form;

  const { fields, replace } = useFieldArray({
    control,
    name: "destinos",
  });

  const paxMenores = useWatch({ control, name: "paxMenores" }) ?? 0;
  const destinosSeleccionados =
    useWatch({ control, name: "destinosSeleccionados" }) ?? [];
  const fechaIda = useWatch({ control, name: "fechaIda" }) ?? "";
  const destinosWatch = useWatch({ control, name: "destinos" }) ?? [];

  const excursionsByDestino = useMemo(() => {
    const map: Record<string, CatalogExcursion[]> = {};
    for (const d of destinosSeleccionados) {
      map[d] = fechaIda ? filterExcursions({ destino: d, fechaIda }) : [];
    }
    return map;
  }, [destinosSeleccionados, fechaIda]);

  function syncDestinos(selected: (typeof DESTINOS)[number][]) {
    const current = getValues("destinos");
    const next = selected.map(
      (destino) =>
        current.find((d) => d.destino === destino) ?? emptyDestino(destino),
    );
    replace(next);
    setValue("destinosSeleccionados", selected, { shouldValidate: true });
  }

  function refreshItinerary() {
    const values = getValues();
    const primary = values.destinos[0];
    if (!primary || !values.fechaIda || !values.fechaVuelta) return;

    const excursiones = (primary.excursionIds ?? [])
      .map((id) =>
        (excursionsByDestino[primary.destino] ?? []).find((e) => e.id === id),
      )
      .filter(Boolean) as CatalogExcursion[];

    const text = generateItinerary({
      destino: primary.destino,
      fechaIda: values.fechaIda,
      fechaVuelta: values.fechaVuelta,
      hotelNombre: primary.hotelNombre,
      excursiones,
    });
    setValue("itinerario", text);
  }

  async function goNext() {
    setServerError(null);
    if (step === 0) {
      const ok = await trigger([
        "clienteNombre",
        "paisOrigen",
        "whatsapp",
        "perfil",
        "destinosSeleccionados",
        "fechaIda",
        "fechaVuelta",
        "paxAdultos",
        "paxMenores",
        "edadesMenores",
        "metodoPago",
        "equipaje",
      ]);
      if (!ok) return;
      syncDestinos(getValues("destinosSeleccionados"));
      setStep(1);
      return;
    }

    if (step === 1) {
      const ok = await trigger(["destinos"]);
      if (!ok) return;
      refreshItinerary();
      try {
        const result = calcularCotizacion(formToFormulaInput(getValues()));
        setPreview(result);
        setStep(2);
      } catch (error) {
        setServerError(
          error instanceof FormulaError
            ? error.message
            : "No se pudo calcular la cotización",
        );
      }
    }
  }

  async function onGenerate(values: CotizacionFormInput) {
    setServerError(null);
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setServerError(data?.error ?? "No se pudo generar el PDF");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      a.href = url;
      a.download = match?.[1] ?? "cotizacion.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setServerError("Error de red al generar el PDF");
    } finally {
      setIsGenerating(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            KORS · Cotizador MVP
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Nueva cotización
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            TC ARS/USD {FORMULA_PARAMS.tcArsUsd} · fórmula v2.9
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="icon-sm" onClick={logout}>
            <LogOut />
          </Button>
        </div>
      </header>

      <nav className="flex gap-2">
        {STEPS.map((label, index) => (
          <div
            key={label}
            className={`flex-1 rounded-2xl border px-3 py-2 text-center text-xs font-medium ${
              index === step
                ? "border-primary bg-primary/10 text-foreground"
                : index < step
                  ? "border-border bg-muted text-foreground"
                  : "border-border text-muted-foreground"
            }`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </nav>

      <form
        onSubmit={handleSubmit(onGenerate)}
        className="rounded-4xl border border-border bg-card p-6 shadow-sm"
        noValidate
      >
        {step === 0 ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="clienteNombre">Nombre completo</Label>
                <Input id="clienteNombre" {...register("clienteNombre")} />
                <FieldError message={errors.clienteNombre?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paisOrigen">País</Label>
                <select
                  id="paisOrigen"
                  className="h-9 w-full rounded-4xl border border-border bg-background px-3 text-sm"
                  {...register("paisOrigen")}
                >
                  {PAISES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="+54 9 11 ..."
                  {...register("whatsapp")}
                />
                <FieldError message={errors.whatsapp?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil">Perfil</Label>
                <select
                  id="perfil"
                  className="h-9 w-full rounded-4xl border border-border bg-background px-3 text-sm"
                  {...register("perfil")}
                >
                  {PERFILES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metodoPago">Método de pago</Label>
                <select
                  id="metodoPago"
                  className="h-9 w-full rounded-4xl border border-border bg-background px-3 text-sm"
                  {...register("metodoPago")}
                >
                  {METODOS_PAGO.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaIda">Fecha ida</Label>
                <Input id="fechaIda" type="date" {...register("fechaIda")} />
                <FieldError message={errors.fechaIda?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaVuelta">Fecha vuelta</Label>
                <Input
                  id="fechaVuelta"
                  type="date"
                  {...register("fechaVuelta")}
                />
                <FieldError message={errors.fechaVuelta?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paxAdultos">Adultos</Label>
                <Input
                  id="paxAdultos"
                  type="number"
                  min={1}
                  {...register("paxAdultos")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paxMenores">Menores</Label>
                <Input
                  id="paxMenores"
                  type="number"
                  min={0}
                  {...register("paxMenores", {
                    onChange: (e) => {
                      const n = Number(e.target.value) || 0;
                      const current = getValues("edadesMenores") ?? [];
                      setValue(
                        "edadesMenores",
                        Array.from({ length: n }, (_, i) => current[i] ?? 0),
                      );
                    },
                  })}
                />
              </div>
              {paxMenores > 0 ? (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Edades de menores</Label>
                  <div className="flex flex-wrap gap-2">
                    {(getValues("edadesMenores") ?? []).map((_, i) => (
                      <Input
                        // Age inputs are positional form fields; index key is intentional.
                        // biome-ignore lint/suspicious/noArrayIndexKey: positional RHF fields
                        key={`edad-menor-${i}`}
                        type="number"
                        min={0}
                        max={17}
                        className="w-20"
                        {...register(`edadesMenores.${i}`)}
                      />
                    ))}
                  </div>
                  <FieldError
                    message={
                      errors.edadesMenores?.message as string | undefined
                    }
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="equipaje">Equipaje</Label>
                <select
                  id="equipaje"
                  className="h-9 w-full rounded-4xl border border-border bg-background px-3 text-sm"
                  {...register("equipaje")}
                >
                  {EQUIPAJES.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aerolinea">Aerolínea (opcional)</Label>
                <Input id="aerolinea" {...register("aerolinea")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Destinos</Label>
              <div className="flex flex-wrap gap-2">
                {DESTINOS.map((destino) => {
                  const selected = destinosSeleccionados.includes(destino);
                  return (
                    <button
                      key={destino}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? destinosSeleccionados.filter((d) => d !== destino)
                          : [...destinosSeleccionados, destino];
                        if (next.length === 0) return;
                        syncDestinos(next);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {destino}
                    </button>
                  );
                })}
              </div>
              <FieldError message={errors.destinosSeleccionados?.message} />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-8">
            {fields.map((field, index) => {
              const destino = destinosWatch[index]?.destino ?? field.destino;
              const options = excursionsByDestino[destino] ?? [];
              const selectedIds = destinosWatch[index]?.excursionIds ?? [];
              const moneda = destinosWatch[index]?.moneda ?? "ARS";
              const hasMenores = paxMenores > 0;
              const cur = (label: string) => `${label} (${moneda})`;
              return (
                <section
                  key={field.id}
                  className="space-y-4 border-b border-border pb-8 last:border-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{destino}</h2>
                    <div className="inline-flex rounded-full border border-border p-0.5">
                      {(["ARS", "USD"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            setValue(`destinos.${index}.moneda`, m, {
                              shouldValidate: true,
                            })
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            moneda === m
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{cur("Vuelo ida adulto")}</Label>
                      <MoneyField
                        currency={moneda}
                        value={destinosWatch[index]?.vueloIdaAdultoArs ?? 0}
                        onValueChange={(v) =>
                          setValue(`destinos.${index}.vueloIdaAdultoArs`, v)
                        }
                      />
                    </div>
                    {hasMenores ? (
                      <div className="space-y-2">
                        <Label>{cur("Vuelo ida menor")}</Label>
                        <MoneyField
                          currency={moneda}
                          value={destinosWatch[index]?.vueloIdaMenorArs ?? 0}
                          onValueChange={(v) =>
                            setValue(`destinos.${index}.vueloIdaMenorArs`, v)
                          }
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>{cur("Vuelo vuelta adulto")}</Label>
                      <MoneyField
                        currency={moneda}
                        value={destinosWatch[index]?.vueloVueltaAdultoArs ?? 0}
                        onValueChange={(v) =>
                          setValue(`destinos.${index}.vueloVueltaAdultoArs`, v)
                        }
                      />
                    </div>
                    {hasMenores ? (
                      <div className="space-y-2">
                        <Label>{cur("Vuelo vuelta menor")}</Label>
                        <MoneyField
                          currency={moneda}
                          value={destinosWatch[index]?.vueloVueltaMenorArs ?? 0}
                          onValueChange={(v) =>
                            setValue(`destinos.${index}.vueloVueltaMenorArs`, v)
                          }
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>{cur("Hotel por adulto")}</Label>
                      <MoneyField
                        currency={moneda}
                        value={destinosWatch[index]?.hotelAdultoArs ?? 0}
                        onValueChange={(v) =>
                          setValue(`destinos.${index}.hotelAdultoArs`, v)
                        }
                      />
                    </div>
                    {hasMenores ? (
                      <div className="space-y-2">
                        <Label>{cur("Hotel por menor")}</Label>
                        <MoneyField
                          currency={moneda}
                          value={destinosWatch[index]?.hotelMenorArs ?? 0}
                          onValueChange={(v) =>
                            setValue(`destinos.${index}.hotelMenorArs`, v)
                          }
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>Nombre hotel</Label>
                      <Input {...register(`destinos.${index}.hotelNombre`)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <select
                        className="h-9 w-full rounded-4xl border border-border bg-background px-3 text-sm"
                        {...register(`destinos.${index}.hotelCategoria`)}
                      >
                        <option value="">—</option>
                        {HOTEL_CATEGORIAS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Régimen</Label>
                      <Input {...register(`destinos.${index}.hotelRegimen`)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Ubicación</Label>
                      <Input
                        {...register(`destinos.${index}.hotelUbicacion`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo habitación</Label>
                      <Input
                        {...register(`destinos.${index}.hotelHabitacion`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{cur("Ajuste operador ±")}</Label>
                      <MoneyField
                        currency={moneda}
                        allowNegative
                        value={destinosWatch[index]?.hotelAjusteArs ?? 0}
                        onValueChange={(v) =>
                          setValue(`destinos.${index}.hotelAjusteArs`, v)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Excursiones ({options.length} vigentes)</Label>
                    {!fechaIda ? (
                      <p className="text-sm text-muted-foreground">
                        Definí la fecha de ida para filtrar por vigencia.
                      </p>
                    ) : options.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay excursiones activas vigentes para este
                        destino/fecha.
                      </p>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-border p-3">
                        {options.map((exc) => {
                          const checked = selectedIds.includes(exc.id);
                          return (
                            <label
                              key={exc.id}
                              className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-muted"
                            >
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={checked}
                                onChange={(e) => {
                                  const current =
                                    getValues(
                                      `destinos.${index}.excursionIds`,
                                    ) ?? [];
                                  const next = e.target.checked
                                    ? [...current, exc.id]
                                    : current.filter((id) => id !== exc.id);
                                  setValue(
                                    `destinos.${index}.excursionIds`,
                                    next,
                                  );
                                }}
                              />
                              <span className="text-sm">
                                <span className="font-medium">
                                  {exc.nombreLimpio}
                                </span>
                                <span className="mt-0.5 block text-muted-foreground">
                                  {exc.moneda}{" "}
                                  {exc.neto.toLocaleString("es-AR")} ·{" "}
                                  {exc.politicaMenores}
                                  {exc.proveedor ? ` · ${exc.proveedor}` : ""}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}

        {step === 2 && preview ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Costo neto
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {moneyDec(preview.subtotalUsd)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Precio final
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {money(preview.precioFinalCliente)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Por adulto
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {money(preview.precioAdultoCliente)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4 text-sm">
              <p>Margen agencia: {moneyDec(preview.margenAgenciaUsd)}</p>
              <p>Post fee: {moneyDec(preview.precioPostFee)}</p>
              <p>Margen vendedor: {moneyDec(preview.margenVendedorUsd)}</p>
              {preview.precioMenorCliente > 0 ? (
                <p>Por menor: {money(preview.precioMenorCliente)}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="itinerario">Itinerario (editable)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={refreshItinerary}
                >
                  Regenerar
                </Button>
              </div>
              <textarea
                id="itinerario"
                rows={6}
                className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
                {...register("itinerario")}
              />
            </div>
          </div>
        ) : null}

        {serverError ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        ) : null}

        <div className="mt-6 flex justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || isGenerating}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Atrás
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={goNext}>
              Continuar
            </Button>
          ) : (
            <Button type="submit" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" />
                  Generando PDF...
                </>
              ) : (
                "Generar PDF"
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
