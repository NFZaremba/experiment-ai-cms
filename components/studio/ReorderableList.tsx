"use client";

import React from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { recordBridgeEdit } from "@/components/studio/EditModeBridge";

export type HandleProps = {
  ref: (el: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
};

export type ReorderableListProps<T extends { id: string }> = {
  page: string;
  /** content path of the collection, e.g. "team.members" */
  path: string;
  items: T[];
  className?: string;
  /** render an item; `handle` must be spread onto the drag-handle element */
  renderItem: (item: T, handle: HandleProps) => React.ReactNode;
};

function SortableItem<T extends { id: string }>({
  item,
  renderItem,
}: {
  item: T;
  renderItem: ReorderableListProps<T>["renderItem"];
}) {
  const { setNodeRef, transform, transition, setActivatorNodeRef, attributes, listeners, isDragging } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, { ref: setActivatorNodeRef, attributes: attributes as unknown as Record<string, unknown>, listeners })}
    </div>
  );
}

/** Edit-mode drag-to-reorder for a collection. Reorders write to the draft
 *  store (live) + notify the shell for publish via recordBridgeEdit. */
export function ReorderableList<T extends { id: string }>({
  page,
  path,
  items,
  className,
  renderItem,
}: ReorderableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    recordBridgeEdit(path, next, "order");
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
