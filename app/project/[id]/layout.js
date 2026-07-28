import WorkspaceShell from "./WorkspaceShell";

export default async function ProjectLayout({ children, params }) {
  const { id } = await params;
  return <WorkspaceShell projectId={id}>{children}</WorkspaceShell>;
}
