import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size?: number;
  label?: string;
}

/** Render a scannable QR code for the given URL/value. */
export function QrCode({ value, size = 160, label }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: "M" })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not generate QR code.");
      });
    return () => { cancelled = true; };
  }, [value, size]);

  if (error) {
    return <p className="form-error" style={{ maxWidth: size }}>{error}</p>;
  }

  return (
    <figure className="qr-code" style={{ display: "inline-flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
      {src ? (
        <img
          src={src}
          alt={`QR code for ${value}`}
          width={size}
          height={size}
          style={{ display: "block", borderRadius: "0.5rem" }}
        />
      ) : (
        <span className="simple-note">טוען QR…</span>
      )}
      {label ? <figcaption className="simple-note">{label}</figcaption> : null}
    </figure>
  );
}
