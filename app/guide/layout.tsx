import Navbar from "@/components/Navbar";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar />
      {children}
    </div>
  );
}
