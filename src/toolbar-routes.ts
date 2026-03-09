import { FiBookOpen, FiHome } from "solid-icons/fi";
import { ToolbarRoute } from "~/models/toolbar-route";

export default function toolbarRoutes(): ToolbarRoute[] {
  return [
    { label: "Flashcards", path: "/flashcards", icon: FiBookOpen }
  ];
}
