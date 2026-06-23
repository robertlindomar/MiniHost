interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <section className="max-w-3xl">
      <h2 className="text-2xl font-semibold text-zinc-950 md:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600 md:text-base">{description}</p>
    </section>
  );
}
