import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { FilterState, SortState, CensusStats } from "@/types";

interface WorkerResult {
  indices: number[];
  stats: CensusStats;
}

export function usePatientWorker() {
  const workerRef = useRef<Worker | null>(null);
  const setFilteredIndices = useAppStore((s) => s.setFilteredIndices);
  const patients = useAppStore((s) => s.patients);
  const patientsRef = useRef(patients);
  patientsRef.current = patients;

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/patientWorker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (
      e: MessageEvent<{ type: string; payload: unknown }>,
    ) => {
      if (e.data.type === "RESULT") {
        const { indices } = e.data.payload as WorkerResult;
        setFilteredIndices(indices);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [setFilteredIndices]);

  useEffect(() => {
    if (!workerRef.current || patients.length === 0) return;
    workerRef.current.postMessage({ type: "LOAD", payload: patients });
  }, [patients]);

  const filterAndSort = useCallback((filter: FilterState, sort: SortState) => {
    workerRef.current?.postMessage({
      type: "FILTER_AND_SORT",
      payload: { filter, sort },
    });
  }, []);

  const computeHandoffList = useCallback((cb: (indices: number[]) => void) => {
    if (!workerRef.current) return;
    const handler = (
      e: MessageEvent<{ type: string; payload: { indices: number[] } }>,
    ) => {
      if (e.data.type === "HANDOFF_LIST") {
        cb(e.data.payload.indices);
        workerRef.current?.removeEventListener("message", handler);
      }
    };
    workerRef.current.addEventListener("message", handler);
    workerRef.current.postMessage({ type: "COMPUTE_HANDOFF_LIST" });
  }, []);

  return { filterAndSort, computeHandoffList };
}
