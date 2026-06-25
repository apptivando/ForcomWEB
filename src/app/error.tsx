"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D0D0F] text-white gap-4">
      <h2 className="text-2xl font-bold">Algo salió mal</h2>
      <p className="text-[#8A8A8A] text-sm">{error.digest}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#E8231A] text-white rounded-sm text-sm"
      >
        Reintentar
      </button>
    </div>
  );
}
