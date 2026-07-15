import { supabase } from "@/libs/supabaseClient";

export async function uploadPaymentProof(orderId: string, file: File) {
  const fileExt = file.name.split(".").pop();
  const filePath = `${orderId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(filePath, 60);

  if (signedError || !signedData?.signedUrl) {
    const publicUrlResult = await supabase.storage
      .from("payment-proofs")
      .getPublicUrl(filePath);

    if (!publicUrlResult.data?.publicUrl) {
      throw new Error(
        signedError?.message ||
          "Could not generate a proof URL"
      );
    }

    return publicUrlResult.data.publicUrl;
  }

  return signedData.signedUrl;
}