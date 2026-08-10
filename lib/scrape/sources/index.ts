import type { Source } from "../types";
import { auto24 } from "./auto24";
import { autobazar } from "./autobazar";
import { autogidas } from "./autogidas";
import { autoplius } from "./autoplius";
import { bazos } from "./bazos";
import { kleinanzeigen } from "./kleinanzeigen";
import { marktplaats } from "./marktplaats";
import { nettiauto } from "./nettiauto";
import { otomoto } from "./otomoto";
import { sslv } from "./sslv";
import { subito } from "./subito";

// autoplius/auto24/autogidas/subito go through Bright Data and quietly
// no-op without the key.
export const SOURCES: Source[] = [
  sslv, otomoto, kleinanzeigen, bazos, nettiauto, autobazar, marktplaats,
  autoplius, auto24, autogidas, subito,
];
