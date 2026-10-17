import { transform, vec3 } from "@gabarito/geometry";
import { removalClosure } from "./document";
import type { DocumentState, Entity, EntityId, Settings, Vec3 } from "./types";

/**
 * Every mutation of the document is one of these. They are plain data so they can be
 * logged, replayed, and reversed (decision 0006).
 */
export type Command =
  | { type: "addEntities"; entities: Entity[] }
  | { type: "removeEntities"; ids: EntityId[] }
  | { type: "translate"; pointIds: EntityId[]; delta: Vec3 }
  | { type: "rotate"; pointIds: EntityId[]; origin: Vec3; axis: Vec3; angle: number }
  | { type: "setSelection"; ids: EntityId[] }
  | { type: "setSettings"; patch: Partial<Settings> };

/** What is needed to undo one command. Produced by `applyCommand`, never guessed. */
export type Inverse =
  | { type: "none" }
  | { type: "rawRemove"; ids: EntityId[] }
  | { type: "rawAdd"; entities: Entity[] }
  | { type: "translate"; pointIds: EntityId[]; delta: Vec3 }
  | { type: "rotate"; pointIds: EntityId[]; origin: Vec3; axis: Vec3; angle: number }
  | { type: "setSelection"; ids: EntityId[] }
  | { type: "setSettings"; patch: Partial<Settings> };

const NONE: Inverse = { type: "none" };

function rawAdd(doc: DocumentState, entities: Entity[]): void {
  for (const entity of entities) doc.entities[entity.id] = entity;
}

function rawRemove(doc: DocumentState, ids: EntityId[]): void {
  for (const id of ids) delete doc.entities[id];
  const removed = new Set(ids);
  doc.selection = doc.selection.filter((id) => !removed.has(id));
}

function translatePoints(doc: DocumentState, pointIds: EntityId[], delta: Vec3): void {
  for (const id of pointIds) {
    const entity = doc.entities[id];
    if (entity && entity.kind === "point") {
      entity.position = vec3.add(entity.position, delta);
    }
  }
}

function rotatePoints(
  doc: DocumentState,
  pointIds: EntityId[],
  origin: Vec3,
  axis: Vec3,
  angle: number,
): void {
  for (const id of pointIds) {
    const entity = doc.entities[id];
    if (entity && entity.kind === "point") {
      entity.position = transform.rotatePointAroundAxis(entity.position, origin, axis, angle);
    }
  }
}

export function applyCommand(doc: DocumentState, command: Command): Inverse {
  switch (command.type) {
    case "addEntities": {
      const added = command.entities.filter((entity) => doc.entities[entity.id] === undefined);
      if (added.length === 0) return NONE;
      rawAdd(doc, added);
      return { type: "rawRemove", ids: added.map((entity) => entity.id) };
    }

    case "removeEntities": {
      const closure = removalClosure(doc, command.ids);
      if (closure.length === 0) return NONE;
      const captured = closure
        .map((id) => doc.entities[id])
        .filter((entity): entity is Entity => entity !== undefined);
      rawRemove(doc, closure);
      return { type: "rawAdd", entities: captured };
    }

    case "translate": {
      if (command.pointIds.length === 0 || vec3.isZero(command.delta)) return NONE;
      const unique = [...new Set(command.pointIds)];
      translatePoints(doc, unique, command.delta);
      return { type: "translate", pointIds: unique, delta: vec3.neg(command.delta) };
    }

    case "rotate": {
      if (command.pointIds.length === 0 || Math.abs(command.angle) < 1e-12) return NONE;
      const unique = [...new Set(command.pointIds)];
      rotatePoints(doc, unique, command.origin, command.axis, command.angle);
      return {
        type: "rotate",
        pointIds: unique,
        origin: command.origin,
        axis: command.axis,
        angle: -command.angle,
      };
    }

    case "setSelection": {
      const previous = doc.selection;
      const next = [...new Set(command.ids)].filter((id) => doc.entities[id] !== undefined);
      if (previous.length === next.length && previous.every((id, index) => id === next[index])) {
        return NONE;
      }
      doc.selection = next;
      return { type: "setSelection", ids: previous };
    }

    case "setSettings": {
      const previous: Partial<Settings> = {};
      for (const key of Object.keys(command.patch) as Array<keyof Settings>) {
        const value = command.patch[key];
        if (value === undefined) continue;
        previous[key] = doc.settings[key] as never;
      }
      Object.assign(doc.settings, command.patch);
      return { type: "setSettings", patch: previous };
    }
  }
}

export function revertCommand(doc: DocumentState, inverse: Inverse): void {
  switch (inverse.type) {
    case "none":
      return;
    case "rawRemove":
      rawRemove(doc, inverse.ids);
      return;
    case "rawAdd":
      rawAdd(doc, inverse.entities);
      return;
    case "translate":
      translatePoints(doc, inverse.pointIds, inverse.delta);
      return;
    case "rotate":
      rotatePoints(doc, inverse.pointIds, inverse.origin, inverse.axis, inverse.angle);
      return;
    case "setSelection":
      doc.selection = [...inverse.ids];
      return;
    case "setSettings":
      Object.assign(doc.settings, inverse.patch);
      return;
  }
}

export function isNoop(inverse: Inverse): boolean {
  return inverse.type === "none";
}
