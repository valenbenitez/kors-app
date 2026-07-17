export type PdfTip = {
  emoji: string;
  title: string;
  body: string;
};

export type PdfGastro = {
  emoji: string;
  name: string;
  body: string;
  mapsQuery: string;
};

export type PdfUpsell = {
  emoji: string;
  title: string;
  body: string;
  priceUsd: number;
  badge: string;
};

export type PdfPacking = {
  emoji: string;
  title: string;
  body: string;
};

export type PdfClimate = {
  season: string;
  range: string;
  body: string;
};

export type PdfMap = {
  summary: string;
  lat: number;
  lng: number;
  pinLabel: string;
};

export type PdfDestinationCopy = {
  locationLabel: string;
  defaultTags: Array<{ emoji: string; label: string; accent?: boolean }>;
  guideSubtitle: (ctx: { perfil: string; seasonHint: string }) => string;
  excludes: string[];
  hotelHighlights: string[];
  upsells: PdfUpsell[];
  tips: PdfTip[];
  gastro: PdfGastro[];
  climate: PdfClimate;
  packingTitle: string;
  packing: PdfPacking[];
  map: PdfMap;
};
