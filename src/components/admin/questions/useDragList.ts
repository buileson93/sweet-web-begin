import { useState } from "react";

/**
 * Kéo-thả sắp xếp lại danh sách bằng HTML5 drag & drop (không cần thư viện ngoài).
 * Trả về các handler gắn thẳng vào từng dòng và chỉ số dòng đang được thả tới.
 */
export function useDragList(move: (from: number, to: number) => void) {
  const [fromIndex, setFromIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  return {
    overIndex,
    onDragStart: (i: number) => setFromIndex(i),
    onDragOver: (e: React.DragEvent, i: number) => {
      e.preventDefault();
      if (overIndex !== i) setOverIndex(i);
    },
    onDrop: (i: number) => {
      if (fromIndex !== null && fromIndex !== i) move(fromIndex, i);
      setFromIndex(null);
      setOverIndex(null);
    },
    onDragEnd: () => {
      setFromIndex(null);
      setOverIndex(null);
    },
  };
}
