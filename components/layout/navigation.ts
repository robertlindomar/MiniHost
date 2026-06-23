import {
  FolderKanban,
  Globe2,
  History,
  Layers3,
  LayoutDashboard,
  ListTree,
  Settings,
  type LucideIcon
} from "lucide-react";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navigation: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domínios", icon: Globe2 },
  { href: "/projects", label: "Projetos", icon: FolderKanban },
  { href: "/records", label: "Registros DNS", icon: ListTree },
  { href: "/templates", label: "Templates DNS", icon: Layers3 },
  { href: "/history", label: "Histórico", icon: History },
  { href: "/settings", label: "Configurações", icon: Settings }
];

export interface PageMeta {
  title: string;
  description?: string;
}

export const pageMetaByHref: Record<string, PageMeta> = {
  "/dashboard": {
    title: "Visão geral",
    description: "Acompanhe domínios, registros DNS e atividade recente da plataforma."
  },
  "/domains": {
    title: "Domínios cadastrados",
    description: "Gerencie os domínios conectados à MiniHost e sincronizados com a Cloudflare."
  },
  "/projects": {
    title: "Projetos",
    description: "Organize registros DNS relacionados a um mesmo sistema ou aplicação."
  },
  "/records": {
    title: "Registros DNS",
    description: "Gerencie todos os registros DNS do seu domínio."
  },
  "/templates": {
    title: "Templates DNS",
    description: "Crie registros comuns rapidamente usando modelos prontos."
  },
  "/history": {
    title: "Histórico",
    description: "Acompanhe todas as ações realizadas na plataforma."
  },
  "/settings": {
    title: "Configurações",
    description: "Gerencie integrações, padrões e preferências do sistema."
  }
};

export function getActiveNavigationItem(pathname: string) {
  if (pathname === "/") {
    return navigation[0];
  }

  return navigation.find((item) => pathname.startsWith(item.href)) ?? navigation[0];
}

export function getPageMeta(pathname: string): PageMeta {
  if (pathname.startsWith("/projects/") && pathname !== "/projects") {
    return {
      title: "Detalhes do projeto",
      description: "Visualize informações, registros DNS vinculados e ações rápidas do projeto."
    };
  }

  const activeItem = getActiveNavigationItem(pathname);
  return pageMetaByHref[activeItem.href] ?? pageMetaByHref["/dashboard"];
}

export const APP_VERSION = "v1.0.0";
