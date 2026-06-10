"use client";

import { useParams } from "next/navigation";
import { RecipeEditor } from "@/components/recetas/recipe-editor";

export default function EditarRecetaPage() {
  const { id } = useParams<{ id: string }>();
  return <RecipeEditor recipeId={id} />;
}
