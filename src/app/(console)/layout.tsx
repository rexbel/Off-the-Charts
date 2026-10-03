import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { DemoProvider } from "@/components/demo/demo-provider";
import { currentUser } from "@/lib/auth";
import { currentNamespace, demoEnabled } from "@/lib/namespace";
import { modelAvailable, providerName } from "@/lib/ai/provider";

/** Every console page needs a signed-in staff user. Patient check-in and login live outside this group. */
export default async function ConsoleLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const namespace = await currentNamespace();
  return (
    <DemoProvider enabled={demoEnabled()}>
      <AppShell user={user} namespace={namespace} demoEnabled={demoEnabled()} modelAvailable={modelAvailable()} provider={providerName()}>
        {children}
      </AppShell>
    </DemoProvider>
  );
}
