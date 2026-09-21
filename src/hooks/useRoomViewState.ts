import { useSearchParams } from "react-router-dom";

export type ViewMode = "plan" | "list";

// Выбранная комната и вид (план/список) живут в query-параметрах, а не в
// локальном стейте - чтобы при переключении вида справа оставалась та же
// комната, и чтобы можно было открыть ссылку сразу в нужном состоянии
// (?view=list&room=5).
export function useRoomViewState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: ViewMode =
    searchParams.get("view") === "list" ? "list" : "plan";
  const openRoomN = (() => {
    const raw = searchParams.get("room");
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  })();

  const setRoom = (roomN: number | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (roomN === null) next.delete("room");
        else next.set("room", String(roomN));
        return next;
      },
      { replace: true },
    );
  };

  const setView = (mode: ViewMode) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (mode === "plan") next.delete("view");
        else next.set("view", mode);
        return next;
      },
      { replace: true },
    );
  };

  // Тап по хотспоту на плане - повторный тап по уже открытой комнате
  // закрывает панель. У выбора из RoomMenu такого поведения нет (это
  // список, не переключатель), там используется setRoom напрямую.
  const openRoom = (roomN: number) => {
    setRoom(openRoomN === roomN ? null : roomN);
  };

  const closeRoom = () => setRoom(null);

  return { viewMode, openRoomN, setView, setRoom, openRoom, closeRoom };
}
