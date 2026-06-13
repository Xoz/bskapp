import Navbar from "@/components/Navbar";

export default function RapporteraLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar />
      {children}
    </div>
  );
}
