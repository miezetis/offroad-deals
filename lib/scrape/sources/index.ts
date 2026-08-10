import type { Source } from "../types";
import { autobazar } from "./autobazar";
import { bazos } from "./bazos";
import { kleinanzeigen } from "./kleinanzeigen";
import { nettiauto } from "./nettiauto";
import { otomoto } from "./otomoto";
import { sslv } from "./sslv";

export const SOURCES: Source[] = [sslv, otomoto, kleinanzeigen, bazos, nettiauto, autobazar];
