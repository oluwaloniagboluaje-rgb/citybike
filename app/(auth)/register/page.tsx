import RegisterForm from "./RegisterForm";
import { getSafeNextPath } from "@/libs/safeRedirect";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedNext = Array.isArray(params.next)
    ? params.next[0] || null
    : params.next || null;

  return <RegisterForm nextPath={getSafeNextPath(requestedNext)} />;
}
