"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { renderMarketingEmail } from "@/libs/marketingEmail";
import { uploadMarketingImage } from "@/libs/uploadMarketingImage";
import ConfirmModal from "@/components/ui/ConfirmModal";
import StatusModal, {
  CLOSED_MODAL,
  type StatusModalState,
} from "@/components/ui/StatusModal";

type AudienceType =
  | "all_subscribers"
  | "selected_customers"
  | "locations"
  | "previous_customers";

interface CampaignAudience {
  type: AudienceType;
  customerIds: string[];
  countries: string[];
  cities: string[];
}

interface CampaignContent {
  name: string;
  subject: string;
  message: string;
  imageUrl: string;
  imageLink: string;
  ctaLabel: string;
  ctaUrl: string;
  discountCode: string;
}

interface Campaign extends CampaignContent {
  _id: string;
  status: string;
  audienceType: AudienceType;
  customerIds: string[];
  countries: string[];
  cities: string[];
  scheduledAt?: string;
  sentAt?: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  bouncedCount: number;
  failedCount: number;
  skippedCount: number;
  openedCount: number;
  clickedCount: number;
  createdAt: string;
  lastError?: string;
}

interface CustomerOption {
  _id: string;
  name: string;
  email: string;
}

interface AudienceData {
  customers: CustomerOption[];
  total: number;
  page: number;
  pageSize: number;
  customerCount: number;
  countries: string[];
  cities: string[];
}

interface CampaignStatistics {
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  opened: number;
  clicked: number;
}

interface CampaignHistoryResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  pageSize: number;
  statistics: CampaignStatistics;
}

const EMPTY_CONTENT: CampaignContent = {
  name: "",
  subject: "",
  message: "",
  imageUrl: "",
  imageLink: "",
  ctaLabel: "",
  ctaUrl: "",
  discountCode: "",
};

const EMPTY_AUDIENCE: CampaignAudience = {
  type: "all_subscribers",
  customerIds: [],
  countries: [],
  cities: [],
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "The request could not be completed.");
  }
  return data as T;
}

function campaignToEditor(campaign: Campaign) {
  return {
    content: {
      name: campaign.name,
      subject: campaign.subject,
      message: campaign.message,
      imageUrl: campaign.imageUrl || "",
      imageLink: campaign.imageLink || "",
      ctaLabel: campaign.ctaLabel || "",
      ctaUrl: campaign.ctaUrl || "",
      discountCode: campaign.discountCode || "",
    },
    audience: {
      type: campaign.audienceType,
      customerIds: (campaign.customerIds || []).map(String),
      countries: campaign.countries || [],
      cities: campaign.cities || [],
    },
  };
}

export default function CampaignsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [statistics, setStatistics] = useState<CampaignStatistics>({
    sent: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
    opened: 0,
    clicked: 0,
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [content, setContent] = useState<CampaignContent>(EMPTY_CONTENT);
  const [audience, setAudience] = useState<CampaignAudience>(EMPTY_AUDIENCE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audienceData, setAudienceData] = useState<AudienceData | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [statusModal, setStatusModal] =
    useState<StatusModalState>(CLOSED_MODAL);
  const [confirmation, setConfirmation] = useState<
    { type: "send" } | { type: "delete"; campaign: Campaign } | null
  >(null);

  function showStatus(
    variant: "success" | "error",
    title: string,
    message: string
  ) {
    setStatusModal({ open: true, variant, title, message });
  }

  const refreshCampaigns = useCallback(async (page = historyPage) => {
    const data = await parseResponse<CampaignHistoryResponse>(
      await fetch(`/api/marketing/campaigns?page=${page}`)
    );
    setCampaigns(data.campaigns);
    setStatistics(data.statistics);
    setHistoryTotal(data.total);
    setHistoryPage(data.page);
  }, [historyPage]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/login");
      return;
    }
    if (loading || !user || user.role !== "admin") return;
    void fetch(`/api/marketing/campaigns?page=${historyPage}`)
      .then((response) => parseResponse<CampaignHistoryResponse>(response))
      .then((data) => {
        setCampaigns(data.campaigns);
        setStatistics(data.statistics);
        setHistoryTotal(data.total);
        setHistoryPage(data.page);
      })
      .catch((loadError: unknown) => {
        showStatus(
          "error",
          "Could not load campaign history",
          loadError instanceof Error
            ? loadError.message
            : "Could not load campaign history."
        );
      })
      .finally(() => setLoadingCampaigns(false));
  }, [historyPage, loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "admin" || !showEditor) return;
    let active = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        page: String(customerPage),
        search: customerSearch,
        previousCustomers: String(audience.type === "previous_customers"),
      });
      audience.countries.forEach((country) => params.append("country", country));
      audience.cities.forEach((city) => params.append("city", city));
      void fetch(`/api/marketing/audience?${params}`)
        .then((response) => parseResponse<AudienceData>(response))
        .then((data) => {
          if (active) setAudienceData(data);
        })
        .catch((loadError: unknown) => {
          if (active) {
            showStatus(
              "error",
              "Could not load customer recipients",
              loadError instanceof Error
                ? loadError.message
                : "Could not load customer recipients."
            );
          }
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    audience.cities,
    audience.countries,
    audience.type,
    customerPage,
    customerSearch,
    showEditor,
    user,
  ]);

  const audienceSize = useMemo(() => {
    if (audience.type === "all_subscribers") {
      return audienceData?.customerCount ?? 0;
    }
    if (audience.type === "selected_customers") {
      return audience.customerIds.length;
    }
    return audienceData?.total ?? 0;
  }, [audience, audienceData]);

  function startNewCampaign() {
    setEditingId(null);
    setContent(EMPTY_CONTENT);
    setAudience(EMPTY_AUDIENCE);
    setScheduleAt("");
    setShowEditor(true);
  }

  async function editCampaign(id: string) {
    setBusy(true);
    try {
      const data = await parseResponse<{ campaign: Campaign }>(
        await fetch(`/api/marketing/campaigns/${id}`)
      );
      const editor = campaignToEditor(data.campaign);
      setEditingId(id);
      setContent(editor.content);
      setAudience(editor.audience);
      setScheduleAt(
        data.campaign.scheduledAt
          ? new Date(data.campaign.scheduledAt).toISOString().slice(0, 16)
          : ""
      );
      setShowEditor(true);
    } catch (loadError) {
      showStatus(
        "error",
        "Could not open campaign",
        loadError instanceof Error
          ? loadError.message
          : "Could not open campaign."
      );
    } finally {
      setBusy(false);
    }
  }

  function getPayload() {
    return {
      ...content,
      audience,
    };
  }

  async function saveDraft(): Promise<Campaign> {
    if (!content.name.trim() || !content.subject.trim() || !content.message.trim()) {
      throw new Error("Campaign name, subject and message are required.");
    }
    if (
      audience.type === "selected_customers" &&
      audience.customerIds.length === 0
    ) {
      throw new Error("Select at least one customer.");
    }
    if (
      audience.type === "locations" &&
      audience.countries.length === 0 &&
      audience.cities.length === 0
    ) {
      throw new Error("Choose at least one country or city.");
    }

    const response = await fetch(
      editingId ? `/api/marketing/campaigns/${editingId}` : "/api/marketing/campaigns",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getPayload()),
      }
    );
    const data = await parseResponse<{ campaign: Campaign }>(response);
    setEditingId(data.campaign._id);
    return data.campaign;
  }

  async function handleSaveDraft() {
    setBusy(true);
    try {
      const campaign = await saveDraft();
      showStatus("success", "Draft saved", `Draft “${campaign.name}” was saved.`);
      await refreshCampaigns().catch((historyError: unknown) => {
        showStatus(
          "error",
          "Draft saved, but history did not refresh",
          historyError instanceof Error
            ? historyError.message
            : "Reload the page to see the updated campaign history."
        );
      });
    } catch (saveError) {
      showStatus(
        "error",
        "Could not save draft",
        saveError instanceof Error ? saveError.message : "Could not save draft."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleTestEmail() {
    setBusy(true);
    try {
      const campaign = await saveDraft();
      const result = await parseResponse<{ recipient: string }>(
        await fetch(`/api/marketing/campaigns/${campaign._id}/test`, {
          method: "POST",
        })
      );
      showStatus(
        "success",
        "Test email sent",
        `A test email was sent to ${result.recipient}.`
      );
      await refreshCampaigns().catch((historyError: unknown) => {
        showStatus(
          "error",
          "Test sent, but history did not refresh",
          historyError instanceof Error
            ? historyError.message
            : "Reload the page to see the updated campaign history."
        );
      });
    } catch (testError) {
      showStatus(
        "error",
        "Could not send test email",
        testError instanceof Error
          ? testError.message
          : "Could not send test email."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleSend() {
    if (audienceSize < 1) {
      showStatus(
        "error",
        "No campaign recipients",
        "There are no active, subscribed customers in this audience."
      );
      return;
    }
    setConfirmation({ type: "send" });
  }

  async function sendCampaign() {
    setBusy(true);
    let started = false;
    try {
      const campaign = await saveDraft();
      const result = await parseResponse<{ message: string }>(
        await fetch(`/api/marketing/campaigns/${campaign._id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduledAt: scheduleAt
              ? new Date(scheduleAt).toISOString()
              : undefined,
          }),
        })
      );
      showStatus("success", "Campaign started", result.message);
      started = true;
    } catch (sendError) {
      showStatus(
        "error",
        "Could not start campaign",
        sendError instanceof Error
          ? sendError.message
          : "Could not start campaign delivery."
      );
    } finally {
      setBusy(false);
    }
    if (started) {
      await refreshCampaigns().catch((historyError: unknown) => {
        showStatus(
          "error",
          "Campaign started, but history did not refresh",
          historyError instanceof Error
            ? historyError.message
            : "Reload the page to see the updated campaign status."
        );
      });
    } else {
      await refreshCampaigns().catch((historyError: unknown) => {
        console.error("Could not refresh campaign history after send failure:", historyError);
      });
    }
  }

  async function deleteCampaign(campaign: Campaign) {
    setBusy(true);
    try {
      await parseResponse<{ success: boolean }>(
        await fetch(`/api/marketing/campaigns/${campaign._id}`, {
          method: "DELETE",
        })
      );
      setCampaigns((previous) =>
        previous.filter((item) => item._id !== campaign._id)
      );
      if (editingId === campaign._id) {
        setShowEditor(false);
        setEditingId(null);
      }
      showStatus("success", "Campaign deleted", "The unsent campaign was deleted.");
    } catch (deleteError) {
      showStatus(
        "error",
        "Could not delete campaign",
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete campaign."
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction() {
    const action = confirmation;
    setConfirmation(null);
    if (!action) return;
    if (action.type === "send") {
      await sendCampaign();
    } else {
      await deleteCampaign(action.campaign);
    }
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;
    setUploadingImage(true);
    try {
      const imageUrl = await uploadMarketingImage(file);
      setContent((current) => ({ ...current, imageUrl }));
      showStatus("success", "Image uploaded", "Your promotional image is ready.");
    } catch (uploadError) {
      showStatus(
        "error",
        "Image upload failed",
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload the image."
      );
    } finally {
      setUploadingImage(false);
    }
  }

  function toggleListValue(
    values: string[],
    value: string,
    setValues: (values: string[]) => void
  ) {
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value]
    );
    setCustomerPage(1);
  }

  if (loading || !user || user.role !== "admin") {
    return null;
  }

  const previewHtml = renderMarketingEmail(
    {
      ...content,
      name: content.name || "Your campaign headline",
      message: content.message || "Your announcement message will appear here.",
    },
    "#unsubscribe"
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/admin"
            className="text-sm font-medium text-orange-700 hover:underline"
          >
            ← Admin dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900">
            Email Marketing
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Campaigns reach every active customer account except customers who have unsubscribed.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewCampaign}
          className="rounded-lg bg-orange-600 px-4 py-2.5 font-semibold text-white hover:bg-orange-500"
        >
          Create campaign
        </button>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Emails sent", statistics.sent],
          ["Delivered", statistics.delivered],
          ["Bounced", statistics.bounced],
          ["Failed", statistics.failed],
          ["Opened", statistics.opened],
          ["Clicked", statistics.clicked],
        ].map(([label, count]) => (
          <div key={label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{count}</p>
          </div>
        ))}
      </section>

      {showEditor && (
        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-neutral-900">
              {editingId ? "Edit campaign" : "New campaign draft"}
            </h2>
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-neutral-700">
                Campaign name
                <input
                  maxLength={120}
                  value={content.name}
                  onChange={(event) =>
                    setContent({ ...content, name: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                Email subject
                <input
                  maxLength={180}
                  value={content.subject}
                  onChange={(event) =>
                    setContent({ ...content, subject: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                />
              </label>
              <label className="block text-sm font-medium text-neutral-700">
                Message
                <textarea
                  rows={8}
                  maxLength={20000}
                  value={content.message}
                  onChange={(event) =>
                    setContent({ ...content, message: event.target.value })
                  }
                  placeholder="Write your announcement or promotion. Line breaks are preserved."
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Promotional image URL
                  <input
                    type="url"
                    value={content.imageUrl}
                    onChange={(event) =>
                      setContent({ ...content, imageUrl: event.target.value })
                    }
                    placeholder="https://..."
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Or upload an image from this device
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    disabled={uploadingImage || busy}
                    onChange={(event) => {
                      void handleImageUpload(event.currentTarget.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                    className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:font-semibold file:text-orange-700"
                  />
                  <span className="mt-1 block text-xs font-normal text-neutral-500">
                    JPG, PNG, GIF or WebP, up to 5 MB.
                  </span>
                  {uploadingImage && (
                    <span className="mt-1 block text-xs text-neutral-500">
                      Uploading image...
                    </span>
                  )}
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Image link (optional)
                  <input
                    type="url"
                    value={content.imageLink}
                    onChange={(event) =>
                      setContent({ ...content, imageLink: event.target.value })
                    }
                    placeholder="https://..."
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Button label (optional)
                  <input
                    maxLength={60}
                    value={content.ctaLabel}
                    onChange={(event) =>
                      setContent({ ...content, ctaLabel: event.target.value })
                    }
                    placeholder="Shop the offer"
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                  />
                </label>
                <label className="block text-sm font-medium text-neutral-700">
                  Button link (optional)
                  <input
                    type="url"
                    value={content.ctaUrl}
                    onChange={(event) =>
                      setContent({ ...content, ctaUrl: event.target.value })
                    }
                    placeholder="https://..."
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-neutral-700">
                Discount code or special offer (optional)
                <input
                  maxLength={80}
                  value={content.discountCode}
                  onChange={(event) =>
                    setContent({ ...content, discountCode: event.target.value })
                  }
                  placeholder="e.g. CITYBIKE10"
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                />
              </label>

              <fieldset className="rounded-xl border border-neutral-200 p-4">
                <legend className="px-1 text-sm font-semibold text-neutral-800">
                  Customer recipients
                </legend>
                <label className="block text-sm font-medium text-neutral-700">
                  Choose a customer audience
                  <select
                    value={audience.type}
                    onChange={(event) => {
                      setAudience({
                        ...EMPTY_AUDIENCE,
                        type: event.target.value as AudienceType,
                      });
                      setCustomerPage(1);
                    }}
                    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                  >
                    <option value="all_subscribers">All registered customers</option>
                    <option value="selected_customers">Specific customers</option>
                    <option value="locations">Customers in selected locations</option>
                    <option value="previous_customers">Customers with previous orders</option>
                  </select>
                </label>
                {audience.type === "locations" && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Countries
                      <select
                        multiple
                        size={5}
                        value={audience.countries}
                        onChange={(event) => {
                          const countries = Array.from(
                            event.currentTarget.selectedOptions,
                            (option) => option.value
                          );
                          setAudience({ ...audience, countries });
                          setCustomerPage(1);
                        }}
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                      >
                        {(audienceData?.countries || []).map((country) => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-neutral-700">
                      Cities
                      <select
                        multiple
                        size={5}
                        value={audience.cities}
                        onChange={(event) => {
                          const cities = Array.from(
                            event.currentTarget.selectedOptions,
                            (option) => option.value
                          );
                          setAudience({ ...audience, cities });
                          setCustomerPage(1);
                        }}
                        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                      >
                        {(audienceData?.cities || []).map((city) => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-neutral-500 sm:col-span-2">
                      Locations are based on saved order addresses. If both filters are selected, the same pickup or delivery address must match both.
                    </p>
                  </div>
                )}
                {audience.type !== "all_subscribers" && (
                  <div className="mt-3">
                    <input
                      type="search"
                      value={customerSearch}
                      onChange={(event) => {
                        setCustomerSearch(event.target.value);
                        setCustomerPage(1);
                      }}
                      placeholder="Search customers by name or email"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                    />
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-neutral-200">
                      {(audienceData?.customers || []).map((customer) => {
                        const checked = audience.type === "selected_customers"
                          ? audience.customerIds.includes(customer._id)
                          : false;
                        return (
                          <label
                            key={customer._id}
                            className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0"
                          >
                            {audience.type === "selected_customers" && (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  toggleListValue(
                                    audience.customerIds,
                                    customer._id,
                                    (customerIds) =>
                                      setAudience({ ...audience, customerIds })
                                  )
                                }
                              />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{customer.name}</span>
                              <span className="block truncate text-neutral-500">{customer.email}</span>
                            </span>
                          </label>
                        );
                      })}
                      {audienceData && audienceData.customers.length === 0 && (
                        <p className="p-3 text-sm text-neutral-500">
                          No active, subscribed customers match these filters.
                        </p>
                      )}
                    </div>
                    {audienceData && (
                      <div className="mt-2 flex items-center justify-between text-xs text-neutral-600">
                        <span>
                          {audience.type === "selected_customers"
                            ? `${audience.customerIds.length} selected`
                            : `${audienceData.total} matching customers`}
                        </span>
                        <span className="flex gap-2">
                          <button
                            type="button"
                            disabled={customerPage <= 1}
                            onClick={() => setCustomerPage((page) => page - 1)}
                            className="rounded border px-2 py-1 disabled:opacity-40"
                          >
                            Previous
                          </button>
                          <span className="py-1">
                            {customerPage} / {Math.max(1, Math.ceil(audienceData.total / audienceData.pageSize))}
                          </span>
                          <button
                            type="button"
                            disabled={customerPage * audienceData.pageSize >= audienceData.total}
                            onClick={() => setCustomerPage((page) => page + 1)}
                            className="rounded border px-2 py-1 disabled:opacity-40"
                          >
                            Next
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-3 text-sm font-semibold text-neutral-800">
                  Estimated recipients: {audienceSize.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Campaigns go to every active customer account except customers who have unsubscribed.
                </p>
              </fieldset>

              <label className="block text-sm font-medium text-neutral-700">
                Schedule for later (leave empty to send now)
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || uploadingImage}
                  onClick={() => void handleSaveDraft()}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-semibold text-neutral-800 disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy || uploadingImage}
                  onClick={() => void handleTestEmail()}
                  className="rounded-lg border border-neutral-300 px-4 py-2 font-semibold text-neutral-800 disabled:opacity-50"
                >
                  Send test email
                </button>
                <button
                  type="button"
                  disabled={busy || uploadingImage || audienceSize < 1}
                  onClick={() => void handleSend()}
                  className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Working..." : scheduleAt ? "Schedule campaign" : "Send campaign"}
                </button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-neutral-800">Email preview</h3>
              <iframe
                title="Campaign email preview"
                sandbox=""
                srcDoc={previewHtml}
                className="h-[720px] w-full rounded-xl border border-neutral-200 bg-neutral-100"
              />
            </div>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold text-neutral-900">Campaign history</h2>
        {loadingCampaigns ? (
          <p className="mt-4 text-sm text-neutral-500">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            No campaigns yet. Create a draft to get started.
          </p>
        ) : (
          <>
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <article
                key={campaign._id}
                className="rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-neutral-900">{campaign.name}</h3>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs capitalize text-neutral-700">
                        {campaign.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">Subject: {campaign.subject}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Created {new Date(campaign.createdAt).toLocaleString()}
                      {campaign.sentAt
                        ? ` · Sent ${new Date(campaign.sentAt).toLocaleString()}`
                        : campaign.scheduledAt
                          ? ` · Scheduled ${new Date(campaign.scheduledAt).toLocaleString()}`
                          : ""}
                    </p>
                  </div>
                  {(campaign.status === "draft" || campaign.status === "scheduled") && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void editCampaign(campaign._id)}
                        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setConfirmation({ type: "delete", campaign })
                        }
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
                  {[
                    ["Recipients", campaign.recipientCount],
                    ["Sent", campaign.sentCount],
                    ["Delivered", campaign.deliveredCount],
                    ["Bounced", campaign.bouncedCount],
                    ["Failed", campaign.failedCount],
                    ["Skipped", campaign.skippedCount],
                    ["Opened", campaign.openedCount],
                    ["Clicked", campaign.clickedCount],
                  ].map(([label, count]) => (
                    <div key={label} className="rounded-lg bg-neutral-50 px-3 py-2">
                      <p className="text-xs text-neutral-500">{label}</p>
                      <p className="font-semibold text-neutral-900">{count}</p>
                    </div>
                  ))}
                </div>
                {campaign.lastError && (
                  <p className="mt-3 text-sm text-red-700">
                    Latest delivery issue: {campaign.lastError}
                  </p>
                )}
              </article>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-neutral-600">
            <span>
              Showing {(historyPage - 1) * 50 + 1}–
              {Math.min(historyPage * 50, historyTotal)} of {historyTotal}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((page) => page - 1)}
                className="rounded-md border px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={historyPage * 50 >= historyTotal}
                onClick={() => setHistoryPage((page) => page + 1)}
                className="rounded-md border px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
          </>
        )}
      </section>
      <ConfirmModal
        open={confirmation !== null}
        title={
          confirmation?.type === "delete"
            ? "Delete this unsent campaign?"
            : scheduleAt
              ? "Schedule this campaign?"
              : "Send this campaign?"
        }
        message={
          confirmation?.type === "delete"
            ? `Delete “${confirmation.campaign.name}”? This cannot be undone.`
            : scheduleAt
              ? `Schedule “${content.name}” for ${new Date(scheduleAt).toLocaleString()} to approximately ${audienceSize.toLocaleString()} customers?`
              : `Send “${content.name}” now to approximately ${audienceSize.toLocaleString()} customers?`
        }
        confirmLabel={
          confirmation?.type === "delete"
            ? "Delete campaign"
            : scheduleAt
              ? "Schedule campaign"
              : "Send campaign"
        }
        destructive={confirmation?.type === "delete"}
        disabled={busy}
        onConfirm={() => void confirmAction()}
        onCancel={() => setConfirmation(null)}
      />
      <StatusModal
        state={statusModal}
        onClose={() => setStatusModal(CLOSED_MODAL)}
      />
    </main>
  );
}
