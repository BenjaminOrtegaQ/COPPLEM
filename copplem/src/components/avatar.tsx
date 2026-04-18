// src/components/avatar.tsx
import React from "react";

type Props = {
  name: string;
  avatarUrl?: string | null;
  bgColor?: string | null;
  size?: number;
  radius?: number;
  className?: string;
};

const DEFAULT_BG = "#ffe8da";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join("");
}

function textColorForBg(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const L = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
  return L > 0.6 ? "#1f2937" : "#ffffff";
}

export function Avatar({
  name,
  avatarUrl,
  bgColor,
  size = 28,
  radius = 8,
  className,
}: Props) {
  const bg = avatarUrl ? undefined : (bgColor ?? DEFAULT_BG);
  return (
    <div
      className={`avatar ${className || ""}`}
      title={`Icono de ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        color: bg ? textColorForBg(bg) : undefined,
        display: "inline-grid",
        placeItems: "center",
        overflow: "hidden",
        fontWeight: 700,
        lineHeight: 1,
        verticalAlign: "middle",
        flex: `0 0 ${size}px`,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <span style={{ lineHeight: 1 }}>{initials(name)}</span>
      )}
    </div>
  );
}