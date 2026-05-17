export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[2rem] bg-white p-5 shadow-soft md:p-6 ${className}`}>{children}</section>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-black text-navy md:text-2xl">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-navy/65">{subtitle}</p>}
    </div>
  );
}
