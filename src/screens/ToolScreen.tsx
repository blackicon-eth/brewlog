import React from "react";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import { TOOLS_BY_ID } from "./tools/registry";

type Rt = RouteProp<RootStackParamList, "Tool">;

// Single navigator target for all tools. Resolves the tapped card's id to its module and
// renders that module's dedicated page. Adding a tool never touches the navigator — only the
// registry.
export function ToolScreen() {
  const { params } = useRoute<Rt>();
  const Screen = TOOLS_BY_ID[params.toolId].Screen;
  return <Screen />;
}
