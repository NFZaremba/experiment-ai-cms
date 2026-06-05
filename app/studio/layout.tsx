import { isStudioAuthed } from "@/lib/studio/auth";
import { StudioLogin } from "@/components/studio/StudioLogin";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isStudioAuthed();
  if (!authed) return <StudioLogin />;
  return <>{children}</>;
}
