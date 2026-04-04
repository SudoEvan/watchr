import { useState } from "react";
import { Star } from "lucide-react";

interface Props {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: number;
}

export default function StarRating({ value, onChange, readonly = false, size = 20 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const halfValue = star - 0.5;
        return (
          <div
            key={star}
            className="relative"
            style={{ width: size, height: size, cursor: readonly ? "default" : "pointer" }}
            onMouseLeave={() => !readonly && setHover(null)}
          >
            {/* Left half — half star */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: "50%" }}
              onMouseEnter={() => !readonly && setHover(halfValue)}
              onClick={() => !readonly && onChange?.(halfValue)}
            >
              <Star
                size={size}
                fill={display >= halfValue ? "var(--accent-primary)" : "none"}
                stroke={display >= halfValue ? "var(--accent-primary)" : "var(--text-secondary)"}
                strokeWidth={1.5}
              />
            </div>
            {/* Right half — full star */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ left: "50%", width: "50%" }}
              onMouseEnter={() => !readonly && setHover(star)}
              onClick={() => !readonly && onChange?.(star)}
            >
              <Star
                size={size}
                fill={display >= star ? "var(--accent-primary)" : "none"}
                stroke={display >= star ? "var(--accent-primary)" : "var(--text-secondary)"}
                strokeWidth={1.5}
                style={{ marginLeft: -(size / 2) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
