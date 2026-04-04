import { useState } from "react";
import { X } from "lucide-react";
import StarRating from "./StarRating";

interface Props {
  title: string;
  onSubmit: (rating: number) => void;
  onSkip: () => void;
}

export default function RatingModal({ title, onSubmit, onSkip }: Props) {
  const [rating, setRating] = useState(0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onSkip()}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl"
        style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Rate this title
          </h2>
          <button
            onClick={onSkip}
            className="rounded-lg p-1.5 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <p className="text-center text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            How would you rate <strong>{title}</strong>?
          </p>
          <StarRating value={rating} onChange={setRating} size={32} />
          {rating > 0 && (
            <span className="text-sm font-medium" style={{ color: "var(--accent-primary)" }}>
              {rating} / 5
            </span>
          )}
          <div className="flex w-full gap-2">
            <button
              onClick={onSkip}
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Skip
            </button>
            <button
              onClick={() => rating > 0 && onSubmit(rating)}
              disabled={rating === 0}
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "var(--accent-primary)" }}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
