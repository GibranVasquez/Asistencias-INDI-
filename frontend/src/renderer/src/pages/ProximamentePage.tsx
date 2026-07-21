export default function ProximamentePage({ titulo }: { titulo: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 40,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{titulo}</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", maxWidth: 360 }}>
        Esta pantalla todavía no está construida en esta versión.
      </p>
    </div>
  );
}
