import { supabase } from "@/libs/supabaseClient";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadMarketingImage(file: File): Promise<string> {
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error("Choose a JPG, PNG, GIF or WebP image.");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("The image must be 5 MB or smaller.");
  }

  const filePath = `marketing-campaigns/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("package-photos")
    .upload(filePath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`Could not upload the image: ${error.message}`);
  }

  const { data } = supabase.storage.from("package-photos").getPublicUrl(filePath);
  if (!data.publicUrl) {
    throw new Error("The image uploaded, but its public URL could not be created.");
  }
  return data.publicUrl;
}
