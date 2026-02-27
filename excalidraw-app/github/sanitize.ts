/**
 * Sanitizes a user-provided diagram name to a valid filesystem path.
 * Allowed characters: [a-zA-Z0-9\-_./]
 * Rules:
 * - Replace disallowed characters with "-"
 * - Strip leading/trailing dots and slashes
 * - Append ".excalidraw" if not already present
 * FR-011
 */
export const sanitizeFilename = (input: string): string => {
  let name = input
    .replace(/[^a-zA-Z0-9\-_./]/g, "-") // replace disallowed chars
    .replace(/^[./]+/, "")               // strip leading dots/slashes
    .replace(/[./]+$/, "")              // strip trailing dots/slashes
    .replace(/-{2,}/g, "-");            // collapse multiple dashes

  if (!name) {
    name = "untitled";
  }

  if (!name.endsWith(".excalidraw")) {
    name = `${name}.excalidraw`;
  }

  return name;
};
