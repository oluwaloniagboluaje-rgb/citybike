"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquarePlus } from "lucide-react";

interface Review {
  _id: string;
  name: string;
  rating: number;
  text: string;
  createdAt: string;
}

function StarRating({
  rating,
  size = "h-4 w-4",
}: {
  rating: number;
  size?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${
            n <= rating ? "fill-orange-500 text-orange-500" : "text-neutral-300"
          }`}
        />
      ))}
    </div>
  );
}

function InteractiveStarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = hovered != null ? n <= hovered : n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
            className="p-0.5"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                filled ? "fill-orange-500 text-orange-500" : "text-neutral-300"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function fetchReviews() {
    const res = await fetch("/api/reviews");
    if (res.ok) {
      const data = await res.json();
      setReviews(data.reviews);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchReviews();
  }, []);

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }
    if (!text.trim()) {
      setError("Please write a short review.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rating, text: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not submit your review. Please try again.");
        return;
      }
      setSubmitted(true);
      setName("");
      setRating(0);
      setText("");
      fetchReviews();
      setTimeout(() => {
        setSubmitted(false);
        setShowForm(false);
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-16">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-neutral-900">
          What our customers say
        </h2>
        {reviews.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-neutral-600">
            <StarRating rating={Math.round(averageRating)} />
            <span>
              {averageRating.toFixed(1)} out of 5 ({reviews.length} review
              {reviews.length === 1 ? "" : "s"})
            </span>
          </div>
        )}
        <button
          onClick={() => setShowForm((s) => !s)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Write a Review
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-6 max-w-md rounded-lg border border-neutral-200 bg-white p-5"
        >
          {submitted ? (
            <p className="text-center text-sm font-medium text-green-700">
              Thanks for your review!
            </p>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Your name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Rating
                </label>
                <InteractiveStarInput value={rating} onChange={setRating} />
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Your review
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>

              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
            </>
          )}
        </form>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && (
          <p className="col-span-full text-center text-sm text-neutral-500">
            Loading reviews...
          </p>
        )}
        {!loading && reviews.length === 0 && (
          <p className="col-span-full text-center text-sm text-neutral-500">
            No reviews yet. Be the first to share your experience!
          </p>
        )}
        {reviews.map((r) => (
          <div
            key={r._id}
            className="rounded-lg border border-neutral-200 bg-white p-4"
          >
            <StarRating rating={r.rating} />
            <p className="mt-2 text-sm text-neutral-700">{r.text}</p>
            <p className="mt-3 text-xs font-medium text-neutral-500">
              {r.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}