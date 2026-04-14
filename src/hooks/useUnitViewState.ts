import { useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { FilterState, SortState } from "@/types";

interface SavedView {
  name: string;
  unitId: string;
  filter: FilterState;
  sort: SortState;
  savedAt: string;
}

interface SerializedState {
  unitId: string;
  filter: FilterState;
  sort: SortState;
  zoom: number;
  layout?: string;
}

const DB_NAME = "pulseops";
const DB_VERSION = 1;
const STORE_NAME = "saved_views";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "name" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function encodeState(state: SerializedState): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(state)));
  } catch {
    return "";
  }
}

function decodeState(encoded: string): SerializedState | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded))) as SerializedState;
  } catch {
    return null;
  }
}

const DEFAULT_FILTER: FilterState = {
  status: [],
  acuity_min: 1,
  acuity_max: 5,
  unit_ids: [],
  search: "",
  fall_risk: [],
  isolation_type: [],
  code_status: [],
  attending_provider_id: "",
  los_threshold_hours: null,
  flags: [],
};

const DEFAULT_SORT: SortState = { column: "acuity", direction: "desc" };

export function useUnitViewState() {
  const selectedUnitId = useAppStore((s) => s.selectedUnitId);
  const filterState = useAppStore((s) => s.filterState);
  const sortState = useAppStore((s) => s.sortState);
  const setSelectedUnit = useAppStore((s) => s.setSelectedUnit);
  const setFilterState = useAppStore((s) => s.setFilterState);
  const setSortState = useAppStore((s) => s.setSortState);
  const zoomRef = useRef(1);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("v");
    if (!encoded) return;
    const decoded = decodeState(encoded);
    if (!decoded) return;
    isRestoringRef.current = true;
    if (decoded.unitId) setSelectedUnit(decoded.unitId);
    if (decoded.filter) setFilterState(decoded.filter);
    if (decoded.sort) setSortState(decoded.sort);
    if (decoded.zoom) zoomRef.current = decoded.zoom;
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 100);
  }, [setSelectedUnit, setFilterState, setSortState]);

  useEffect(() => {
    if (isRestoringRef.current || !selectedUnitId) return;
    const state: SerializedState = {
      unitId: selectedUnitId,
      filter: filterState,
      sort: sortState,
      zoom: zoomRef.current,
    };
    const encoded = encodeState(state);
    if (!encoded) return;
    const url = new URL(window.location.href);
    url.searchParams.set("v", encoded);
    window.history.replaceState(null, "", url.toString());
  }, [selectedUnitId, filterState, sortState]);

  const saveView = useCallback(
    async (name: string) => {
      if (!selectedUnitId) return;
      const view: SavedView = {
        name,
        unitId: selectedUnitId,
        filter: filterState,
        sort: sortState,
        savedAt: new Date().toISOString(),
      };
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(view);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    [selectedUnitId, filterState, sortState],
  );

  const loadView = useCallback(
    async (name: string) => {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(name);
      const view = await new Promise<SavedView | undefined>((res, rej) => {
        req.onsuccess = () => res(req.result as SavedView | undefined);
        req.onerror = () => rej(req.error);
      });
      db.close();
      if (!view) return;
      setSelectedUnit(view.unitId);
      setFilterState(view.filter);
      setSortState(view.sort);
    },
    [setSelectedUnit, setFilterState, setSortState],
  );

  const listViews = useCallback(async (): Promise<SavedView[]> => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    const views = await new Promise<SavedView[]>((res, rej) => {
      req.onsuccess = () => res(req.result as SavedView[]);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return views;
  }, []);

  const deleteView = useCallback(async (name: string) => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(name);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, []);

  const resetFilters = useCallback(() => {
    setFilterState(DEFAULT_FILTER);
    setSortState(DEFAULT_SORT);
  }, [setFilterState, setSortState]);

  const setZoom = useCallback(
    (zoom: number) => {
      zoomRef.current = zoom;
      if (!selectedUnitId) return;
      const state: SerializedState = {
        unitId: selectedUnitId,
        filter: filterState,
        sort: sortState,
        zoom,
      };
      const encoded = encodeState(state);
      if (!encoded) return;
      const url = new URL(window.location.href);
      url.searchParams.set("v", encoded);
      window.history.replaceState(null, "", url.toString());
    },
    [selectedUnitId, filterState, sortState],
  );

  return {
    saveView,
    loadView,
    listViews,
    deleteView,
    resetFilters,
    setZoom,
    zoom: zoomRef.current,
    SerializedState: null as unknown as SerializedState,
  };
}
