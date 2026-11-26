import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0ea5e9, #10b981)",
          color: "white",
          fontSize: 110,
          fontWeight: 700,
          borderRadius: 0,
        }}
      >
        U
      </div>
    ),
    size,
  );
}
