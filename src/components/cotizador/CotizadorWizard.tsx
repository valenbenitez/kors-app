"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Resolver,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { ImagePrefillUpload } from "@/components/cotizador/ImagePrefillUpload";
import { CURRENCY_UI, MoneyField } from "@/components/cotizador/MoneyField";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formToFormulaInput } from "@/lib/cotizador/build-input";
import type { CatalogExcursion } from "@/lib/cotizador/catalog";
import {
  calcularCotizacion,
  FormulaError,
  type FormulaResult,
} from "@/lib/cotizador/formula";
import { generateItinerary } from "@/lib/cotizador/itinerary";
import {
  DESTINO_OPTIONS,
  type DestinoOption,
  excursionsForSelection,
} from "@/lib/cotizador/provinces";
import {
  convertCatalogAmountToForm,
  type FxRatesMap,
  fallbackFxRates,
  isFxRatesMap,
} from "@/lib/cotizador/rates";
import { cn } from "@/lib/utils";
import {
  type CotizacionFormInput,
  cotizacionFormSchema,
  defaultCotizacionValues,
  EQUIPAJES,
  emptyDestino,
  type FormMoneda,
  HOTEL_CATEGORIAS,
  METODOS_PAGO,
  MONEDAS,
  PAISES,
  PERFILES,
} from "@/lib/validations/cotizacion";

const STEPS = [
  { full: "Cliente + viaje", short: "Cliente" },
  { full: "Costos por destino", short: "Costos" },
  { full: "Confirmación", short: "Confirmar" },
] as const;

function formatDisplayAmount(amount: number, currency: FormMoneda): string {
  return amount.toLocaleString("es-AR", {
    maximumFractionDigits: CURRENCY_UI[currency].decimals,
  });
}

function cotNumberFromDownload(
  headerValue: string | null,
  filename: string,
): string | null {
  if (headerValue?.match(/^COT-\d+$/i)) {
    return headerValue.toUpperCase();
  }
  const fromName = filename.match(/COT-\d+/i);
  return fromName ? fromName[0].toUpperCase() : null;
}

/** Money fields cleared when destination currency changes (no silent re-interpretation). */
const DESTINO_MONEY_FIELDS = [
  "vueloIdaAdultoArs",
  "vueloIdaMenorArs",
  "vueloVueltaAdultoArs",
  "vueloVueltaMenorArs",
  "hotelAdultoArs",
  "hotelMenorArs",
  "hotelAjusteArs",
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
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<FormulaResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  // Live rates when /api/rates succeeds; FX_RATES_TO_USD fallback keeps demos
  // working if the sheet is down (show muted "TC (fallback)" warning).
  const [rates, setRates] = useState<FxRatesMap | null>(null);
  const [ratesSource, setRatesSource] = useState<"live" | "fallback" | null>(
    null,
  );
  const [ratesLoading, setRatesLoading] = useState(true);
  // Per-destination search query; filtering the list does not clear excursionIds.
  const [excursionQueries, setExcursionQueries] = useState<
    Record<string, string>
  >({});
  // Guard reentrante: garantiza como máximo una petición activa aunque
  // lleguen submits concurrentes (doble click / doble Enter) antes del rerender.
  const isGeneratingRef = useRef(false);
  /** Form paths filled by flight image prefill — used for visual highlight. */
  const [prefilledFlightPaths, setPrefilledFlightPaths] = useState<string[]>(
    [],
  );
  /** Form paths filled by hotel image prefill — used for visual highlight. */
  const [prefilledHotelPaths, setPrefilledHotelPaths] = useState<string[]>([]);

  function prefillClass(path: string): string | undefined {
    if (
      !prefilledFlightPaths.includes(path) &&
      !prefilledHotelPaths.includes(path)
    ) {
      return undefined;
    }
    return "ring-2 ring-primary/40 bg-primary/5";
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRates() {
      setRatesLoading(true);
      try {
        const res = await fetch("/api/rates");
        if (!res.ok) throw new Error(`Rates HTTP ${res.status}`);
        const data: unknown = await res.json();
        if (!isFxRatesMap(data)) {
          throw new Error("Invalid rates payload");
        }
        if (!cancelled) {
          setRates(data);
          setRatesSource("live");
        }
      } catch {
        // Prefer live rates; on failure use hardcoded FX_RATES_TO_USD so demos
        // still work, with a visible muted warning in the header.
        if (!cancelled) {
          setRates(fallbackFxRates());
          setRatesSource("fallback");
        }
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    }

    void loadRates();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const paxAdultos = useWatch({ control, name: "paxAdultos" }) ?? 0;
  const paxMenores = useWatch({ control, name: "paxMenores" }) ?? 0;
  const destinosSeleccionados =
    useWatch({ control, name: "destinosSeleccionados" }) ?? [];
  const fechaIda = useWatch({ control, name: "fechaIda" }) ?? "";
  const fechaVuelta = useWatch({ control, name: "fechaVuelta" }) ?? "";
  const destinosWatch = useWatch({ control, name: "destinos" }) ?? [];

  // Keep segment flight dates in sync with trip-level dates (PDF reads segment fechas).
  useEffect(() => {
    setValue("vueloIdaFecha", fechaIda, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [fechaIda, setValue]);

  useEffect(() => {
    setValue("vueloVueltaFecha", fechaVuelta, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [fechaVuelta, setValue]);

  const excursionsByDestino = useMemo(() => {
    const map: Record<string, CatalogExcursion[]> = {};
    for (const d of destinosSeleccionados) {
      map[d] = fechaIda
        ? excursionsForSelection({ selection: d, fechaIda })
        : [];
    }
    return map;
  }, [destinosSeleccionados, fechaIda]);

  function syncDestinos(selected: DestinoOption[]) {
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
    setDownloadSuccess(null);
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
      if (!rates) {
        setServerError("Cotizaciones no disponibles. Recargá la página.");
        return;
      }
      refreshItinerary();
      try {
        const result = calcularCotizacion(
          formToFormulaInput(getValues(), rates),
        );
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
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setServerError(null);
    setDownloadSuccess(null);
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
        setServerError(
          data?.error ??
            "No se pudo generar el PDF. Revisá los datos e intentá de nuevo.",
        );
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      const filename = match?.[1] ?? "cotizacion.pdf";
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const cotNumber = cotNumberFromDownload(
        response.headers.get("X-Cotizacion-Numero"),
        filename,
      );
      setDownloadSuccess(cotNumber ?? "listo");
    } catch {
      setServerError(
        "No se pudo conectar al generar el PDF. Revisá tu conexión e intentá de nuevo.",
      );
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  }

  // Multi-destino: TC header uses the first destino's moneda.
  const headerMoneda = destinosWatch.find((d) => d?.moneda)?.moneda ?? "ARS";
  // Flight costs bind to destinos[0] only (same as applyVueloPrefill).
  const flightMoneda = destinosWatch[0]?.moneda ?? "ARS";
  const hasFlightDestino = destinosWatch.length > 0;
  const hasMenoresStep0 = paxMenores > 0;
  const flightCur = (label: string) => `${label} (${flightMoneda})`;

  function setFlightMoneda(m: (typeof MONEDAS)[number]) {
    if (!hasFlightDestino || m === flightMoneda) return;
    setValue("destinos.0.moneda", m, { shouldValidate: true });
    for (const field of DESTINO_MONEY_FIELDS) {
      setValue(`destinos.0.${field}`, 0, { shouldValidate: true });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Nueva cotización
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ratesLoading || !rates
            ? "Cargando cotizaciones…"
            : ratesSource === "fallback"
              ? `TC ${headerMoneda}/USD ${rates[headerMoneda]} (fallback) · fórmula v2.9`
              : `TC ${headerMoneda}/USD ${rates[headerMoneda]} · fórmula v2.9`}
        </p>
        {ratesSource === "fallback" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            No se pudieron cargar las cotizaciones en vivo; se usan valores de
            respaldo.
          </p>
        ) : null}
      </header>

      <nav aria-label="Pasos del cotizador" className="flex gap-1.5 sm:gap-2">
        {STEPS.map((label, index) => (
          <div
            key={label.full}
            aria-current={index === step ? "step" : undefined}
            className={`flex-1 rounded-2xl border px-2 py-2 text-center text-xs font-medium sm:px-3 ${
              index === step
                ? "border-primary bg-primary text-primary-foreground"
                : index < step
                  ? "border-accent/40 bg-accent/15 text-foreground"
                  : "border-border text-muted-foreground"
            }`}
          >
            <span className="md:hidden">
              {index + 1}. {label.short}
            </span>
            <span className="hidden md:inline">
              {index + 1}. {label.full}
            </span>
          </div>
        ))}
      </nav>

      <form
        onSubmit={(event) => {
          // Nunca generar por submit nativo: evita race Continuar→submit al
          // cambiar el botón de type="button" a type="submit" en el mismo click.
          event.preventDefault();
        }}
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
              <div className="flex min-w-0 flex-col space-y-2">
                <Label htmlFor="fechaIda">Fecha ida</Label>
                <Input
                  id="fechaIda"
                  type="date"
                  className={prefillClass("fechaIda")}
                  {...register("fechaIda")}
                />
                <FieldError message={errors.fechaIda?.message} />
              </div>
              <div className="flex min-w-0 flex-col space-y-2">
                <Label htmlFor="fechaVuelta">Fecha vuelta</Label>
                <Input
                  id="fechaVuelta"
                  type="date"
                  className={prefillClass("fechaVuelta")}
                  {...register("fechaVuelta")}
                />
                <FieldError
                  message={
                    errors.fechaVuelta?.message ??
                    errors.vueloVueltaFecha?.message
                  }
                />
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
                <Input
                  id="aerolinea"
                  className={prefillClass("aerolinea")}
                  {...register("aerolinea")}
                />
              </div>
            </div>

            <ImagePrefillUpload
              tipo="vuelo"
              setValue={setValue}
              getValues={getValues}
              onPrefill={setPrefilledFlightPaths}
            />

            <div className="space-y-4 rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Vuelo ida (opcional)</h3>
                <div className="inline-flex flex-wrap justify-end gap-0.5 rounded-full border border-border p-0.5">
                  {MONEDAS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={!hasFlightDestino}
                      onClick={() => setFlightMoneda(m)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        flightMoneda === m
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloIdaHoraSalida">Hora salida</Label>
                  <Input
                    id="vueloIdaHoraSalida"
                    type="time"
                    className={prefillClass("vueloIdaHoraSalida")}
                    {...register("vueloIdaHoraSalida")}
                  />
                </div>
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloIdaHoraLlegada">Hora llegada</Label>
                  <Input
                    id="vueloIdaHoraLlegada"
                    type="time"
                    className={prefillClass("vueloIdaHoraLlegada")}
                    {...register("vueloIdaHoraLlegada")}
                  />
                </div>
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloIdaNumero">Número de vuelo ida</Label>
                  <Input
                    id="vueloIdaNumero"
                    placeholder="ej. 3150"
                    className={prefillClass("vueloIdaNumero")}
                    {...register("vueloIdaNumero")}
                  />
                </div>
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloIdaAeropuertoSalida">
                    Aeropuerto salida ida (IATA)
                  </Label>
                  <Input
                    id="vueloIdaAeropuertoSalida"
                    placeholder="EZE"
                    maxLength={3}
                    className={cn(
                      "uppercase",
                      prefillClass("vueloIdaAeropuertoSalida"),
                    )}
                    {...register("vueloIdaAeropuertoSalida")}
                  />
                </div>
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloIdaAeropuertoLlegada">
                    Aeropuerto llegada ida (IATA)
                  </Label>
                  <Input
                    id="vueloIdaAeropuertoLlegada"
                    placeholder="IGR"
                    maxLength={3}
                    className={cn(
                      "uppercase",
                      prefillClass("vueloIdaAeropuertoLlegada"),
                    )}
                    {...register("vueloIdaAeropuertoLlegada")}
                  />
                </div>
              </div>
              {!hasFlightDestino ? (
                <p className="text-sm text-muted-foreground">
                  Seleccioná un destino para cargar precios de vuelo.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vueloIdaAdultoArs">
                    {flightCur("Vuelo ida adulto")}
                  </Label>
                  <MoneyField
                    id="vueloIdaAdultoArs"
                    currency={flightMoneda}
                    disabled={!hasFlightDestino}
                    className={prefillClass("destinos.0.vueloIdaAdultoArs")}
                    value={destinosWatch[0]?.vueloIdaAdultoArs ?? 0}
                    onValueChange={(v) =>
                      setValue("destinos.0.vueloIdaAdultoArs", v)
                    }
                  />
                </div>
                {hasMenoresStep0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="vueloIdaMenorArs">
                      {flightCur("Vuelo ida menor")}
                    </Label>
                    <MoneyField
                      id="vueloIdaMenorArs"
                      currency={flightMoneda}
                      disabled={!hasFlightDestino}
                      className={prefillClass("destinos.0.vueloIdaMenorArs")}
                      value={destinosWatch[0]?.vueloIdaMenorArs ?? 0}
                      onValueChange={(v) =>
                        setValue("destinos.0.vueloIdaMenorArs", v)
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border p-4">
              <h3 className="text-sm font-semibold">Vuelo vuelta (opcional)</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloVueltaHoraSalida">Hora salida</Label>
                  <Input
                    id="vueloVueltaHoraSalida"
                    type="time"
                    className={prefillClass("vueloVueltaHoraSalida")}
                    {...register("vueloVueltaHoraSalida")}
                  />
                </div>
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloVueltaHoraLlegada">Hora llegada</Label>
                  <Input
                    id="vueloVueltaHoraLlegada"
                    type="time"
                    className={prefillClass("vueloVueltaHoraLlegada")}
                    {...register("vueloVueltaHoraLlegada")}
                  />
                </div>
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloVueltaNumero">
                    Número de vuelo vuelta
                  </Label>
                  <Input
                    id="vueloVueltaNumero"
                    placeholder="ej. 3151"
                    className={prefillClass("vueloVueltaNumero")}
                    {...register("vueloVueltaNumero")}
                  />
                </div>
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloVueltaAeropuertoSalida">
                    Aeropuerto salida vuelta (IATA)
                  </Label>
                  <Input
                    id="vueloVueltaAeropuertoSalida"
                    placeholder="IGR"
                    maxLength={3}
                    className={cn(
                      "uppercase",
                      prefillClass("vueloVueltaAeropuertoSalida"),
                    )}
                    {...register("vueloVueltaAeropuertoSalida")}
                  />
                </div>
                <div className="flex min-w-0 flex-col space-y-2">
                  <Label htmlFor="vueloVueltaAeropuertoLlegada">
                    Aeropuerto llegada vuelta (IATA)
                  </Label>
                  <Input
                    id="vueloVueltaAeropuertoLlegada"
                    placeholder="EZE"
                    maxLength={3}
                    className={cn(
                      "uppercase",
                      prefillClass("vueloVueltaAeropuertoLlegada"),
                    )}
                    {...register("vueloVueltaAeropuertoLlegada")}
                  />
                </div>
              </div>
              {!hasFlightDestino ? (
                <p className="text-sm text-muted-foreground">
                  Seleccioná un destino para cargar precios de vuelo.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vueloVueltaAdultoArs">
                    {flightCur("Vuelo vuelta adulto")}
                  </Label>
                  <MoneyField
                    id="vueloVueltaAdultoArs"
                    currency={flightMoneda}
                    disabled={!hasFlightDestino}
                    className={prefillClass("destinos.0.vueloVueltaAdultoArs")}
                    value={destinosWatch[0]?.vueloVueltaAdultoArs ?? 0}
                    onValueChange={(v) =>
                      setValue("destinos.0.vueloVueltaAdultoArs", v)
                    }
                  />
                </div>
                {hasMenoresStep0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="vueloVueltaMenorArs">
                      {flightCur("Vuelo vuelta menor")}
                    </Label>
                    <MoneyField
                      id="vueloVueltaMenorArs"
                      currency={flightMoneda}
                      disabled={!hasFlightDestino}
                      className={prefillClass("destinos.0.vueloVueltaMenorArs")}
                      value={destinosWatch[0]?.vueloVueltaMenorArs ?? 0}
                      onValueChange={(v) =>
                        setValue("destinos.0.vueloVueltaMenorArs", v)
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Destinos</Label>
              <div className="flex flex-wrap gap-2">
                {DESTINO_OPTIONS.map((destino) => {
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
              const query = excursionQueries[destino] ?? "";
              // Selected ids stay in form even when hidden by the name filter.
              const visibleOptions =
                fechaIda && query.trim()
                  ? excursionsForSelection({
                      selection: destino,
                      fechaIda,
                      query,
                    })
                  : options;
              const selectedIds = destinosWatch[index]?.excursionIds ?? [];
              const moneda = destinosWatch[index]?.moneda ?? "ARS";
              const fx = rates ?? fallbackFxRates();
              const hasMenores = paxMenores > 0;
              const cur = (label: string) => `${label} (${moneda})`;
              return (
                <section
                  key={field.id}
                  className="space-y-4 border-b border-border pb-8 last:border-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{destino}</h2>
                    <div className="inline-flex flex-wrap justify-end gap-0.5 rounded-full border border-border p-0.5">
                      {MONEDAS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            if (m === moneda) return;
                            // Policy: clear amounts on currency change so Zod
                            // stays valid and values are never left in the
                            // previous currency without conversion.
                            setValue(`destinos.${index}.moneda`, m, {
                              shouldValidate: true,
                            });
                            for (const field of DESTINO_MONEY_FIELDS) {
                              setValue(`destinos.${index}.${field}`, 0, {
                                shouldValidate: true,
                              });
                            }
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
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
                    <div className="space-y-2 sm:col-span-2">
                      <ImagePrefillUpload
                        tipo="hotel"
                        destinoIndex={index}
                        paxAdultos={Number(paxAdultos)}
                        setValue={setValue}
                        getValues={getValues}
                        onPrefill={setPrefilledHotelPaths}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre hotel</Label>
                      <Input
                        className={prefillClass(
                          `destinos.${index}.hotelNombre`,
                        )}
                        {...register(`destinos.${index}.hotelNombre`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoría</Label>
                      <select
                        className={cn(
                          "h-9 w-full rounded-4xl border border-border bg-background px-3 text-sm",
                          prefillClass(`destinos.${index}.hotelCategoria`),
                        )}
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
                      <Input
                        className={prefillClass(
                          `destinos.${index}.hotelRegimen`,
                        )}
                        {...register(`destinos.${index}.hotelRegimen`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ubicación</Label>
                      <Input
                        className={prefillClass(
                          `destinos.${index}.hotelUbicacion`,
                        )}
                        {...register(`destinos.${index}.hotelUbicacion`)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo habitación</Label>
                      <Input
                        className={prefillClass(
                          `destinos.${index}.hotelHabitacion`,
                        )}
                        {...register(`destinos.${index}.hotelHabitacion`)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`hotelIncluye-${index}`}>
                        Hotel incluye (opcional)
                      </Label>
                      <textarea
                        id={`hotelIncluye-${index}`}
                        rows={2}
                        className={cn(
                          "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm",
                          prefillClass(`destinos.${index}.hotelIncluye`),
                        )}
                        placeholder="Una línea por ítem…"
                        {...register(`destinos.${index}.hotelIncluye`)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`hotelExcluye-${index}`}>
                        Hotel excluye (opcional)
                      </Label>
                      <textarea
                        id={`hotelExcluye-${index}`}
                        rows={2}
                        className={cn(
                          "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm",
                          prefillClass(`destinos.${index}.hotelExcluye`),
                        )}
                        placeholder="Una línea por ítem…"
                        {...register(`destinos.${index}.hotelExcluye`)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`hotelCondiciones-${index}`}>
                        Condiciones del hotel (opcional)
                      </Label>
                      <textarea
                        id={`hotelCondiciones-${index}`}
                        rows={2}
                        className={cn(
                          "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm",
                          prefillClass(`destinos.${index}.hotelCondiciones`),
                        )}
                        placeholder="Check-in, políticas, notas…"
                        {...register(`destinos.${index}.hotelCondiciones`)}
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
                        No hay excursiones vigentes para esta fecha. Probá otra
                        fecha de ida o continuá sin excursiones.
                      </p>
                    ) : (
                      <>
                        <Input
                          type="search"
                          placeholder="Buscar excursión por nombre…"
                          value={excursionQueries[destino] ?? ""}
                          onChange={(e) =>
                            setExcursionQueries((prev) => ({
                              ...prev,
                              [destino]: e.target.value,
                            }))
                          }
                          aria-label={`Buscar excursiones en ${destino}`}
                        />
                        {visibleOptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No hay coincidencias para tu búsqueda.
                          </p>
                        ) : (
                          <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-border p-3">
                            {visibleOptions.map((exc) => {
                              const checked = selectedIds.includes(exc.id);
                              const displayAmount = convertCatalogAmountToForm(
                                exc.neto,
                                exc.moneda,
                                moneda,
                                fx,
                              );
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
                                      {moneda}{" "}
                                      {formatDisplayAmount(
                                        displayAmount,
                                        moneda,
                                      )}{" "}
                                      · {exc.politicaMenores}
                                      {exc.proveedor
                                        ? ` · ${exc.proveedor}`
                                        : ""}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </>
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

        {downloadSuccess ? (
          <output className="mt-4 block rounded-2xl border border-success/25 bg-success/10 px-3 py-2.5 text-sm text-success">
            {downloadSuccess === "listo" ? (
              "PDF descargado correctamente."
            ) : (
              <>
                PDF listo ·{" "}
                <span className="font-semibold">{downloadSuccess}</span> se
                descargó correctamente.
              </>
            )}
          </output>
        ) : null}

        {step === 2 ? (
          <>
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isGenerating}
                aria-expanded={showPdfPreview}
                onClick={() => setShowPdfPreview((open) => !open)}
              >
                {showPdfPreview ? "Ocultar preview" : "Ver preview"}
              </Button>
            </div>
            <PdfPreview formValues={getValues()} open={showPdfPreview} />
          </>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || isGenerating}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Atrás
          </Button>
          {step < 2 ? (
            <Button
              type="button"
              disabled={ratesLoading || !rates}
              onClick={goNext}
            >
              {ratesLoading ? "Cargando cotizaciones…" : "Continuar"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isGenerating}
              onClick={() => void handleSubmit(onGenerate)()}
            >
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
