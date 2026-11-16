import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-5xl" aria-hidden>🥏</p>
      <h1 className="mt-4 text-2xl font-black text-white">Out of bounds</h1>
      <p className="mt-2 text-sm text-white/60">That page doesn&apos;t exist. Take your one-stroke penalty and head back to the tee.</p>
      <Link href="/" className="mt-6 rounded-lg bg-[#36D7B7] px-5 py-2 text-sm font-bold text-[#0f1117] transition hover:bg-[#2ec2a6]">
        Back to the tee
      </Link>
    </main>
  );
}
