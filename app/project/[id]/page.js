import { redirect } from "next/navigation";

export default async function ProjectIndex({ params }) {
  const { id } = await params;
  redirect(`/project/${id}/info`);
}
