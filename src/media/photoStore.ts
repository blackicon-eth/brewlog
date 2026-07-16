import { File, Directory, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync } from "expo-image-picker";
import { base64ToBytes } from "../lib/base64";
import { makeId } from "../lib/ids";

// One resized photo saved to app storage, tagged with the id it was filed under.
export type SavedPhoto = { id: string; uri: string };

export const MAX_PHOTOS = 3;
const DIR = "coffee-photos";

function photoDir(): Directory {
  const dir = new Directory(Paths.document, DIR);
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

// Downscale a source image to <=1024px wide at JPEG q0.6 and persist it under a fresh id.
async function processAndSave(srcUri: string): Promise<SavedPhoto> {
  const id = makeId();
  const ref = await ImageManipulator.manipulate(srcUri).resize({ width: 1024 }).renderAsync();
  const result = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });

  const dest = new File(photoDir(), `${id}.jpg`);
  if (dest.exists) dest.delete();
  new File(result.uri).copy(dest);
  // Reclaim the manipulator's cache-dir temp output now that it's copied into place.
  try {
    new File(result.uri).delete();
  } catch {
    // best-effort — the OS reclaims the cache dir anyway
  }
  return { id, uri: dest.uri };
}

// Open the camera to take a photo, then resize + persist it. Returns the saved photo, `null`
// if the user backed out, or "denied" if camera permission was refused (caller informs).
export async function takePhoto(): Promise<SavedPhoto | "denied" | null> {
  const perm = await requestCameraPermissionsAsync();
  if (!perm.granted) return "denied";
  const res = await launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  if (res.canceled || !res.assets?.length) return null;
  return processAndSave(res.assets[0].uri);
}

// Open the system gallery for multi-select (up to `limit`), then resize + persist each.
// Returns the saved photos in pick order (empty if dismissed). No storage permission is
// needed — this uses the Android system photo picker.
export async function pickFromGallery(limit: number): Promise<SavedPhoto[]> {
  if (limit <= 0) return [];
  const res = await launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  if (res.canceled || !res.assets?.length) return [];
  const out: SavedPhoto[] = [];
  for (const a of res.assets.slice(0, limit)) out.push(await processAndSave(a.uri));
  return out;
}

export function deletePhotoFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // best-effort — a missing file is fine
  }
}

export async function readPhotoBase64(uri: string): Promise<string> {
  return await new File(uri).base64();
}

// Write an imported photo's base64 payload to a real file under photoId; returns its uri.
export async function writePhotoFromBase64(photoId: string, base64: string): Promise<string> {
  const dest = new File(photoDir(), `${photoId}.jpg`);
  if (dest.exists) dest.delete();
  dest.create();
  dest.write(base64ToBytes(base64));
  return dest.uri;
}

