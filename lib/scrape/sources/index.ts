import type { Source } from "../types";
import { auto24 } from "./auto24";
import { autobazar } from "./autobazar";
import { autogidas } from "./autogidas";
import { autoplius } from "./autoplius";
import { bazos } from "./bazos";
import { kleinanzeigen } from "./kleinanzeigen";
import { nettiauto } from "./nettiauto";
import { otomoto } from "./otomoto";
import { sslv } from "./sslv";

// The last three go through Bright Data and quietly no-op without the key.
export const SOURCES: Source[] = [
  sslv, otomoto, kleinanzeigen, bazos, nettiauto, autobazar,
  autoplius, auto24, autogidas,
];
