export function BrandIconMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#22201c",
        color: "#faf8f3",
        fontFamily: "Georgia, serif",
        fontWeight: 600,
        fontSize: Math.round(size * 0.42),
        letterSpacing: -Math.round(size * 0.02),
      }}
    >
      CL
    </div>
  );
}
