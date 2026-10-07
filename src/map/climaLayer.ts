import type { IControl, Map as MLMap, GeoJSONSource, ExpressionSpecification } from "maplibre-gl";
import "./clima.css";

/**
 * Capa de clima para wawhere (Open-Meteo), como control nativo de MapLibre.
 *
 * Uso (dentro de map.on('load'), después de agregar las demás capas):
 *   map.addControl(new ClimaControl({ beforeId: RESUMEN_LAYERS[0] }), "bottom-left");
 */

type Modo = "temperatura" | "lluvia";

interface Opciones {
    /** id de la capa de reportes por colonia; el clima se dibuja debajo de ella */
    beforeId?: string;
    /** prefijo de la API; vacío = mismo dominio (o el proxy de Vite en desarrollo) */
    apiBase?: string;
    /** cada cuánto volver a pedir datos al backend */
    refrescoMs?: number;
}

const SOURCE_ID = "clima";
const FILL_ID = "clima-fill";
const LABEL_ID = "clima-label";
const CAPAS = [FILL_ID, LABEL_ID];
const REINTENTO_MS = 30_000;

const MODOS: Record<
    Modo,
    { nota: string; color: ExpressionSpecification; etiqueta: ExpressionSpecification; leyenda: [string, string][] }
> = {
    temperatura: {
        nota: "Temperatura actual",
        color: [
            "interpolate", ["linear"], ["number", ["get", "temperatura"], 20],
            10, "#3b6fb6",
            18, "#7fb8a4",
            24, "#f2d36b",
            30, "#ec8a3c",
            36, "#c8323a",
        ],
        etiqueta: ["concat", ["to-string", ["round", ["number", ["get", "temperatura"], 0]]], "°"],
        leyenda: [["10°", "#3b6fb6"], ["18°", "#7fb8a4"], ["24°", "#f2d36b"], ["30°", "#ec8a3c"], ["36°", "#c8323a"]],
    },
    lluvia: {
        nota: "Probabilidad de lluvia, próximas 12 h",
        color: [
            "interpolate", ["linear"], ["number", ["get", "prob_lluvia_12h"], 0],
            0, "rgba(40,110,200,0)",
            30, "#9cc6ee",
            60, "#4a8fd6",
            90, "#1d4f9c",
        ],
        etiqueta: ["concat", ["to-string", ["round", ["number", ["get", "prob_lluvia_12h"], 0]]], "%"],
        leyenda: [["0%", "#e8eef5"], ["30%", "#9cc6ee"], ["60%", "#4a8fd6"], ["90%", "#1d4f9c"]],
    },
};

export class ClimaControl implements IControl {
    private map?: MLMap;
    private contenedor!: HTMLDivElement;
    private leyenda!: HTMLDivElement;
    private aviso!: HTMLParagraphElement;
    private botones: HTMLButtonElement[] = [];
    private modo: Modo | null = null;
    private intervalo?: number;
    private reintento?: number;
    private readonly opts: Required<Opciones>;

    constructor(opciones: Opciones = {}) {
        this.opts = {
            beforeId: opciones.beforeId ?? "",
            apiBase: opciones.apiBase ?? "",
            refrescoMs: opciones.refrescoMs ?? 15 * 60 * 1000,
        };
    }

    onAdd(map: MLMap): HTMLElement {
        this.map = map;
        this.contenedor = this.construirUI();

        const montar = () => {
            this.agregarCapas();
            if (this.modo) this.cambiarModo(this.modo);
            void this.cargar();
            this.intervalo = window.setInterval(() => void this.cargar(), this.opts.refrescoMs);
        };

        // isStyleLoaded() da false mientras otras fuentes cargan, aunque 'load' ya pasó;
        // por eso se intenta montar directo y solo se espera 'load' si de verdad falla.
        try {
            montar();
        } catch {
            map.once("load", montar);
        }
        return this.contenedor;
    }

    onRemove(): void {
        window.clearInterval(this.intervalo);
        window.clearTimeout(this.reintento);
        for (const id of CAPAS) if (this.map?.getLayer(id)) this.map.removeLayer(id);
        if (this.map?.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
        this.contenedor.remove();
        this.map = undefined;
    }

    // --- Mapa ------------------------------------------------------------------

    private agregarCapas(): void {
        const map = this.map!;
        const antes = this.opts.beforeId && map.getLayer(this.opts.beforeId) ? this.opts.beforeId : undefined;

        if (!map.getSource(SOURCE_ID)) {
            map.addSource(SOURCE_ID, {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
                attribution: '<a href="https://open-meteo.com/" target="_blank" rel="noopener">Clima: Open-Meteo.com</a>',
            });
        }

        // Relleno de color por celda
        if (!map.getLayer(FILL_ID)) {
            map.addLayer(
                {
                    id: FILL_ID,
                    type: "fill",
                    source: SOURCE_ID,
                    layout: { visibility: "none" },
                    paint: {
                        "fill-color": MODOS.temperatura.color,
                        "fill-opacity": 0.3,
                        "fill-outline-color": "rgba(22,50,79,0.15)",
                    },
                },
                antes,
            );
        }

        // Valor escrito en el centro de cada celda
        if (!map.getLayer(LABEL_ID)) {
            map.addLayer(
                {
                    id: LABEL_ID,
                    type: "symbol",
                    source: SOURCE_ID,
                    layout: {
                        visibility: "none",
                        "text-field": MODOS.temperatura.etiqueta,
                        "text-size": 13,
                        "text-allow-overlap": false,
                    },
                    paint: { "text-color": "#16324f", "text-halo-color": "#fff", "text-halo-width": 1.5 },
                },
                antes,
            );
        }
    }

    private async cargar(): Promise<void> {
        window.clearTimeout(this.reintento);
        try {
            const res = await fetch(`${this.opts.apiBase}/api/clima/cuadricula`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            (this.map?.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);
            this.aviso.hidden = true;
        } catch (e) {
            console.warn("[clima] no se pudo cargar:", e);
            this.aviso.textContent = "El clima todavía no está disponible. Reintentando…";
            this.aviso.hidden = this.modo === null;
            this.reintento = window.setTimeout(() => void this.cargar(), REINTENTO_MS);
        }
    }

    private cambiarModo(modo: Modo | null): void {
        this.modo = modo;
        const map = this.map;
        if (map?.getLayer(FILL_ID) && map.getLayer(LABEL_ID)) {
            if (modo) {
                map.setPaintProperty(FILL_ID, "fill-color", MODOS[modo].color);
                map.setLayoutProperty(LABEL_ID, "text-field", MODOS[modo].etiqueta);
            }
            for (const id of CAPAS) map.setLayoutProperty(id, "visibility", modo ? "visible" : "none");
        }
        this.botones.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === (modo ?? ""))));
        this.pintarLeyenda();
        if (!modo) this.aviso.hidden = true;
    }

    // --- UI ----------------------------------------------------------------------

    private construirUI(): HTMLDivElement {
        const panel = document.createElement("div");
        panel.className = "maplibregl-ctrl clima-ctrl";
        panel.setAttribute("role", "group");
        panel.setAttribute("aria-label", "Capa de clima");

        const fila = document.createElement("div");
        fila.className = "clima-botones";
        const opciones: [Modo | null, string][] = [[null, "Sin clima"], ["temperatura", "Temperatura"], ["lluvia", "Lluvia"]];
        for (const [modo, texto] of opciones) {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = texto;
            b.dataset.modo = modo ?? "";
            b.setAttribute("aria-pressed", String(modo === null));
            b.addEventListener("click", () => this.cambiarModo(modo));
            this.botones.push(b);
            fila.appendChild(b);
        }

        this.leyenda = document.createElement("div");
        this.leyenda.className = "clima-leyenda";
        this.leyenda.hidden = true;

        this.aviso = document.createElement("p");
        this.aviso.className = "clima-aviso";
        this.aviso.hidden = true;

        panel.append(fila, this.leyenda, this.aviso);
        return panel;
    }

    private pintarLeyenda(): void {
        if (!this.modo) {
            this.leyenda.hidden = true;
            return;
        }
        const { nota, leyenda } = MODOS[this.modo];
        this.leyenda.replaceChildren();
        const n = document.createElement("span");
        n.className = "clima-nota";
        n.textContent = nota;
        const escala = document.createElement("div");
        escala.className = "clima-escala";
        for (const [txt, color] of leyenda) {
            const paso = document.createElement("span");
            const muestra = document.createElement("i");
            muestra.style.background = color;
            paso.append(muestra, txt);
            escala.appendChild(paso);
        }
        this.leyenda.append(n, escala);
        this.leyenda.hidden = false;
    }
}