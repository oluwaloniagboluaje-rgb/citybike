import QuoteCheckoutForm from "@/components/quote/QuoteCheckoutForm";

type QuoteSearchParams = {
  route?: string | string[];
  shippingSpeed?: string | string[];
  approxWeight?: string | string[];
  destinationCountry?: string | string[];
};

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<QuoteSearchParams>;
}) {
  const params = await searchParams;

  return (
    <QuoteCheckoutForm
      route={firstParam(params.route)}
      shippingSpeed={firstParam(params.shippingSpeed)}
      weightKg={firstParam(params.approxWeight)}
      destinationCountry={firstParam(params.destinationCountry)}
    />
  );
}
