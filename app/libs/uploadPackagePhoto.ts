import { supabase } from "@/libs/supabaseClient";

export type PhotoStage = "pickup" | "delivery";

export async function uploadPackagePhoto(
  orderId: string,
  stage: PhotoStage,
  file: File
) {
  const fileExt = file.name.split(".").pop();
  const filePath = `${orderId}/${stage}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("package-photos")
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage
    .from("package-photos")
    .getPublicUrl(filePath);

  return data.publicUrl;
}