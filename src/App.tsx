import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { UnitCommandView } from "@/features/UnitCommandView";

export default function App() {
  const setUnits = useAppStore((s) => s.setUnits);
  const setSelectedUnit = useAppStore((s) => s.setSelectedUnit);
  const selectedUnitId = useAppStore((s) => s.selectedUnitId);

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: api.getUnits,
  });

  useEffect(() => {
    if (units) {
      setUnits(units);
      if (!selectedUnitId && units.length > 0) {
        setSelectedUnit(units[0].id);
      }
    }
  }, [units, setUnits, setSelectedUnit, selectedUnitId]);

  return <UnitCommandView />;
}
