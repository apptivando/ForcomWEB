// Passthrough — el proxy.ts maneja la auth, el sidebar vive en (panel)/layout.tsx
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
