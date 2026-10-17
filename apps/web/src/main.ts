import { boot } from "@gabarito/app";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

boot({ root });
