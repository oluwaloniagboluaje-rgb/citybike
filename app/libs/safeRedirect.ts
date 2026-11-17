export function getSafeNextPath(nextPath: string | null): string | null {
  if (
    !nextPath ||
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.includes("\\")
  ) {
    return null;
  }

  return nextPath;
}
