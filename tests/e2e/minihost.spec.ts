import { expect, test } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { seedInitialData } from "../../prisma/seed-data";

loadEnvConfig(process.cwd());

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const prisma = hasDatabaseUrl ? new PrismaClient() : null;

const domainName = "e2e-minihost.dev";
const editedDomainName = "e2e-minihost-editado.dev";
const recordName = "app-e2e";
const editedRecordName = "api-e2e";

async function resetMiniHostDatabase() {
  if (!prisma) {
    return;
  }

  await prisma.auditLog.deleteMany();
  await prisma.dnsRecord.deleteMany();
  await prisma.domain.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.user.deleteMany();
  await seedInitialData(prisma);
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@minihost.local");
  await page.getByLabel("Senha").fill("admin123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("admin@minihost.local")).toBeVisible();
}

test.describe("MiniHost MVP com PostgreSQL e autenticação", () => {
  test.skip(!hasDatabaseUrl, "DATABASE_URL não configurado para testes E2E com PostgreSQL.");

  test.beforeEach(async () => {
    await resetMiniHostDatabase();
  });

  test.afterAll(async () => {
    await prisma?.$disconnect();
  });

  test("bloqueia painel sem login, autentica admin e sai da sessão", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);

    await page.getByLabel("Email").fill("admin@minihost.local");
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Email ou senha inválidos")).toBeVisible();

    const admin = await prisma?.user.findUnique({ where: { email: "admin@minihost.local" } });
    expect(admin?.passwordHash).toBeTruthy();
    expect(admin?.passwordHash).not.toBe("admin123");

    await page.getByLabel("Senha").fill("admin123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("admin@minihost.local")).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("dashboard abre e menu lateral navega pelas telas principais", async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total de domínios")).toBeVisible();
    await expect(page.getByText("Total de registros DNS")).toBeVisible();
    await expect(page.getByText("Registros com proxy ativo")).toBeVisible();
    await expect(page.getByText("Última alteração")).toBeVisible();
    await expect(page.getByText("Carregando dados do dashboard...")).toHaveCount(0, { timeout: 15_000 });

    const navigation = page.getByRole("navigation");

    await navigation.getByRole("link", { name: "Domínios" }).click();
    await expect(page).toHaveURL(/\/domains$/);
    await expect(page.getByRole("heading", { level: 1, name: "Domínios" })).toBeVisible();

    await navigation.getByRole("link", { name: "Registros DNS" }).click();
    await expect(page).toHaveURL(/\/records$/);
    await expect(page.getByRole("heading", { level: 1, name: "Registros DNS" })).toBeVisible();

    await navigation.getByRole("link", { name: "Histórico" }).click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole("heading", { level: 1, name: "Histórico" })).toBeVisible();

    await navigation.getByRole("link", { name: "Configurações" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  });

  test("domínios lista, cria, edita, exclui e registra histórico", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/domains");

    await expect(page.getByText("robertlindomar.dev")).toBeVisible();

    await page.getByRole("button", { name: "Novo domínio" }).click();
    await page.getByLabel("Nome do domínio").fill(domainName);
    await page.getByLabel("Provedor").fill("Cloudflare");
    await page.getByLabel("Zone ID fake/opcional").fill("fake-zone-e2e");
    await page.getByRole("button", { name: "Criar domínio" }).click();

    await expect(page.getByText("Domínio criado com sucesso.")).toBeVisible();
    await expect(page.getByText(domainName)).toBeVisible();

    const createdRow = page.getByRole("row").filter({ hasText: domainName });
    await createdRow.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Nome do domínio").fill(editedDomainName);
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Domínio editado com sucesso.")).toBeVisible();
    await expect(page.getByText(editedDomainName)).toBeVisible();

    const editedRow = page.getByRole("row").filter({ hasText: editedDomainName });
    await editedRow.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByRole("dialog")).toContainText(`Deseja excluir ${editedDomainName}`);
    await page.getByRole("button", { name: "Excluir" }).last().click();

    await expect(page.getByText("Domínio excluído com sucesso.")).toBeVisible();
    await expect(page.getByText(editedDomainName)).toHaveCount(0);

    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Domínio criado" }).filter({ hasText: domainName })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Domínio editado" }).filter({ hasText: editedDomainName })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Domínio excluído" }).filter({ hasText: editedDomainName })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Domínio criado" }).filter({ hasText: "admin@minihost.local" })).toBeVisible();
  });

  test("registros DNS lista, cria, edita, exclui e alerta registros sensíveis", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/records");

    await expect(page.getByRole("row").filter({ hasText: "A" }).filter({ hasText: "@" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "CNAME" }).filter({ hasText: "www" })).toBeVisible();

    await page.getByRole("button", { name: "Sincronizar com Cloudflare" }).click();
    await expect(
      page.getByText(/Não foi possível sincronizar|Token da Cloudflare|Zone ID inválido|Permissão insuficiente/)
    ).toBeVisible();

    await page.getByRole("button", { name: "Novo registro DNS" }).click();
    await page.getByLabel("Tipo do registro").selectOption("A");
    await page.getByLabel("Nome/subdomínio").fill(recordName);
    await page.getByLabel("Valor/conteúdo").fill("72.60.250.40");
    await page.getByRole("button", { name: "Criar registro" }).click();

    await expect(page.getByText("Registro DNS criado com sucesso.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: recordName })).toBeVisible();

    const createdRecordRow = page.getByRole("row").filter({ hasText: recordName });
    await createdRecordRow.getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Nome/subdomínio").fill(editedRecordName);
    await page.getByLabel("Valor/conteúdo").fill("72.60.250.41");
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page.getByText("Registro DNS editado com sucesso.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: editedRecordName })).toBeVisible();

    const editedRecordRow = page.getByRole("row").filter({ hasText: editedRecordName });
    await editedRecordRow.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByRole("dialog")).toContainText(`Deseja excluir A ${editedRecordName}`);
    await page.getByRole("button", { name: "Excluir" }).last().click();

    await expect(page.getByText("Registro DNS excluído com sucesso.")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: editedRecordName })).toHaveCount(0);

    const sensitiveRow = page.getByRole("row").filter({ hasText: "CNAME" }).filter({ hasText: "www" });
    await sensitiveRow.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByRole("dialog")).toContainText("Este registro parece sensível");
    await page.getByRole("button", { name: "Cancelar" }).click();

    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page.getByRole("row").filter({ hasText: "Registro criado" }).filter({ hasText: recordName })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Registro editado" }).filter({ hasText: editedRecordName })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Registro excluído" }).filter({ hasText: editedRecordName })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Registro criado" }).filter({ hasText: "admin@minihost.local" })).toBeVisible();
  });

  test("configurações salvam no banco", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/settings");

    await page.getByLabel("Cloudflare API Token").fill("fake-token-db");
    await page.getByLabel("Zone ID padrão").fill("fake-zone-default");
    await page.getByLabel("Domínio padrão").fill("robertlindomar.dev");
    await page.getByLabel("IP padrão da VPS").fill("72.60.250.39");
    await page.getByLabel("Proxy Cloudflare padrão").uncheck();
    await page.getByRole("button", { name: "Salvar configurações" }).click();

    await expect(page.getByText("Configurações salvas com sucesso.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Cloudflare API Token")).toHaveValue("fake-token-db");
    await expect(page.getByLabel("Zone ID padrão")).toHaveValue("fake-zone-default");
    await expect(page.getByLabel("Proxy Cloudflare padrão")).not.toBeChecked();

    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(page.getByText("Configurações salvas")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Configurações salvas" }).filter({ hasText: "admin@minihost.local" })).toBeVisible();
  });
});
