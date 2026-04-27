import type { ValtioYjsCoordinator } from "../core/coordinator";
import { isYArray, isYMap, isYSharedContainer } from "../core/guards";
import type { YSharedContainer } from "../core/yjs-types";

export function cleanupControllerTreeForYType(
  coordinator: ValtioYjsCoordinator,
  yType: YSharedContainer,
  visited = new WeakSet<object>(),
): void {
  if (visited.has(yType)) {
    return;
  }
  visited.add(yType);

  if (isYMap(yType)) {
    for (const [, child] of yType.entries()) {
      if (isYSharedContainer(child)) {
        cleanupControllerTreeForYType(coordinator, child, visited);
      }
    }
  } else if (isYArray(yType)) {
    for (const child of yType.toArray()) {
      if (isYSharedContainer(child)) {
        cleanupControllerTreeForYType(coordinator, child, visited);
      }
    }
  }

  const proxy = coordinator.state.yTypeToValtioProxy.get(yType);
  if (proxy && typeof proxy === "object") {
    coordinator.state.valtioProxyToYType.delete(proxy);
  }
  coordinator.unregisterSubscription(yType);
  coordinator.state.yTypeToValtioProxy.delete(yType);
}

export function cleanupNestedValue(
  coordinator: ValtioYjsCoordinator,
  value: unknown,
  visitedValues = new WeakSet<object>(),
  visitedYTypes = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  const objectValue = value as object;
  if (visitedValues.has(objectValue)) {
    return;
  }
  visitedValues.add(objectValue);

  const yType = coordinator.state.valtioProxyToYType.get(objectValue);
  if (yType) {
    cleanupControllerTreeForYType(coordinator, yType, visitedYTypes);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      cleanupNestedValue(coordinator, item, visitedValues, visitedYTypes);
    }
    return;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    cleanupNestedValue(coordinator, child, visitedValues, visitedYTypes);
  }
}
