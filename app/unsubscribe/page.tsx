import UnsubscribeForm from "@/components/marketing/UnsubscribeForm";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token)
    ? params.token[0] || ""
    : params.token || "";
  return <UnsubscribeForm token={token} />;
}
